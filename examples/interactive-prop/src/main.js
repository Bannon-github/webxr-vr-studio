import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  applyActivityVisual,
  activityState,
  createResetPlate,
  createStatePlaque,
  createToolbox,
  resetToolbox,
  restPose,
  setColliderDebug,
  setToolboxLod,
  toolIsHeldOrOut,
  tryReturnTool,
  updateStatePlaque,
  updateToolboxLod,
} from "./toolbox.js";
import {
  beginGrab,
  collectPickables,
  clearAllHovers,
  dispatchDrive,
  dispatchUse,
  endGrab,
  firstHit,
  isPinching,
  pinchReleased,
  playFeedback,
  playTick,
  pulseHaptic,
  rayFromController,
  rayFromNdc,
  resumeAudio,
  sampleHeldPose,
  setHover,
  stepKinematics,
} from "./interaction.js";
import {
  initQuest3Diagnostics,
  isQuest3DiagnosticsEnabled,
  recordQuest3FfrSet,
  recordQuest3Session,
  recordQuest3SessionEnd,
  sampleQuest3Diagnostics,
  toggleQuest3Diagnostics,
} from "./quest3-diagnostics.js";

/**
 * Interactive crate demo — visual mesh ≠ collider ≠ activity.
 * APIs: MDN WebXR (select/squeeze, targetRaySpace/gripSpace, optional XRHand)
 * plus Three.js WebXRManager helpers. No invented session methods.
 */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 50);
camera.position.set(0, 1.5, 0.85);
camera.lookAt(0, 1.0, -0.55);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const sessionInit = { optionalFeatures: ["hand-tracking", "local-floor"] };
document.body.appendChild(VRButton.createButton(renderer, sessionInit));

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xf0e6d4, 0x2a1c12, 0.55));
const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
sun.position.set(2.2, 4.4, 1.4);
scene.add(sun);

const table = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 0.08, 0.7),
  new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.82, metalness: 0.04 })
);
table.position.set(0, 0.86, -0.55);
scene.add(table);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.95, metalness: 0.02 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.GridHelper(8, 16, 0x3a3228, 0x241e18));

const toolbox = createToolbox();
restPose(toolbox);
toolbox.userData.homeParent = scene;
scene.add(toolbox);

const resetPlate = createResetPlate();
resetPlate.position.set(-0.42, 0.9, -0.42);
scene.add(resetPlate);

const plaque = createStatePlaque();
scene.add(plaque);

const entities = [toolbox, resetPlate];
const movable = [toolbox, toolbox.userData.parts.tool];

let colliderDebug = false;
let lastState = activityState(toolbox);
let lastFastenerKey = "";
function refreshPlaque() {
  const f = toolbox.userData.fastener;
  const key = `${activityState(toolbox)}:${f?.turns}:${f?.seated}`;
  if (key === lastFastenerKey) return;
  lastFastenerKey = key;
  lastState = activityState(toolbox);
  updateStatePlaque(plaque, lastState, f);
}
refreshPlaque();
const lodStatus = document.getElementById("lod-status");
let lastLodKey = "";

function refreshLodStatus() {
  const lod = toolbox.userData.lod;
  if (!lod || !lodStatus) return;
  const key = `${lod.mode}:${lod.current}`;
  if (key === lastLodKey) return;
  lastLodKey = key;
  const stats = lod.stats[lod.current];
  lodStatus.textContent = `${lod.mode} / ${lod.current} · ${stats.tris} tris · ${stats.draws} draws`;
}
refreshLodStatus();
console.info("[crate-toolbox] LOD geometry stats (not Quest frame time)", toolbox.userData.lod.stats);

const quest3Panel = document.getElementById("quest3-diag");
initQuest3Diagnostics({
  panel: quest3Panel,
  renderer,
  getToolbox: () => toolbox,
});
document.getElementById("quest3-diag-btn")?.addEventListener("click", () => {
  toggleQuest3Diagnostics();
});

const controllerModelFactory = new XRControllerModelFactory();
const handModelFactory = new XRHandModelFactory();

function buildRayLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ad1ff }));
  line.name = "ray";
  line.scale.z = 1.6;
  return line;
}

function setupController(index) {
  const controller = renderer.xr.getController(index);
  controller.userData.kind = "controller";
  controller.addEventListener("selectstart", () => onUse(controller));
  controller.addEventListener("squeezestart", () => onGrabStart(controller, renderer.xr.getControllerGrip(index)));
  controller.addEventListener("squeezeend", () => onGrabEnd(controller));
  controller.addEventListener("connected", (event) => {
    controller.userData.inputSource = event.data;
    if (!controller.getObjectByName("ray")) controller.add(buildRayLine());
  });
  controller.addEventListener("disconnected", () => {
    controller.userData.inputSource = null;
    const ray = controller.getObjectByName("ray");
    if (ray) controller.remove(ray);
  });
  scene.add(controller);

  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  const hand = renderer.xr.getHand(index);
  hand.userData.kind = "hand";
  hand.userData.pinching = false;
  hand.add(handModelFactory.createHandModel(hand, "mesh"));
  scene.add(hand);

  return { controller, grip, hand };
}

const pairs = [setupController(0), setupController(1)];

function pickables() {
  return collectPickables(entities);
}

function hoverFromRay(raycaster) {
  const hit = firstHit(raycaster, pickables());
  clearAllHovers(entities);
  if (!hit) return null;
  const entity = hit.object.userData.entity;
  const changed = setHover(entity, hit.object.name);
  if (changed) playFeedback(entity, "hoverEnter", null);
  return hit;
}

function onUse(controller) {
  resumeAudio();
  const hit = firstHit(rayFromController(controller), pickables());
  const src = controller.userData.inputSource;
  const tool = toolbox.userData.parts.tool;
  if (controller.userData.held === tool) {
    if (hit?.object.name === "collider_fastener") dispatchDrive(toolbox, src);
    else playFeedback(toolbox, "nack", src);
    return;
  }
  if (!hit) return;
  if (hit.object.name === "collider_fastener") {
    if (toolIsHeldOrOut(tool, toolbox)) dispatchDrive(toolbox, src);
    else playFeedback(toolbox, "nack", src);
    return;
  }
  const result = dispatchUse(hit.object.userData.entity, hit.object.name, src);
  if (result.reset) resetAll();
}

function grabTargetFromHit(hit, grip) {
  if (!hit) return null;
  const entity = hit.object.userData.entity;
  if (hit.object.name === "collider_tool") {
    if (hit.object.userData.pickable === false) return null;
    return entity.userData.parts.tool;
  }
  if (hit.object.name === "collider_grab") {
    const near = grip?.getWorldPosition(new THREE.Vector3()) ?? null;
    const cfg = entity.userData.studio?.components?.grabbable;
    if (near && cfg?.nearMeters) {
      const dist = near.distanceTo(hit.point);
      if (dist > cfg.nearMeters + 0.6) {
        // Far ray-grab of the crate is allowed so seated users can pull it closer.
      }
    }
    return entity;
  }
  return null;
}

function onGrabStart(controller, grip) {
  resumeAudio();
  const hit = firstHit(rayFromController(controller), pickables());
  const target = grabTargetFromHit(hit, grip);
  if (!target) {
    playTick("nack");
    pulseHaptic(controller.userData.inputSource, 0.2, 25);
    return;
  }
  const holder = grip || controller;
  beginGrab(target, holder, controller.userData.inputSource);
  controller.userData.held = target;
}

function onGrabEnd(controller) {
  const held = controller.userData.held;
  if (!held) return;
  endGrab(held, scene, toolbox);
  controller.userData.held = null;
}

function resetAll() {
  resetToolbox(toolbox, table.position.y + 0.04);
  lastFastenerKey = "";
  refreshPlaque();
  setAction("reset");
}

// Desktop pointer stand-in (same intents; not a WebXR API).
const pointer = { x: 0, y: 0, down: false, dragging: null, offset: new THREE.Vector3() };
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -table.position.y - 0.04);
const planeHit = new THREE.Vector3();

renderer.domElement.addEventListener("pointermove", (e) => {
  if (renderer.xr.isPresenting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  const ray = rayFromNdc(camera, pointer.x, pointer.y);
  if (pointer.dragging) {
    if (ray.ray.intersectPlane(plane, planeHit)) {
      pointer.dragging.position.set(
        planeHit.x + pointer.offset.x,
        table.position.y + 0.04,
        planeHit.z + pointer.offset.z
      );
      const v = pointer.dragging.userData.velocity;
      if (v) v.set(0, 0, 0);
    }
    return;
  }
  hoverFromRay(ray);
});

const actionStatus = document.getElementById("action-status");
function setAction(msg) {
  if (actionStatus) actionStatus.textContent = msg;
}

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (renderer.xr.isPresenting) return;
  resumeAudio();
  pointer.down = true;
  const ray = rayFromNdc(camera, pointer.x, pointer.y);
  const hit = firstHit(ray, pickables());
  if (!hit) return;
  if (hit.object.name === "collider_fastener") {
    const tool = toolbox.userData.parts.tool;
    if (toolIsHeldOrOut(tool, toolbox) || pointer.dragging === tool) {
      const r = dispatchDrive(toolbox, null);
      setAction(r.ok ? (r.seated ? "fastener seated" : `drive ${r.turns}/${r.needed}`) : "drive nack");
    } else {
      playFeedback(toolbox, "nack", null);
      setAction("nack — extract the tool first");
    }
    return;
  }
  if (hit.object.userData.layer === "use") {
    const result = dispatchUse(hit.object.userData.entity, hit.object.name, null);
    if (result.reset) resetAll();
    else if (result.ok) setAction(`${result.from} → ${result.to}`);
    else setAction(`nack — ${result.from || "wrong state"}`);
    return;
  }
  const target = grabTargetFromHit(hit, null);
  if (target) {
    if (target.parent !== scene) scene.attach(target);
    pointer.dragging = target;
    target.userData.heldBy = "desktop";
    pointer.offset.set(target.position.x - hit.point.x, 0, target.position.z - hit.point.z);
  }
});

window.addEventListener("pointerup", () => {
  if (pointer.dragging) {
    const dragged = pointer.dragging;
    dragged.userData.heldBy = null;
    if (dragged === toolbox.userData.parts.tool) {
      if (tryReturnTool(dragged, toolbox)) {
        playFeedback(toolbox, "return", null);
        setAction("tool returned");
      } else {
        dragged.userData.extracted = true;
        setAction("tool extracted — F drives, T returns");
      }
    }
  }
  pointer.down = false;
  pointer.dragging = null;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "c" || e.key === "C") {
    colliderDebug = !colliderDebug;
    setColliderDebug(entities, colliderDebug);
  }
  if (e.key === "r" || e.key === "R") resetAll();
  if (e.key === "e" || e.key === "E") {
    const tool = toolbox.userData.parts.tool;
    if (activityState(toolbox) === "open" && tool.parent === toolbox) {
      scene.attach(tool);
      tool.position.set(0.32, table.position.y + 0.05, -0.35);
      tool.rotation.set(0, 0, 0);
      tool.userData.heldBy = null;
      tool.userData.extracted = true;
      if (tool.userData.velocity) tool.userData.velocity.set(0, 0, 0);
      playFeedback(toolbox, "grab", null);
      setAction("tool extracted — F drives, T returns");
    } else {
      playFeedback(toolbox, "nack", null);
      setAction("nack — cannot extract (need open, tool in tray)");
    }
  }
  if (e.key === "f" || e.key === "F") {
    const tool = toolbox.userData.parts.tool;
    if (toolIsHeldOrOut(tool, toolbox)) {
      const r = dispatchDrive(toolbox, null);
      setAction(r.ok ? (r.seated ? "fastener seated" : `drive ${r.turns}/${r.needed}`) : "drive nack");
    } else {
      playFeedback(toolbox, "nack", null);
      setAction("nack — extract the tool first");
    }
  }
  if (e.key === "t" || e.key === "T") {
    const tool = toolbox.userData.parts.tool;
    if (tryReturnTool(tool, toolbox, { force: true })) {
      playFeedback(toolbox, "return", null);
      setAction("tool returned");
    } else {
      playFeedback(toolbox, "nack", null);
      setAction("nack — crate must be open to return");
    }
  }
  if (e.key === "0") {
    toolbox.userData.lod.mode = "auto";
  }
  if (e.key === "1" || e.key === "2" || e.key === "3") {
    toolbox.userData.lod.mode = "force";
    setToolboxLod(toolbox, Number(e.key) - 1);
  }
  if (e.key === "p" || e.key === "P") toggleQuest3Diagnostics();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * Quest 3 Browser defaults: 90 Hz if the UA lists it (else 72), FFR medium-high.
 * Real APIs only — XRSession.supportedFrameRates / updateTargetFrameRate (MDN),
 * XRWebGLLayer.fixedFoveation via Three WebXRManager.setFoveation.
 * Do not require 120 / 207 / 240 Hz.
 */
function applyQuest3SessionDefaults(session) {
  if (!session) return;
  const rates = session.supportedFrameRates ? Array.from(session.supportedFrameRates) : [];
  const hz = rates.includes(90) ? 90 : rates.includes(72) ? 72 : null;
  recordQuest3Session(session, hz, false);
  if (hz && typeof session.updateTargetFrameRate === "function") {
    session.updateTargetFrameRate(hz).then(
      () => {
        recordQuest3Session(session, hz, true);
        console.info("[interactive-prop] target frameRate", hz, "supported:", rates);
      },
      () => {
        recordQuest3Session(session, hz, false);
        console.info("[interactive-prop] updateTargetFrameRate rejected; UA default. supported:", rates);
      }
    );
  } else {
    console.info("[interactive-prop] frame-rate API unavailable; UA default. supported:", rates);
  }
  if (typeof renderer.xr.setFoveation === "function") {
    renderer.xr.setFoveation(0.75);
    recordQuest3FfrSet(0.75);
  }
}

renderer.xr.addEventListener("sessionstart", () => {
  resumeAudio();
  applyQuest3SessionDefaults(renderer.xr.getSession());
});
renderer.xr.addEventListener("sessionend", () => {
  recordQuest3SessionEnd();
});

const clock = new THREE.Clock();

function updateHands() {
  for (const { hand } of pairs) {
    if (!hand.visible && hand.children.length === 0) continue;
    const pinching = isPinching(hand);
    if (pinching && !hand.userData.pinching) {
      hand.userData.pinching = true;
      const tip = hand.joints?.["index-finger-tip"];
      if (!tip) continue;
      const ray = rayFromController(hand);
      const hit = firstHit(ray, pickables()) || nearestColliderTo(tip);
      if (!hit) continue;
      if (hit.object.name === "collider_fastener") {
        const tool = toolbox.userData.parts.tool;
        if (toolIsHeldOrOut(tool, toolbox) || hand.userData.held === tool) dispatchDrive(toolbox, null);
        else playFeedback(toolbox, "nack", null);
      } else if (hit.object.userData.layer === "use") {
        const result = dispatchUse(hit.object.userData.entity, hit.object.name, null);
        if (result.reset) resetAll();
      } else {
        const target = grabTargetFromHit(hit, hand);
        if (target) {
          const wrist = hand.joints?.["wrist"] || hand;
          beginGrab(target, wrist, null);
          hand.userData.held = target;
        }
      }
    } else if (!pinching && hand.userData.pinching && pinchReleased(hand)) {
      hand.userData.pinching = false;
      if (hand.userData.held) {
        endGrab(hand.userData.held, scene, toolbox);
        hand.userData.held = null;
      }
    }
  }
}

function nearestColliderTo(obj3d) {
  const origin = obj3d.getWorldPosition(new THREE.Vector3());
  let best = null;
  let bestD = 0.06;
  for (const c of pickables()) {
    const d = c.getWorldPosition(new THREE.Vector3()).distanceTo(origin);
    if (d < bestD) {
      bestD = d;
      best = { object: c, point: origin, distance: d };
    }
  }
  return best;
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() / 1000;

  applyActivityVisual(toolbox, 0.18);
  const viewCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  updateToolboxLod(toolbox, viewCam);
  refreshLodStatus();
  refreshPlaque();

  if (renderer.xr.isPresenting) {
    let hovered = false;
    for (const { controller } of pairs) {
      const hit = firstHit(rayFromController(controller), pickables());
      const ray = controller.getObjectByName("ray");
      if (ray) ray.scale.z = hit ? hit.distance : 1.6;
      if (hit && !hovered) {
        clearAllHovers(entities);
        const entity = hit.object.userData.entity;
        if (setHover(entity, hit.object.name)) {
          playFeedback(entity, "hoverEnter", controller.userData.inputSource);
        }
        hovered = true;
      }
    }
    if (!hovered) clearAllHovers(entities);
    updateHands();
  }

  for (const obj of movable) {
    sampleHeldPose(obj, now);
    if (obj === toolbox.userData.parts.tool && obj.parent === toolbox) continue;
    stepKinematics(obj, dt, table.position.y + 0.04);
  }

  renderer.render(scene, camera);
  if (isQuest3DiagnosticsEnabled()) sampleQuest3Diagnostics(performance.now());
});

if (navigator.xr) {
  navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
    console.info("[interactive-prop] immersive-vr supported:", ok);
  });
} else {
  console.warn("[interactive-prop] navigator.xr missing — use a WebXR browser or emulator");
}

/** Desktop QA snapshot + collider projection for pointer tests. */
const _qaNdc = new THREE.Vector3();
window.__qa = {
  snap() {
    const tool = toolbox.userData.parts.tool;
    const f = toolbox.userData.fastener;
    return {
      state: activityState(toolbox),
      turns: f.turns,
      seated: f.seated,
      toolOut: toolIsHeldOrOut(tool, toolbox),
      toolInCrate: tool.parent === toolbox,
      extracted: Boolean(tool.userData.extracted),
      action: document.getElementById("action-status")?.textContent ?? "",
    };
  },
  project(colliderName) {
    const list = [...toolbox.userData.colliders, ...(resetPlate.userData.colliders || [])];
    const c = list.find((m) => m.name === colliderName);
    if (!c) return null;
    c.getWorldPosition(_qaNdc);
    _qaNdc.project(camera);
    return {
      x: (_qaNdc.x * 0.5 + 0.5) * window.innerWidth,
      y: (-_qaNdc.y * 0.5 + 0.5) * window.innerHeight,
    };
  },
};

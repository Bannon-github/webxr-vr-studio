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
  updateStatePlaque,
} from "./toolbox.js";
import {
  beginGrab,
  collectPickables,
  clearAllHovers,
  dispatchUse,
  endGrab,
  firstHit,
  isPinching,
  pinchReleased,
  playTick,
  pulseHaptic,
  rayFromController,
  rayFromNdc,
  resumeAudio,
  sampleHeldPose,
  setHover,
  stepKinematics,
} from "./interaction.js";

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
updateStatePlaque(plaque, lastState);

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
  if (changed) pulseHaptic(undefined, 0.08, 12);
  return hit;
}

function onUse(controller) {
  resumeAudio();
  const hit = firstHit(rayFromController(controller), pickables());
  if (!hit) return;
  const result = dispatchUse(hit.object.userData.entity, hit.object.name, controller.userData.inputSource);
  if (result.reset) resetAll();
}

function grabTargetFromHit(hit, grip) {
  if (!hit) return null;
  const entity = hit.object.userData.entity;
  if (hit.object.name === "collider_tool") return entity.userData.parts.tool;
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
  endGrab(held, scene);
  controller.userData.held = null;
}

function resetAll() {
  resetToolbox(toolbox, table.position.y + 0.04);
  lastState = activityState(toolbox);
  updateStatePlaque(plaque, lastState);
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

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (renderer.xr.isPresenting) return;
  resumeAudio();
  pointer.down = true;
  const ray = rayFromNdc(camera, pointer.x, pointer.y);
  const hit = firstHit(ray, pickables());
  if (!hit) return;
  if (hit.object.userData.layer === "use") {
    const result = dispatchUse(hit.object.userData.entity, hit.object.name, null);
    if (result.reset) resetAll();
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
  if (pointer.dragging) pointer.dragging.userData.heldBy = null;
  pointer.down = false;
  pointer.dragging = null;
});

window.addEventListener("keydown", (e) => {
  if (e.key === "c" || e.key === "C") {
    colliderDebug = !colliderDebug;
    setColliderDebug(entities, colliderDebug);
  }
  if (e.key === "r" || e.key === "R") resetAll();
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
  if (hz && typeof session.updateTargetFrameRate === "function") {
    session.updateTargetFrameRate(hz).then(
      () => console.info("[interactive-prop] target frameRate", hz, "supported:", rates),
      () => console.info("[interactive-prop] updateTargetFrameRate rejected; UA default. supported:", rates)
    );
  } else {
    console.info("[interactive-prop] frame-rate API unavailable; UA default. supported:", rates);
  }
  if (typeof renderer.xr.setFoveation === "function") {
    renderer.xr.setFoveation(0.75);
  }
}

renderer.xr.addEventListener("sessionstart", () => {
  resumeAudio();
  applyQuest3SessionDefaults(renderer.xr.getSession());
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
      if (hit.object.userData.layer === "use") {
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
        endGrab(hand.userData.held, scene);
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
  const state = activityState(toolbox);
  if (state !== lastState) {
    lastState = state;
    updateStatePlaque(plaque, state);
  }

  if (renderer.xr.isPresenting) {
    let hovered = false;
    for (const { controller } of pairs) {
      const hit = firstHit(rayFromController(controller), pickables());
      const ray = controller.getObjectByName("ray");
      if (ray) ray.scale.z = hit ? hit.distance : 1.6;
      if (hit && !hovered) {
        clearAllHovers(entities);
        setHover(hit.object.userData.entity, hit.object.name);
        hovered = true;
      }
    }
    if (!hovered) clearAllHovers(entities);
    updateHands();
  }

  for (const obj of movable) {
    sampleHeldPose(obj, now);
    if (obj === toolbox.userData.parts.tool && obj.parent === toolbox) continue;
    stepKinematics(obj, dt, obj === toolbox ? table.position.y + 0.04 : 0);
  }

  renderer.render(scene, camera);
});

if (navigator.xr) {
  navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
    console.info("[interactive-prop] immersive-vr supported:", ok);
  });
} else {
  console.warn("[interactive-prop] navigator.xr missing — use a WebXR browser or emulator");
}

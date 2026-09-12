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
  forceReleaseHold,
  isDocumentVisibilityLost,
  isHandInputSource,
  isSessionVisibilityLost,
  releaseIfDocumentHidden,
  releaseIfSourceRemoved,
  releaseIfVisibilityLost,
  releaseLostHold,
} from "./hold-tracking.js";
import {
  initQuest3Diagnostics,
  isQuest3DiagnosticsEnabled,
  recordQuest3FfrSet,
  recordQuest3Session,
  recordQuest3SessionEnd,
  sampleQuest3Diagnostics,
  toggleQuest3Diagnostics,
} from "./quest3-diagnostics.js";
import {
  applyPresentPixelRatioClamp,
  resolveDesktopPixelRatio,
} from "./present-pixel-ratio.js";
import {
  applyPresentAntialias,
  resolveQuest3PresentAntialias,
} from "./present-antialias.js";
import { applyPresentToneMapping } from "./present-tone-mapping.js";
import { applyPresentEnvironment } from "./present-environment.js";
import { applyPresentDirectionalLight } from "./present-directional-light.js";
import {
  applyPresentAmbientFill,
  QUEST3_XR_AMBIENT_COLOR,
  QUEST3_XR_AMBIENT_INTENSITY,
} from "./present-ambient-fill.js";
import { applyPresentAnisotropy } from "./present-anisotropy.js";
import {
  applyPresentFramebufferScale,
  QUEST3_XR_FRAMEBUFFER_SCALE,
} from "./present-framebuffer-scale.js";
import behaviorTemplate from "./behavior.json";
import { tryLoadPackagedToolbox } from "./packaged-visual.js";

/**
 * Interactive crate demo — visual mesh ≠ collider ≠ activity.
 * APIs: MDN WebXR (select/squeeze, targetRaySpace/gripSpace, optional XRHand,
 * inputsourceschange, XRFrame.getPose / getJointPose, XRSession.visibilityState)
 * plus Three.js WebXRManager helpers. Null grip/ray/joint poses, a removed
 * holding source, and session/page visibility loss call endGrab.
 * No invented session methods.
 */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1410);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 50);
camera.position.set(0, 1.5, 0.85);
camera.lookAt(0, 1.0, -0.55);

// Present-path constructor: Three r170 copies this into XRWebGLLayer.
// Cannot flip on a live context — see present-antialias.js.
const renderer = new THREE.WebGLRenderer({
  antialias: resolveQuest3PresentAntialias(),
  alpha: false,
});
renderer.setPixelRatio(resolveDesktopPixelRatio(window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
// Present-path XR eye-buffer scale (v0.22). Three r170 snapshots this in
// setSession *before* sessionstart (and warns if set while presenting).
// Set 1 here so the current layer inherits the clamp. Session helpers
// still save/apply/restore; r170 has no getter.
if (typeof renderer.xr.setFramebufferScaleFactor === "function") {
  renderer.xr.setFramebufferScaleFactor(QUEST3_XR_FRAMEBUFFER_SCALE);
}
document.body.appendChild(renderer.domElement);

const sessionInit = { optionalFeatures: ["hand-tracking", "local-floor"] };
document.body.appendChild(VRButton.createButton(renderer, sessionInit));

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xf0e6d4, 0x2a1c12, 0.55);
scene.add(hemi);
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

const toolbox = (await tryLoadPackagedToolbox(renderer, behaviorTemplate)) ?? createToolbox();
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
let lastPlaqueState = "";
let lastPlaqueTurns = -1;
let lastPlaqueSeated = null;
function refreshPlaque() {
  const f = toolbox.userData.fastener;
  const state = activityState(toolbox);
  const turns = f?.turns ?? 0;
  const seated = Boolean(f?.seated);
  if (state === lastPlaqueState && turns === lastPlaqueTurns && seated === lastPlaqueSeated) return;
  lastPlaqueState = state;
  lastPlaqueTurns = turns;
  lastPlaqueSeated = seated;
  lastState = state;
  updateStatePlaque(plaque, lastState, f);
}
refreshPlaque();
const lodStatus = document.getElementById("lod-status");
let lastLodMode = "";
let lastLodCurrent = -1;

function refreshLodStatus() {
  const lod = toolbox.userData.lod;
  if (!lod || !lodStatus) return;
  if (lod.mode === lastLodMode && lod.current === lastLodCurrent) return;
  lastLodMode = lod.mode;
  lastLodCurrent = lod.current;
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
  const grip = renderer.xr.getControllerGrip(index);
  const hand = renderer.xr.getHand(index);
  controller.userData.kind = "controller";
  controller.addEventListener("selectstart", () => onUse(controller));
  controller.addEventListener("squeezestart", () => onGrabStart(controller, grip));
  controller.addEventListener("squeezeend", () => onGrabEnd(controller));
  controller.addEventListener("connected", (event) => {
    const src = event.data;
    // Three dispatches this on target-ray, grip, and hand for the same slot.
    // A hand XRInputSource must not overwrite the controller pointer.
    if (isHandInputSource(src)) {
      forceReleaseHold(controller, endGrab, scene, toolbox);
      controller.userData.inputSource = null;
      const staleRay = controller.userData.ray;
      if (staleRay?.parent) controller.remove(staleRay);
      return;
    }
    controller.userData.inputSource = src;
    let ray = controller.userData.ray;
    if (!ray) {
      ray = buildRayLine();
      controller.userData.ray = ray;
    }
    if (!ray.parent) controller.add(ray);
  });
  controller.addEventListener("disconnected", (event) => {
    if (isHandInputSource(event.data)) return;
    forceReleaseHold(controller, endGrab, scene, toolbox);
    controller.userData.inputSource = null;
    const ray = controller.userData.ray;
    if (ray?.parent) controller.remove(ray);
  });
  scene.add(controller);

  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);

  hand.userData.kind = "hand";
  hand.userData.pinching = false;
  hand.addEventListener("connected", (event) => {
    const src = event.data;
    if (!isHandInputSource(src)) return;
    hand.userData.inputSource = src;
  });
  hand.addEventListener("disconnected", (event) => {
    if (!isHandInputSource(event.data)) return;
    forceReleaseHold(hand, endGrab, scene, toolbox);
    hand.userData.inputSource = null;
  });
  hand.add(handModelFactory.createHandModel(hand, "mesh"));
  scene.add(hand);

  return { controller, grip, hand };
}

const pairs = [setupController(0), setupController(1)];

const _pickList = [];
const _gripWorld = new THREE.Vector3();
const _nearOrigin = new THREE.Vector3();
const _nearPos = new THREE.Vector3();
const _nearHit = { object: null, point: _nearOrigin, distance: 0 };

function pickables() {
  return collectPickables(entities, _pickList);
}

function hoverFromRay(raycaster) {
  const hit = firstHit(raycaster, pickables());
  if (!hit) {
    clearAllHovers(entities);
    return null;
  }
  applyHoverHit(hit, null);
  return hit;
}

/** Same emissive path as controllers. Does not use/grab. Avoids hoverEnter spam. */
function applyHoverHit(hit, inputSource) {
  const entity = hit.object.userData.entity;
  const name = hit.object.name;
  for (let i = 0; i < entities.length; i++) {
    if (entities[i] !== entity) setHover(entities[i], null);
  }
  if (setHover(entity, name)) playFeedback(entity, "hoverEnter", inputSource);
  return true;
}

/**
 * Bare-hand hover when no controller ray hit this frame.
 * Prefer index-tip proximity, then a tip-origin ray. Reuses the frame pick list.
 */
function hoverFromHands(list) {
  for (const { hand } of pairs) {
    if (!hand.visible && hand.children.length === 0) continue;
    const tip = hand.joints?.["index-finger-tip"];
    if (!tip) continue;
    const hit = nearestColliderTo(tip, list) || firstHit(rayFromController(hand), list);
    if (hit) return applyHoverHit(hit, null);
  }
  return false;
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
    const near = grip?.getWorldPosition(_gripWorld) ?? null;
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
  forceReleaseHold(controller, endGrab, scene, toolbox);
}

/** Null pose / removed source: same `endGrab` as squeezeend (return-tool / throw / table). */
function releaseLostHolds(frame, referenceSpace) {
  for (let i = 0; i < pairs.length; i++) {
    const { controller, grip, hand } = pairs[i];
    if (controller.userData.held) {
      releaseLostHold(
        controller,
        frame,
        referenceSpace,
        controller.userData.inputSource,
        grip || controller,
        endGrab,
        scene,
        toolbox
      );
    }
    if (hand.userData.held) {
      const wrist = hand.joints?.["wrist"] || hand;
      releaseLostHold(
        hand,
        frame,
        referenceSpace,
        hand.userData.inputSource,
        wrist,
        endGrab,
        scene,
        toolbox
      );
    }
  }
}

function onInputSourcesChange(event) {
  const removed = event.removed || [];
  for (let i = 0; i < pairs.length; i++) {
    releaseIfSourceRemoved(pairs[i].controller, removed, endGrab, scene, toolbox);
    releaseIfSourceRemoved(pairs[i].hand, removed, endGrab, scene, toolbox);
  }
}

function releaseAllHolds() {
  for (let i = 0; i < pairs.length; i++) {
    forceReleaseHold(pairs[i].controller, endGrab, scene, toolbox);
    forceReleaseHold(pairs[i].hand, endGrab, scene, toolbox);
  }
}

/**
 * Session hidden / visible-blurred, or document.hidden while presenting.
 * Same `endGrab` as tracking loss. Returning to `visible` does not regrab.
 */
function releaseHoldsForLostVisibility(visibilityState, documentHidden, isPresenting) {
  let released = false;
  for (let i = 0; i < pairs.length; i++) {
    const { controller, hand } = pairs[i];
    if (releaseIfVisibilityLost(controller, visibilityState, endGrab, scene, toolbox)) released = true;
    if (releaseIfVisibilityLost(hand, visibilityState, endGrab, scene, toolbox)) released = true;
    if (releaseIfDocumentHidden(controller, documentHidden, isPresenting, endGrab, scene, toolbox)) {
      released = true;
    }
    if (releaseIfDocumentHidden(hand, documentHidden, isPresenting, endGrab, scene, toolbox)) {
      released = true;
    }
  }
  return released;
}

function onSessionVisibilityChange(event) {
  const session = event?.session || xrSession;
  if (isSessionVisibilityLost(session?.visibilityState)) {
    releaseHoldsForLostVisibility(session.visibilityState, false, true);
  }
}

function onDocumentVisibilityChange() {
  if (isDocumentVisibilityLost(document.hidden, renderer.xr.isPresenting)) {
    releaseHoldsForLostVisibility("visible", document.hidden, true);
  }
}

function resetAll() {
  resetToolbox(toolbox, table.position.y + 0.04);
  lastPlaqueState = "";
  lastPlaqueTurns = -1;
  lastPlaqueSeated = null;
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
 * Pixel-ratio clamp (1 while presenting), present-path antialias/MSAA off,
 * present-path NoToneMapping, present-path IBL/environment off,
 * present-path directional/punctual off, present-path ambient-only
 * fill (hemisphere off + one AmbientLight), present-path texture
 * anisotropy clamp to 1, then present-path XR framebuffer scale
 * clamp to 1 are applied after this on sessionstart.
 * Antialias is constructor-time (Three copies getContextAttributes into
 * XRWebGLLayer); helpers verify only. Tone mapping is a live renderer
 * property (save ACES + exposure, set NoToneMapping). IBL: r170
 * environmentIntensity is a post-sample multiply, so sessionstart nulls
 * scene.environment (do not dispose the PMREM) and writes intensity 0;
 * restore both on sessionend. Directional: r170 still counts a visible
 * sun with intensity 0 toward NUM_DIR_LIGHTS, so sessionstart hides it
 * (visible=false + intensity 0). Ambient fill: r170 still counts a
 * visible HemisphereLight with intensity 0 toward NUM_HEMI_LIGHTS, so
 * sessionstart hides it (visible=false + intensity 0) and enables one
 * reused AmbientLight at intensity 0.4; restore hemi and disable/detach
 * ambient on sessionend. Anisotropy: lookdev / packaged GLB may use GPU
 * max; sessionstart clamps bound maps to 1 and sessionend restores the
 * saved values (not per-frame; do not re-upload). Framebuffer scale:
 * r170 has setFramebufferScaleFactor only (no getter; private default
 * 1). sessionstart (after v0.15–v0.21) saves last-set / lookdev 1 and
 * writes 1; a set while presenting does not rebuild the current layer.
 * Construction-time set above is what the current session inherits.
 * sessionend restores the saved lookdev scale first. Do not require
 * 120 / 207 / 240 Hz.
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

let xrSession = null;
let savedDesktopPixelRatio = null;
let savedDesktopAntialias = null;
let savedDesktopToneMapping = null;
let savedDesktopToneMappingExposure = null;
let savedDesktopEnvironment = null;
let savedDesktopEnvironmentIntensity = null;
let savedDesktopDirectionalVisible = null;
let savedDesktopDirectionalIntensity = null;
let presentAmbient = null;
let savedDesktopHemisphereVisible = null;
let savedDesktopHemisphereIntensity = null;
let presentAnisotropyHandle = null;
let savedDesktopFramebufferScale = null;
renderer.xr.addEventListener("sessionstart", () => {
  resumeAudio();
  const session = renderer.xr.getSession();
  xrSession = session;
  applyQuest3SessionDefaults(session);
  // Present-path clamp only (not per-frame). Save desktop/2D ratio first.
  const clamp = applyPresentPixelRatioClamp(renderer, { presenting: true });
  savedDesktopPixelRatio = clamp.savedRatio;
  // After pixel-ratio: verify MSAA-off policy (context is immutable).
  const aa = applyPresentAntialias(renderer, { presenting: true });
  savedDesktopAntialias = aa.savedAntialias;
  console.info(
    "[interactive-prop] present antialias",
    aa.antialias,
    "applied",
    aa.applied,
    "contextImmutable",
    aa.contextImmutable
  );
  // After antialias: cheaper present-path NoToneMapping (not per-frame).
  const tm = applyPresentToneMapping(renderer, { presenting: true });
  savedDesktopToneMapping = tm.savedToneMapping;
  savedDesktopToneMappingExposure = tm.savedExposure;
  console.info(
    "[interactive-prop] present toneMapping",
    tm.toneMapping,
    "exposure",
    tm.exposure
  );
  // After tone mapping: drop present-path IBL sampling (not per-frame).
  const env = applyPresentEnvironment(scene, { presenting: true });
  savedDesktopEnvironment = env.savedEnvironment;
  savedDesktopEnvironmentIntensity = env.savedIntensity;
  console.info(
    "[interactive-prop] present environment",
    env.environment,
    "intensity",
    env.intensity,
    "envMapCleared",
    env.envMapCleared
  );
  // After IBL: drop present-path directional / punctual (not per-frame).
  const dir = applyPresentDirectionalLight(sun, { presenting: true });
  savedDesktopDirectionalVisible = dir.savedVisible;
  savedDesktopDirectionalIntensity = dir.savedIntensity;
  console.info(
    "[interactive-prop] present directional visible",
    dir.visible,
    "intensity",
    dir.intensity
  );
  // After directional: cheaper present-path ambient-only fill (not per-frame).
  const fill = applyPresentAmbientFill(hemi, presentAmbient, {
    presenting: true,
    scene,
    createAmbient: () => new THREE.AmbientLight(QUEST3_XR_AMBIENT_COLOR, QUEST3_XR_AMBIENT_INTENSITY),
  });
  presentAmbient = fill.ambient;
  savedDesktopHemisphereVisible = fill.savedVisible;
  savedDesktopHemisphereIntensity = fill.savedIntensity;
  console.info(
    "[interactive-prop] present ambient fill hemi visible",
    fill.hemiVisible,
    "hemi intensity",
    fill.hemiIntensity,
    "ambient visible",
    fill.ambientVisible,
    "ambient intensity",
    fill.ambientIntensity
  );
  // After ambient fill: clamp present-path texture AF to 1 (not per-frame).
  const aniso = applyPresentAnisotropy({
    presenting: true,
    roots: [toolbox, scene],
    handle: presentAnisotropyHandle,
  });
  presentAnisotropyHandle = aniso.handle;
  console.info(
    "[interactive-prop] present anisotropy",
    aniso.anisotropy,
    "textures",
    aniso.count
  );
  // After anisotropy: clamp present-path XR framebuffer scale to 1
  // (not per-frame). r170 has no getter; a set while presenting does
  // not rebuild the current eye buffer.
  const fb = applyPresentFramebufferScale(renderer, {
    presenting: true,
    savedScale: savedDesktopFramebufferScale,
    lastSetScale: savedDesktopFramebufferScale ?? QUEST3_XR_FRAMEBUFFER_SCALE,
  });
  savedDesktopFramebufferScale = fb.savedScale;
  console.info(
    "[interactive-prop] present framebufferScale",
    fb.scale,
    "saved",
    fb.savedScale,
    "presentingLocked",
    fb.presentingLocked,
    "getterAvailable",
    fb.getterAvailable
  );
  session?.addEventListener("inputsourceschange", onInputSourcesChange);
  session?.addEventListener("visibilitychange", onSessionVisibilityChange);
});
renderer.xr.addEventListener("sessionend", () => {
  if (xrSession) {
    xrSession.removeEventListener("inputsourceschange", onInputSourcesChange);
    xrSession.removeEventListener("visibilitychange", onSessionVisibilityChange);
    xrSession = null;
  }
  releaseAllHolds();
  // Last applied on sessionstart — restore first (reverse-safe).
  applyPresentFramebufferScale(renderer, {
    presenting: false,
    savedScale: savedDesktopFramebufferScale,
  });
  savedDesktopFramebufferScale = null;
  applyPresentAnisotropy({
    presenting: false,
    handle: presentAnisotropyHandle,
  });
  presentAnisotropyHandle = null;
  applyPresentPixelRatioClamp(renderer, {
    presenting: false,
    savedRatio: savedDesktopPixelRatio,
    windowSize: { width: window.innerWidth, height: window.innerHeight },
  });
  savedDesktopPixelRatio = null;
  applyPresentAntialias(renderer, {
    presenting: false,
    savedAntialias: savedDesktopAntialias,
  });
  savedDesktopAntialias = null;
  applyPresentToneMapping(renderer, {
    presenting: false,
    savedToneMapping: savedDesktopToneMapping,
    savedExposure: savedDesktopToneMappingExposure,
  });
  savedDesktopToneMapping = null;
  savedDesktopToneMappingExposure = null;
  applyPresentEnvironment(scene, {
    presenting: false,
    savedEnvironment: savedDesktopEnvironment,
    savedIntensity: savedDesktopEnvironmentIntensity,
  });
  savedDesktopEnvironment = null;
  savedDesktopEnvironmentIntensity = null;
  applyPresentDirectionalLight(sun, {
    presenting: false,
    savedVisible: savedDesktopDirectionalVisible,
    savedIntensity: savedDesktopDirectionalIntensity,
  });
  savedDesktopDirectionalVisible = null;
  savedDesktopDirectionalIntensity = null;
  applyPresentAmbientFill(hemi, presentAmbient, {
    presenting: false,
    savedVisible: savedDesktopHemisphereVisible,
    savedIntensity: savedDesktopHemisphereIntensity,
    scene,
  });
  savedDesktopHemisphereVisible = null;
  savedDesktopHemisphereIntensity = null;
  recordQuest3SessionEnd();
});
document.addEventListener("visibilitychange", onDocumentVisibilityChange);

const clock = new THREE.Clock();

function updateHands(list) {
  const pickList = list || pickables();
  for (const { hand } of pairs) {
    if (hand.userData.held) {
      const wrist = hand.joints?.["wrist"] || hand;
      if (!hand.visible || wrist.visible === false) {
        forceReleaseHold(hand, endGrab, scene, toolbox);
        continue;
      }
    }
    if (!hand.visible && hand.children.length === 0) continue;
    const pinching = isPinching(hand);
    if (pinching && !hand.userData.pinching) {
      hand.userData.pinching = true;
      const tip = hand.joints?.["index-finger-tip"];
      if (!tip) continue;
      const ray = rayFromController(hand);
      const hit = firstHit(ray, pickList) || nearestColliderTo(tip, pickList);
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
          beginGrab(target, wrist, hand.userData.inputSource);
          hand.userData.held = target;
        }
      }
    } else if (!pinching && hand.userData.pinching && pinchReleased(hand)) {
      hand.userData.pinching = false;
      forceReleaseHold(hand, endGrab, scene, toolbox);
    }
  }
}

function nearestColliderTo(obj3d, list) {
  obj3d.getWorldPosition(_nearOrigin);
  let best = null;
  let bestD = 0.06;
  const colliders = list || pickables();
  for (const c of colliders) {
    const d = c.getWorldPosition(_nearPos).distanceTo(_nearOrigin);
    if (d < bestD) {
      bestD = d;
      _nearHit.object = c;
      _nearHit.distance = d;
      best = _nearHit;
    }
  }
  return best;
}

renderer.setAnimationLoop((_time, frame) => {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now() / 1000;

  applyActivityVisual(toolbox, 0.18);
  const viewCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  updateToolboxLod(toolbox, viewCam);
  refreshLodStatus();
  refreshPlaque();

  // Quest 3 gate: no per-frame `new` / array alloc on this path when overlay is off.
  const list = pickables();
  if (renderer.xr.isPresenting) {
    const session = xrSession || renderer.xr.getSession();
    if (isSessionVisibilityLost(session?.visibilityState) || document.hidden) {
      releaseHoldsForLostVisibility(session?.visibilityState, document.hidden, true);
    }
    if (frame) releaseLostHolds(frame, renderer.xr.getReferenceSpace());
    let hovered = false;
    for (const { controller } of pairs) {
      const hit = firstHit(rayFromController(controller), list);
      const ray = controller.userData.ray;
      if (ray) ray.scale.z = hit ? hit.distance : 1.6;
      if (hit && !hovered) {
        applyHoverHit(hit, controller.userData.inputSource);
        hovered = true;
      }
    }
    // Controllers win on a ray hit; otherwise index-tip / hand ray (Quest 3 bare hands).
    if (!hovered) hovered = hoverFromHands(list);
    if (!hovered) clearAllHovers(entities);
    updateHands(list);
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
const _qaLostFrame = {
  getPose() {
    return null;
  },
  getJointPose() {
    return null;
  },
};

function qaHoldSnapshot() {
  const tool = toolbox.userData.parts.tool;
  return {
    crateHeldBy: toolbox.userData.heldBy ? "held" : null,
    toolHeldBy: tool.userData.heldBy ? "held" : null,
    controllerHeld: Boolean(pairs[0].controller.userData.held || pairs[1].controller.userData.held),
    handHeld: Boolean(pairs[0].hand.userData.held || pairs[1].hand.userData.held),
  };
}

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
  /** Attach crate or tool to grip 0 so tracking-loss can be simulated without a headset. */
  forceHold(which = "crate") {
    const target = which === "tool" ? toolbox.userData.parts.tool : toolbox;
    const { controller, grip } = pairs[0];
    if (target.userData.heldBy || controller.userData.held) {
      return { ok: false, reason: "already-held" };
    }
    const dummy = { gripSpace: {}, profiles: ["qa-simulate"] };
    controller.userData.inputSource = dummy;
    beginGrab(target, grip, dummy);
    controller.userData.held = target;
    return { ok: true, name: target.name, ...qaHoldSnapshot() };
  },
  /** Same path as a null grip/joint pose this frame. */
  simulateTrackingLoss() {
    releaseLostHolds(_qaLostFrame, {});
    return { ok: true, ...qaHoldSnapshot() };
  },
  /** Same path as `inputsourceschange` when the holding source is removed. */
  simulateSourceRemoved() {
    for (let i = 0; i < pairs.length; i++) {
      const { controller, hand } = pairs[i];
      const cSrc = controller.userData.inputSource;
      const hSrc = hand.userData.inputSource;
      if (cSrc) releaseIfSourceRemoved(controller, [cSrc], endGrab, scene, toolbox);
      else forceReleaseHold(controller, endGrab, scene, toolbox);
      if (hSrc) releaseIfSourceRemoved(hand, [hSrc], endGrab, scene, toolbox);
      else forceReleaseHold(hand, endGrab, scene, toolbox);
    }
    return { ok: true, ...qaHoldSnapshot() };
  },
  /** Same path as XRSession visibilityState `hidden` (lift headset / blur). */
  simulateVisibilityHidden() {
    releaseHoldsForLostVisibility("hidden", false, true);
    return { ok: true, visibilityState: "hidden", ...qaHoldSnapshot() };
  },
  /**
   * Session back to `visible`. Does not re-attach — user must grab again.
   * Also exercises the document.hidden-while-presenting helper as a no-op
   * when the page is visible.
   */
  simulateVisibilityRestore() {
    releaseHoldsForLostVisibility("visible", false, true);
    return { ok: true, visibilityState: "visible", autoRegrab: false, ...qaHoldSnapshot() };
  },
  /** Belt-and-suspenders: document.hidden while presenting. */
  simulateDocumentHidden() {
    releaseHoldsForLostVisibility("visible", true, true);
    return { ok: true, documentHidden: true, presenting: true, ...qaHoldSnapshot() };
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

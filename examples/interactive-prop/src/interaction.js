import * as THREE from "three";
import { applyActivityVisual, tryDriveFastener, tryReturnTool, tryUse, toolIsHeldOrOut } from "./toolbox.js";

/**
 * Intent adapter: WebXR select/squeeze (and a desktop pointer stand-in)
 * become hover / use / grab / release. Picks collider meshes only.
 *
 * Real APIs: XRSession select* / squeeze* (via Three controller objects),
 * XRInputSource.targetRaySpace / gripSpace / gamepad haptic actuators,
 * XRHand joint names from the Hand Input module (thumb-tip, index-finger-tip).
 */

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _tmp = new THREE.Vector3();
const _tmpMat = new THREE.Matrix4();

const PINCH_ON = 0.018;
const PINCH_OFF = 0.03;
const _pinchA = new THREE.Vector3();
const _pinchB = new THREE.Vector3();

export function pulseHaptic(inputSource, value = 0.3, ms = 30) {
  const gp = inputSource?.gamepad;
  if (!gp) return;
  const actuator = gp.hapticActuators?.[0] ?? gp.vibrationActuator;
  if (actuator && typeof actuator.pulse === "function") {
    const maybe = actuator.pulse(value, ms);
    if (maybe && typeof maybe.catch === "function") maybe.catch(() => {});
  }
}

let audioCtx = null;
export function resumeAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

export function playTick(kind) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const freq = kind === "grab" ? 140 : kind === "nack" ? 90 : kind === "latch" ? 420 : 260;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function collectPickables(entities) {
  const list = [];
  for (const e of entities) {
    for (const c of e.userData.colliders || []) {
      if (c.userData.pickable === false) continue;
      c.userData.entity = e;
      list.push(c);
    }
  }
  return list;
}

export function rayFromController(controller) {
  _tmpMat.identity().extractRotation(controller.matrixWorld);
  _raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  _raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_tmpMat);
  return _raycaster;
}

export function rayFromNdc(camera, nx, ny) {
  _ndc.set(nx, ny);
  _raycaster.setFromCamera(_ndc, camera);
  return _raycaster;
}

export function firstHit(raycaster, pickables) {
  const hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return null;
  // Prefer a use-target that is almost as near as the grab hull so a large
  // body collider cannot steal latch/lid clicks (interactive-objects.md).
  const nearest = hits[0];
  const entity = nearest.object.userData.entity;
  const tool = entity?.userData?.parts?.tool;
  // Prefer the fastener only while the tool is in play so it cannot steal latch/lid.
  if (tool && toolIsHeldOrOut(tool, entity)) {
    const fastener = hits.find((h) => h.object.name === "collider_fastener" && h.distance <= nearest.distance + 0.16);
    if (fastener) return fastener;
  }
  const use = hits.find((h) => h.object.userData.layer === "use" && h.distance <= nearest.distance + 0.08);
  return use || nearest;
}

function emissiveFor(obj, hex) {
  obj.traverse((child) => {
    if (child.isMesh && child.material && "emissive" in child.material && !child.userData.collider) {
      if (!child.material.userData._baseEmissive) {
        child.material.userData._baseEmissive = child.material.emissive.clone();
      }
      child.material.emissive.setHex(hex);
    }
  });
}

function clearEmissive(obj) {
  obj.traverse((child) => {
    if (child.isMesh && child.material?.userData?._baseEmissive) {
      child.material.emissive.copy(child.material.userData._baseEmissive);
    }
  });
}

export function setHover(entity, colliderName) {
  const prev = entity.userData.hoverCollider;
  entity.userData.hoverCollider = colliderName || null;
  const map = entity.userData.highlightables || {};
  for (const [key, obj] of Object.entries(map)) {
    const latchHit = colliderName === "collider_latch" && key === "latch";
    const lidHit = colliderName === "collider_lid" && key === "lid";
    const grabHit = colliderName === "collider_grab" && key === "body";
    const toolHit = colliderName === "collider_tool" && key === "tool";
    const fastenerHit = colliderName === "collider_fastener" && key === "fastener";
    const resetHit = colliderName === "collider_reset" && key === "reset";
    if (latchHit || lidHit || grabHit || toolHit || fastenerHit || resetHit) emissiveFor(obj, 0x4a2810);
    else clearEmissive(obj);
  }
  return prev !== colliderName;
}

export function clearAllHovers(entities) {
  for (const e of entities) setHover(e, null);
}

export function playFeedback(entity, key, inputSource) {
  const src = entity?.userData.studio ? entity : entity?.userData.feedbackEntity;
  const fb = src?.userData.studio?.components?.feedback?.[key];
  if (!fb) return;
  if (fb.haptic) pulseHaptic(inputSource, fb.haptic, fb.ms ?? 30);
  if (fb.audio) playTick(fb.audio);
}

export function dispatchUse(entity, colliderName, inputSource) {
  if (entity.name === "reset" && colliderName === "collider_reset") {
    playTick("latch");
    pulseHaptic(inputSource, 0.3, 30);
    return { ok: true, reset: true };
  }
  const result = tryUse(entity, colliderName);
  if (result.ok) {
    applyActivityVisual(entity, 1);
    playFeedback(entity, result.to, inputSource);
  } else if (result.reason === "nack") {
    playFeedback(entity, "nack", inputSource);
  }
  return result;
}

export function dispatchDrive(entity, inputSource) {
  const result = tryDriveFastener(entity);
  if (result.ok) playFeedback(entity, result.seated ? "seated" : "drive", inputSource);
  else playFeedback(entity, "nack", inputSource);
  return result;
}

function attachTo(holder, object) {
  holder.attach(object);
  object.userData.heldBy = holder;
  object.userData.velocity = new THREE.Vector3();
}

function detachTo(scene, object) {
  scene.attach(object);
  object.userData.heldBy = null;
}

export function beginGrab(object, holder, inputSource) {
  if (object.userData.heldBy) return false;
  attachTo(holder, object);
  object.userData.poseHistory = [];
  playFeedback(object, "grab", inputSource);
  return true;
}

export function endGrab(object, scene, crate) {
  if (!object.userData.heldBy) return { returned: false };
  const history = object.userData.poseHistory || [];
  detachTo(scene, object);
  if (object.name === "tool" && crate && tryReturnTool(object, crate)) {
    playFeedback(crate, "return");
    return { returned: true };
  }
  if (object.name === "tool") object.userData.extracted = true;
  const v = object.userData.velocity;
  if (v) {
    v.set(0, 0, 0);
    if (history.length >= 2) {
      const a = history[0];
      const b = history[history.length - 1];
      const dt = Math.max(1 / 90, b.t - a.t);
      v.subVectors(b.p, a.p).divideScalar(dt);
      v.clampLength(0, 6);
    }
  }
  return { returned: false };
}

export function sampleHeldPose(object, now) {
  if (!object.userData.heldBy) return;
  object.getWorldPosition(_tmp);
  const hist = object.userData.poseHistory || (object.userData.poseHistory = []);
  hist.push({ t: now, p: _tmp.clone() });
  if (hist.length > 8) hist.shift();
}

export function stepKinematics(object, dt, floorY = 0) {
  if (object.userData.heldBy) return;
  const v = object.userData.velocity;
  if (!v) return;
  v.y -= 9.8 * dt;
  object.position.addScaledVector(v, dt);
  const minY = floorY + 0.02;
  if (object.position.y < minY) {
    object.position.y = minY;
    if (v.y < 0) v.y *= -0.25;
    v.x *= 0.72;
    v.z *= 0.72;
    if (v.length() < 0.08) v.set(0, 0, 0);
  }
}

export function isPinching(hand) {
  const tip = hand.joints?.["index-finger-tip"];
  const thumb = hand.joints?.["thumb-tip"];
  if (!tip || !thumb) return false;
  return tip.getWorldPosition(_pinchA).distanceTo(thumb.getWorldPosition(_pinchB)) < PINCH_ON;
}

export function pinchReleased(hand) {
  const tip = hand.joints?.["index-finger-tip"];
  const thumb = hand.joints?.["thumb-tip"];
  if (!tip || !thumb) return true;
  return tip.getWorldPosition(_pinchA).distanceTo(thumb.getWorldPosition(_pinchB)) > PINCH_OFF;
}

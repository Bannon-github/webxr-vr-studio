import * as THREE from "three";
import { applyActivityVisual, tryDriveFastener, tryReturnTool, tryUse, toolIsHeldOrOut } from "./toolbox.js";

/**
 * Intent adapter: WebXR select/squeeze (and a desktop pointer stand-in)
 * become hover / use / grab / release. Picks collider meshes only.
 *
 * Real APIs: XRSession select* / squeeze* (via Three controller objects),
 * XRInputSource.targetRaySpace / gripSpace / gamepad haptic actuators,
 * XRHand joint names from the Hand Input module (thumb-tip, index-finger-tip).
 *
 * Quest 3 frame-loop allocation scrub: pick list, hit result, and pose ring
 * are reused. Do not add `new THREE.*` or fresh arrays on the rAF path.
 */

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _tmp = new THREE.Vector3();
const _tmpMat = new THREE.Matrix4();
const _invMat = new THREE.Matrix4();
const _inv3 = new THREE.Matrix3();
const _localOrigin = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _hitScratch = { object: null, point: new THREE.Vector3(), distance: 0 };

const POSE_RING = 8;

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

/** Fill `into` (reused) with pickable hulls. Do not allocate a new array on the XR path. */
export function collectPickables(entities, into) {
  const list = into || [];
  list.length = 0;
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

function boxHalfExtents(obj) {
  const s = obj.userData.size;
  if (s) return s;
  const p = obj.geometry?.parameters;
  if (p && p.width != null) return p;
  return null;
}

/** Slab test. `rd` is the world-dir transformed by the inverse linear part (not renormalized). */
function rayAabbT(ro, rd, hx, hy, hz) {
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const origin = i === 0 ? ro.x : i === 1 ? ro.y : ro.z;
    const dir = i === 0 ? rd.x : i === 1 ? rd.y : rd.z;
    const h = i === 0 ? hx : i === 1 ? hy : hz;
    if (Math.abs(dir) < 1e-12) {
      if (origin < -h || origin > h) return null;
      continue;
    }
    let t1 = (-h - origin) / dir;
    let t2 = (h - origin) / dir;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmax < 0 ? null : tmin;
}

/**
 * Closest box-hull hit. Reuses one result object — copy fields if you need to keep it
 * across another `firstHit` call. Avoids Three.intersectObjects allocation.
 */
export function firstHit(raycaster, pickables) {
  const ray = raycaster.ray;
  const near = raycaster.near;
  const far = raycaster.far;
  let nearestObj = null;
  let nearestT = Infinity;
  let toolObj = null;
  let toolT = Infinity;
  let fastenerObj = null;
  let fastenerT = Infinity;
  let useObj = null;
  let useT = Infinity;

  for (const obj of pickables) {
    const size = boxHalfExtents(obj);
    if (!size) continue;
    const hx = (size.x ?? size.width) * 0.5;
    const hy = (size.y ?? size.height) * 0.5;
    const hz = (size.z ?? size.depth) * 0.5;
    obj.updateWorldMatrix(true, false);
    _invMat.copy(obj.matrixWorld).invert();
    _inv3.setFromMatrix4(_invMat);
    _localOrigin.copy(ray.origin).applyMatrix4(_invMat);
    _localDir.copy(ray.direction).applyMatrix3(_inv3);
    const t = rayAabbT(_localOrigin, _localDir, hx, hy, hz);
    if (t == null || t < near || t > far) continue;
    if (t < nearestT) {
      nearestT = t;
      nearestObj = obj;
    }
    if (obj.name === "collider_tool" && obj.userData.pickable !== false && t < toolT) {
      toolT = t;
      toolObj = obj;
    }
    if (obj.name === "collider_fastener" && t < fastenerT) {
      fastenerT = t;
      fastenerObj = obj;
    }
    if (obj.userData.layer === "use" && t < useT) {
      useT = t;
      useObj = obj;
    }
  }

  if (!nearestObj) return null;

  // Prefer a use-target that is almost as near as the grab hull so a large
  // body collider cannot steal latch/lid clicks (interactive-objects.md).
  let chosen = nearestObj;
  let chosenT = nearestT;
  if (toolObj && toolT <= nearestT + 0.22) {
    chosen = toolObj;
    chosenT = toolT;
  } else {
    const entity = nearestObj.userData.entity;
    const tool = entity?.userData?.parts?.tool;
    if (tool && toolIsHeldOrOut(tool, entity) && fastenerObj && fastenerT <= nearestT + 0.16) {
      chosen = fastenerObj;
      chosenT = fastenerT;
    } else if (useObj && useT <= nearestT + 0.08) {
      chosen = useObj;
      chosenT = useT;
    }
  }

  _hitScratch.object = chosen;
  _hitScratch.distance = chosenT;
  _hitScratch.point.copy(ray.origin).addScaledVector(ray.direction, chosenT);
  return _hitScratch;
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
  for (const key in map) {
    const obj = map[key];
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

function ensurePoseRing(object) {
  let ring = object.userData.poseRing;
  if (!ring) {
    ring = [];
    for (let i = 0; i < POSE_RING; i++) ring.push({ t: 0, p: new THREE.Vector3() });
    object.userData.poseRing = ring;
  }
  return ring;
}

function attachTo(holder, object) {
  holder.attach(object);
  object.userData.heldBy = holder;
  if (!object.userData.velocity) object.userData.velocity = new THREE.Vector3();
  else object.userData.velocity.set(0, 0, 0);
}

function detachTo(scene, object) {
  scene.attach(object);
  object.userData.heldBy = null;
}

export function beginGrab(object, holder, inputSource) {
  if (object.userData.heldBy) return false;
  attachTo(holder, object);
  ensurePoseRing(object);
  object.userData.poseWrite = 0;
  object.userData.poseCount = 0;
  playFeedback(object, "grab", inputSource);
  return true;
}

export function endGrab(object, scene, crate) {
  if (!object.userData.heldBy) return { returned: false };
  const ring = object.userData.poseRing;
  const count = object.userData.poseCount || 0;
  const write = object.userData.poseWrite || 0;
  detachTo(scene, object);
  if (object.name === "tool" && crate && tryReturnTool(object, crate)) {
    playFeedback(crate, "return");
    return { returned: true };
  }
  if (object.name === "tool") object.userData.extracted = true;
  const v = object.userData.velocity;
  if (v) {
    v.set(0, 0, 0);
    if (ring && count >= 2) {
      const newest = ring[(write + POSE_RING - 1) % POSE_RING];
      const oldest = ring[count === POSE_RING ? write : (write + POSE_RING - count) % POSE_RING];
      const dt = Math.max(1 / 90, newest.t - oldest.t);
      v.subVectors(newest.p, oldest.p).divideScalar(dt);
      v.clampLength(0, 6);
    }
  }
  return { returned: false };
}

export function sampleHeldPose(object, now) {
  if (!object.userData.heldBy) return;
  const ring = ensurePoseRing(object);
  object.getWorldPosition(_tmp);
  let write = object.userData.poseWrite || 0;
  const slot = ring[write];
  slot.t = now;
  slot.p.copy(_tmp);
  object.userData.poseWrite = (write + 1) % POSE_RING;
  object.userData.poseCount = Math.min(POSE_RING, (object.userData.poseCount || 0) + 1);
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

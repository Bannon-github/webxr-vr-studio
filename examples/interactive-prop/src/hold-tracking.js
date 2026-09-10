/**
 * Quest 3 tracking-loss / null-pose gate.
 *
 * Real WebXR: XRFrame.getPose (grip / targetRay), XRFrame.getJointPose
 * (hand wrist), XRSession `inputsourceschange` removed[].
 * Three fallback: Object3D.visible after WebXRManager wrote a null pose.
 *
 * No allocations — safe on the XR animation path when P is off.
 */

/**
 * True when the holding source has no usable pose this frame.
 * Call only while presenting with a live XRFrame (or a test double).
 */
export function isHoldPoseLost(frame, referenceSpace, inputSource, holder) {
  if (!inputSource) return true;

  const hand = inputSource.hand;
  if (hand && typeof hand.get === "function") {
    const wrist = hand.get("wrist");
    if (!wrist) return true;
    if (frame && referenceSpace) {
      if (typeof frame.getJointPose === "function") {
        return frame.getJointPose(wrist, referenceSpace) == null;
      }
      if (typeof frame.getPose === "function") {
        return frame.getPose(wrist, referenceSpace) == null;
      }
    }
    return holder?.visible === false;
  }

  const space = inputSource.gripSpace || inputSource.targetRaySpace;
  if (space && frame && referenceSpace && typeof frame.getPose === "function") {
    return frame.getPose(space, referenceSpace) == null;
  }

  return !holder || holder.visible === false;
}

/**
 * Run `endGrab` and clear `held` / pinching on the controller or hand slot.
 * Returns true when a hold was released.
 */
export function forceReleaseHold(inputObj, endGrab, scene, crate) {
  const held = inputObj?.userData?.held;
  if (!held) return false;
  endGrab(held, scene, crate);
  inputObj.userData.held = null;
  inputObj.userData.pinching = false;
  return true;
}

/**
 * If this slot is holding and the pose is lost, release via `endGrab`.
 */
export function releaseLostHold(
  inputObj,
  frame,
  referenceSpace,
  inputSource,
  holder,
  endGrab,
  scene,
  crate
) {
  if (!inputObj?.userData?.held) return false;
  if (!isHoldPoseLost(frame, referenceSpace, inputSource, holder)) return false;
  return forceReleaseHold(inputObj, endGrab, scene, crate);
}

/**
 * Release when the holding XRInputSource is gone or listed in
 * `inputsourceschange` `removed`.
 */
export function releaseIfSourceRemoved(inputObj, removed, endGrab, scene, crate) {
  if (!inputObj?.userData?.held) return false;
  const src = inputObj.userData.inputSource;
  if (src) {
    if (!removed) return false;
    let listed = false;
    for (let i = 0; i < removed.length; i++) {
      if (removed[i] === src) {
        listed = true;
        break;
      }
    }
    if (!listed) return false;
  }
  return forceReleaseHold(inputObj, endGrab, scene, crate);
}

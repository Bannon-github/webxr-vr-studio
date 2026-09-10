# Sessions

## Modes

Per MDN XRSystem.requestSession / isSessionSupported:

| Mode | Intent |
| --- | --- |
| immersive-vr | Exclusive VR presentation to an HMD; environmentBlendMode typically opaque |
| immersive-ar | Augmented reality overlay / passthrough (Augmented Reality Module) |
| inline | XR inline in the page (not exclusive) |

This studio playbook focuses on immersive-vr.

## Capability checks

1. Guard on navigator.xr (undefined means no WebXR).
2. await navigator.xr.isSessionSupported with mode immersive-vr.
3. Enable Enter VR only when true; disable or hide otherwise.
4. Call requestSession only from a user activation handler (click, etc.).

## Feature lists

requestSession accepts requiredFeatures and optionalFeatures. Common space-related names include: local, local-floor, bounded-floor, unbounded, viewer. Other optional modules include hand-tracking (articulated XRHand on XRInputSource.hand) when available.

If a required feature is unavailable, the promise rejects — prefer optionalFeatures for progressive enhancement.

## Lifecycle

1. requestSession immersive-vr with optionalFeatures such as local-floor
2. Listen for session end
3. Create XRWebGLLayer from a WebGL or WebGL2 context compatible with XR
4. session.updateRenderState with baseLayer
5. requestReferenceSpace
6. session.requestAnimationFrame loop
7. On exit: session.end(); restore inline canvas / UI

## Visibility

`XRSession.visibilityState` is not the same as `document.visibilityState`. Listen for session `visibilitychange` and read `visibilityState` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/visibilityState)):

| State | Meaning (spec) |
| --- | --- |
| `visible` | Primary focus; rAF at device rate; input processed |
| `visible-blurred` | Not primary focus; rAF may throttle; **input not processed** |
| `hidden` | Not shown; rAF paused; **input not processed** |

On Quest 3, lifting the headset, a system overlay, or Quest Browser blurring the immersive session can leave a held prop parented to a grip/wrist that is no longer receiving input. `crate-toolbox` v0.11 releases via the existing `endGrab` path on `hidden` / `visible-blurred`, and also on `document.hidden` while presenting (tab/app switch if session events lag). Restore to `visible` must not auto-regrab.

Refs: MDN XRSystem.requestSession; MDN Starting up and shutting down a WebXR session; MDN XRSession.visibilitychange.

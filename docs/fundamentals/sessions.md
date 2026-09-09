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

Refs: MDN XRSystem.requestSession; MDN Starting up and shutting down a WebXR session.

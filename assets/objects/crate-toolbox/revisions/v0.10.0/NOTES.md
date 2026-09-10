# crate-toolbox v0.10.0

Shipping/a11y UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): if a controller or hand is holding the crate or screwdriver and the pose goes null (`XRFrame.getPose` on grip / targetRay, `getJointPose` on the wrist) or the holding `XRInputSource` is removed (`inputsourceschange` / Three `disconnected`), call the existing `endGrab` path. Same return-tool / throw / table logic as a normal squeezeend. Clears `held` / `heldBy` so the prop is free in the scene — not frozen on a dead grip or wrist.
- Session end also releases any live hold.
- v0.9 hover-before-pinch unchanged (controllers still win on a ray hit). v0.8 allocation scrub kept (no per-frame `new` when `P` is off; reused helpers, no extra arrays on the XR path).
- Confirm on headset: [quest-3-on-device-qa](../../../../docs/shipping/quest-3-on-device-qa.md) Tracking-loss subsection. Qualitative only.
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024).
- Quest 3 frame time / FFR still **unmeasured**.

# crate-toolbox v0.11.0

Shipping/a11y UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): if a controller or hand is holding the crate or screwdriver and the XR session or page loses visibility — `XRSession.visibilityState` `hidden` or `visible-blurred` (`visibilitychange`, or a cheap per-frame read while presenting), or `document.hidden` while presenting — call the existing `endGrab` path. Same return-tool / throw / table logic as a normal squeezeend / tracking-loss release. Clears `held` / `heldBy` so the prop is free in the scene — not frozen while the user lifts the headset, the immersive session blurs, or Quest Browser switches apps.
- Returning to `visible` does **not** auto-regrab; the user must grab again.
- Controller and hand hold sources stay independent (v0.10). Session-wide visibility loss still walks each slot separately.
- Session end also releases any live hold.
- v0.10 tracking-loss / null-pose release unchanged. v0.9 hover-before-pinch unchanged (controllers still win on a ray hit). v0.8 allocation scrub kept (no per-frame `new` when `P` is off; reused helpers, no extra arrays on the XR path).
- Confirm on headset: [quest-3-on-device-qa](../../../../docs/shipping/quest-3-on-device-qa.md) Visibility-loss subsection. Qualitative only.
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024).
- Quest 3 frame time / FFR still **unmeasured**.

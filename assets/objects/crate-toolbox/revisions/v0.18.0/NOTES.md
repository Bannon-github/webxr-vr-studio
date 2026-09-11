# crate-toolbox v0.18.0

Shipping/perf-gate UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): present-path **IBL / scene.environment off** while an immersive XR session is presenting, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, and v0.17’s NoToneMapping. Desktop lookdev still assigns a PMREM from `RoomEnvironment` to `scene.environment` (`environmentIntensity` default 1). Three.js r170 MeshStandardMaterials sample that IBL every fragment when `USE_ENVMAP` is set — real TBDR cost on Quest 3.
- r170 `scene.environmentIntensity` is a post-sample uniform multiply (`envMapIntensity` after `textureCubeUV`). Intensity 0 does **not** drop `USE_ENVMAP` while `scene.environment` is assigned. Present-path policy therefore **nulls** `scene.environment` (and writes intensity 0 when the property exists). On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 antialias verify + v0.17 NoToneMapping) helpers in `present-environment.js` save the texture reference + intensity. On `sessionend` restore both. Do **not** dispose the PMREM texture. Session events only — not per-frame (v0.8 allocation scrub kept). Do not reconstruct the renderer.
- L5 activity contract unchanged (`closed` → `unlatched` → `open`; tool / fastener / return).
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024). v0.17 NoToneMapping, v0.16 MSAA off, v0.15 pixel-ratio clamp, v0.14 LOD1 half `normalScale`, and v0.13 LOD2 no-`normalMap` stay as they were.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper present-path IBL / fragment cost is the intended delta.

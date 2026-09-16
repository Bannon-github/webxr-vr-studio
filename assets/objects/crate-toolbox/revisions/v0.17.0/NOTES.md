# crate-toolbox v0.17.0

Shipping/perf-gate UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): present-path **NoToneMapping** while an immersive XR session is presenting, complementary to v0.15’s pixel-ratio clamp and v0.16’s antialias/MSAA off. Desktop lookdev still starts with `THREE.ACESFilmicToneMapping` + `toneMappingExposure` 1.05. Three.js r170 applies `renderer.toneMapping` on the output fragment (`TONE_MAPPING` define); ACESFilmic is extra ALU on every fragment on Quest 3’s TBDR present path.
- On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 antialias verify) helpers in `present-tone-mapping.js` save the current operator + exposure, then set `NoToneMapping` (0) and identity exposure (1). r170 does not apply `toneMappingExposure` when `TONE_MAPPING` is unset; still write 1 so the property matches identity. On `sessionend` restore saved ACESFilmic (4) + the prior exposure. Session events only — not per-frame (v0.8 allocation scrub kept). Do not reconstruct the renderer.
- L5 activity contract unchanged (`closed` → `unlatched` → `open`; tool / fastener / return).
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024). v0.16 MSAA off, v0.15 pixel-ratio clamp, v0.14 LOD1 half `normalScale`, and v0.13 LOD2 no-`normalMap` stay as they were.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper present-path tone mapping / fragment cost is the intended delta.

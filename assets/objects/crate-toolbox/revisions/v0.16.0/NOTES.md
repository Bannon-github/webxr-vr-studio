# crate-toolbox v0.16.0

Shipping/perf-gate UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): present-path WebGL antialias / MSAA off, complementary to v0.15’s pixel-ratio clamp. Three.js r170 `WebXRManager` snapshots `gl.getContextAttributes()` and copies `antialias` into `XRWebGLLayer` (or projection-layer `samples: 4|0`). The WebGL attribute is immutable after `getContext`; there is no `renderer.setAntialias`. Recreating the renderer/canvas would drop PMREM, GPU uploads, and XR bindings — not used.
- The one long-lived renderer therefore **starts** with `antialias: QUEST3_XR_ANTIALIAS` (**false**) so the immersive layer inherits MSAA off. Helpers in `present-antialias.js` run on `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)`) and `sessionend` (restore desired lookdev policy value `true`; context stays false). Session events only — not per-frame (v0.8 allocation scrub kept).
- Desktop 2D lookdev shares that context, so it also has MSAA off. Documented trade-off so the Quest present path is correct.
- L5 activity contract unchanged (`closed` → `unlatched` → `open`; tool / fastener / return).
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024). v0.15 pixel-ratio clamp, v0.14 LOD1 half `normalScale`, and v0.13 LOD2 no-`normalMap` stay as they were.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Lower present-path MSAA / fill cost is the intended delta.

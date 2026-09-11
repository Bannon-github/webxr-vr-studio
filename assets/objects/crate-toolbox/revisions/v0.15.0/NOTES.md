# crate-toolbox v0.15.0

Shipping/perf-gate UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): present-path WebGL pixel-ratio clamp. On `sessionstart`, after existing Quest 3 defaults (90 if listed else 72, FFR 0.75), save the current pixel ratio and `renderer.setPixelRatio(QUEST3_XR_PIXEL_RATIO)` (**1**). On `sessionend`, restore the saved desktop/2D ratio and `renderer.setSize` to the current window so lookdev is unchanged.
- Helpers live in `present-pixel-ratio.js` (`resolveQuest3PresentPixelRatio` always returns 1). Session events only — not per-frame (v0.8 allocation scrub kept).
- L5 activity contract unchanged (`closed` → `unlatched` → `open`; tool / fastener / return).
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024). v0.14 LOD1 half `normalScale` and v0.13 LOD2 no-`normalMap` stay as they were.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Lower XR fragment fill / backbuffer cost is the intended delta.

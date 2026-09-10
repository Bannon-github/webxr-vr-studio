# crate-toolbox v0.14.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.13 dropped `normalMap` on LOD2, **LOD1 no longer uses full-strength `normalScale`**. LOD1 is the mid crate (96 tris / 8 draws, ~2.4–4.5 m). Body + lid + latch + tool stub use separate materials: same 512² albedo + ORM + normal canvases as LOD0, `normalScale × L3_LOD1_NORMAL_SCALE_MUL` (**0.5**).
- LOD0 keeps the five shared v0.12 materials at full modest scale (wood 0.62, brass 0.30, steel 0.38). LOD2 stays v0.13 (separate wood, `normalMap = null`). Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Unique canvases still 9. Texture authoring still 512² / max 1024.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.13.0 set. v0.8 allocation scrub, v0.9 hand hover, v0.10 tracking-loss release, and v0.11 visibility-loss release stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. Mid LOD primitives should keep `normalTexture` with reduced `normalTexture.scale`; far LOD primitives should omit `normalTexture`. Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**.

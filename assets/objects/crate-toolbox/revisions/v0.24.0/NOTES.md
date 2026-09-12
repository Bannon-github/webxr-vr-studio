# crate-toolbox v0.24.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.13 dropped `normalMap` on LOD2, v0.14 halved LOD1 `normalScale`, and v0.23 dropped packed ORM on LOD2, **LOD1 no longer binds `normalMap`**. LOD1 body / lid / latch / tool stub still share separate mid materials (`woodMid` / `woodDarkMid` / `brassMid` / `handleMatMid`): same 512² albedo + packed ORM, `{ normalMap: false }` — `normalMap = null`.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal. LOD2 stays v0.23 albedo-only (`woodFar`: no `normalMap`, no ORM; constant roughness 220/255 and metalness 8/255). Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Unique canvases still 9. Texture authoring still 512² / max 1024.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.23.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. Mid LOD primitives should omit `normalTexture` the same way while keeping packed ORM. Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper mid-fragment texture samples (no tangent-space normal) is the intended delta.

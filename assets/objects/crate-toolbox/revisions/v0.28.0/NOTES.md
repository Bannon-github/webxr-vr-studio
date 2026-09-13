# crate-toolbox v0.28.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.27 made LOD2 far wood unlit `MeshBasicMaterial`, **LOD1 mid body / lid / latch / tool stub are unlit `MeshBasicMaterial`** (card-like) with the same 256² wood / brass albedos as v0.26. No roughness/metalness uniforms — those do not apply to MeshBasic.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal — still **512²** albedo + ORM + `normalMap` on `MeshStandardMaterial`. Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- LOD2 stays v0.27 unlit `MeshBasicMaterial` at 256² wood albedo (`woodFar`). Unchanged this pulse.
- Unique canvases stay **11**. `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture pref still 512 / max 1024 (LOD0); mid/far albedo is 256.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.27.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Author LOD1 as **unlit/basic** (or `KHR_materials_unlit`) with **≤256²** albedo and no `normalTexture` + packed ORM. Author LOD2 the same way (v0.27). The runtime prefers a packaged GLB when present and does **not** rewrite materials at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper mid-distance fragments (skip MeshStandard PBR lighting math at 2.4–4.5 m after the v0.20 ambient-only present path) is the intended delta.

# crate-toolbox v0.29.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.27/v0.28 made mid/far unlit MeshBasic, **LOD2 far body + lid drop the albedo `map`** and use color-only unlit `MeshBasicMaterial` (card-like) with wood albedo midtone **`0x633318`** (`L3_LOD2_WOOD_COLOR` — stripe/pore mid 0.5, knot overlay off; matches a 256² `woodAlbedo` pixel average). No roughness/metalness uniforms — those do not apply to MeshBasic.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal — still **512²** albedo + ORM + `normalMap` on `MeshStandardMaterial`. Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- LOD1 stays v0.28 unlit `MeshBasicMaterial` at 256² wood / brass albedo (`map` only). Unchanged this pulse — do not drop the 256² canvases.
- Unique canvases stay **11** (LOD1 still references both 256² maps; LOD2 no longer samples woodLod). `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture pref still 512 / max 1024 (LOD0); mid albedo is 256; far is color-only.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.28.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Author LOD2 as **unlit/basic** (or `KHR_materials_unlit`) **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). Author LOD1 as unlit/basic with **≤256²** albedo and no `normalTexture` + packed ORM. LOD0 stays full PBR. The runtime prefers a packaged GLB when present and does **not** rewrite materials at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper far fragments (no LOD2 albedo sample / less texture bandwidth on Quest 3 TBDR at ≥4.5 m) is the intended delta.

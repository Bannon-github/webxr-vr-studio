# crate-toolbox v0.30.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.29 dropped the LOD2 albedo `map`, **LOD1 mid body / lid / latch / tool stub drop their 256² albedo `map`s** and use color-only unlit `MeshBasicMaterial` (card-like) with wood albedo midtone **`0x633318`** (`L3_LOD1_WOOD_COLOR` — same derivation as `L3_LOD2_WOOD_COLOR`; stripe/pore mid 0.5, knot overlay off; matches a 256² `woodAlbedo` pixel average) and brass albedo midtone **`0xBE7E31`** (`L3_LOD1_BRASS_COLOR` — 256² `brassAlbedo` pixel average ~190 / 126 / 49). No roughness/metalness uniforms — those do not apply to MeshBasic.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal — still **512²** albedo + ORM + `normalMap` on `MeshStandardMaterial`. Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- LOD2 stays v0.29 color-only unlit `MeshBasicMaterial` at wood midtone `0x633318` (no map). Unchanged this pulse.
- Unique canvases **11 → 9** (stop allocating unused `woodLod` / `brassLod` 256² canvases; LOD0 still owns its own 512² albedo + ORM + normal). `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture pref still 512 / max 1024 (LOD0); mid and far are color-only.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.29.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Author LOD1 and LOD2 as **unlit/basic** (or `KHR_materials_unlit`) **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). LOD0 stays full PBR. The runtime prefers a packaged GLB when present and does **not** rewrite materials at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper mid-distance fragments (no LOD1 albedo sample / less texture bandwidth on Quest 3 TBDR at 2.4–4.5 m) is the intended delta.

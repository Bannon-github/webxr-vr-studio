# crate-toolbox v0.32.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.31 halved LOD0 maps to 256², **procedural LOD0 MeshStandard drops `normalMap`** while keeping **256² albedo + ORM** at `MeshStandardMaterial` (photoreal roughness/metalness maps stay). Do not bind `normalMap` / do not allocate the three LOD0 normal canvases. `L2_TEXTURE_SIZE` stays **256**. `L3_LOD_ALBEDO_SIZE` stays **256** as the historical mid/far half-res constant (v0.26–v0.28).
- LOD1 stays v0.30 color-only unlit `MeshBasicMaterial` (wood albedo midtone **`0x633318`**, brass albedo midtone **`0xBE7E31`**, no map). Unchanged this pulse.
- LOD2 stays v0.29 color-only unlit `MeshBasicMaterial` at wood midtone `0x633318` (no map). Unchanged this pulse.
- Unique canvases **9 → 6** (wood / brass / steel albedo + ORM only). Fastener is not an LOD mesh; it stays on shared LOD0 brass MeshStandard (now albedo+ORM only, no `normalMap`). `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture pref **256** / max 1024 (LOD0 albedo+ORM); mid and far are color-only.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.31.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Author LOD0 PBR that may omit `normalTexture` (albedo + ORM **≤256²**). Author LOD1 and LOD2 as **unlit/basic** (or `KHR_materials_unlit`) **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). The runtime prefers a packaged GLB when present and does **not** rewrite materials at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper LOD0 fragments / less normal-map bandwidth at arm’s length (canvases 9 → 6) is the intended delta.

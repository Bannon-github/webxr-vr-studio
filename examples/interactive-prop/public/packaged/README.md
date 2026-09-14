# Packaged drop (optional)

Place `crate-toolbox.glb` here after the [KTX2 / Quest 3 recipe](../../../docs/performance/ktx2-quest3-packaging.md).

The example probes `/packaged/crate-toolbox.glb` (or `?packaged=`). Missing files must not look like a GLB (Vite may 200 HTML — the probe rejects `text/html`). **No file → procedural color-only MeshBasic (LOD0 / LOD1 / LOD2 unlit, no albedo map, no `normalMap`, no ORM).** The loader does not strip, downsample, or rewrite materials — author LOD0, LOD1, and LOD2 as unlit/basic (or `KHR_materials_unlit`) **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). Do not commit a fake or oversized binary.

Required nodes (same contract as the procedural crate): `collider_grab`, `collider_latch`, `collider_lid`, `collider_tool`, plus `lid` / `latch` / `tool`. Do not use hero meshes as colliders.

**LOD visibility (v0.36):** name visual groups `lod0` / `lod1` / `lod2` (case-insensitive; `lod_0` / `lod-0` also match) or tag `userData.lodLevel` 0/1/2. Ingest wires `userData.lod` and shows only one level (`setToolboxLod` / `updateToolboxLod` / keys `1`/`2`/`3`). Keep `collider_*` and `fastener` / `fastenerMesh` **outside** those groups. If those names are missing, ingest fails soft: every authored visual stays visible (no fake LODs).

**Same-material batches (v0.37 procedural; author the GLB the same way):** merge static meshes that share a material **inside** each `lod*` group. Do not flatten lid / latch / tool into the body, and do not merge the fastener into an LOD node. Ingest still does not merge or rewrite materials.

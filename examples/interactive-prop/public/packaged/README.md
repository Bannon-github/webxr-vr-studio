# Packaged drop (optional)

Place `crate-toolbox.glb` here after the [KTX2 / Quest 3 recipe](../../../docs/performance/ktx2-quest3-packaging.md).

The example probes `/packaged/crate-toolbox.glb` (or `?packaged=`). Missing files must not look like a GLB (Vite may 200 HTML — the probe rejects `text/html`). **No file → procedural canvases (512² LOD0 MeshStandard; 256² LOD1 MeshBasic unlit; color-only LOD2 MeshBasic unlit).** The loader does not strip, downsample, or rewrite materials — author LOD1 as unlit/basic (or `KHR_materials_unlit`) with ≤256² albedo and no normal/ORM; author LOD2 as unlit/basic **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). Do not commit a fake or oversized binary.

Required nodes (same contract as the procedural crate): `collider_grab`, `collider_latch`, `collider_lid`, `collider_tool`, plus `lid` / `latch` / `tool`. Keep LOD groups and do not use hero meshes as colliders.

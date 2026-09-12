# Packaged drop (optional)

Place `crate-toolbox.glb` here after the [KTX2 / Quest 3 recipe](../../../docs/performance/ktx2-quest3-packaging.md).

The example probes `/packaged/crate-toolbox.glb` (or `?packaged=`). Missing files must not look like a GLB (Vite may 200 HTML — the probe rejects `text/html`). **No file → procedural canvases (512² LOD0; 256² LOD1/LOD2 albedo).** The loader does not strip or downsample maps — author mid/far albedo at ≤256². Do not commit a fake or oversized binary.

Required nodes (same contract as the procedural crate): `collider_grab`, `collider_latch`, `collider_lid`, `collider_tool`, plus `lid` / `latch` / `tool`. Keep LOD groups and do not use hero meshes as colliders.

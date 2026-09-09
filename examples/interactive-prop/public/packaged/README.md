# Packaged drop (optional)

Place `crate-toolbox.glb` here after the [KTX2 / Quest 3 recipe](../../../docs/performance/ktx2-quest3-packaging.md).

The example probes `/packaged/crate-toolbox.glb` (or `?packaged=`). **404 → procedural 512² canvases.** Do not commit a fake or oversized binary.

Required nodes (same contract as the procedural crate): `collider_grab`, `collider_latch`, `collider_lid`, `collider_tool`, plus `lid` / `latch` / `tool`. Keep LOD groups and do not use hero meshes as colliders.

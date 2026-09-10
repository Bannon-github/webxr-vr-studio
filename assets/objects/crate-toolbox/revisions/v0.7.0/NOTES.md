# crate-toolbox v0.7.0

L3 packaging UPGRADE on the same `objectId`. No GLB in this folder. Not a new layer.

- Recipe: `docs/performance/ktx2-quest3-packaging.md` (`gltf-transform` resize / uastc / etc1s / meshopt).
- Runtime: `examples/interactive-prop` probes `/packaged/crate-toolbox.glb` (or `?packaged=`). 404 → v0.6 procedural 512² albedo+ORM.
- Drop a real KTX2 GLB with the same `collider_*` / lid / latch / tool names; do not commit a fake binary.
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024).
- Quest 3 frame time / FFR still **unmeasured**.

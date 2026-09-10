# crate-toolbox v0.3.0

Procedural stand-in — no `current.glb`.

L3 added beside existing LOD0 (not a replace):

| Level | Tris | Draws | Visual |
| --- | --- | --- | --- |
| LOD0 | 240 | 14 | Hollow walls + planks + 12-seg tool |
| LOD1 | 96 | 8 | Hollow walls, no planks; lid/latch boxes; tool as one box |
| LOD2 | 24 | 2 | Single body box + lid box |

Counts from Three.js geometry indexes (`BoxGeometry` = 12, `CylinderGeometry` 12 radial = 48). Not Quest 3 GPU time.

Switch: camera distance 2.4 m → LOD1, 4.5 m → LOD2, ±0.2 m hysteresis. Colliders unchanged on `collider_*` hulls.

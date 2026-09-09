# crate-toolbox v0.6.0

L2 quality UPGRADE on the same `objectId`. No GLB. Not a new layer.

- Flat `MeshStandardMaterial` colors replaced by **six 512² canvases**: wood / brass / steel albedo + ORM (R unused / G roughness / B metalness). Dark wood and tool grip reuse the wood maps with a color tint.
- Five shared materials (same as v0.5.0). LOD draws unchanged: 14 / 8 / 2 + fastener 1.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.5.0 set.
- **KTX2 / Basis** is the next packaging step when a DCC GLB lands. Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**.

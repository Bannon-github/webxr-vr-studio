# crate-toolbox v0.12.0

L2 quality UPGRADE on the same `objectId`. No GLB. Not a new layer.

- v0.6 albedo + ORM canvases gain **three 512² normal maps** (wood / brass / steel). Heights follow the same grain, tarnish/scratch, and brush functions so lighting matches color. OpenGL +Y for Three.js `MeshStandardMaterial.normalMap`; modest `normalScale` (wood 0.62, brass 0.30, steel 0.38).
- Still five shared materials. Unique canvases 6 → 9. LOD draws unchanged: 14 / 8 / 2 + fastener 1.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.11.0 set. v0.8 allocation scrub, v0.9 hand hover, v0.10 tracking-loss release, and v0.11 visibility-loss release stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`normalTexture` → UASTC). Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**.

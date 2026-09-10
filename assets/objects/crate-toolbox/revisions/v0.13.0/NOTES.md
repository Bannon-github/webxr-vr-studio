# crate-toolbox v0.13.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.12 normals on all five shared materials, **LOD2 no longer binds `normalMap`**. LOD2 is a solid wood box + lid (24 tris / 2 draws). Those two meshes now use a sixth material: same wood albedo + ORM, `normalMap = null`.
- LOD0 keeps v0.12 OpenGL +Y normals for arm’s-length photoreal. LOD1 keeps the same shared materials (simpler than a second split / reduced `normalScale`). Fastener is not an LOD mesh; it stays on shared brass.
- `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture authoring still 512² / max 1024.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.12.0 set. v0.8 allocation scrub, v0.9 hand hover, v0.10 tracking-loss release, and v0.11 visibility-loss release stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. Far LOD primitives should omit `normalTexture` the same way. Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**.

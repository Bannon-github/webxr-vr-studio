# crate-toolbox v0.23.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.13 dropped `normalMap` on LOD2 and v0.14 halved LOD1 `normalScale`, **LOD2 no longer binds packed ORM**. LOD2 is a solid wood box + lid (24 tris / 2 draws). Those two meshes still share one far wood material (`woodFar`): same 512² albedo, `normalMap = null`, and now `{ ormMap: false }` — no `roughnessMap` / `metalnessMap`.
- Constant roughness **220/255** and metalness **8/255** match wood ORM midtones (`woodOrm` G = 200 + stripe×40 at stripe 0.5; B is authored 8). That keeps `MeshStandardMaterial` lit under the present-path ambient fill without sampling ORM at LOD2 distances.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM for arm’s-length photoreal. LOD1 keeps albedo + ORM + `normalMap` at half `normalScale`. Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Unique canvases still 9. Texture authoring still 512² / max 1024.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.22.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. Far LOD primitives should omit `normalTexture` and packed ORM the same way. Not in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper far-fragment texture samples (albedo-only) is the intended delta.

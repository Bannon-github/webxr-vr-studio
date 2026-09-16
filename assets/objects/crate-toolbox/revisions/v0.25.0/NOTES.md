# crate-toolbox v0.25.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.13 dropped `normalMap` on LOD2, v0.14 halved LOD1 `normalScale`, v0.23 dropped packed ORM on LOD2, and v0.24 dropped LOD1 `normalMap`, **LOD1 no longer binds packed ORM**. LOD1 body / lid / latch / tool stub still share separate mid materials (`woodMid` / `woodDarkMid` / `brassMid` / `handleMatMid`): same 512² albedo, `{ normalMap: false, ormMap: false }` — `normalMap = null`, no `roughnessMap` / `metalnessMap`.
- Wood / woodDark / handle mid use constant roughness **220/255** and metalness **8/255** (same wood ORM midtones as LOD2: `woodOrm` G = 200 + stripe×40 at stripe 0.5; B is authored 8). Brass latch mid uses constant roughness **95/255** and metalness **230/255** (`brassOrm` G = 70 + n×50 + tarnish×90 at n 0.5 / tarnish 0; B = 230 − tarnish×80). That keeps `MeshStandardMaterial` lit under the present-path ambient fill without sampling ORM at 2.4–4.5 m. LOD1 has no steel mesh (tool stub uses wood-tinted handleMatMid).
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal. LOD2 stays v0.23 albedo-only (`woodFar`: no `normalMap`, no ORM; wood-ORM-midtone constants). Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Unique canvases still 9. Texture authoring still 512² / max 1024.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.24.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Mid LOD primitives should omit `normalTexture` and packed ORM (albedo only), like LOD2. The runtime prefers a packaged GLB when present and does **not** strip maps at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper mid-fragment texture samples (no packed ORM) is the intended delta.

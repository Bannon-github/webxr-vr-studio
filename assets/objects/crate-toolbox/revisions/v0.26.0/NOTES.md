# crate-toolbox v0.26.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.25 made LOD1 albedo-only (and v0.23 did the same for LOD2), **LOD1 and LOD2 no longer bind the shared 512² L2 albedos**. Mid/far wood and brass use dedicated **256²** albedo canvases (`L3_LOD_ALBEDO_SIZE`). LOD1 wood / woodDark / handle and LOD2 `woodFar` share one 256² wood albedo; LOD1 brass latch has its own 256² brass albedo. Steel has no mid/far mesh (LOD1 tool stub stays wood-tinted).
- Mid/far stay albedo-only as in v0.25: `{ normalMap: false, ormMap: false }` — no `normalMap`, no `roughnessMap` / `metalnessMap`. Wood / handle / far wood keep constant roughness **220/255** and metalness **8/255**. Brass latch mid keeps **95/255** / **230/255**. That keeps `MeshStandardMaterial` lit under the present-path ambient fill.
- LOD0 keeps v0.12 OpenGL +Y normals + ORM at full modest `normalScale` for arm’s-length photoreal — still **512²** albedo + ORM + `normalMap`. Fastener is not an LOD mesh; it stays on shared LOD0 brass.
- Unique canvases rise **9 → 11** (the original 512² wood/brass/steel albedo+ORM+normal set, plus the two 256² mid/far albedos). `setToolboxLod` is still visibility-only (no per-switch material swap, no frame-loop allocation). Draws unchanged: 14 / 8 / 2 + fastener 1. Texture pref still 512 / max 1024 (LOD0); mid/far albedo is 256.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.25.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands (`docs/performance/ktx2-quest3-packaging.md`). Author LOD1/LOD2 albedo at **≤256²** and omit `normalTexture` + packed ORM. The runtime prefers a packaged GLB when present and does **not** strip or downsample maps at ingest. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Cheaper mid/far texture bandwidth / footprint (half-res albedo) is the intended delta.

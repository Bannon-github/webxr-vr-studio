# crate-toolbox v0.40.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.39 welded coincident vertices (and kept UV / normal channels), **that helper strips unused `uv` / `normal` (plus `uv1` / `uv2` / `uv3` / `tangent` / unused `color`) when the material is color-only unlit MeshBasic** — no `map` / `lightMap` / `aoMap` / `specularMap` / `alphaMap` / `envMap`. Color-only MeshBasic does not sample UVs or use normals for lighting. Mapped or lit materials keep their attributes. Single-mesh groups still skip concat/weld but still strip unused attrs. Weld itself is unchanged (still keeps channels). Does **not** cross `body` / `lidPivot` / `latchPivot` / `tool`, colliders, or the fastener (`fastener` / `fastenerMesh` — fastener stays outside the helper). Materials are not rewritten. Missing LOD names still fail soft (v0.36).
- Author may **omit unused attributes in DCC**; runtime strip is a safety net for procedural + merged packaged meshes that share `mergeSameMaterialMeshes`.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts (v0.39 weld) | attrBytes v0.39 (uv+normal kept) | attrBytes v0.40 (position-only + index) |
  | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | **230** | 8800 | **4200** |
  | LOD1 | **4** | **96** | **100** | 3776 | **1776** |
  | LOD2 | **2** | **24** | **48** | 1680 | **720** |
  | Fastener (not LOD) | 1 | 12 | — | — | — (helper does not touch fastener) |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | |

  Delta is 20 bytes/vert (normal 12 + uv 8) × unique verts: LOD0 −4600, LOD1 −2000, LOD2 −960. Draws / tris / unique verts unchanged vs v0.39.
- **Unit/mock evidence** (not headset): packaged `lod0` 3 coincident `MeshBasic` boxes share one material → 1 mesh, tris 36 unchanged, unique verts **8** (v0.39 weld). After strip: `uv` / `normal` absent; attrBytes **2992 → 1392**. Direct `stripUnusedColorOnlyAttributes` on one `BoxGeometry` is 840 → 360 (24 verts × 12 B position + 72 B Uint16 index). Mapped MeshBasic and MeshStandard keep `uv` / `normal`.
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.39.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.40 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. A tighter GPU attribute footprint after weld (position-only on color-only MeshBasic) is the intended delta.

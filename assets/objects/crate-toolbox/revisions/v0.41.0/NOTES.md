# crate-toolbox v0.41.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.40 stripped unused `uv` / `normal` on color-only MeshBasic **inside** `mergeSameMaterialMeshes`, **that helper compactIndexToUint16-copies a >16-bit index into Uint16** when `position.count` ≤ 65535 (no-op if no index, verts exceed 65535, or the index is already ≤2 bytes/element). Does **not** change triangle count or vertex count. `concatGeometries` always builds Uint32; `weldCoincidentVertices` only rewrites to Uint16 when it actually reduces verts (`next === vertexCount` early-return leaves Uint32). Compact is the safety net for that path and for packaged meshes that arrive with a 32-bit index. Single-mesh groups still skip concat/weld but still strip unused attrs and compact. Does **not** cross `body` / `lidPivot` / `latchPivot` / `tool`, colliders, or fold the fastener into an LOD batch. Materials are not rewritten. Missing LOD names still fail soft (v0.36).
- **`fastenerMesh` stays outside the LOD merge skip set** (still not an LOD mesh) but now gets the **same unused-attr strip + compact** after procedural create, and on packaged ingest when an authored root-level `fastener` / `fastenerMesh` MeshBasic exists. Do not invent a fastener.
- Author may **pre-weld and emit Uint16** (and omit unused attrs) in DCC; runtime compact + strip is a safety net for procedural + packaged meshes that share `mergeSameMaterialMeshes`.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts (v0.39 weld) | attrBytes v0.40 (position-only + index) | attrBytes v0.41 |
  | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | **230** | 4200 | **4200** (already Uint16 after weld) |
  | LOD1 | **4** | **96** | **100** | 1776 | **1776** (already Uint16 after weld) |
  | LOD2 | **2** | **24** | **48** | 720 | **720** (BoxGeometry already Uint16) |
  | Fastener (not LOD) | 1 | 12 | 24 | 840 (uv+normal kept) | **360** (position-only + Uint16 index) |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | |

  LOD compact is a no-op on the current procedural path (hypothesis confirmed). Fastener unused-attr strip is the attrBytes win (−480 B: normal 12 + uv 8 × 24 verts). Draws / tris / unique verts unchanged vs v0.40.
- **Unit/mock evidence** (not headset): forced Uint32 index on a color-only MeshBasic `BoxGeometry` (`position.count` ≤ 65535) → Uint16, index byte length **halves**, tris/verts unchanged. Two offset `PlaneGeometry` siblings (weld early-return, concat Uint32) compact to Uint16 (12 indices × 2 B). Packaged `lod0` 3 coincident `MeshBasic` boxes stay 8 unique verts / 36 tris; attrBytes stay **1392**.
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.40.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.41 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. A tighter index width on weld-noop / packaged Uint32 meshes, plus a smaller fastener attribute footprint, is the intended delta.

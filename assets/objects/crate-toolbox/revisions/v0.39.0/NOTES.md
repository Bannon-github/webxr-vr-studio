# crate-toolbox v0.39.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.38 ran `mergeSameMaterialMeshes` on packaged `lod0` / `lod1` / `lod2` nodes (and v0.37 on the procedural path), **that helper welds coincident vertices after concat**. Hash is Three.js `mergeVertices`-style truncation on **position** only (1e-4 m). UV / normal / other attribute *channels* stay — the surviving vertex keeps the first-seen values. Weld does **not** drop triangles (index length / 3 stays the concatenated envelope). Single-mesh groups are still no-ops (no concat → no weld). Does **not** cross `body` / `lidPivot` / `latchPivot` / `tool`, colliders, or the fastener (`fastener` / `fastenerMesh`). Materials are not rewritten. Missing LOD names still fail soft (v0.36).
- Author still prefers **pre-welded batches in DCC**; runtime weld is a safety net after same-material merge. Mapped UV islands at coincident corners may keep the first vertex's UV — weld in DCC if that matters.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts v0.38 concat | Unique verts v0.39 weld | attrBytes v0.38 concat (Uint32 on merged) | attrBytes v0.39 |
  | --- | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | 440 | **230** | 16456 | **8800** |
  | LOD1 | **4** | **96** | 192 | **100** | 7080 | **3776** |
  | LOD2 | **2** | **24** | 48 | **48** (no concat) | 1680 | **1680** |
  | Fastener (not LOD) | 1 | 12 | — | — | — | — |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | | |

  LOD0 breakdown after weld: `bodyL0` 8 wood boxes concat 192 → **48** unique verts (96 tris); `lidL0` / `latchL0` unmerged boxes stay 24 verts; `toolL0` steel shaft+tip concat 100 → **34**; wood grip unmerged cylinder stays 76. LOD1: `bodyL1` 5 boxes 120 → **28**. LOD2 unchanged (one box each, no merge).
- **Unit/mock evidence** (not headset): packaged `lod0` 3 coincident `MeshBasic` boxes share one material → 1 mesh, tris 36 unchanged, unique verts **72 → 8**. Direct `weldCoincidentVertices` on one `BoxGeometry` is 24 → 8 (used only after concat of 2+ meshes in the helper).
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.38.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.39 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Fewer unique verts / a tighter GPU attribute footprint after merge is the intended delta.

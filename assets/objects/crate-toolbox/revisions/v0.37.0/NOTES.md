# crate-toolbox v0.37.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.36 wired packaged `lod0` / `lod1` / `lod2` visibility, **procedural LOD0 and LOD1 merge meshes that share a material instance inside each static lodGroup**. Merge is load-time only (not per-frame). Groups stay separate: do **not** merge across `body` / `lidPivot` / `latchPivot` / `tool`. The fastener (`fastenerMesh`) is not an LOD mesh and is not merged into latch/lid brass.
- Duplicate same-color unlit MeshBasics collapse so merged meshes share one instance: LOD0 `wood` / `woodDark` / `handleMat` → one `L3_LOD0_WOOD_COLOR` (`0x633318`) MeshBasic; LOD1 `wood` / `woodDark` / `handleMat` → one `L3_LOD1_WOOD_COLOR` instance. Brass and steel stay their own materials. `userData.materials` keeps the old keys as aliases.
- Named meshes required by tests stay: `lidMesh` (wood lid under the lid pivot), `latchMesh` (brass under the latch pivot), `fastenerMesh` (root, not an LOD mesh). Tool parts are unnamed; steel shaft + tip concatenate into one mesh, wood grip stays.
- **Measured** `userData.lod.stats` (Three.js index counts via `countGroupStats`; colliders skipped):

  | Level | Before (v0.36) | After (v0.37) |
  | --- | --- | --- |
  | LOD0 | 240 tris / **14** draws | 240 tris / **6** draws |
  | LOD1 | 96 tris / **8** draws | 96 tris / **4** draws |
  | LOD2 | 24 tris / 2 draws | 24 tris / 2 draws |
  | Fastener (not LOD) | 12 tris / 1 draw | 12 tris / 1 draw |
  | `drawCallsEstimate` (LOD0 + fastener) | 15 | **7** |

  LOD0 breakdown after merge: `bodyL0` 1 wood (was 8 boxes), `lidL0` wood `lidMesh` + brass plaque (2), `latchL0` brass `latchMesh` (1), `toolL0` steel + wood grip (2). LOD1: `bodyL1` 1 wood (was 5 boxes) + lid + latch + tool stub. Tris are the sum of concatenated Box/Cylinder indices — **no weld**, so counts match v0.13–v0.36.
- Packaged GLB ingest from v0.36 is **unchanged**: discover `lod0` / `lod1` / `lod2` (or `userData.lodLevel`), `attachToolboxLod` + `setToolboxLod(..., 0)`, fail soft when unnamed (no fake LODs). Loader still does **not** rewrite materials or merge at ingest. Author static same-material batches inside each `lod*` group in DCC if you want the same draw cut on a packaged hero; do not flatten across pivots or fold colliders/fastener into an LOD node.
- Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.36.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.37 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Fewer procedural hero-LOD draws is the intended delta.

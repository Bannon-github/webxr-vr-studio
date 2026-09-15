# crate-toolbox v0.42.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.41 compacted lingering Uint32 indices (and stripped fastener attrs), **procedural `createToolbox` shares identical color-only unlit `MeshBasicMaterial` instances across LOD levels when the midtone hex is the same** (`shareColorOnlyUnlitBasic` cache). v0.37 already aliased woodDark/handleMat to wood *within* a LOD; v0.42 aliases **across** LODs. Does **not** merge meshes across `body` / `lidPivot` / `latchPivot` / `tool`, fold the fastener into an LOD batch (`fastener` / `fastenerMesh` stay outside `LOD_MERGE_SKIP_NAMES`), rewrite material type, invent a GLB, or change L4/L5 interaction. Named meshes `lidMesh` / `latchMesh` / `fastenerMesh` kept. The v0.37–v0.41 merge → weld → unused-attr strip → Uint16 compact pipeline stays intact (including fastener pack).
- **Verified constants** (do not assume): `L3_LOD0_WOOD_COLOR` / `L3_LOD1_WOOD_COLOR` / `L3_LOD2_WOOD_COLOR` are all `0x633318`. `L3_LOD0_BRASS_COLOR` / `L3_LOD1_BRASS_COLOR` are both `0xBE7E31`. Steel stays LOD0-only (`L3_LOD0_STEEL_COLOR` / `0xC1C3C9`).
- **Packaged ingest does not hex-dedupe.** Same-hex MeshBasics can still differ in `side` / `opacity` / `transparent`; multi-material slots must stay intact. Author shared glTF material slots in DCC. Procedural-only is the v0.42 delta.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts (v0.39 weld) | attrBytes (v0.41 envelope) | Unique MeshBasic |
  | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | **230** | **4200** | wood + brass + steel |
  | LOD1 | **4** | **96** | **100** | **1776** | same wood + same brass |
  | LOD2 | **2** | **24** | **48** | **720** | same wood |
  | Fastener (not LOD) | 1 | 12 | 24 | **360** | same brass |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | |

  Unique procedural MeshBasic instances **6 → 3** (wood×3 + brass×2 + steel×1, counting v0.37 within-LOD aliases, collapse to one wood + one brass + one steel). `userData.l2.uniqueMaterials` **3**. Draws / tris / unique verts / attrBytes unchanged vs v0.41.
- **Unit/mock evidence** (not headset): `shareColorOnlyUnlitBasic` returns the same object for matching wood hexes and matching brass hexes; cache size 3. Bound visual meshes (LOD0/1/2 + fastener, colliders skipped) resolve to those three instances. LOD0 wood === LOD1 wood === LOD2 wood; LOD0 brass === LOD1 brass === fastener.
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.41.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.42 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Fewer duplicate MeshBasic instances (less material-state churn when switching LODs) is the intended delta; headset ms still **TODO**.

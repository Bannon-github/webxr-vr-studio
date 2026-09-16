# crate-toolbox v0.43.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.42 shared color-only MeshBasic instances across LODs, **`packColorOnlyGeometry` (strip → Uint16 compact → this step) sets `StaticDrawUsage` and Three r170 `BufferAttribute.onUpload` so the first GPU upload releases CPU `.array` on color-only unlit MeshBasic LOD0/1/2 + fastener geometries**. Procedural create and packaged ingest share the helper. Does **not** merge meshes across `body` / `lidPivot` / `latchPivot` / `tool`, fold the fastener into an LOD batch (`fastener` / `fastenerMesh` stay outside `LOD_MERGE_SKIP_NAMES`), rewrite material type, invent a GLB, or change L4/L5 interaction. Named meshes `lidMesh` / `latchMesh` / `fastenerMesh` kept. The v0.37–v0.42 merge → weld → unused-attr strip → Uint16 compact → shared MeshBasic pipeline stays intact.
- **Verified r170 API (do not assume):** `BufferAttribute.usage` defaults to `StaticDrawUsage` (`35044`); `setUsage` / `onUpload(callback)` are the public hooks. `WebGLAttributes.createBuffer` copies `.array` into `bufferData` *before* `onUploadCallback()`, then uses that local for type detection — nulling `.array` in the hook is safe. Interleaved / morph geometries are skipped.
- **Raycast / LOD safety (verified in-repo, not a hunch):** `firstHit` / `collectPickables` use collider AABB slabs (`userData.size`), not visual `BufferGeometry` arrays. `setToolboxLod` is visibility-only. Bounds are computed at pack time so frustum culls do not need `.array` after upload. Collider hulls are **not** packed.
- **Measurement rule:** `userData.lod.stats.attrBytes` is the **pre-upload** CPU envelope (arrays still present at `attachToolboxLod`). After simulated / real GPU upload, live CPU attrBytes on those visuals → **0**; `BufferAttribute.count` (draws / tris / verts) stays.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts (v0.39 weld) | attrBytes (pre-upload v0.42 envelope) | Unique MeshBasic |
  | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | **230** | **4200** | wood + brass + steel |
  | LOD1 | **4** | **96** | **100** | **1776** | same wood + same brass |
  | LOD2 | **2** | **24** | **48** | **720** | same wood |
  | Fastener (not LOD) | 1 | 12 | 24 | **360** | same brass |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | |

  Unique procedural MeshBasic instances stay **3**. `userData.l2.uniqueMaterials` **3**. Draws / tris / unique verts / pre-upload attrBytes unchanged vs v0.42. After simulated upload, CPU attrBytes on those 13 visual geos → 0.
- **Unit/mock evidence** (not headset): `releaseCpuArraysOnGpuUpload` nulls position/index `.array` after `onUploadCallback` only on color-only MeshBasic; mapped MeshBasic and MeshStandard keep arrays. Packaged ingest of a mock `lod0` + fastener hooks the same path; `collider_grab` arrays stay. Procedural colliders survive a default `onUploadCallback`.
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.42.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.43 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Dropping CPU copies of static GPU buffers after first upload is the intended delta; headset ms still **TODO**.

# crate-toolbox v0.44.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.43 hooked post-upload CPU-array release, **`packColorOnlyGeometry` (strip → Uint16 compact → this step → StaticDrawUsage + onUpload) quantizes Float32 `position` to Three r170 `Float16BufferAttribute` on color-only unlit MeshBasic LOD0/1/2 + fastener geometries**. Procedural create and packaged ingest share the helper. Does **not** merge meshes across `body` / `lidPivot` / `latchPivot` / `tool`, fold the fastener into an LOD batch (`fastener` / `fastenerMesh` stay outside `LOD_MERGE_SKIP_NAMES`), rewrite material type, invent a GLB, or change L4/L5 interaction. Named meshes `lidMesh` / `latchMesh` / `fastenerMesh` kept. The v0.37–v0.43 merge → weld → unused-attr strip → Uint16 compact → shared MeshBasic → upload-release pipeline stays intact.
- **Verified r170 API (do not assume):** `Float16BufferAttribute` stores IEEE-754 binary16 bits in a `Uint16Array` and sets `isFloat16BufferAttribute`. `WebGLAttributes.createBuffer` uploads that as `gl.HALF_FLOAT` (WebGL2). The constructor `new Float16BufferAttribute(float32Array, 3)` is **not** a half-float encode — it does `super(new Uint16Array(array))` (ToUint16 truncation). This revision encodes with `setXYZ` (r170 override calls `DataUtils.toHalfFloat`). `getX`/`getY`/`getZ` decode via `fromHalfFloat`. Interleaved / morph / non-Float32 positions are skipped.
- **Raycast / LOD safety (verified in-repo, not a hunch):** `firstHit` / `collectPickables` use collider AABB slabs (`userData.size`), not visual `BufferGeometry` arrays. `setToolboxLod` is visibility-only. Bounds are **recomputed after quantize** (`Box3.setFromBufferAttribute` → `Vector3.fromBufferAttribute`) so frustum culls match GPU verts before `onUpload` nulls `.array`. Collider hulls are **not** packed (stay Float32).
- **Measurement rule:** `userData.lod.stats.attrBytes` is the **pre-upload** CPU envelope (arrays still present at `attachToolboxLod`). After simulated / real GPU upload, live CPU attrBytes on those visuals → **0**; `BufferAttribute.count` (draws / tris / verts) stays.
- **Measured** `userData.lod.stats` (Three.js index counts + `position.count` + attribute/index byte length via `countGroupStats`; colliders skipped; unit tests, **not** headset):

  | Level | Draws | Tris (index/3) | Unique verts (v0.39 weld) | attrBytes (pre-upload v0.44 Float16) | Unique MeshBasic |
  | --- | --- | --- | --- | --- | --- |
  | LOD0 | **6** | **240** | **230** | **2820** (was 4200) | wood + brass + steel |
  | LOD1 | **4** | **96** | **100** | **1176** (was 1776) | same wood + same brass |
  | LOD2 | **2** | **24** | **48** | **432** (was 720) | same wood |
  | Fastener (not LOD) | 1 | 12 | 24 | **216** (was 360) | same brass |
  | `drawCallsEstimate` (LOD0 + fastener) | **7** | | | | |

  Unique procedural MeshBasic instances stay **3**. `userData.l2.uniqueMaterials` **3**. Draws / tris / unique verts unchanged vs v0.43. r170 stores half-float as `Uint16Array` (`BYTES_PER_ELEMENT` 2) so the expected envelope matches: 230×3×2 + 240×3×2 = 2820, etc. After simulated upload, CPU attrBytes on those 13 visual geos → 0.
- **Unit/mock evidence** (not headset): `quantizePositionToFloat16` sets `isFloat16BufferAttribute` only on color-only MeshBasic; mapped MeshBasic and MeshStandard stay Float32. Packaged ingest of a mock `lod0` + fastener takes the same path; `collider_grab` stays Float32. Bounds exist after quantize, before `onUpload`.
- Named meshes required by tests stay: `lidMesh`, `latchMesh`, `fastenerMesh`. Unique canvases stay **0**. Color-only unlit MeshBasic on LOD0 / LOD1 / LOD2. `setToolboxLod` is still visibility-only. Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.43.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.44 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Half-float positions on color-only MeshBasic is the intended delta; headset ms still **TODO**.

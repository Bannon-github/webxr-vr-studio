# Changelog

All notable changes to this knowledge base are documented here.

## [0.106.0] — 2026-09-24

### Changed

- `crate-toolbox` **v1.4.0** L3 packaging/perf UPGRADE: after the v1.3.0 Mesh / Object3D `name` pin (`mesh.name === ''` on non-reserved packed color-only unlit MeshBasic visual meshes; mesh-name-empty 10; reserved `lidMesh` / `latchMesh` / `fastenerMesh` / `collider_*` stay), also pin leftover Mesh / Object3D `userData` to the r170 constructor default empty plain object (`mesh.userData` is a fresh `{}` with `Object.prototype` and no own keys) on those same visual meshes (body LOD leaves + lid/latch/tool + fastener; reserved-name visuals are included). `pinColorOnlyUnlitBasicMeshUserData` / `pinColorOnlyVisualMeshUserData` run after `pinColorOnlyVisualMeshName` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign a fresh `mesh.userData = {}` only when it is not already an empty plain object (missing, non-object, any own string or symbol keys, or a prototype other than `Object.prototype`). Do not share one `{}` across meshes. An already-empty plain object is left as-is. Do not replace the mesh, the material, the geometry, the attributes, or the typed arrays. Do not touch Mesh / Object3D `name` (v1.3.0 mesh-name-empty stays; reserved names stay). Do not touch Material `name` (v1.2.0 material-name-empty stays) or Material `userData` (v1.1.0 material-userData-empty stays). Do not touch BufferGeometry `userData` / `name`. Do not touch entity / root `userData` or tool Group `userData`. Collider meshes stay untouched. Do not change `frustumCulled`, `matrixAutoUpdate`, or `mesh.visible`. Checked installed three@0.170.0: the Object3D constructor assigns `this.userData = {}`. Mesh does not override `userData`. `Object3D.toJSON` writes `object.userData` only when `Object.keys(this.userData).length > 0`. `Object3D.copy` assigns `this.userData = JSON.parse(JSON.stringify(source.userData))`. `ObjectLoader.parseObject` assigns `object.userData = data.userData` when `data.userData !== undefined`. Stock GLTFLoader `loadMesh` calls `assignExtrasToUserData(mesh, meshDef)` and `_loadNodeShallow` calls `assignExtrasToUserData(node, nodeDef)` (a single-primitive node is the mesh, so node extras land on `mesh.userData`). `assignExtrasToUserData` `Object.assign`s extras onto `userData`. `WebGLRenderer` does not read `mesh.userData`. Clearing leftover extras to a fresh `{}` is load-time packaging only: no draw / tri / attrBytes change. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10 stay vs v1.3.0. mesh-userData-empty 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.105.0] — 2026-09-24

### Changed

- `crate-toolbox` **v1.3.0** L3 packaging/perf UPGRADE: after the v1.2.0 Material `name` pin (`material.name === ''` on the 3 shared color-only unlit MeshBasic materials), also pin leftover Mesh / Object3D `name` to the r170 constructor default empty string (`mesh.name === ''`) on packed color-only unlit MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener). Reserved names stay: `lidMesh`, `latchMesh`, `fastenerMesh`, and any `collider_*` mesh name. `pinColorOnlyUnlitBasicMeshName` / `pinColorOnlyVisualMeshName` run after `pinColorOnlyVisualMaterialName` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `mesh.name = ''` in place only when it is not already `''` and the name is not reserved. Do not replace the mesh, the material, the geometry, the attributes, or the typed arrays. Do not touch Material `name` (v1.2.0 material-name-empty stays) or Material `userData` (v1.1.0 material-userData-empty stays). Do not touch BufferGeometry `userData` / `name`. Do not touch Mesh / Object3D `userData`. Do not change `frustumCulled`, `matrixAutoUpdate`, or `mesh.visible`. Checked installed three@0.170.0: the Object3D constructor assigns `this.name = ''`. Mesh does not override `name`. `Object3D.toJSON` writes `object.name` only when `this.name !== ''`. `Object3D.copy` copies `source.name`. `ObjectLoader.parseObject` assigns `object.name = data.name` when `data.name !== undefined`. Stock GLTFLoader `loadMesh` assigns `mesh.name` from `meshDef.name` (or `mesh_` + index) and `_loadNodeShallow` assigns `node.name` when the node has a name (a single-primitive node is the mesh). `WebGLRenderer` does not read `mesh.name`. `WebGLPrograms.getParameters` copies `shaderName: material.name`, not the mesh name, so a leftover mesh name does not fork the program cache or change the draw. Clearing non-reserved names to `''` is load-time packaging only: no draw / tri / attrBytes change. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13 stay vs v1.2.0. mesh-name-empty 10 is the new count (LOD0 4 / LOD1 4 / LOD2 2; `lidMesh`, `latchMesh`, and `fastenerMesh` stay named). Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.104.0] — 2026-09-24

### Changed

- `crate-toolbox` **v1.2.0** L3 packaging/perf UPGRADE: after the v1.1.0 Material `userData` pin (`material.userData = {}` on the 3 shared color-only unlit MeshBasic materials), also pin leftover Material `name` to the r170 constructor default empty string (`material.name === ''`) on those same materials (wood / brass / steel; unique MeshBasic stays 3; first-class measured material-name-empty). `pinColorOnlyUnlitBasicMaterialName` / `pinColorOnlyVisualMaterialName` run after `pinColorOnlyVisualMaterialUserData` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `material.name = ''` in place only when it is not already `''`. Do not replace the material, the geometry, the attributes, or the typed arrays. Do not touch Material `userData` (v1.1.0 material-userData-empty stays). Do not touch prior material program-cache / flag pins. Do not touch BufferGeometry `userData` / `name`. Do not touch Mesh / Object3D `userData`. Checked installed three@0.170.0: the Material constructor assigns `this.name = ''`. `Material.toJSON` writes `name` only when `this.name !== ''`. `Material.copy` copies `source.name`. `MaterialLoader` / `ObjectLoader.parseMaterials` assign `json.name` when present. Stock GLTFLoader `loadMaterial` assigns `material.name = materialDef.name` when `materialDef.name` is set. `WebGLRenderer` does not read `material.name`. `WebGLPrograms.getParameters` copies `shaderName: material.name` and `WebGLProgram` emits `#define SHADER_NAME` from that parameter, but `getProgramCacheKey` does not include `shaderName`, so a leftover name does not fork the program cache or change the draw. Clearing leftover names to `''` is load-time packaging only: no draw / tri / attrBytes change. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, version-zero 13 stay vs v1.1.0. material-name-empty 3 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.103.0] — 2026-09-24

### Changed

- `crate-toolbox` **v1.1.0** L3 packaging/perf UPGRADE: after the v1.0.0 BufferGeometry `userData` pin (`geometry.userData = {}` on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover Material `userData` to the r170 constructor default empty plain object (`material.userData = {}`) on the shared color-only MeshBasic materials those visuals use (wood / brass / steel; unique MeshBasic stays 3; first-class measured material-userData-empty). `pinColorOnlyUnlitBasicMaterialUserData` / `pinColorOnlyVisualMaterialUserData` run after `pinColorOnlyVisualGeometryUserData` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign a fresh `material.userData = {}` in place only when it is not already an empty plain object (missing, non-object, any own string or symbol keys, or a prototype other than `Object.prototype`). Do not share one `{}` across materials. An already-empty plain object is left as-is. Do not replace the material, the geometry, the attributes, or the typed arrays. Do not touch Material `name`. Do not touch prior material program-cache / flag pins. Do not touch BufferGeometry `userData` (v1.0.0 geometry-userData-empty stays) or BufferGeometry `name`. Do not touch Mesh / Object3D `userData`. Checked installed three@0.170.0: the Material constructor assigns `this.userData = {}`. `Material.toJSON` writes `userData` only when `Object.keys(this.userData).length > 0`. `Material.copy` clones via `JSON.parse(JSON.stringify(source.userData))` (not the shared reference `BufferGeometry.copy` uses). `MaterialLoader` / `ObjectLoader.parseMaterials` assign `json.userData` when present. Stock GLTFLoader `loadMaterial` calls `assignExtrasToUserData(material, materialDef)`. `WebGLRenderer` does not read `material.userData`. Clearing leftover extras to a fresh `{}` is load-time packaging only: no draw / tri / attrBytes change. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, geometry-userData-empty 13, geometry-name-empty 13, version-zero 13 stay vs v1.0.0. material-userData-empty 3 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.102.0] — 2026-09-24

### Changed

- `crate-toolbox` **v1.0.0** L3 packaging/perf UPGRADE: after the v0.99 BufferGeometry `name` pin (`geometry.name === ''` on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferGeometry `userData` to the r170 constructor default empty plain object (`geometry.userData = {}`) on those same visual geometries (13 visuals; one geometry per visual; first-class measured geometry-userData-empty). `pinColorOnlyUnlitBasicGeometryUserData` / `pinColorOnlyVisualGeometryUserData` run after `pinColorOnlyVisualGeometryName` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign a fresh `geometry.userData = {}` in place only when it is not already an empty plain object (missing, non-object, any own keys, or a prototype other than `Object.prototype`). Do not share one `{}` across geometries. An already-empty plain object is left as-is. Do not replace the geometry, the attributes, or the typed arrays. Do not touch BufferGeometry `name` (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D `userData`. Do not touch BufferAttribute `version` (v0.98 version-zero stays). Do not touch BufferAttribute `name` (v0.97 name-empty stays). Do not touch `gpuType` (v0.96 gpuType-float stays). Do not call `setUsage` (v0.94 usage-static stays). Do not reassign `normalized` (v0.95 normalized-default stays). Do not touch `onUpload` / `onUploadCallback` (v0.43 CPU-release hook stays). Checked installed three@0.170.0: the BufferGeometry constructor assigns `this.userData = {}`. `BufferGeometry.toJSON` writes `data.userData` only when `Object.keys(this.userData).length > 0`. `BufferGeometry.copy` assigns `this.userData = source.userData` (shared reference). `BufferGeometryLoader` assigns `geometry.userData = json.userData` when `json.userData` is truthy. `ObjectLoader.parseGeometries` assigns `geometry.userData = data.userData` when `data.userData !== undefined`. Stock GLTFLoader `addPrimitiveAttributes` calls `assignExtrasToUserData(geometry, primitiveDef)`, which `Object.assign`s primitive extras onto `geometry.userData`. `WebGLRenderer` does not read `geometry.userData`. Clearing leftover extras to a fresh `{}` is load-time packaging only: no draw / tri / attrBytes change. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Does not rename the Mesh. Mapped / lit / interleaved / colliders keep authored `geometry.userData`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, geometry-name-empty 13, version-zero 13, name-empty 13, gpuType-float 13, normalized-default 13, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.99. geometry-userData-empty 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.101.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.99.0** L3 packaging/perf UPGRADE: after the v0.98 BufferAttribute `version` pin (`version === 0` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferGeometry `name` to the r170 constructor default empty string (`geometry.name === ''`) on those same visual geometries (13 visuals; one geometry per visual; first-class measured geometry-name-empty). `pinColorOnlyUnlitBasicGeometryName` / `pinColorOnlyVisualGeometryName` run after `pinColorOnlyVisualVersion` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `geometry.name = ''` in place only when it is not already `''`. Do not replace the geometry, the attributes, or the typed arrays. Do not touch BufferAttribute `version` (v0.98 version-zero stays). Do not touch BufferAttribute `name` (v0.97 name-empty stays). Do not touch `gpuType` (v0.96 gpuType-float stays). Do not call `setUsage` (v0.94 usage-static stays). Do not reassign `normalized` (v0.95 normalized-default stays). Do not touch `onUpload` / `onUploadCallback` (v0.43 CPU-release hook stays). Checked installed three@0.170.0: the BufferGeometry constructor assigns `this.name = ''`. `BufferGeometry.toJSON` writes `data.name` only when `this.name !== ''`. `BufferGeometry.copy` copies `source.name`. `BufferGeometryLoader` assigns `geometry.name = json.name` when `json.name` is present. `ObjectLoader.parseGeometries` assigns `geometry.name = data.name` when `data.name !== undefined`. Stock GLTFLoader names the Mesh and copies primitive extras onto `geometry.userData`; it does not assign `geometry.name`. `WebGLRenderer` does not read `geometry.name`. DCC exporters and JSON round-trips still leave mesh or primitive names on the geometry. Clearing to `''` is load-time packaging only: no draw / tri / attrBytes change; it drops leftover string retention on Quest 3 TBDR static props. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Does not rename the Mesh. Mapped / lit / interleaved / colliders keep authored `geometry.name`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, version-zero 13, name-empty 13, gpuType-float 13, normalized-default 13, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.98. geometry-name-empty 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.100.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.98.0** L3 packaging/perf UPGRADE: after the v0.97 BufferAttribute `name` pin (`name === ''` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferAttribute `version` to the r170 constructor default `0` (`version === 0`) on those same attributes (13 visuals; one geometry per visual; first-class measured version-zero). `pinColorOnlyUnlitBasicVersion` / `pinColorOnlyVisualVersion` run after `pinColorOnlyVisualName` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `attribute.version = 0` in place only when it is not already `0`. Do not replace the attribute, the typed array, or the geometry. Do not touch `name` (v0.97 name-empty stays). Do not touch `gpuType` (v0.96 gpuType-float stays). Do not call `setUsage` (v0.94 usage-static stays). Do not reassign `normalized` (v0.95 normalized-default stays). Do not touch `onUpload` / `onUploadCallback` (v0.43 CPU-release hook stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.version = 0`. The `needsUpdate` setter increments `version` when `value === true`. `Float16BufferAttribute` does not override `version`. `WebGLAttributes.update` stores `attribute.version` on the first upload and calls `updateBuffer` (`gl.bufferSubData`, then `onUploadCallback`) when the stored buffer version is less than `attribute.version`. A leftover non-zero `version` on static packed color-only props before first upload forces extra TBDR buffer work. Pinning to `0` is load-time packaging only: no draw / tri / attrBytes change. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Does not rename the Mesh. Mapped / lit / interleaved / colliders keep authored `version`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, name-empty 13, gpuType-float 13, normalized-default 13, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.97. version-zero 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.99.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.97.0** L3 packaging/perf UPGRADE: after the v0.96 BufferAttribute `gpuType` pin (`gpuType === FloatType` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferAttribute `name` to the r170 constructor default empty string (`name === ''`) on those same attributes (13 visuals; one geometry per visual; first-class measured name-empty). `pinColorOnlyUnlitBasicName` / `pinColorOnlyVisualName` run after `pinColorOnlyVisualGpuType` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `attribute.name = ''` in place only when it is not already `''`. Do not replace the attribute, the typed array, or the geometry. Do not touch `gpuType` (v0.96 gpuType-float stays). Do not call `setUsage` (v0.94 usage-static stays). Do not reassign `normalized` (v0.95 normalized-default stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.name = ''`. `Float16BufferAttribute` does not override `name`. `BufferAttribute.toJSON` writes `data.name` only when `this.name !== ''`. `BufferGeometryLoader` copies a JSON attribute name onto the BufferAttribute. `WebGLAttributes` and `WebGLBindingStates` do not read `attribute.name`. GLTF / DCC ingest often leaves accessor or exporter names on attributes and the index. Clearing them to `''` is load-time packaging only: no draw / tri / attrBytes change; it drops leftover string retention on Quest 3 TBDR static props. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Does not rename the Mesh. Mapped / lit / interleaved / colliders keep authored `name`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, gpuType-float 13, normalized-default 13, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.96. name-empty 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.98.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.96.0** L3 packaging/perf UPGRADE: after the v0.95 BufferAttribute `normalized` pin (`normalized === false` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferAttribute `gpuType` to the r170 constructor default `FloatType` (`gpuType === FloatType`) on those same attributes (13 visuals; one geometry per visual; first-class measured gpuType-float). `pinColorOnlyUnlitBasicGpuType` / `pinColorOnlyVisualGpuType` run after `pinColorOnlyVisualNormalized` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `attribute.gpuType = FloatType` in place only when it is not already `FloatType`. Do not replace the attribute, the typed array, or the geometry. Do not call `setUsage` (v0.94 usage-static stays). Do not reassign `normalized` (v0.95 normalized-default stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.gpuType = FloatType` (1015). `Float16BufferAttribute` does not override `gpuType`. `WebGLAttributes.createBuffer` chooses the GL component type from the typed array and does not read `gpuType`. `WebGLBindingStates.setupVertexAttributes` calls `gl.vertexAttribIPointer` when `geometryAttribute.gpuType === IntType` (1013). A leftover `IntType` on Float16/Float32 `position` (or the index) mis-types static packed color-only props and breaks Quest 3 TBDR draws. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Mapped / lit / interleaved / colliders keep authored `gpuType`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, normalized-default 13, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.95. gpuType-float 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.97.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.95.0** L3 packaging/perf UPGRADE: after the v0.94 BufferAttribute `usage` pin (`StaticDrawUsage` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on the 13 packed color-only unlit MeshBasic visual geometries), also pin leftover BufferAttribute `normalized` to the r170 constructor default `false` (`normalized === false`) on those same attributes (13 visuals; one geometry per visual; first-class measured normalized-default). `pinColorOnlyUnlitBasicNormalized` / `pinColorOnlyVisualNormalized` run after `pinColorOnlyVisualUsage` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign `attribute.normalized = false` in place only when it is not already false. Do not replace the attribute, the typed array, or the geometry. Do not call `setUsage` (v0.94 usage-static stays). Checked installed three@0.170.0: the BufferAttribute constructor is `(array, itemSize, normalized = false)` and assigns `this.normalized = normalized`. Omitting the argument leaves `normalized === false`. `Float16BufferAttribute` forwards that flag. `WebGLAttributes.createBuffer` does not read `normalized`. `WebGLBindingStates.setupVertexAttributes` passes `geometryAttribute.normalized` to `gl.vertexAttribPointer`. A leftover `normalized === true` on Float16/Float32 `position` (or the index) incorrectly normalizes static packed color-only props and breaks Quest 3 TBDR draws. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Mapped / lit / interleaved / colliders keep authored `normalized`. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, usage-static 13, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.94. normalized-default 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.96.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.94.0** L3 packaging/perf UPGRADE: after the v0.93 Mesh / Object3D `boundingSphere` clear (`mesh.boundingSphere === undefined` on the 13 packed color-only unlit MeshBasic visual meshes), also pin leftover BufferAttribute `usage` to the r170 constructor default `StaticDrawUsage` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on those same visual geometries (13 visuals; one geometry per visual; first-class measured usage-static). `pinColorOnlyUnlitBasicUsage` / `pinColorOnlyVisualUsage` run after `pinColorOnlyVisualMeshBoundingSphere` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. `setUsage` assigns the value in place. Do not replace the attribute or the geometry. Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.usage = StaticDrawUsage` (35044, `gl.STATIC_DRAW`). `WebGLAttributes.createBuffer` passes `attribute.usage` to `gl.bufferData`. A leftover `DynamicDrawUsage` (35048) or any other non-static usage on static packed color-only props is a wasteful buffer hint on Quest 3 TBDR. Does not touch `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh `boundingSphere` (v0.93). Does not change `frustumCulled`. Mapped / lit / interleaved / colliders keep authored usage. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, mesh-boundingSphere-absent 13, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.93. usage-static 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.95.0] — 2026-09-23

### Changed

- `crate-toolbox` **v0.93.0** L3 packaging/perf UPGRADE: after the v0.92 BufferGeometry `boundingBox` / `boundingSphere` pin (`null` on the 13 packed color-only unlit MeshBasic visual geometries), also delete leftover Mesh / Object3D `boundingSphere` so the property is absent (`mesh.boundingSphere === undefined`) on those same visual meshes (13 visuals; first-class measured mesh-boundingSphere-absent). `pinColorOnlyUnlitBasicMeshBoundingSphere` / `pinColorOnlyVisualMeshBoundingSphere` run after `pinColorOnlyVisualBounds` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer `delete`. Do not assign `null` (`null !== undefined`, so a null own property still takes the `Frustum.intersectsObject` object branch and calls `object.computeBoundingSphere`, which Mesh does not implement). Do not invent a `Sphere`. Do not call `computeBoundingSphere` on the mesh. Do not touch geometry `boundingBox` / `boundingSphere` (v0.92). Checked installed three@0.170.0: `Frustum.intersectsObject` uses `object.boundingSphere` when that property is not `undefined`. A Mesh does not assign `object.boundingSphere`, so the else branch copies `geometry.boundingSphere` and calls `geometry.computeBoundingSphere()` only when that sphere is `null`. A leftover non-undefined `mesh.boundingSphere` short-circuits that path while `frustumCulled` stays true (v0.50). Does not touch `updateRanges` (v0.91). Does not touch `updateRange` (v0.90). Does not change `usage` (v0.43 StaticDrawUsage stays). Does not touch `skinIndex` / `skinWeight`, `drawRange`, `groups`, `morphAttributes` / `morphTargetsRelative`, Mesh morph targets, or Object3D `animations`. Does not change `frustumCulled`. Mapped / lit / interleaved / colliders keep authored object spheres. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, bounds-null 13, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.92. mesh-boundingSphere-absent 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.94.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.92.0** L3 packaging/perf UPGRADE: after the v0.91 BufferAttribute `updateRanges` clear, also pin leftover BufferGeometry `boundingBox` and `boundingSphere` to the r170 constructor `null` on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured bounds-null). `pinColorOnlyUnlitBasicBounds` / `pinColorOnlyVisualBounds` run after `pinColorOnlyVisualUpdateRanges` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Assign `null`. Do not invent `Box3` / `Sphere`. Do not call `computeBoundingBox` / `computeBoundingSphere` in the pin. Checked installed three@0.170.0: the BufferGeometry constructor assigns both `null`. `Frustum.intersectsObject` uses `geometry.boundingSphere` when the Mesh has no own `boundingSphere` and calls `computeBoundingSphere` only when that sphere is `null`; a leftover non-null sphere is tested as-is while `frustumCulled` stays true (v0.50). Does not touch `updateRanges` (v0.91). Does not touch `updateRange` (v0.90). Does not change `usage` (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete `skinIndex` / `skinWeight`. Does not touch `drawRange` / `groups` / `morphAttributes` / `morphTargetsRelative`. Does not change `frustumCulled`. Mapped / lit / interleaved / colliders stay authored. The v0.43 `onUpload` callback recomputes bounds when they are null while CPU arrays are still present, then releases the arrays. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, updateRanges-empty 13, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.91. bounds-null 13 is the new count (13 unique geometries). Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured. Do not require 207/240 Hz.

## [0.93.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.91.0** L3 packaging/perf UPGRADE: after the v0.90 BufferAttribute `updateRange` pin, also clear leftover BufferAttribute `updateRanges` so `Array.isArray(updateRanges) && updateRanges.length === 0` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured updateRanges-empty). `pinColorOnlyUnlitBasicUpdateRanges` / `pinColorOnlyVisualUpdateRanges` run after `pinColorOnlyVisualUpdateRange` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Mutate the existing array (`length = 0`); if missing or not an array, assign `[]`. Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.updateRanges = []`. `WebGLAttributes.updateBuffer` full-uploads when `updateRanges.length === 0` and partial-uploads each `{ start, count }` otherwise. `addUpdateRange(start, count)` pushes a partial range; `clearUpdateRanges()` sets length; this pulse calls neither. Does not touch legacy `updateRange` (v0.90). Does not change `usage` (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete `skinIndex` / `skinWeight`. Does not touch `drawRange` / `groups` / `morphAttributes` / `morphTargetsRelative`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate`. Clean procedural draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, updateRange-default 13, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.90. updateRanges-empty 13 is the new count (13 unique geometries). Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured.

## [0.92.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.90.0** L3 packaging/perf UPGRADE: after the v0.89 `skinIndex` / `skinWeight` strip, also pin leftover BufferAttribute `updateRange` so `offset === 0` and `count === -1` on every non-interleaved BufferAttribute plus `geometry.index` when it is a BufferAttribute, on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured updateRange-default). `pinColorOnlyUnlitBasicUpdateRange` / `pinColorOnlyVisualUpdateRange` run after `pinColorOnlyVisualSkinAttributes` on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Mutate the existing object (`offset = 0`, `count = -1`); if missing or not an object, assign `{ offset: 0, count: -1 }`. Checked installed three@0.170.0: the BufferAttribute constructor assigns `this.updateRanges = []` and does not assign `updateRange`. `WebGLAttributes.updateBuffer` full-uploads when `updateRanges.length === 0` and partial-uploads each `{ start, count }` otherwise. `addUpdateRange(start, count)` pushes a partial range; this pulse does not call it and does not rewrite `updateRanges` or `usage` (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete `skinIndex` / `skinWeight`. Does not touch `drawRange` / `groups` / `morphAttributes` / `morphTargetsRelative`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate`. Clean procedural draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, skinAttributes-absent 13, drawRange-default 13, groups-empty 13 stay vs v0.89. updateRange-default 13 is the new count (13 unique geometries; every BufferAttribute + index has `updateRange.offset === 0` && `updateRange.count === -1`). Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still unmeasured.

## [0.91.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.89.0** L3 packaging/perf UPGRADE: after the v0.88 BufferGeometry `drawRange` pin, also strip leftover `skinIndex` / `skinWeight` on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured skinAttributes-absent). `COLOR_ONLY_UNUSED_ATTRS` now includes those names via `COLOR_ONLY_UNUSED_SKIN_ATTRS`. `stripUnusedColorOnlyAttributes` drops them on the pack path after weld; `pinColorOnlyUnlitBasicSkinAttributes` / `pinColorOnlyVisualSkinAttributes` run after `pinColorOnlyVisualDrawRange` on procedural create and packaged ingest, including fail-soft (no lod groups). Verified in-repo three@0.170.0: `WebGLPrograms` sets `skinning` only when `object.isSkinnedMesh === true`; `WebGLProgram` emits `#define USE_SKINNING` and `attribute vec4 skinIndex` / `attribute vec4 skinWeight` only then, so a plain Mesh + MeshBasic never reads them. `WebGLGeometries.update` still uploads every `geometry.attributes` entry, so leftover skin attrs inflate pre-upload attrBytes. `GLTFLoader` maps `JOINTS_0` → `skinIndex` and `WEIGHTS_0` → `skinWeight` and builds a `SkinnedMesh` only when the node has a skin. This pulse deletes the leftover attributes (`BufferGeometry.deleteAttribute`) rather than enabling skinning. Does not invent a SkinnedMesh; does not touch bones / `skeleton` / `bindMatrix` / `bindMatrixInverse`; does not delete `position`; does not touch `drawRange` / `groups` / `morphAttributes` / `morphTargetsRelative`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate`. Clean procedural meshes have no skin attrs, so draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, drawRange-default 13, groups-empty 13, morphAttributes-empty 13 stay vs v0.88. skinAttributes-absent 13 is the new count. A 24-vert BoxGeometry fixture with leftover Uint16 `skinIndex` + Float32 `skinWeight` (itemSize 4) drops **576** pre-upload attrBytes. Headset ms / FFR still unmeasured.

## [0.90.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.88.0** L3 packaging/perf UPGRADE: after the v0.87 BufferGeometry `groups` clear, also pin leftover BufferGeometry `drawRange` so `start === 0` and `count === Infinity` on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured drawRange-default). Verified in-repo three@0.170.0: the BufferGeometry constructor assigns `this.drawRange = { start: 0, count: Infinity }`. `setDrawRange(start, count)` writes those fields on the existing object and throws when `drawRange` is missing; the helper mutates `start` / `count` in place, and assigns `{ start: 0, count: Infinity }` only when `drawRange` is missing or not an object. r170 `WebGLRenderer.renderBufferDirect` draws `geometry.drawRange` when the render item's `group` is null. A single MeshBasicMaterial pushes `group = null` (`projectObject` walks `groups` only when `Array.isArray(material)`), so a leftover partial `drawRange` clips or under-draws the color-only stand-in. Pinning the r170 default keeps the full index/position span. Does not call `setDrawRange()`; does not invent a partial range; does not replace the geometry; does not touch `groups`; does not touch `morphAttributes` / `morphTargetsRelative`; does not touch Mesh `morphTargetInfluences` / `morphTargetDictionary`; does not touch Object3D `animations`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, groups-empty 13, morphAttributes-empty 13, morphTargets-absent 13, animations-empty 13 unchanged vs v0.87. drawRange-default 13 is the new count. Headset ms / FFR still unmeasured.

## [0.89.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.87.0** L3 packaging/perf UPGRADE: after the v0.86 BufferGeometry `morphAttributes` clear, also clear leftover BufferGeometry `groups` so `Array.isArray(geometry.groups) && geometry.groups.length === 0` on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured groups-empty). Verified in-repo three@0.170.0: the BufferGeometry constructor assigns `this.groups = []`. `clearGroups()` assigns a new `[]` (it does not set length on the existing array); the helper mutates with `groups.length = 0`, and assigns `[]` only when `groups` is missing or not an array. r170 `WebGLRenderer.projectObject` pushes one render item per group only when `Array.isArray(material)`. A single MeshBasicMaterial pushes one item with `group = null`, so leftover groups do not multiply draws while the material stays a single MeshBasicMaterial. Clearing the list keeps a later material-array binding or `BufferGeometry.copy` round-trip from reviving per-group draws. Does not invent groups; does not assign a material array; does not touch `drawRange`; does not touch `morphAttributes` / `morphTargetsRelative`; does not touch Mesh `morphTargetInfluences` / `morphTargetDictionary`; does not touch Object3D `animations`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, morphAttributes-empty 13, morphTargets-absent 13, animations-empty 13 unchanged vs v0.86. groups-empty 13 is the new count. Headset ms / FFR still unmeasured.

## [0.88.0] — 2026-09-22

### Changed

- `crate-toolbox` **v0.86.0** L3 packaging/perf UPGRADE: after the v0.85 Mesh `morphTargetInfluences` / `morphTargetDictionary` absence, also clear leftover BufferGeometry `morphAttributes` so `Object.keys(geometry.morphAttributes).length === 0` and pin `morphTargetsRelative` to the r170 default `false` (only when it is not already false) on packed color-only unlit MeshBasic visual geometries (13 visual meshes; one geometry per visual; first-class measured morphAttributes-empty). Verified in-repo three@0.170.0: the BufferGeometry constructor assigns `this.morphAttributes = {}` and `this.morphTargetsRelative = false`. r170 `WebGLRenderer` calls `WebGLMorphtargets.update` when `morphAttributes.position`, `.normal`, or `.color` is not `undefined` (an empty array or empty BufferAttribute under the key still counts). Mutate the existing object (delete own keys; dispose a leftover BufferAttribute only when `dispose` exists and it is not a live attribute). Do not reassign `null` / `undefined`. Does not invent morph targets; does not call `updateMorphTargets()`; does not add morphAttributes; does not enable morphing; does not touch Mesh `morphTargetInfluences` / `morphTargetDictionary`; does not touch Object3D `animations`. Mapped / lit / interleaved / colliders stay authored. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, morphTargets-absent 13 unchanged vs v0.85. morphAttributes-empty 13 is the new count. Headset ms / FFR still unmeasured.

## [0.87.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.85.0** L3 packaging/perf UPGRADE: after the v0.84 Object3D `animations` clear (and after the Mesh callback fence through v0.79 `onBeforeShadow`/`onAfterShadow` / v0.77 `onBeforeRender`/`onAfterRender` / v0.76 customDepth/Distance), also delete leftover Mesh `morphTargetInfluences` / `morphTargetDictionary` so the r170 absence remains (`morphTargetInfluences === undefined` && `morphTargetDictionary === undefined`) on packed color-only unlit MeshBasic visual meshes (13 visual meshes; first-class measured morphTargets-absent). Verified in-repo three@0.170.0: the Mesh constructor calls `updateMorphTargets()`, which assigns both properties only when `Object.keys(geometry.morphAttributes).length > 0`; a non-morph Mesh leaves both absent (`undefined`; `Object.hasOwn` false). `Mesh.copy` copies them when the source defines them. Prefer `delete` when present. Does not assign `null` or empty `[]` / `{}`. Does not invent morph targets; does not call `updateMorphTargets()`; does not add morphAttributes; does not enable morphing; does not touch Object3D `animations`; does not touch Material `glslVersion`; does not touch Material `flatShading`; does not touch Material `defines`; does not touch Material `customProgramCacheKey`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows. Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including glslVersion / flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13, customProgramCacheKey-default 3, defines-absent 3, flatShading-off 3, glslVersion-absent 3, animations-empty 13 unchanged vs v0.84. morphTargets-absent 13 is the new count. Headset ms / FFR still unmeasured.

## [0.86.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.84.0** L3 packaging/perf UPGRADE: after the v0.83 Material `glslVersion` clear (and after the Mesh callback fence through v0.79 `onBeforeShadow`/`onAfterShadow` / v0.77 `onBeforeRender`/`onAfterRender` / v0.76 customDepth/Distance), also clear leftover Object3D `animations` to the r170 empty list (`Array.isArray(mesh.animations) && mesh.animations.length === 0`) on packed color-only unlit MeshBasic visual meshes (13 visual meshes; first-class measured animations-empty). Verified in-repo three@0.170.0: the Object3D constructor assigns `this.animations = []`. When the property is an array, mutate it (`animations.length = 0`); if missing or non-array, assign `animations = []`. Does not invent AnimationClips; does not create an AnimationMixer; does not call `AnimationMixer.update`; does not touch Material `glslVersion`; does not touch Material `flatShading`; does not touch Material `defines`; does not touch Material `customProgramCacheKey`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows. Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including glslVersion / flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13, customProgramCacheKey-default 3, defines-absent 3, flatShading-off 3, glslVersion-absent 3 unchanged vs v0.83. animations-empty 13 is the new count. Headset ms / FFR still unmeasured.

## [0.85.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.83.0** L3 packaging/perf UPGRADE: after the v0.82 Material `flatShading = false` pin (and after the Material program-cache fence through v0.81 `defines` / v0.80 `customProgramCacheKey` / v0.78 `onBeforeCompile` + `onBeforeRender`), also clear leftover Material `glslVersion` so the r170 MeshBasicMaterial / Material default absence remains (`glslVersion === undefined`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured glslVersion-absent). Verified in-repo three@0.170.0: Material / MeshBasicMaterial leave `glslVersion` unset (`undefined`; `Object.hasOwn` false); `ShaderMaterial` assigns `glslVersion = null` in its own constructor; `WebGLPrograms` copies `glslVersion: material.glslVersion` into program parameters; `WebGLProgram` emits `#version ${parameters.glslVersion}` when that parameter is truthy and omits the `pc_fragColor` / `gl_FragColor` defines when `parameters.glslVersion === GLSL3` (`'300 es'`). Does not assign a sentinel string; does not assign `GLSL3` / `GLSL1` / `'300 es'` / `'100'`; does not invent custom shaders or convert MeshBasic to ShaderMaterial; does not touch Material `flatShading`; does not touch Material `defines`; does not touch Material `customProgramCacheKey`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows. Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / Mesh shadow-callback clear / customProgramCacheKey clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13, customProgramCacheKey-default 3, defines-absent 3, flatShading-off 3 unchanged vs v0.82. glslVersion-absent 3 is the new count. Headset ms / FFR still unmeasured.

## [0.84.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.82.0** L3 packaging/perf UPGRADE: after the v0.81 Material `defines` clear (and after the long Material flag fence through v0.80 `customProgramCacheKey` / v0.78 `onBeforeCompile` + `onBeforeRender` / v0.75 stencil companions), also pin Material `flatShading = false` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured flatShading-off). Verified in-repo three@0.170.0: Material / MeshBasicMaterial leave `flatShading` unset (`undefined`); `WebGLPrograms` copies `flatShading: material.flatShading === true` into program parameters and the program cache key; `WebGLProgram` emits `#define FLAT_SHADED` only when that parameter is true. Does not invent custom shaders; does not enable flat shading; does not touch Material `defines`; does not touch Material `customProgramCacheKey`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows. Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / Mesh shadow-callback clear / customProgramCacheKey clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13, customProgramCacheKey-default 3, defines-absent 3 unchanged vs v0.81. flatShading-off 3 is the new count. Headset ms / FFR still unmeasured.

## [0.83.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.81.0** L3 packaging/perf UPGRADE: after the v0.80 Material `customProgramCacheKey` clear (and after the v0.78 Material `onBeforeCompile` / `onBeforeRender` clear), also clear leftover Material `defines` so the r170 MeshBasicMaterial / Material default absence remains (`defines === undefined`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured defines-absent; does not invent a replacement `#define` map; does not assign a sentinel empty `{}`; does not touch Material `customProgramCacheKey`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / Mesh shadow-callback clear / customProgramCacheKey clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13, customProgramCacheKey-default 3 unchanged vs v0.80. defines-absent 3 is the new count. Headset ms / FFR still unmeasured.

## [0.82.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.80.0** L3 packaging/perf UPGRADE: after the v0.79 Mesh `onBeforeShadow` / `onAfterShadow` clear (and after the v0.78 Material `onBeforeCompile` / `onBeforeRender` clear), also delete leftover own-property Material `customProgramCacheKey` so the r170 `Material.prototype.customProgramCacheKey` remains on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured customProgramCacheKey-default; does not invent a replacement function; does not assign `undefined`; does not touch Material `onBeforeCompile` / `onBeforeRender`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch Mesh `onBeforeShadow` / `onAfterShadow`; does not touch customDepth/Distance; does not enable shadows). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / Mesh shadow-callback clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3, shadow-callbacks-absent 13 unchanged vs v0.79. customProgramCacheKey-default 3 is the new count. Headset ms / FFR still unmeasured.

## [0.81.0] — 2026-09-21

### Changed

- `crate-toolbox` **v0.79.0** L3 packaging/perf UPGRADE: after the v0.78 Material `onBeforeCompile` / `onBeforeRender` clear (and after the v0.77 Mesh `onBeforeRender` / `onAfterRender` clear / v0.76 customDepth/Distance clear / v0.49 Mesh `castShadow`/`receiveShadow` false), also delete leftover own-property Mesh `onBeforeShadow` / `onAfterShadow` so the r170 Object3D prototype empty no-ops remain on packed color-only unlit MeshBasic visual meshes (13 visual meshes; first-class measured shadow-callbacks-absent; does not invent replacement callbacks; does not assign `undefined`; does not enable shadows; does not touch Mesh `onBeforeRender` / `onAfterRender` or Material `onBeforeCompile` / `onBeforeRender`; does not touch customDepth/Distance). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13, material-render-callbacks-absent 3 unchanged vs v0.78. Shadow-callbacks-absent 13 is the new count. Headset ms / FFR still unmeasured.

## [0.80.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.78.0** L3 packaging/perf UPGRADE: after the v0.77 Mesh `onBeforeRender` / `onAfterRender` clear (and after the long material-flag fence through v0.75 stencil companions / v0.74 polygonOffset companions / v0.72 dithering+A2C), also delete leftover own-property Material `onBeforeCompile` / `onBeforeRender` so the r170 Material.prototype empty no-ops remain on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured material-render-callbacks-absent; does not invent replacement callbacks or custom shaders; does not assign `undefined`; does not touch Mesh `onBeforeRender` / `onAfterRender`; does not touch `onBeforeShadow` / `onAfterShadow`; does not enable shadows). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / the v0.77 Mesh render-callback clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13, render-callbacks-absent 13 unchanged vs v0.77. Material-render-callbacks-absent 3 is the new count. Headset ms / FFR still unmeasured.

## [0.79.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.77.0** L3 packaging/perf UPGRADE: after the v0.76 Mesh customDepth/Distance clear (and after v0.49 already pinned Mesh `castShadow`/`receiveShadow` false), also delete leftover own-property `onBeforeRender` / `onAfterRender` so the r170 Object3D prototype empty no-ops remain on packed color-only unlit MeshBasic visual meshes (13 visual meshes; does not invent replacement callbacks; does not assign `undefined`; does not enable shadows or touch customDepth/Distance). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13 unchanged vs v0.76. Render-callbacks-absent 13 is the new count. Headset ms / FFR still unmeasured.

## [0.78.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.76.0** L3 packaging/perf UPGRADE: after the v0.75 Material stencil companions pin (and after v0.49 already pinned Mesh `castShadow`/`receiveShadow` false), also clear leftover Mesh `customDepthMaterial` / `customDistanceMaterial` to the r170 Mesh default absence on packed color-only unlit MeshBasic visual meshes (13 visual meshes; does not invent replacement materials; does not enable shadows). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13, customDepth/Distance-absent 13 unchanged vs v0.75. Headset ms / FFR still unmeasured.

## [0.77.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.75.0** L3 packaging/perf UPGRADE: after the v0.74 Material polygonOffsetFactor/Units pin (and after v0.53 already assigned the full r170 Material stencil suite), also pin r170 Material `stencilRef = 0` / `stencilWriteMask = 0xff` / `stencilFuncMask = 0xff` / `stencilZFail = KeepStencilOp` / `stencilZPass = KeepStencilOp` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured flags after the v0.53 short-form `stencilWrite` / `stencilFunc` / `stencilFail` companions). Mapped / lit / colliders stay authored / r170 defaults. Does not enable stencil write or invent non-Always func / non-Keep ops / non-zero ref / non-0xff masks. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / prior material pins including polygonOffset companions / dithering / A2C / blendColor / blendAlpha. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13 unchanged vs v0.74. Headset ms / FFR still unmeasured.

## [0.76.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.74.0** L3 packaging/perf UPGRADE: after the v0.73 Object3D rotation.order pin (and after the v0.72 Material dithering/A2C pin), also pin r170 Material `polygonOffsetFactor = 0` / `polygonOffsetUnits = 0` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured flags after the v0.52 GPU-state companions, with `polygonOffset = false`). Mapped / lit / colliders stay authored / r170 defaults. Does not enable `polygonOffset` or invent non-zero factors/units. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `rotation.order` / `blendColor` / `blendAlpha` / dithering / A2C. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13 unchanged vs v0.73. Headset ms / FFR still unmeasured.

## [0.75.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.73.0** L3 packaging/perf UPGRADE: after the v0.72 Material dithering/A2C pin (and after the v0.71 Object3D scale pin), also pin r170 Object3D `rotation.order = 'XYZ'` on packed color-only unlit MeshBasic visual meshes (13 visual meshes; keeps the existing Euler instance; does not rewrite rotation.xyz; does not touch quaternion). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` (v0.45 static-body freeze stays). Does not change `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `blendColor` / `blendAlpha` / dithering / A2C. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13, rotation-order-XYZ 13 unchanged vs v0.72 except the new rotation-order-XYZ count. Headset ms / FFR still unmeasured.

## [0.74.0] — 2026-09-20

### Changed

- `crate-toolbox` **v0.72.0** L3 packaging/perf UPGRADE: after the v0.71 Object3D scale pin (and after the v0.68 blendColor/blendAlpha / v0.53 stencil suite), also pin r170 Material `dithering = false` / `alphaToCoverage = false` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured flags after the v0.51 blending/alpha companions). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `layers` / `up` / `scale` / `blendColor` / `blendAlpha`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13 unchanged vs v0.71. Headset ms / FFR still unmeasured.

## [0.73.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.71.0** L3 packaging/perf UPGRADE: after the v0.70 Object3D up pin (and after the v0.69 Object3D matrixWorldAutoUpdate pin), also pin r170 Object3D `scale` `(1, 1, 1)` on packed color-only unlit MeshBasic visual meshes (13 visual meshes; keeps the existing Vector3 instance). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` (v0.45 static-body freeze stays). Does not change `matrixWorldAutoUpdate` / `layers` / `up` / `blendColor` / `blendAlpha`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13, scale-default 13 unchanged vs v0.70 except the new scale-default count. Headset ms / FFR still unmeasured.

## [0.72.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.70.0** L3 packaging/perf UPGRADE: after the v0.69 Object3D matrixWorldAutoUpdate pin (and after the v0.67 Object3D layers default pin), also pin r170 Object3D `up` `(0, 1, 0)` (`Object3D.DEFAULT_UP`) on packed color-only unlit MeshBasic visual meshes (13 visual meshes; keeps the existing Vector3 instance). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` (v0.45 static-body freeze stays). Does not change `matrixWorldAutoUpdate` / `layers` / `blendColor` / `blendAlpha`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13, up-default 13 unchanged vs v0.69 except the new up-default count. Headset ms / FFR still unmeasured.

## [0.71.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.69.0** L3 packaging/perf UPGRADE: after the v0.68 Material blendColor/blendAlpha pin (and after the v0.67 Object3D layers default pin), also pin r170 Object3D `matrixWorldAutoUpdate = true` (`Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE`) on packed color-only unlit MeshBasic visual meshes (13 visual meshes). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixAutoUpdate` (v0.45 static-body freeze stays). Does not change `layers` / `blendColor` / `blendAlpha`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13, matrixWorldAutoUpdate-on 13 unchanged vs v0.68. Headset ms / FFR still unmeasured.

## [0.70.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.68.0** L3 packaging/perf UPGRADE: after the v0.67 Object3D layers default pin (and after the v0.56 NormalBlending factor/equation companions), also pin r170 Material CustomBlending color/alpha companions (`blendColor` `(0, 0, 0)` / `blendAlpha = 0`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; keeps the existing Color instance). Mapped / lit / colliders stay authored / r170 defaults. Does not enable CustomBlending or change `blending` away from NormalBlending. Does not pin `mesh.visible` or change `layers` / `matrixWorldAutoUpdate` / `matrixAutoUpdate`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13 unchanged vs v0.67. Headset ms / FFR still unmeasured.

## [0.69.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.67.0** L3 packaging/perf UPGRADE: after the v0.66 MeshBasic envMapRotation pin (and after the v0.60 mesh renderOrder pin), also pin r170 Object3D layers default (layer 0 only / `mask = 1`) on packed color-only unlit MeshBasic visual meshes (13 visual meshes; keeps the existing Layers instance). Mapped / lit / colliders stay authored / r170 Mesh defaults. Does not pin `mesh.visible` or change `matrixWorldAutoUpdate` / `matrixAutoUpdate`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13, layers-default 13 unchanged vs v0.66. Headset ms / FFR still unmeasured.

## [0.68.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.66.0** L3 packaging/perf UPGRADE: after the v0.65 MeshBasic wireframe line-style pin (and after the v0.62 envMap companion pin), also pin r170 MeshBasic `envMapRotation` `(0, 0, 0)` / `order = 'XYZ'` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; keeps the existing Euler instance). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible`, force envMap, attach maps, or enable wireframe. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.67.0] — 2026-09-19

### Changed

- `crate-toolbox` **v0.65.0** L3 packaging/perf UPGRADE: after the v0.64 MeshBasic `wireframeLinewidth` pin (and after the v0.52 `wireframe = false` pin), also pin r170 MeshBasic wireframe line-style defaults (`wireframeLinecap = 'round'`, `wireframeLinejoin = 'round'`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or enable wireframe. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.66.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.64.0** L3 packaging/perf UPGRADE: after the v0.63 MeshBasic map-intensity companion pin (and after the v0.62 envMap companion pin), also pin r170 MeshBasic `wireframeLinewidth = 1` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible` or enable wireframe. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.65.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.63.0** L3 packaging/perf UPGRADE: after the v0.62 MeshBasic envMap companion pin (and after the v0.61 material visible pin), also pin r170 MeshBasic map-intensity companions (`lightMapIntensity = 1`, `aoMapIntensity = 1`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible`, force lightMap / aoMap, or attach maps. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.64.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.62.0** L3 packaging/perf UPGRADE: after the v0.61 material visible pin (and after the v0.60 mesh renderOrder pin), also pin r170 MeshBasic envMap companions (`combine = MultiplyOperation`, `reflectivity = 1`, `refractionRatio = 0.98`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible`, force envMap, or attach maps. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.63.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.61.0** L3 packaging/perf UPGRADE: after the v0.60 mesh renderOrder pin (and after the v0.59 material shadowSide pin), also pin r170 Material `visible = true` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Does not pin `mesh.visible`. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13, renderOrder-0 13 unchanged. Headset ms / FFR still unmeasured.

## [0.62.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.60.0** L3 packaging/perf UPGRADE: after the v0.59 material shadowSide pin (and after the v0.50 mesh frustumCulled / v0.49 mesh shadow flags), also pin r170 Object3D `renderOrder = 0` on packed color-only unlit MeshBasic visual meshes (13 renderOrder-0). Mapped / lit / colliders stay authored / r170 Mesh defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.61.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.59.0** L3 packaging/perf UPGRADE: after the v0.58 precision pin (and after the v0.49 mesh-level shadow-flag pin), also pin r170 Material `shadowSide = null` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.60.0] — 2026-09-18

### Changed

- `crate-toolbox` **v0.58.0** L3 packaging/perf UPGRADE: after the v0.57 vertexColors pin (and after the v0.56 NormalBlending companion pin), also pin r170 Material `precision = null` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.59.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.57.0** L3 packaging/perf UPGRADE: after the v0.56 NormalBlending companion pin (and after the v0.51 blending-mode pin), also pin r170 Material `vertexColors = false` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.58.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.56.0** L3 packaging/perf UPGRADE: after the v0.55 alphaHash / forceSinglePass pin (and after the v0.51 blending-mode pin), also pin r170 NormalBlending factor/equation companions (`blendSrc = SrcAlphaFactor`, `blendDst = OneMinusSrcAlphaFactor`, `blendEquation = AddEquation`, `blendSrcAlpha = null`, `blendDstAlpha = null`, `blendEquationAlpha = null`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.57.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.55.0** L3 packaging/perf UPGRADE: after the v0.54 clipping pin (and after the v0.53 stencil pin), also pin remaining r170 Material boolean GPU-state defaults (`alphaHash = false`, `forceSinglePass = false`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.56.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.54.0** L3 packaging/perf UPGRADE: after the v0.53 stencil pin (and after the v0.52 wireframe/depthFunc/colorWrite/polygonOffset pin), also pin r170 Material clipping defaults (`clippingPlanes = null`, `clipIntersection = false`, `clipShadows = false`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.55.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.53.0** L3 packaging/perf UPGRADE: after the v0.52 wireframe/depthFunc/colorWrite/polygonOffset pin (and after the v0.51 blending/alpha pin), also pin r170 Material stencil defaults (`stencilWrite = false`, `stencilFunc = AlwaysStencilFunc`, `stencilRef = 0`, `stencilWriteMask = 0xff`, `stencilFuncMask = 0xff`, `stencilFail = KeepStencilOp`, `stencilZFail = KeepStencilOp`, `stencilZPass = KeepStencilOp`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.54.0] — 2026-09-17

### Changed

- `crate-toolbox` **v0.52.0** L3 packaging/perf UPGRADE: after the v0.51 blending/alpha pin (and after the v0.48 opaque FrontSide pin), also pin `wireframe = false`, `colorWrite = true`, `depthFunc = LessEqualDepth`, and `polygonOffset = false` (`polygonOffsetFactor = 0` / `polygonOffsetUnits = 0`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.53.0] — 2026-09-16

### Changed

- `crate-toolbox` **v0.51.0** L3 packaging/perf UPGRADE: after the v0.50 frustumCulled pin (and after the v0.48 opaque FrontSide pin), also pin `blending = NormalBlending`, `premultipliedAlpha = false`, and `alphaTest = 0` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances; companions `dithering = false` / `alphaToCoverage = false`). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13, frustumCulled-on 13 unchanged. Headset ms / FFR still unmeasured.

## [0.52.0] — 2026-09-16

### Changed

- `crate-toolbox` **v0.50.0** L3 packaging/perf UPGRADE: after the v0.49 shadow-flag pin, also pin `frustumCulled = true` on packed color-only unlit MeshBasic visual meshes (13 frustumCulled-on). Mapped / lit / colliders stay authored / r170 Mesh defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10, shadow-off 13 unchanged. Headset ms / FFR still unmeasured.

## [0.51.0] — 2026-09-16

### Changed

- `crate-toolbox` **v0.49.0** L3 packaging/perf UPGRADE: after the v0.48 opaque FrontSide pin, also pin `castShadow = false` and `receiveShadow = false` on packed color-only unlit MeshBasic visual meshes (13 shadow-off). Mapped / lit / colliders stay authored / r170 Mesh defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10 unchanged. Headset ms / FFR still unmeasured.

## [0.50.0] — 2026-09-16

### Changed

- `crate-toolbox` **v0.48.0** L3 packaging/perf UPGRADE: after the v0.47 fog/toneMapped pin, also pin opaque FrontSide draw-state (`transparent = false`, `opacity = 1`, `depthWrite = true`, `depthTest = true`, `side = FrontSide`) on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay authored / r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10 unchanged. Headset ms / FFR still unmeasured.

## [0.49.0] — 2026-09-16

### Changed

- `crate-toolbox` **v0.47.0** L3 packaging/perf UPGRADE: after the v0.46 visual raycast disable, pin `fog = false` and `toneMapped = false` on packed color-only unlit MeshBasic materials (3 unique shared wood/brass/steel instances). Mapped / lit / colliders stay r170 defaults. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, raycast-off 13, frozen 3 / live 10 unchanged. Headset ms / FFR still unmeasured.

## [0.48.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.46.0** L3 packaging/perf UPGRADE: after the v0.45 static matrix freeze, disable `Mesh.raycast` on packed color-only unlit MeshBasic visuals (body + lid/latch/tool + fastener; named no-op). Colliders keep `Mesh.prototype.raycast`. Measured 13 raycast-off / 5 collider default. Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, frozen 3 / live 10 unchanged. Headset ms / FFR still unmeasured.

## [0.47.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.45.0** L3 packaging/perf UPGRADE: after one `updateMatrixWorld(true)`, freeze `matrixAutoUpdate` on static packed color-only MeshBasic body LOD leaves. Measured 3 frozen / 10 live (lid/latch/tool/fastener stay updating). Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216 unchanged. Headset ms / FFR still unmeasured.

## [0.46.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.44.0** L3 packaging/perf UPGRADE: quantize Float32 `position` to Three r170 `Float16BufferAttribute` (WebGL2 `HALF_FLOAT`) on color-only unlit MeshBasic LOD/fastener geometries after Uint16 compact and before `onUpload` CPU-array release. Pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24 unchanged; attrBytes 4200 → 2820 / 1776 → 1176 / 720 → 432; fastener 360 → 216. Post-upload CPU attrBytes → 0. Colliders stay Float32. Headset ms / FFR still unmeasured.

## [0.45.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.43.0** L3 packaging/perf UPGRADE: after GPU upload, release CPU typed arrays on color-only unlit MeshBasic LOD/fastener geometries (`StaticDrawUsage` + Three r170 `onUpload`). Pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 4200 / 1776 / 720 unchanged; post-upload CPU attrBytes → 0. Colliders keep arrays. Headset ms / FFR still unmeasured.

## [0.44.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.42.0** L3 packaging/perf UPGRADE: share identical color-only unlit MeshBasic instances across LOD levels when the midtone hex matches (procedural; unique instances 6 → 3). Draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 4200 / 1776 / 720 unchanged. Packaged hex-dedupe skipped. Headset ms / FFR still unmeasured.

## [0.43.0] — 2026-09-15

### Changed

- `crate-toolbox` **v0.41.0** L3 packaging/perf UPGRADE: compact lingering Uint32 indices to Uint16 after unused-attr strip (procedural + packaged helper); fastener (outside LOD merge) gets the same strip + compact. LOD attrBytes stay 4200 / 1776 / 720 (already Uint16); fastener 840 → 360. Headset ms / FFR still unmeasured.

## [0.42.0] — 2026-09-14

### Changed

- `crate-toolbox` **v0.40.0** L3 packaging/perf UPGRADE: strip unused `uv` / `normal` after same-material concat + coincident weld on color-only unlit MeshBasic (procedural + packaged helper). Attribute bytes 8800 → 4200 (LOD0), 3776 → 1776 (LOD1), 1680 → 720 (LOD2); draws 6 / 4 / 2 and tris 240 / 96 / 24 unchanged. Headset ms / FFR still unmeasured.

## [0.41.0] — 2026-09-14

### Changed

- `crate-toolbox` **v0.39.0** L3 packaging/perf UPGRADE: weld coincident vertices after same-material concat (procedural + packaged helper). Unique verts 440 → 230 (LOD0) and 192 → 100 (LOD1); tris 240 / 96 / 24 and draws 6 / 4 / 2 unchanged. Headset ms / FFR still unmeasured.

## [0.40.0] — 2026-09-14

### Changed

- `crate-toolbox` **v0.38.0** L3 packaging/perf UPGRADE: packaged GLB ingest applies the same load-time same-material mesh merge as procedural v0.37, within each discovered `lod0`/`lod1`/`lod2` group. Unit/mock 3 MeshBasic → 1 (tris unchanged). Procedural draws stay 6/4/2. Headset ms / FFR still unmeasured.

## [0.39.0] — 2026-09-14

### Changed

- `crate-toolbox` **v0.37.0** L3 packaging/perf UPGRADE: procedural LOD0/LOD1 same-material mesh merge within each static lodGroup (wood/woodDark/handleMat share one MeshBasic). Measured draws 14 → 6 (LOD0) and 8 → 4 (LOD1); tris unchanged. Packaged v0.36 LOD visibility left intact. Headset ms / FFR still unmeasured.

## [0.38.0] — 2026-09-14

### Changed

- `crate-toolbox` **v0.36.0** L3 packaging/perf UPGRADE: packaged GLB ingest wires `lod0` / `lod1` / `lod2` (or `userData.lodLevel`) into `userData.lod` and shows only one level. Missing names fail soft (no fake LODs). Procedural path unchanged. Headset ms / FFR still unmeasured.

## [0.37.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.35.0** L3 packaging/perf UPGRADE: procedural LOD0 hero meshes drop the 256² albedo `map` and use color-only unlit `MeshBasicMaterial` (wood/handle `0x633318`, brass `0xBE7E31`, steel `0xC1C3C9`). LOD1 stays color-only MeshBasic (v0.30); LOD2 stays color-only MeshBasic (v0.29). Unique canvases 3 → 0. Same draws / tris as v0.34. Headset ms / FFR still unmeasured.

## [0.36.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.34.0** L3 packaging/perf UPGRADE: procedural LOD0 hero meshes switch from albedo-only MeshStandard to unlit `MeshBasicMaterial` with the same 256² wood / brass / steel albedo maps (no roughness/metalness). LOD1 stays color-only MeshBasic (v0.30); LOD2 stays color-only MeshBasic (v0.29). Unique canvases stay 3. Same draws / tris as v0.33. Headset ms / FFR still unmeasured.

## [0.35.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.33.0** L3 packaging/perf UPGRADE: procedural LOD0 MeshStandard drops packed ORM and becomes albedo-only (256² albedo; constant wood/brass/steel ORM-midtone roughness/metalness). LOD1 stays color-only MeshBasic (v0.30); LOD2 stays color-only MeshBasic (v0.29). Unique canvases 6 → 3. Same draws / tris as v0.32. Headset ms / FFR still unmeasured.

## [0.34.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.32.0** L3 packaging/perf UPGRADE: procedural LOD0 MeshStandard drops `normalMap` while keeping 256² albedo + ORM. LOD1 stays color-only MeshBasic (v0.30); LOD2 stays color-only MeshBasic (v0.29). Unique canvases 9 → 6. Same draws / tris as v0.31. Headset ms / FFR still unmeasured.

## [0.33.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.31.0** L3 packaging/perf UPGRADE: procedural LOD0 hero maps drop from 512² → 256² while staying MeshStandard with albedo + ORM + `normalMap` at full modest `normalScale`. LOD1 stays color-only MeshBasic (v0.30); LOD2 stays color-only MeshBasic (v0.29). Unique canvases stay 9. Same draws / tris as v0.30. Headset ms / FFR still unmeasured.

## [0.32.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.30.0** L3 packaging/perf UPGRADE: LOD1 mid body / lid / latch / tool stub drop the albedo `map` and use color-only unlit `MeshBasicMaterial` (wood midtone `0x633318`, brass midtone `0xBE7E31`). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD2 stays color-only MeshBasic (v0.29). Unique canvases 11 → 9. Same draws / tris as v0.29. Headset ms / FFR still unmeasured.

## [0.31.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.29.0** L3 packaging/perf UPGRADE: LOD2 far body + lid drop the albedo `map` and use color-only unlit `MeshBasicMaterial` (wood midtone `0x633318`). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD1 stays 256² MeshBasic (v0.28). Unique canvases stay 11. Same draws / tris as v0.28. Headset ms / FFR still unmeasured.

## [0.30.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.28.0** L3 packaging/perf UPGRADE: LOD1 body / lid / latch / tool stub switch from albedo-only `MeshStandardMaterial` to unlit `MeshBasicMaterial` with the same 256² wood / brass albedos (no roughness/metalness uniforms). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD2 stays 256² MeshBasic (v0.27). Unique canvases stay 11. Same draws / tris as v0.27. Headset ms / FFR still unmeasured.

## [0.29.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.27.0** L3 packaging/perf UPGRADE: LOD2 far body + lid switch from albedo-only `MeshStandardMaterial` to unlit `MeshBasicMaterial` with the same 256² wood albedo (no roughness/metalness uniforms). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD1 stays 256² albedo-only MeshStandard (v0.26). Unique canvases stay 11. Same draws / tris as v0.26. Headset ms / FFR still unmeasured.

## [0.28.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.26.0** L3 packaging/perf UPGRADE: LOD1 and LOD2 procedural materials bind half-resolution (256²) albedo maps instead of the shared 512² L2 albedos. LOD0 stays 512² albedo+ORM+normal at full modest `normalScale`; mid/far stay albedo-only (v0.25 constants). Unique canvases 9 → 11 (extra 256² wood/brass albedos). Same draws / tris as v0.25. Headset ms / FFR still unmeasured.

## [0.27.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.25.0** L3 packaging/perf UPGRADE: LOD1 visual materials omit packed ORM (`roughnessMap`/`metalnessMap`) and use constant wood-ORM-midtone roughness 220/255 + metalness 8/255 (wood/handle) and brass-ORM-midtone roughness 95/255 + metalness 230/255 (latch). LOD0 stays albedo+ORM+normal at full modest `normalScale`; LOD2 stays albedo-only (v0.23). Same draws / tris / 9 canvases as v0.24. Headset ms / FFR still unmeasured.

## [0.26.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.24.0** L3 packaging/perf UPGRADE: LOD1 visual materials omit `normalMap` (keep albedo + packed ORM). LOD0 stays albedo+ORM+normal at full modest `normalScale`; LOD2 stays albedo-only (v0.23). Same draws / tris / 9 canvases as v0.23. Headset ms / FFR still unmeasured.

## [0.25.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.23.0** L3 packaging/perf UPGRADE: LOD2 visual materials omit packed ORM (`roughnessMap`/`metalnessMap`) and use constant wood-ORM-midtone roughness 220/255 + metalness 8/255 (albedo-only far crate + lid). LOD0/1 keep albedo+ORM+normal (LOD1 half `normalScale`). Same draws / tris / 9 canvases as v0.22. Headset ms / FFR still unmeasured.

## [0.24.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.22.0** Quest 3 shipping/perf gate: present-path XR framebuffer scale factor clamp to 1 in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off + v0.20 ambient-only fill + v0.21 anisotropy clamp; save last-set / lookdev default, `setFramebufferScaleFactor(1)`; r170 has no getter and cannot rebuild the current layer while presenting — also set 1 at renderer setup; restore lookdev scale on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.23.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.21.0** Quest 3 shipping/perf gate: present-path texture anisotropy clamp to 1 in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off + v0.20 ambient-only fill; walk toolbox / scene maps, save `.anisotropy`, write 1; restore lookdev anisotropy on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.22.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.20.0** Quest 3 shipping/perf gate: present-path ambient-only fill (HemisphereLight off + one `AmbientLight` at intensity 0.4) in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off; hemi `visible = false` + intensity 0; restore lookdev hemi and disable/detach the present-only ambient on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.21.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.19.0** Quest 3 shipping/perf gate: present-path directional / punctual light off (hemisphere-only) in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off; `sun.visible = false` + intensity 0; restore lookdev visible + intensity on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.20.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.18.0** Quest 3 shipping/perf gate: present-path IBL / `scene.environment` off in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping; null `scene.environment` + intensity 0; restore the saved PMREM + lookdev intensity on `sessionend`, do not dispose). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.19.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.17.0** Quest 3 shipping/perf gate: present-path `NoToneMapping` in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify; restore lookdev `ACESFilmicToneMapping` + prior `toneMappingExposure` on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.18.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.16.0** Quest 3 shipping/perf gate: present-path WebGL antialias / MSAA off in `examples/interactive-prop` (constructor `antialias: false` so Three r170 `XRWebGLLayer` inherits MSAA off; session helpers verify after 90/72 + FFR + v0.15 pixel-ratio clamp). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.17.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.15.0** Quest 3 shipping/perf gate: present-path WebGL pixel-ratio clamp in `examples/interactive-prop` (`setPixelRatio(1)` on `sessionstart` after 90/72 + FFR 0.75; restore saved desktop ratio + `setSize` on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.16.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.14.0** L3 packaging/perf UPGRADE: LOD1 visual materials keep `normalMap` at half LOD0 `normalScale` (`L3_LOD1_NORMAL_SCALE_MUL` = 0.5). LOD0 stays full v0.12 scale; LOD2 still omits `normalMap`. Same draws / tris / 9 canvases as v0.13. Headset ms / FFR still unmeasured.

## [0.15.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.13.0** L3 packaging/perf UPGRADE: LOD2 visual materials omit `normalMap` (cheaper far fragments after the v0.12 normal pass). LOD0/1 keep shared v0.12 normals. Same draws / tris as v0.12. Headset ms / FFR still unmeasured.

## [0.14.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.12.0** L2 quality UPGRADE: shared procedural 512² normal maps (wood / brass / steel) on `MeshStandardMaterial.normalMap`. Same draws / tris as v0.11. 9 unique canvases (albedo + ORM + normal). Headset ms / FFR still unmeasured.

## [0.13.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.11.0** Quest 3 shipping/a11y gate: visibility-loss safe release in `examples/interactive-prop` (held crate or tool `endGrab` when `XRSession.visibilityState` is `hidden` / `visible-blurred`, or `document.hidden` while presenting; no auto-regrab on restore). Same L0–L5. v0.8 allocation scrub, v0.9 hand hover, and v0.10 tracking-loss kept. Headset ms / FFR still unmeasured.

## [0.12.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.10.0** Quest 3 shipping/a11y gate: tracking-loss / null-pose safe release in `examples/interactive-prop` (held crate or tool `endGrab` on null grip/ray/joint pose or removed input source). Same L0–L5. v0.8 allocation scrub and v0.9 hand hover kept. Headset ms / FFR still unmeasured.

## [0.11.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.9.0** Quest 3 shipping/input-parity gate: bare-hand hover before pinch in `examples/interactive-prop` (controllers still win on a ray hit). Same L0–L5. v0.8 allocation scrub kept. Headset ms / FFR still unmeasured.

## [0.10.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.8.0** Quest 3 shipping/perf gate: XR frame-loop allocation scrub in `examples/interactive-prop` (reused pick list, AABB first-hit, pose-history ring). Same L0–L5. Draws unchanged. Headset ms / FFR still unmeasured.

## [0.9.0] — 2026-09-09

### Added

- [Quest 3 KTX2/Basis packaging](docs/performance/ktx2-quest3-packaging.md) — `gltf-transform` recipe (cap ≤1024², UASTC/ETC1S, meshopt). `crate-toolbox` **v0.7.0** probes `/packaged/crate-toolbox.glb` and falls back to procedural canvases. No invented GLB or headset ms.

## [0.8.0] — 2026-09-09

### Changed

- `crate-toolbox` **v0.6.0** L2 quality UPGRADE: shared procedural 512² albedo + ORM (wood / brass / steel). Same draws as v0.5.0. KTX2/Basis deferred until a DCC GLB. Headset ms still unmeasured.

## [0.7.0] — 2026-09-09

### Added

- [Quest 3 on-device QA](docs/shipping/quest-3-on-device-qa.md) — checklist + blank results table for Browser / firmware / SHA / Hz / FFR / soak. `examples/interactive-prop` **P** overlay. `crate-toolbox` **v0.5.0** (same L0–L5; headset ms still unmeasured).

## [0.6.0] — 2026-09-09

### Added

- `crate-toolbox` **v0.4.0** L5: re-latch cancel, tool grab only when open, drive front fastener (4 turns), snap-return, `feedback` → `hapticActuators.pulse` when present. LOD set unchanged. Quest 3 frame time still TODO.

## [0.5.0] — 2026-09-09

### Added

- `crate-toolbox` **v0.3.0** L3 pulse: procedural LOD1/LOD2 (96/24 tris) beside LOD0 (240); distance + key switch in `examples/interactive-prop`. Geometry counts only — Quest 3 frame time still TODO.

## [0.4.0] — 2026-09-09

### Added

- [Quest 3 gate](docs/shipping/quest-3-target.md) — 90 Hz ship / 72 Hz fallback / 120 Hz stretch; TBDR + thermal; studio draw/tri/texture/FFR checklist (Meta WebXR + MDN cites; TODOs for on-device confirm)
- Manifest `targetDevice` + `perf` on the catalog template and `crate-toolbox` v0.2.1
- `examples/interactive-prop` requests 90 Hz and FFR 0.75 on `sessionstart` when the UA exposes the APIs

### Changed

- Quality bar, additive L2/L3, asset workflow, content-pipeline, photoreal-realtime, shipping matrix, and testing soak now gate on Quest 3 @ 90 Hz (not a desktop GPU). 207/240 Hz out of scope.

## [0.3.0] — 2026-09-09

### Added

- [Additive object iteration](studio/additive-object-iteration.md) — stable `objectId`, UPGRADE / variant / NEW tree, L0–L5 stack, revision retention, two-hour pulse
- [ADR 0005](studio/adr/0005-additive-object-evolution.md) — layered manifests + keep prior revisions
- Object catalog [`assets/objects/`](assets/objects/) with `_template/` and seed [`crate-toolbox`](assets/objects/crate-toolbox/) (v0.1 → v0.2 additive notes)

### Changed

- Workflow, content-pipeline, playbook, and README point at the catalog instead of one-off replace-in-place folders

## [0.2.0] — 2026-09-09

### Added

- End-to-end [asset-to-interaction workflow](studio/asset-to-interaction-workflow.md): brief, generation paths (scan / AI / DCC), cleanup, glTF packaging, interaction layer, WebXR binding, QA gates
- [ADR 0004](studio/adr/0004-asset-interaction-architecture.md) — glTF 2.0 + `extras.studio` / sidecar behavior metadata, ECS-ish components, visual ≠ collider ≠ behavior
- Design patterns: [interactive-objects.md](docs/design/interactive-objects.md)
- Performance: [photoreal-realtime.md](docs/performance/photoreal-realtime.md)
- [examples/interactive-prop](examples/interactive-prop/) — PBR crate with hover, grab/throw, latch→lid activity, optional hand pinch
- Quality-bar **Interactive assets** section; content-pipeline now points at the full workflow

### Changed

- README, LEARNING, playbook, design/performance indexes, ADR index, content-pipeline budgets aligned with the interactive-prop path

## [0.1.0] — 2026-09-08

### Added

- Initial WebXR / VR studio knowledge base structure
- Fundamentals: sessions, input sources, reference spaces, frames, layers / FFR
- Stack guidance: Three.js, Babylon.js, A-Frame, React Three Fiber, WebGPU
- Design: comfort, locomotion, spatial UI, accessibility, audio, haptics, presence
- Performance budgets and profiling checklist
- Shipping matrix, HTTPS / permissions, distribution notes
- Headset + emulator testing playbook
- Studio playbook, quality bar, content pipeline
- ADRs 0001-0003 (framework, locomotion, interaction)
- examples/webxr-starter Vite + Three.js immersive-vr demo
- LEARNING.md, MIT license, Node/Vite .gitignore

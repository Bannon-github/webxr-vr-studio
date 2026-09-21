# Changelog

All notable changes to this knowledge base are documented here.

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

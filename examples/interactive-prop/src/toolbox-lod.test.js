import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import {
  L2_TEXTURE_SIZE,
  L3_LOD_ALBEDO_SIZE,
  L3_LOD0_BRASS_COLOR,
  L3_LOD0_STEEL_COLOR,
  L3_LOD0_WOOD_COLOR,
  L3_LOD1_BRASS_COLOR,
  L3_LOD1_WOOD_COLOR,
  L3_LOD2_WOOD_COLOR,
  getCrateL2Maps,
} from "./pbr-maps.js";

function installCanvasStub() {
  if (globalThis.document?.createElement) return;
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return { tagName: String(tag).toUpperCase() };
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            createImageData(w, h) {
              return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
            },
            putImageData() {},
          };
        },
      };
    },
  };
}

installCanvasStub();

const {
  activityState,
  applyActivityVisual,
  collectCrateVisualMaterials,
  collectLodVisualMaterials,
  compactIndexToUint16,
  createToolbox,
  disableColorOnlyVisualRaycast,
  freezeStaticColorOnlyWorldMatrices,
  getToolboxLodStats,
  isColorOnlyUnlitBasic,
  isUnderAnimatedToolboxPivot,
  noopColorOnlyVisualRaycast,
  packColorOnlyGeometry,
  pinColorOnlyUnlitBasicCustomShadowMaterials,
  pinColorOnlyUnlitBasicFlags,
  pinColorOnlyUnlitBasicFrustumCulled,
  pinColorOnlyUnlitBasicLayers,
  pinColorOnlyUnlitBasicMatrixWorldAutoUpdate,
  pinColorOnlyUnlitBasicRenderOrder,
  pinColorOnlyUnlitBasicShadowFlags,
  pinColorOnlyUnlitBasicRotationOrder,
  pinColorOnlyUnlitBasicScale,
  pinColorOnlyUnlitBasicUp,
  pinColorOnlyVisualCustomShadowMaterials,
  pinColorOnlyVisualFrustumCulled,
  pinColorOnlyVisualLayers,
  pinColorOnlyVisualMaterialFlags,
  pinColorOnlyVisualMatrixWorldAutoUpdate,
  pinColorOnlyVisualRenderOrder,
  pinColorOnlyVisualRotationOrder,
  pinColorOnlyVisualScale,
  pinColorOnlyVisualShadowFlags,
  pinColorOnlyVisualUp,
  quantizePositionToFloat16,
  releaseCpuArraysOnGpuUpload,
  resetToolbox,
  setToolboxLod,
  shareColorOnlyUnlitBasic,
  stripUnusedColorOnlyAttributes,
  tryDriveFastener,
  tryUse,
  weldCoincidentVertices,
} = await import("./toolbox.js");

function assertR170MeshBasicOpaqueFrontSideDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.transparent, false, `${label} defaults transparent false`);
  assert.equal(mat.opacity, 1, `${label} defaults opacity 1`);
  assert.equal(mat.depthWrite, true, `${label} defaults depthWrite true`);
  assert.equal(mat.depthTest, true, `${label} defaults depthTest true`);
  assert.equal(mat.side, THREE.FrontSide, `${label} defaults FrontSide`);
  assert.equal(THREE.FrontSide, 0, "r170 FrontSide is 0");
}

function assertR170MeshBasicBlendingAlphaDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.blending, THREE.NormalBlending, `${label} defaults NormalBlending`);
  assert.equal(mat.premultipliedAlpha, false, `${label} defaults premultipliedAlpha false`);
  assert.equal(mat.alphaTest, 0, `${label} defaults alphaTest 0`);
  assert.equal(mat.dithering, false, `${label} defaults dithering false`);
  assert.equal(mat.alphaToCoverage, false, `${label} defaults alphaToCoverage false`);
  assert.equal(THREE.NormalBlending, 1, "r170 NormalBlending is 1");
}

function assertR170MeshBasicGpuStateDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.wireframe, false, `${label} defaults wireframe false`);
  assert.equal(mat.colorWrite, true, `${label} defaults colorWrite true`);
  assert.equal(mat.depthFunc, THREE.LessEqualDepth, `${label} defaults LessEqualDepth`);
  assert.equal(mat.polygonOffset, false, `${label} defaults polygonOffset false`);
  assert.equal(mat.polygonOffsetFactor, 0, `${label} defaults polygonOffsetFactor 0`);
  assert.equal(mat.polygonOffsetUnits, 0, `${label} defaults polygonOffsetUnits 0`);
  assert.equal(THREE.LessEqualDepth, 3, "r170 LessEqualDepth is 3");
}

function assertR170MeshBasicStencilDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.stencilWrite, false, `${label} defaults stencilWrite false`);
  assert.equal(mat.stencilFunc, THREE.AlwaysStencilFunc, `${label} defaults AlwaysStencilFunc`);
  assert.equal(mat.stencilRef, 0, `${label} defaults stencilRef 0`);
  assert.equal(mat.stencilWriteMask, 0xff, `${label} defaults stencilWriteMask 0xff`);
  assert.equal(mat.stencilFuncMask, 0xff, `${label} defaults stencilFuncMask 0xff`);
  assert.equal(mat.stencilFail, THREE.KeepStencilOp, `${label} defaults stencilFail Keep`);
  assert.equal(mat.stencilZFail, THREE.KeepStencilOp, `${label} defaults stencilZFail Keep`);
  assert.equal(mat.stencilZPass, THREE.KeepStencilOp, `${label} defaults stencilZPass Keep`);
  assert.equal(THREE.AlwaysStencilFunc, 519, "r170 AlwaysStencilFunc is 519");
  assert.equal(THREE.KeepStencilOp, 7680, "r170 KeepStencilOp is 7680");
}

function assertR170MeshBasicClippingDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.clippingPlanes, null, `${label} defaults clippingPlanes null`);
  assert.equal(mat.clipIntersection, false, `${label} defaults clipIntersection false`);
  assert.equal(mat.clipShadows, false, `${label} defaults clipShadows false`);
}

function assertR170MeshBasicAlphaHashForceSinglePassDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.alphaHash, false, `${label} defaults alphaHash false`);
  assert.equal(mat.forceSinglePass, false, `${label} defaults forceSinglePass false`);
}

function assertR170MeshBasicNormalBlendingCompanions(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.blendSrc, THREE.SrcAlphaFactor, `${label} defaults SrcAlphaFactor`);
  assert.equal(mat.blendDst, THREE.OneMinusSrcAlphaFactor, `${label} defaults OneMinusSrcAlphaFactor`);
  assert.equal(mat.blendEquation, THREE.AddEquation, `${label} defaults AddEquation`);
  assert.equal(mat.blendSrcAlpha, null, `${label} defaults blendSrcAlpha null`);
  assert.equal(mat.blendDstAlpha, null, `${label} defaults blendDstAlpha null`);
  assert.equal(mat.blendEquationAlpha, null, `${label} defaults blendEquationAlpha null`);
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");
}

function assertR170MeshBasicVertexColorsDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.vertexColors, false, `${label} defaults vertexColors false`);
}

function assertR170MeshBasicPrecisionDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.precision, null, `${label} defaults precision null`);
}

function assertR170MeshBasicShadowSideDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.shadowSide, null, `${label} defaults shadowSide null`);
}

function assertR170MeshBasicVisibleDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.visible, true, `${label} defaults visible true`);
}

function assertR170MeshBasicEnvMapCompanions(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.combine, THREE.MultiplyOperation, `${label} defaults MultiplyOperation`);
  assert.equal(mat.reflectivity, 1, `${label} defaults reflectivity 1`);
  assert.equal(mat.refractionRatio, 0.98, `${label} defaults refractionRatio 0.98`);
  assert.equal(THREE.MultiplyOperation, 0, "r170 MultiplyOperation is 0");
}

function assertR170MeshBasicMapIntensityCompanions(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.lightMapIntensity, 1, `${label} defaults lightMapIntensity 1`);
  assert.equal(mat.aoMapIntensity, 1, `${label} defaults aoMapIntensity 1`);
}

function assertR170MeshBasicWireframeLinewidthDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.wireframeLinewidth, 1, `${label} defaults wireframeLinewidth 1`);
}

function assertR170MeshBasicWireframeLineStyleDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.wireframeLinecap, "round", `${label} defaults wireframeLinecap round`);
  assert.equal(mat.wireframeLinejoin, "round", `${label} defaults wireframeLinejoin round`);
}

function assertR170MeshBasicEnvMapRotationDefault(mat, label = "r170 MeshBasicMaterial") {
  assert.ok(mat.envMapRotation, `${label} has envMapRotation`);
  assert.equal(mat.envMapRotation.isEuler, true, `${label} envMapRotation is Euler`);
  assert.equal(mat.envMapRotation.x, 0, `${label} defaults envMapRotation.x 0`);
  assert.equal(mat.envMapRotation.y, 0, `${label} defaults envMapRotation.y 0`);
  assert.equal(mat.envMapRotation.z, 0, `${label} defaults envMapRotation.z 0`);
  assert.equal(mat.envMapRotation.order, "XYZ", `${label} defaults envMapRotation.order XYZ`);
}

function assertR170MeshBasicBlendColorAlphaDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.ok(mat.blendColor, `${label} has blendColor`);
  assert.equal(mat.blendColor.isColor, true, `${label} blendColor is Color`);
  assert.equal(mat.blendColor.r, 0, `${label} defaults blendColor.r 0`);
  assert.equal(mat.blendColor.g, 0, `${label} defaults blendColor.g 0`);
  assert.equal(mat.blendColor.b, 0, `${label} defaults blendColor.b 0`);
  assert.equal(mat.blendAlpha, 0, `${label} defaults blendAlpha 0`);
}

function assertR170MeshBasicDitheringAlphaToCoverageDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.dithering, false, `${label} defaults dithering false`);
  assert.equal(mat.alphaToCoverage, false, `${label} defaults alphaToCoverage false`);
}

function assertR170MeshBasicPolygonOffsetCompanionDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.polygonOffset, false, `${label} defaults polygonOffset false`);
  assert.equal(mat.polygonOffsetFactor, 0, `${label} defaults polygonOffsetFactor 0`);
  assert.equal(mat.polygonOffsetUnits, 0, `${label} defaults polygonOffsetUnits 0`);
}

function assertR170MeshBasicStencilCompanionDefaults(mat, label = "r170 MeshBasicMaterial") {
  assert.equal(mat.stencilWrite, false, `${label} defaults stencilWrite false`);
  assert.equal(mat.stencilRef, 0, `${label} defaults stencilRef 0`);
  assert.equal(mat.stencilWriteMask, 0xff, `${label} defaults stencilWriteMask 0xff`);
  assert.equal(mat.stencilFuncMask, 0xff, `${label} defaults stencilFuncMask 0xff`);
  assert.equal(mat.stencilZFail, THREE.KeepStencilOp, `${label} defaults stencilZFail Keep`);
  assert.equal(mat.stencilZPass, THREE.KeepStencilOp, `${label} defaults stencilZPass Keep`);
}

function assertQuestSafeUnlitFlags(mat, label = "color-only MeshBasic") {
  assert.equal(mat.fog, false, `${label} pins fog false`);
  assert.equal(mat.toneMapped, false, `${label} pins toneMapped false`);
  assert.equal(mat.transparent, false, `${label} pins transparent false`);
  assert.equal(mat.opacity, 1, `${label} pins opacity 1`);
  assert.equal(mat.depthWrite, true, `${label} pins depthWrite true`);
  assert.equal(mat.depthTest, true, `${label} pins depthTest true`);
  assert.equal(mat.side, THREE.FrontSide, `${label} pins FrontSide`);
  assert.equal(mat.blending, THREE.NormalBlending, `${label} pins NormalBlending`);
  assert.equal(mat.premultipliedAlpha, false, `${label} pins premultipliedAlpha false`);
  assert.equal(mat.alphaTest, 0, `${label} pins alphaTest 0`);
  assert.equal(mat.dithering, false, `${label} pins dithering false`);
  assert.equal(mat.alphaToCoverage, false, `${label} pins alphaToCoverage false`);
  assert.equal(mat.wireframe, false, `${label} pins wireframe false`);
  assert.equal(mat.wireframeLinewidth, 1, `${label} pins wireframeLinewidth 1`);
  assert.equal(mat.wireframeLinecap, "round", `${label} pins wireframeLinecap round`);
  assert.equal(mat.wireframeLinejoin, "round", `${label} pins wireframeLinejoin round`);
  assert.equal(mat.colorWrite, true, `${label} pins colorWrite true`);
  assert.equal(mat.depthFunc, THREE.LessEqualDepth, `${label} pins LessEqualDepth`);
  assert.equal(mat.polygonOffset, false, `${label} pins polygonOffset false`);
  assert.equal(mat.polygonOffsetFactor, 0, `${label} pins polygonOffsetFactor 0`);
  assert.equal(mat.polygonOffsetUnits, 0, `${label} pins polygonOffsetUnits 0`);
  assert.equal(mat.stencilWrite, false, `${label} pins stencilWrite false`);
  assert.equal(mat.stencilFunc, THREE.AlwaysStencilFunc, `${label} pins AlwaysStencilFunc`);
  assert.equal(mat.stencilRef, 0, `${label} pins stencilRef 0`);
  assert.equal(mat.stencilWriteMask, 0xff, `${label} pins stencilWriteMask 0xff`);
  assert.equal(mat.stencilFuncMask, 0xff, `${label} pins stencilFuncMask 0xff`);
  assert.equal(mat.stencilFail, THREE.KeepStencilOp, `${label} pins stencilFail Keep`);
  assert.equal(mat.stencilZFail, THREE.KeepStencilOp, `${label} pins stencilZFail Keep`);
  assert.equal(mat.stencilZPass, THREE.KeepStencilOp, `${label} pins stencilZPass Keep`);
  assert.equal(mat.clippingPlanes, null, `${label} pins clippingPlanes null`);
  assert.equal(mat.clipIntersection, false, `${label} pins clipIntersection false`);
  assert.equal(mat.clipShadows, false, `${label} pins clipShadows false`);
  assert.equal(mat.alphaHash, false, `${label} pins alphaHash false`);
  assert.equal(mat.forceSinglePass, false, `${label} pins forceSinglePass false`);
  assert.equal(mat.blendSrc, THREE.SrcAlphaFactor, `${label} pins SrcAlphaFactor`);
  assert.equal(mat.blendDst, THREE.OneMinusSrcAlphaFactor, `${label} pins OneMinusSrcAlphaFactor`);
  assert.equal(mat.blendEquation, THREE.AddEquation, `${label} pins AddEquation`);
  assert.equal(mat.blendSrcAlpha, null, `${label} pins blendSrcAlpha null`);
  assert.equal(mat.blendDstAlpha, null, `${label} pins blendDstAlpha null`);
  assert.equal(mat.blendEquationAlpha, null, `${label} pins blendEquationAlpha null`);
  assert.equal(mat.vertexColors, false, `${label} pins vertexColors false`);
  assert.equal(mat.precision, null, `${label} pins precision null`);
  assert.equal(mat.shadowSide, null, `${label} pins shadowSide null`);
  assert.equal(mat.visible, true, `${label} pins visible true`);
  assert.equal(mat.combine, THREE.MultiplyOperation, `${label} pins MultiplyOperation`);
  assert.equal(mat.reflectivity, 1, `${label} pins reflectivity 1`);
  assert.equal(mat.refractionRatio, 0.98, `${label} pins refractionRatio 0.98`);
  assert.equal(mat.lightMapIntensity, 1, `${label} pins lightMapIntensity 1`);
  assert.equal(mat.aoMapIntensity, 1, `${label} pins aoMapIntensity 1`);
  assert.equal(mat.envMap, null, `${label} leaves envMap null`);
  assert.ok(mat.envMapRotation, `${label} keeps envMapRotation`);
  assert.equal(mat.envMapRotation.x, 0, `${label} pins envMapRotation.x 0`);
  assert.equal(mat.envMapRotation.y, 0, `${label} pins envMapRotation.y 0`);
  assert.equal(mat.envMapRotation.z, 0, `${label} pins envMapRotation.z 0`);
  assert.equal(mat.envMapRotation.order, "XYZ", `${label} pins envMapRotation.order XYZ`);
  assert.ok(mat.blendColor, `${label} keeps blendColor`);
  assert.equal(mat.blendColor.r, 0, `${label} pins blendColor.r 0`);
  assert.equal(mat.blendColor.g, 0, `${label} pins blendColor.g 0`);
  assert.equal(mat.blendColor.b, 0, `${label} pins blendColor.b 0`);
  assert.equal(mat.blendAlpha, 0, `${label} pins blendAlpha 0`);
}

function assertQuestSafeUnlitShadowFlags(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.castShadow, false, `${label} pins castShadow false`);
  assert.equal(mesh.receiveShadow, false, `${label} pins receiveShadow false`);
}

function assertQuestSafeUnlitFrustumCulled(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.frustumCulled, true, `${label} pins frustumCulled true`);
}

function assertQuestSafeUnlitRenderOrder(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.renderOrder, 0, `${label} pins renderOrder 0`);
}

function assertR170Object3DLayersDefault(obj, label = "r170 Object3D") {
  assert.ok(obj.layers, `${label} has layers`);
  assert.equal(obj.layers.mask, 1, `${label} layers.mask is 1 (layer 0 only)`);
  assert.equal(obj.layers.isEnabled(0), true, `${label} layers.test(0) / isEnabled(0)`);
  assert.equal(obj.layers.isEnabled(1), false, `${label} layer 1 stays disabled`);
}

function assertQuestSafeUnlitLayers(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DLayersDefault(mesh, label);
}

function assertR170Object3DMatrixWorldAutoUpdateDefault(obj, label = "r170 Object3D") {
  assert.equal(obj.matrixWorldAutoUpdate, true, `${label} defaults matrixWorldAutoUpdate true`);
  assert.equal(
    THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,
    true,
    "r170 Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE is true"
  );
}

function assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DMatrixWorldAutoUpdateDefault(mesh, label);
}

function assertR170Object3DUpDefault(obj, label = "r170 Object3D") {
  assert.ok(obj.up, `${label} has up`);
  assert.equal(obj.up.x, 0, `${label} up.x is 0`);
  assert.equal(obj.up.y, 1, `${label} up.y is 1`);
  assert.equal(obj.up.z, 0, `${label} up.z is 0`);
  assert.equal(THREE.Object3D.DEFAULT_UP.x, 0, "r170 Object3D.DEFAULT_UP.x is 0");
  assert.equal(THREE.Object3D.DEFAULT_UP.y, 1, "r170 Object3D.DEFAULT_UP.y is 1");
  assert.equal(THREE.Object3D.DEFAULT_UP.z, 0, "r170 Object3D.DEFAULT_UP.z is 0");
}

function assertQuestSafeUnlitUp(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DUpDefault(mesh, label);
}

function assertR170Object3DScaleDefault(obj, label = "r170 Object3D") {
  assert.ok(obj.scale, `${label} has scale`);
  assert.equal(obj.scale.x, 1, `${label} scale.x is 1`);
  assert.equal(obj.scale.y, 1, `${label} scale.y is 1`);
  assert.equal(obj.scale.z, 1, `${label} scale.z is 1`);
}

function assertQuestSafeUnlitScale(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DScaleDefault(mesh, label);
}

function assertR170Object3DRotationOrderDefault(obj, label = "r170 Object3D") {
  assert.ok(obj.rotation, `${label} has rotation`);
  assert.equal(obj.rotation.isEuler, true, `${label} rotation is Euler`);
  assert.equal(obj.rotation.order, "XYZ", `${label} rotation.order is XYZ`);
}

function assertQuestSafeUnlitRotationOrder(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DRotationOrderDefault(mesh, label);
}

function assertR170MeshCustomShadowMaterialsAbsent(mesh, label = "r170 Mesh") {
  assert.equal(mesh.customDepthMaterial == null, true, `${label} customDepthMaterial is absent`);
  assert.equal(mesh.customDistanceMaterial == null, true, `${label} customDistanceMaterial is absent`);
  assert.equal(mesh.customDepthMaterial, undefined, `${label} customDepthMaterial is undefined`);
  assert.equal(mesh.customDistanceMaterial, undefined, `${label} customDistanceMaterial is undefined`);
}

function assertQuestSafeUnlitCustomShadowMaterials(mesh, label = "color-only MeshBasic mesh") {
  assertR170MeshCustomShadowMaterialsAbsent(mesh, label);
}

test("LOD0 color-only MeshBasic; LOD1 color-only MeshBasic; LOD2 color-only MeshBasic", () => {
  const crate = createToolbox();
  const maps = getCrateL2Maps();
  assert.equal(L2_TEXTURE_SIZE, 256);
  assert.equal(L3_LOD_ALBEDO_SIZE, 256, "historical mid/far half-res constant stays 256");
  assert.equal(L3_LOD0_WOOD_COLOR, L3_LOD1_WOOD_COLOR);
  assert.equal(L3_LOD1_WOOD_COLOR, L3_LOD2_WOOD_COLOR);
  assert.equal(L3_LOD2_WOOD_COLOR, 0x633318);
  assert.equal(L3_LOD0_BRASS_COLOR, L3_LOD1_BRASS_COLOR);
  assert.equal(L3_LOD1_BRASS_COLOR, 0xbe7e31);
  assert.equal(L3_LOD0_STEEL_COLOR, 0xc1c3c9);
  assert.equal(crate.userData.l2.lodNormalScaleMul[0], 0);
  assert.equal(crate.userData.l2.lodNormalScaleMul[1], 0);
  assert.equal(crate.userData.l2.lodNormalScaleMul[2], 0);
  assert.equal(crate.userData.l2.textureSize, L2_TEXTURE_SIZE);
  assert.equal(crate.userData.l2.lodAlbedoSize, 0);
  assert.equal(crate.userData.l2.uniqueTextures, 0, "v0.35 must not allocate LOD albedo canvases");
  assert.deepEqual(crate.userData.l2.lodAlbedoMaps, { 0: 0, 1: 0, 2: 0 });
  assert.equal(crate.userData.l2.maps, "none");
  assert.equal(maps.woodLod, undefined, "v0.30 must not allocate unused woodLod canvases");
  assert.equal(maps.brassLod, undefined, "v0.30 must not allocate unused brassLod canvases");
  assert.equal(maps.wood.normal, null, "v0.32 must not allocate wood normal canvases");
  assert.equal(maps.brass.normal, null, "v0.32 must not allocate brass normal canvases");
  assert.equal(maps.steel.normal, null, "v0.32 must not allocate steel normal canvases");
  assert.equal(maps.wood.orm, null, "v0.33 must not allocate wood ORM canvases");
  assert.equal(maps.brass.orm, null, "v0.33 must not allocate brass ORM canvases");
  assert.equal(maps.steel.orm, null, "v0.33 must not allocate steel ORM canvases");
  assert.equal(maps.wood.albedo, null, "v0.35 must not allocate wood albedo canvases");
  assert.equal(maps.brass.albedo, null, "v0.35 must not allocate brass albedo canvases");
  assert.equal(maps.steel.albedo, null, "v0.35 must not allocate steel albedo canvases");
  assert.deepEqual(crate.userData.l2.lod0Color, {
    wood: L3_LOD0_WOOD_COLOR,
    brass: L3_LOD0_BRASS_COLOR,
    steel: L3_LOD0_STEEL_COLOR,
  });
  assert.deepEqual(crate.userData.l2.lod1Color, { wood: L3_LOD1_WOOD_COLOR, brass: L3_LOD1_BRASS_COLOR });
  assert.equal(crate.userData.l2.lod2Color, L3_LOD2_WOOD_COLOR);
  assert.equal(crate.userData.l2.lod0Constants, undefined, "LOD0 MeshBasic drops roughness/metalness constants");

  setToolboxLod(crate, 0);
  assert.equal(crate.userData.lod.current, 0);
  const lod0 = collectLodVisualMaterials(crate, 0);
  assert.equal(lod0.length, 3, "LOD0 unique materials: wood, brass, steel");
  const lod0Named = crate.userData.materials.lod0;
  assert.equal(lod0Named.wood.isMeshBasicMaterial, true, "LOD0 wood is MeshBasic");
  assert.equal(lod0Named.wood.color.getHex(), L3_LOD0_WOOD_COLOR);
  assert.equal(lod0Named.woodDark, lod0Named.wood, "LOD0 woodDark aliases the wood MeshBasic instance");
  assert.equal(lod0Named.handleMat, lod0Named.wood, "LOD0 handleMat aliases the wood MeshBasic instance");
  assert.equal(lod0Named.woodDark.color.getHex(), L3_LOD0_WOOD_COLOR, "LOD0 dark wood uses the wood midtone");
  assert.equal(lod0Named.handleMat.color.getHex(), L3_LOD0_WOOD_COLOR, "LOD0 handle uses the wood midtone");
  assert.equal(lod0Named.brass.color.getHex(), L3_LOD0_BRASS_COLOR);
  assert.equal(lod0Named.steel.color.getHex(), L3_LOD0_STEEL_COLOR);
  for (const mat of lod0) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD0 is MeshBasicMaterial (unlit)");
    assert.ok(!mat.isMeshStandardMaterial, "LOD0 is not MeshStandard");
    assert.equal(mat.map, null, "LOD0 MeshBasic has no map (color only)");
    assert.ok(!mat.normalMap, "LOD0 MeshBasic has no normalMap");
    assert.ok(!mat.roughnessMap, "LOD0 MeshBasic has no ORM roughnessMap");
    assert.ok(!mat.metalnessMap, "LOD0 MeshBasic has no ORM metalnessMap");
    assert.equal(mat.roughness, undefined, "LOD0 MeshBasic has no roughness");
    assert.equal(mat.metalness, undefined, "LOD0 MeshBasic has no metalness");
    const isBrass = mat === lod0Named.brass;
    const isSteel = mat === lod0Named.steel;
    const expected = isBrass ? L3_LOD0_BRASS_COLOR : isSteel ? L3_LOD0_STEEL_COLOR : L3_LOD0_WOOD_COLOR;
    assert.equal(mat.color.getHex(), expected, "LOD0 uses wood, brass, or steel albedo midtone");
  }

  const lod1 = collectLodVisualMaterials(crate, 1);
  assert.equal(lod1.length, 2, "LOD1 unique materials: wood, brass");
  const lod1Named = crate.userData.materials.lod1;
  assert.equal(lod1Named.wood.isMeshBasicMaterial, true, "LOD1 wood is MeshBasic");
  assert.equal(lod1Named.wood.color.getHex(), L3_LOD1_WOOD_COLOR);
  assert.equal(lod1Named.woodDark, lod1Named.wood, "LOD1 woodDark aliases the wood MeshBasic instance");
  assert.equal(lod1Named.handleMat, lod1Named.wood, "LOD1 handleMat aliases the wood MeshBasic instance");
  assert.equal(lod1Named.woodDark.color.getHex(), L3_LOD1_WOOD_COLOR);
  assert.equal(lod1Named.handleMat.color.getHex(), L3_LOD1_WOOD_COLOR);
  assert.equal(lod1Named.brass.color.getHex(), L3_LOD1_BRASS_COLOR);
  for (const mat of lod1) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD1 is MeshBasicMaterial (unlit)");
    assert.ok(!mat.isMeshStandardMaterial, "LOD1 is not MeshStandard");
    assert.equal(mat.map, null, "LOD1 MeshBasic has no map (color only)");
    assert.ok(!mat.normalMap, "LOD1 has no normalMap");
    assert.ok(!mat.roughnessMap, "LOD1 has no ORM roughnessMap");
    assert.ok(!mat.metalnessMap, "LOD1 has no ORM metalnessMap");
    assert.equal(mat.roughness, undefined, "LOD1 MeshBasic has no roughness");
    assert.equal(mat.metalness, undefined, "LOD1 MeshBasic has no metalness");
    const isBrass = mat === lod1Named.brass;
    assert.equal(
      mat.color.getHex(),
      isBrass ? L3_LOD1_BRASS_COLOR : L3_LOD1_WOOD_COLOR,
      "LOD1 uses wood or brass albedo midtone"
    );
  }

  setToolboxLod(crate, 2);
  assert.equal(crate.userData.lod.current, 2);
  const lod2 = collectLodVisualMaterials(crate, 2);
  assert.ok(lod2.length > 0);
  for (const mat of lod2) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD2 is MeshBasicMaterial (unlit)");
    assert.ok(!mat.isMeshStandardMaterial, "LOD2 is not MeshStandard");
    assert.equal(mat.map, null, "LOD2 MeshBasic has no map (color only)");
    assert.equal(mat.color.getHex(), L3_LOD2_WOOD_COLOR, "LOD2 uses wood albedo midtone");
    assert.ok(!mat.normalMap, "LOD2 has no normalMap");
    assert.ok(!mat.roughnessMap, "LOD2 has no ORM roughnessMap");
    assert.ok(!mat.metalnessMap, "LOD2 has no ORM metalnessMap");
    assert.equal(mat.roughness, undefined, "LOD2 MeshBasic has no roughness");
    assert.equal(mat.metalness, undefined, "LOD2 MeshBasic has no metalness");
    assert.equal(mat, lod1Named.wood, "LOD2 reuses the shared wood MeshBasic when midtones match (v0.42)");
  }
  for (const mat of lod0) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD0 stays MeshBasic after LOD2 collect");
    assert.ok(!mat.normalMap, "LOD0 still has no normalMap after LOD2 collect");
    assert.ok(!mat.roughnessMap, "LOD0 still has no ORM after LOD2 collect");
    assert.ok(!mat.metalnessMap, "LOD0 still has no ORM metalnessMap after LOD2 collect");
    assert.equal(mat.roughness, undefined, "LOD0 MeshBasic still has no roughness");
    assert.equal(mat.metalness, undefined, "LOD0 MeshBasic still has no metalness");
    assert.equal(mat.map, null, "LOD0 MeshBasic still has no map after LOD2 collect");
  }
  assert.equal(crate.userData.l2.lodNormalMaps[0], false);
  assert.equal(crate.userData.l2.lodNormalMaps[1], false);
  assert.equal(crate.userData.l2.lodNormalMaps[2], false);
  assert.equal(crate.userData.l2.lodOrmMaps[0], false);
  assert.equal(crate.userData.l2.lodOrmMaps[1], false);
  assert.equal(crate.userData.l2.lodOrmMaps[2], false);
  assert.equal(crate.userData.l2.lod0Constants, undefined, "LOD0 drops roughness/metalness constants");
  assert.equal(crate.userData.l2.lod1Constants, undefined, "LOD1 drops roughness/metalness constants");
  assert.equal(crate.userData.l2.lod2Constants, undefined, "LOD2 drops roughness/metalness constants");
  assert.deepEqual(crate.userData.l2.lodMaterialClass, {
    0: "MeshBasicMaterial",
    1: "MeshBasicMaterial",
    2: "MeshBasicMaterial",
  });

  const fastener = crate.userData.fastener.mesh;
  assert.equal(fastener.material, crate.userData.materials.lod0.brass);
  assert.equal(fastener.material.isMeshBasicMaterial, true, "fastener stays on shared LOD0 brass MeshBasic");
  assert.ok(!fastener.material.isMeshStandardMaterial, "fastener is not MeshStandard");
  assert.ok(!fastener.material.normalMap, "fastener stays on shared LOD0 brass (no normalMap)");
  assert.ok(!fastener.material.roughnessMap, "fastener stays on shared LOD0 brass (no ORM)");
  assert.ok(!fastener.material.metalnessMap, "fastener stays on shared LOD0 brass (no ORM)");
  assert.equal(fastener.material.roughness, undefined, "fastener MeshBasic has no roughness");
  assert.equal(fastener.material.metalness, undefined, "fastener MeshBasic has no metalness");
  assert.equal(fastener.material.map, null, "fastener shares LOD0 color-only brass MeshBasic");
  assert.equal(fastener.material.color.getHex(), L3_LOD0_BRASS_COLOR);

  assert.equal(lod0Named.wood, lod1Named.wood, "LOD0 wood === LOD1 wood (same MeshBasic instance)");
  assert.equal(lod1Named.wood, crate.userData.materials.lod2.wood, "LOD1 wood === LOD2 wood");
  assert.equal(lod0Named.brass, lod1Named.brass, "LOD0 brass === LOD1 brass");
  assert.equal(fastener.material, lod1Named.brass, "fastener shares the same brass instance as LOD1 latch");
  assert.notEqual(lod0Named.steel, lod0Named.wood, "steel stays its own instance");
  assert.notEqual(lod0Named.steel, lod0Named.brass, "steel is not brass");
  assert.equal(crate.userData.l2.uniqueMaterials, 3, "unique procedural MeshBasic instances: wood + brass + steel");
  const crateMats = collectCrateVisualMaterials(crate);
  assert.equal(crateMats.length, 3, "bound visual materials collapse to 3 instances (colliders skipped)");
  assert.ok(crateMats.includes(lod0Named.wood));
  assert.ok(crateMats.includes(lod0Named.brass));
  assert.ok(crateMats.includes(lod0Named.steel));
});

test("shareColorOnlyUnlitBasic reuses one MeshBasic per midtone hex", () => {
  const cache = new Map();
  const a = shareColorOnlyUnlitBasic(L3_LOD0_WOOD_COLOR, cache);
  const b = shareColorOnlyUnlitBasic(L3_LOD1_WOOD_COLOR, cache);
  const c = shareColorOnlyUnlitBasic(L3_LOD2_WOOD_COLOR, cache);
  const brassA = shareColorOnlyUnlitBasic(L3_LOD0_BRASS_COLOR, cache);
  const brassB = shareColorOnlyUnlitBasic(L3_LOD1_BRASS_COLOR, cache);
  const steel = shareColorOnlyUnlitBasic(L3_LOD0_STEEL_COLOR, cache);
  assert.equal(L3_LOD0_WOOD_COLOR, L3_LOD1_WOOD_COLOR);
  assert.equal(L3_LOD1_WOOD_COLOR, L3_LOD2_WOOD_COLOR);
  assert.equal(L3_LOD0_BRASS_COLOR, L3_LOD1_BRASS_COLOR);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(brassA, brassB);
  assert.notEqual(a, brassA);
  assert.notEqual(a, steel);
  assert.equal(cache.size, 3);
  assert.equal(a.isMeshBasicMaterial, true);
  assert.equal(a.map, null);
  assert.equal(a.fog, false, "shared wood pins fog false at share time");
  assert.equal(a.toneMapped, false, "shared wood pins toneMapped false at share time");
  assertQuestSafeUnlitFlags(a, "shared wood");
  assertQuestSafeUnlitFlags(brassA, "shared brass");
  assertQuestSafeUnlitFlags(steel, "shared steel");
});

test("setToolboxLod is visibility-only (no material swap on switch)", () => {
  const crate = createToolbox();
  const before = collectLodVisualMaterials(crate, 1).map((m) => m);
  setToolboxLod(crate, 1);
  setToolboxLod(crate, 0);
  setToolboxLod(crate, 1);
  const after = collectLodVisualMaterials(crate, 1);
  assert.deepEqual(after, before);
  assert.equal(crate.userData.lod.groups[1][0].visible, true);
  assert.equal(crate.userData.lod.groups[0][0].visible, false);
});

test("LOD draws stay merged; unused uv/normal strip cuts attrBytes (tris/verts stay at the v0.39 envelope)", () => {
  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  // v0.38 concat-without-weld envelope: 440 / 192 / 48 unique verts
  // (Uint32 index on concatenated meshes). v0.39 welds coincident
  // corners: 230 / 100 / 48. v0.40 strips unused uv/normal on
  // color-only MeshBasic (position-only + index). v0.41 compact is a
  // no-op on these LODs — weld already wrote Uint16. v0.44 quantizes
  // Float32 position to Float16 (230×6 + 720×2 = 2820, etc.). Tris
  // stay index-length/3.
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.ok(stats[0].attrBytes < 4200, "LOD0 attrBytes drop vs v0.43 Float32 position");
  assert.ok(stats[1].attrBytes < 1776, "LOD1 attrBytes drop vs v0.43 Float32 position");
  assert.ok(stats[2].attrBytes < 720, "LOD2 attrBytes drop vs v0.43 Float32 position");
  assert.equal(stats[0].verts, 230, "LOD0 unique verts stay at the v0.39 weld count");
  assert.equal(stats[1].verts, 100, "LOD1 unique verts stay at the v0.39 weld count");
  assert.equal(stats[2].verts, 48, "LOD2 has no concat so no weld");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const lidL0 = crate.userData.lod.groups[0][1];
  const latchL0 = crate.userData.lod.groups[0][2];
  const toolL0 = crate.userData.lod.groups[0][3];
  const bodyL1 = crate.userData.lod.groups[1][0];
  const visualMeshes = (g) => g.children.filter((o) => o.isMesh && !o.userData.collider);
  assert.equal(visualMeshes(bodyL0).length, 1, "bodyL0 wood boxes merge to one mesh");
  assert.equal(visualMeshes(bodyL0)[0].geometry.getAttribute("position").count, 48, "bodyL0 8 boxes weld 192 → 48 unique verts");
  assert.equal(visualMeshes(bodyL0)[0].geometry.getAttribute("normal"), undefined, "color-only MeshBasic drops unused normal");
  assert.equal(visualMeshes(bodyL0)[0].geometry.getAttribute("uv"), undefined, "color-only MeshBasic drops unused uv");
  assert.ok(visualMeshes(bodyL0)[0].geometry.getAttribute("position").isFloat16BufferAttribute, "color-only position is Float16");
  assert.equal(visualMeshes(lidL0).length, 2, "lidL0 keeps wood + brass (different materials / lidMesh name)");
  assert.equal(visualMeshes(latchL0).length, 1, "latchL0 stays one brass mesh");
  assert.equal(visualMeshes(toolL0).length, 2, "toolL0 steel shaft+tip merge; grip stays wood");
  assert.equal(visualMeshes(bodyL1).length, 1, "bodyL1 wood boxes merge to one mesh");

  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  const fastenerMesh = crate.getObjectByName("fastenerMesh");
  assert.ok(lidMesh?.isMesh, "lidMesh name survives on the unmerged wood lid");
  assert.equal(lidMesh.parent.parent.name, "lid", "lidMesh stays under the lid pivot");
  assert.ok(latchMesh?.isMesh, "latchMesh name survives");
  assert.equal(latchMesh.parent.parent.name, "latch", "latchMesh stays under the latch pivot");
  assert.ok(fastenerMesh?.isMesh, "fastenerMesh is not an LOD mesh and stays named");
  assert.equal(fastenerMesh.parent.name, "toolbox", "fastener stays on the toolbox root");
  assert.equal(fastenerMesh.material, crate.userData.materials.lod0.brass);
  assert.equal(fastenerMesh.geometry.getAttribute("uv"), undefined, "fastener stays outside merge but still strips unused uv (v0.41)");
  assert.equal(fastenerMesh.geometry.getAttribute("normal"), undefined, "fastener still strips unused normal (v0.41)");
  assert.ok(fastenerMesh.geometry.getAttribute("position").isFloat16BufferAttribute, "fastener position is Float16");
  assert.ok(fastenerMesh.geometry.index, "fastener keeps its index");
  assert.equal(fastenerMesh.geometry.index.array.BYTES_PER_ELEMENT, 2, "fastener index is Uint16");
  const fastenerAttrBytes =
    fastenerMesh.geometry.getAttribute("position").array.byteLength + fastenerMesh.geometry.index.array.byteLength;
  assert.equal(fastenerAttrBytes, 216, "fastener BoxGeometry 24×6 B Float16 position + 72 B Uint16 index (was 360 Float32)");
  assert.ok(lidMesh.geometry.getAttribute("position"));
  assert.equal(lidMesh.geometry.getAttribute("uv"), undefined, "unmerged color-only lid still strips unused uv");
  assert.equal(lidMesh.geometry.index.array.BYTES_PER_ELEMENT, 2, "unmerged lid index stays Uint16");
});

test("stripUnusedColorOnlyAttributes drops uv/normal only on color-only MeshBasic", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const std = new THREE.MeshStandardMaterial();
  assert.equal(isColorOnlyUnlitBasic(colorOnly), true);
  assert.equal(isColorOnlyUnlitBasic(mapped), false);
  assert.equal(isColorOnlyUnlitBasic(std), false);

  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const before =
    geo.getAttribute("position").array.byteLength +
    geo.getAttribute("normal").array.byteLength +
    geo.getAttribute("uv").array.byteLength +
    geo.index.array.byteLength;
  stripUnusedColorOnlyAttributes(geo, colorOnly);
  assert.equal(geo.getAttribute("normal"), undefined);
  assert.equal(geo.getAttribute("uv"), undefined);
  assert.ok(geo.getAttribute("position"));
  const after = geo.getAttribute("position").array.byteLength + geo.index.array.byteLength;
  assert.ok(after < before, "measurable attribute-byte delta");
  assert.equal(after, 360, "BoxGeometry 24 verts × 12 B position + 72 B Uint16 index");

  const kept = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  stripUnusedColorOnlyAttributes(kept, mapped);
  assert.ok(kept.getAttribute("uv"), "mapped MeshBasic keeps uv");
  assert.ok(kept.getAttribute("normal"), "mapped MeshBasic keeps normal");
  stripUnusedColorOnlyAttributes(kept, std);
  assert.ok(kept.getAttribute("uv"), "MeshStandard keeps uv");
  assert.ok(kept.getAttribute("normal"), "MeshStandard keeps normal");
});

test("compactIndexToUint16 copies a forced Uint32 index when verts fit", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  stripUnusedColorOnlyAttributes(geo, colorOnly);
  const posCount = geo.getAttribute("position").count;
  const triCount = geo.index.count / 3;
  assert.ok(posCount <= 65535);
  const src = geo.index.array;
  assert.equal(src.BYTES_PER_ELEMENT, 2, "BoxGeometry starts Uint16");
  const forced = new Uint32Array(src.length);
  forced.set(src);
  geo.setIndex(new THREE.BufferAttribute(forced, 1));
  assert.equal(geo.index.array.BYTES_PER_ELEMENT, 4);
  const beforeBytes = geo.index.array.byteLength;
  compactIndexToUint16(geo);
  assert.ok(geo.index.array instanceof Uint16Array);
  assert.equal(geo.index.array.BYTES_PER_ELEMENT, 2);
  assert.equal(geo.index.array.byteLength, beforeBytes / 2, "index byte length halves");
  assert.equal(geo.index.count / 3, triCount, "triangle count unchanged");
  assert.equal(geo.getAttribute("position").count, posCount, "vertex count unchanged");

  const already = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const beforeUuid = already.index.uuid;
  compactIndexToUint16(already);
  assert.equal(already.index.uuid, beforeUuid, "already-Uint16 is a no-op");
  assert.equal(already.index.array.BYTES_PER_ELEMENT, 2);
});

test("quantizePositionToFloat16 encodes via setXYZ; skips mapped/lit; recomputes bounds", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  const std = new THREE.MeshStandardMaterial();

  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  stripUnusedColorOnlyAttributes(geo, colorOnly);
  compactIndexToUint16(geo);
  const src = geo.getAttribute("position");
  assert.equal(src.array.BYTES_PER_ELEMENT, 4, "BoxGeometry position starts Float32");
  const x0 = src.getX(0);
  const y0 = src.getY(0);
  const z0 = src.getZ(0);
  assert.equal(geo.boundingBox, null);
  quantizePositionToFloat16(geo, colorOnly);
  const pos = geo.getAttribute("position");
  assert.equal(pos.isFloat16BufferAttribute, true);
  assert.ok(pos.array instanceof Uint16Array, "r170 Float16BufferAttribute stores Uint16 half-float bits");
  assert.equal(pos.array.byteLength, 24 * 3 * 2, "24 verts × 3 × 2 B");
  assert.equal(pos.count, 24, "vertex count unchanged");
  assert.equal(cpuAttrBytes(geo), 216, "144 B Float16 position + 72 B Uint16 index");
  assert.ok(geo.boundingBox, "bounds recomputed after quantize");
  assert.ok(geo.boundingSphere);
  assert.ok(Math.abs(pos.getX(0) - x0) < 1e-3, "half-float getX stays close to Float32");
  assert.ok(Math.abs(pos.getY(0) - y0) < 1e-3);
  assert.ok(Math.abs(pos.getZ(0) - z0) < 1e-3);

  const keptMapped = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  quantizePositionToFloat16(keptMapped, mapped);
  assert.equal(keptMapped.getAttribute("position").isFloat16BufferAttribute, undefined, "mapped MeshBasic stays Float32");
  assert.ok(keptMapped.getAttribute("position").array instanceof Float32Array);
  const keptStd = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  quantizePositionToFloat16(keptStd, std);
  assert.equal(keptStd.getAttribute("position").isFloat16BufferAttribute, undefined, "MeshStandard stays Float32");

  const already = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  stripUnusedColorOnlyAttributes(already, colorOnly);
  quantizePositionToFloat16(already, colorOnly);
  const beforeUuid = already.getAttribute("position").uuid;
  quantizePositionToFloat16(already, colorOnly);
  assert.equal(already.getAttribute("position").uuid, beforeUuid, "already-Float16 is a no-op");
});

function simulateGpuUpload(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    geometry.getAttribute(name)?.onUploadCallback();
  }
  geometry.index?.onUploadCallback();
}

function cpuAttrBytes(geo) {
  let bytes = 0;
  for (const name of Object.keys(geo.attributes)) {
    const arr = geo.getAttribute(name)?.array;
    if (arr) bytes += arr.byteLength;
  }
  if (geo.index?.array) bytes += geo.index.array.byteLength;
  return bytes;
}

function crateVisualMeshes(crate) {
  const meshes = [];
  for (const level of [0, 1, 2]) {
    for (const g of crate.userData.lod.groups[level]) {
      g.traverse((o) => {
        if (o.isMesh && !o.userData.collider) meshes.push(o);
      });
    }
  }
  const fastener = crate.userData.fastener?.mesh;
  if (fastener?.isMesh && !fastener.userData.collider) meshes.push(fastener);
  return meshes;
}

test("releaseCpuArraysOnGpuUpload nulls CPU arrays only on color-only MeshBasic after simulated upload", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  const std = new THREE.MeshStandardMaterial();

  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  stripUnusedColorOnlyAttributes(geo, colorOnly);
  compactIndexToUint16(geo);
  const beforeBytes = cpuAttrBytes(geo);
  assert.equal(beforeBytes, 360);
  assert.ok(geo.boundingSphere === null, "BoxGeometry leaves boundingSphere uncomputed");
  releaseCpuArraysOnGpuUpload(geo, colorOnly);
  assert.ok(geo.boundingSphere, "bounds computed before the upload hook so frustum culls need no .array");
  assert.ok(geo.boundingBox);
  const pos = geo.getAttribute("position");
  assert.equal(pos.usage, THREE.StaticDrawUsage);
  assert.equal(geo.index.usage, THREE.StaticDrawUsage);
  assert.ok(pos.array, "CPU array stays until onUploadCallback");
  assert.equal(cpuAttrBytes(geo), beforeBytes, "pre-upload attrBytes unchanged");
  simulateGpuUpload(geo);
  assert.equal(pos.array, null, "position CPU array released after upload");
  assert.equal(geo.index.array, null, "index CPU array released after upload");
  assert.equal(cpuAttrBytes(geo), 0, "post-upload CPU attrBytes are 0");
  assert.equal(pos.count, 24, "BufferAttribute.count stays after array null");
  assert.equal(geo.index.count, 36, "index count stays after array null");

  const keptMapped = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  releaseCpuArraysOnGpuUpload(keptMapped, mapped);
  simulateGpuUpload(keptMapped);
  assert.ok(keptMapped.getAttribute("position").array, "mapped MeshBasic keeps CPU arrays");
  const keptStd = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  releaseCpuArraysOnGpuUpload(keptStd, std);
  simulateGpuUpload(keptStd);
  assert.ok(keptStd.getAttribute("position").array, "MeshStandard keeps CPU arrays");
});

test("packColorOnlyGeometry is strip + compact + Float16 + upload-release (shared procedural/packaged path)", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const src = geo.index.array;
  const forced = new Uint32Array(src.length);
  forced.set(src);
  geo.setIndex(new THREE.BufferAttribute(forced, 1));
  packColorOnlyGeometry(geo, colorOnly);
  assert.equal(geo.getAttribute("uv"), undefined);
  assert.ok(geo.index.array instanceof Uint16Array);
  assert.equal(geo.getAttribute("position").isFloat16BufferAttribute, true);
  assert.equal(cpuAttrBytes(geo), 216, "pre-upload envelope after strip+compact+Float16");
  simulateGpuUpload(geo);
  assert.equal(geo.getAttribute("position").array, null);
  assert.equal(geo.index.array, null);
});

test("procedural LOD/fastener release CPU arrays after simulated upload; colliders keep them; pre-upload envelope is v0.44 Float16", () => {
  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  // Measurement rule: userData.lod.stats.attrBytes is the pre-upload CPU
  // envelope (arrays still present). After GPU upload, CPU .array is
  // nulled on color-only MeshBasic visuals so live cpuAttrBytes → 0;
  // draws / tris / verts stay (BufferAttribute.count is independent).
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 6 + 4 + 2 + 1, "LOD0 6 + LOD1 4 + LOD2 2 + fastener 1");
  let preUploadBytes = 0;
  for (const mesh of visuals) {
    const pos = mesh.geometry.getAttribute("position");
    assert.ok(pos.array, "visual CPU array present before upload");
    assert.equal(pos.isFloat16BufferAttribute, true, "packed visual position is Float16");
    assert.equal(pos.usage, THREE.StaticDrawUsage);
    assert.equal(mesh.geometry.index.usage, THREE.StaticDrawUsage);
    preUploadBytes += cpuAttrBytes(mesh.geometry);
  }
  assert.equal(preUploadBytes, 2820 + 1176 + 432 + 216, "LOD + fastener pre-upload CPU attrBytes");

  const colliders = crate.userData.colliders;
  assert.equal(colliders.length, 5);
  for (const c of colliders) {
    const pos = c.geometry.getAttribute("position");
    assert.ok(pos.array, "collider CPU arrays stay at create");
    assert.equal(pos.isFloat16BufferAttribute, undefined, "collider position stays Float32");
    assert.ok(pos.array instanceof Float32Array);
  }

  for (const mesh of visuals) simulateGpuUpload(mesh.geometry);
  for (const mesh of visuals) {
    assert.equal(mesh.geometry.getAttribute("position").array, null, "visual position released");
    assert.equal(mesh.geometry.index.array, null, "visual index released");
    assert.equal(cpuAttrBytes(mesh.geometry), 0);
    assert.ok(mesh.geometry.getAttribute("position").count > 0);
    assert.ok(mesh.geometry.index.count > 0);
    assert.ok(mesh.geometry.boundingSphere, "packed visual has bounds without CPU arrays");
  }
  assert.deepEqual(getToolboxLodStats(crate), stats, "lod.stats snapshot is the pre-upload envelope");
  for (const c of colliders) {
    simulateGpuUpload(c.geometry);
    assert.ok(c.geometry.getAttribute("position").array, "collider CPU arrays survive default onUpload");
    assert.ok(c.geometry.index.array, "collider index stays on CPU");
  }
});

function countVisualMatrixAutoUpdate(crate) {
  let frozen = 0;
  let live = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.matrixAutoUpdate) live += 1;
    else frozen += 1;
  }
  return { frozen, live, total: frozen + live };
}

test("v0.45 freezes static color-only MeshBasic body leaves; lid/latch/tool/fastener stay live", () => {
  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 6 + 4 + 2 + 1, "LOD0 6 + LOD1 4 + LOD2 2 + fastener 1");
  const counts = countVisualMatrixAutoUpdate(crate);
  assert.equal(counts.total, 13);
  assert.equal(counts.frozen, 3, "body LOD0/1/2 color-only MeshBasic leaves freeze");
  assert.equal(counts.live, 10, "lid/latch/tool LOD meshes + fastener stay live");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyL1 = crate.userData.lod.groups[1][0];
  const bodyL2 = crate.userData.lod.groups[2][0];
  const lidL0 = crate.userData.lod.groups[0][1];
  const latchL0 = crate.userData.lod.groups[0][2];
  const toolL0 = crate.userData.lod.groups[0][3];
  const visualMeshes = (g) => g.children.filter((o) => o.isMesh && !o.userData.collider);

  const bodyMeshes = [...visualMeshes(bodyL0), ...visualMeshes(bodyL1), ...visualMeshes(bodyL2)];
  assert.equal(bodyMeshes.length, 3);
  for (const mesh of bodyMeshes) {
    assert.equal(mesh.matrixAutoUpdate, false, "static body MeshBasic is frozen");
    assert.equal(isColorOnlyUnlitBasic(mesh.material), true);
    assert.equal(isUnderAnimatedToolboxPivot(mesh, crate), false);
  }

  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  const fastenerMesh = crate.getObjectByName("fastenerMesh");
  assert.equal(lidMesh.matrixAutoUpdate, true, "lidMesh under lid pivot stays live");
  assert.equal(latchMesh.matrixAutoUpdate, true, "latchMesh under latch pivot stays live");
  assert.equal(fastenerMesh.matrixAutoUpdate, true, "fastener animates via applyFastenerVisual");
  assert.equal(crate.userData.parts.lidPivot.matrixAutoUpdate, true);
  assert.equal(crate.userData.parts.latchPivot.matrixAutoUpdate, true);
  assert.equal(crate.userData.parts.tool.matrixAutoUpdate, true);
  assert.equal(isUnderAnimatedToolboxPivot(lidMesh, crate), true);
  assert.equal(isUnderAnimatedToolboxPivot(latchMesh, crate), true);
  assert.equal(isUnderAnimatedToolboxPivot(visualMeshes(toolL0)[0], crate), true);

  for (const mesh of visualMeshes(lidL0)) assert.equal(mesh.matrixAutoUpdate, true);
  for (const mesh of visualMeshes(latchL0)) assert.equal(mesh.matrixAutoUpdate, true);
  for (const mesh of visualMeshes(toolL0)) assert.equal(mesh.matrixAutoUpdate, true);

  for (const c of crate.userData.colliders) {
    assert.equal(c.matrixAutoUpdate, true, "colliders stay live for pick AABB");
  }

  // Frozen local matrix still follows crate grab via parent world compose.
  const bodyHero = visualMeshes(bodyL0)[0];
  crate.position.set(1.5, 0, 0);
  crate.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  bodyHero.getWorldPosition(world);
  assert.ok(world.x > 1, "frozen body leaf world matrix follows root motion");
  crate.position.set(0, 0, 0);
  crate.updateMatrixWorld(true);
});

test("L4/L5 activity smoke still passes after static matrix freeze", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot, tool } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");
  assert.equal(lidPivot.matrixAutoUpdate, true);
  assert.equal(latchPivot.matrixAutoUpdate, true);
  assert.equal(tool.matrixAutoUpdate, true);
  assert.equal(fastener.matrixAutoUpdate, true);

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1, "latch hinge still rotates after freeze");
  assert.equal(lidPivot.rotation.x, 0);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2, "lid hinge still rotates after freeze");
  crate.updateMatrixWorld(true);
  const lidWorld = new THREE.Vector3();
  crate.getObjectByName("lidMesh").getWorldPosition(lidWorld);
  assert.ok(lidWorld.y > 0.1, "live lidMesh world position follows pivot");

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6, "fastener rotation still applies");
  assert.ok(fastener.position.z < 0.131, "fastener seats incrementally");

  const cancel = tryUse(crate, "collider_lid");
  assert.equal(cancel.ok, true);
  assert.equal(cancel.to, "closed");

  resetToolbox(crate);
  assert.equal(activityState(crate), "closed");
  applyActivityVisual(crate, 1);
  assert.equal(crate.userData.fastener.turns, 0);
  assert.equal(fastener.rotation.z, 0);
});

test("freezeStaticColorOnlyWorldMatrices skips mapped MeshBasic and colliders", () => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  body.add(mapped, colorOnly);
  root.add(body, collider);
  root.userData.parts = {};
  freezeStaticColorOnlyWorldMatrices(root);
  assert.equal(colorOnly.matrixAutoUpdate, false);
  assert.equal(mapped.matrixAutoUpdate, true, "mapped MeshBasic stays live");
  assert.equal(collider.matrixAutoUpdate, true, "collider stays live");
});

function countVisualRaycast(crate) {
  let disabled = 0;
  let defaultRaycast = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.raycast === noopColorOnlyVisualRaycast) disabled += 1;
    else if (mesh.raycast === THREE.Mesh.prototype.raycast) defaultRaycast += 1;
  }
  return { disabled, defaultRaycast, total: disabled + defaultRaycast };
}

function countVisualShadowFlags(crate) {
  let off = 0;
  let on = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (!mesh.castShadow && !mesh.receiveShadow) off += 1;
    else on += 1;
  }
  return { off, on, total: off + on };
}

function countVisualFrustumCulled(crate) {
  let on = 0;
  let off = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.frustumCulled) on += 1;
    else off += 1;
  }
  return { on, off, total: on + off };
}

function countVisualRenderOrder(crate) {
  let zero = 0;
  let nonzero = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.renderOrder === 0) zero += 1;
    else nonzero += 1;
  }
  return { zero, nonzero, total: zero + nonzero };
}

function countVisualLayersDefault(crate) {
  let layer0Only = 0;
  let other = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.layers.mask === 1 && mesh.layers.isEnabled(0)) layer0Only += 1;
    else other += 1;
  }
  return { layer0Only, other, total: layer0Only + other };
}

function countVisualMatrixWorldAutoUpdate(crate) {
  let on = 0;
  let off = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.matrixWorldAutoUpdate) on += 1;
    else off += 1;
  }
  return { on, off, total: on + off };
}

function countVisualUpDefault(crate) {
  let yUp = 0;
  let other = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.up && mesh.up.x === 0 && mesh.up.y === 1 && mesh.up.z === 0) yUp += 1;
    else other += 1;
  }
  return { yUp, other, total: yUp + other };
}

function countVisualScaleDefault(crate) {
  let unit = 0;
  let other = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.scale && mesh.scale.x === 1 && mesh.scale.y === 1 && mesh.scale.z === 1) unit += 1;
    else other += 1;
  }
  return { unit, other, total: unit + other };
}

function countVisualRotationOrderXYZ(crate) {
  let xyz = 0;
  let other = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.rotation && mesh.rotation.order === "XYZ") xyz += 1;
    else other += 1;
  }
  return { xyz, other, total: xyz + other };
}

function countVisualCustomShadowMaterials(crate) {
  let absent = 0;
  let leftover = 0;
  for (const mesh of crateVisualMeshes(crate)) {
    if (mesh.customDepthMaterial == null && mesh.customDistanceMaterial == null) absent += 1;
    else leftover += 1;
  }
  return { absent, leftover, total: absent + leftover };
}

test("v0.46 disables Mesh.raycast on packed color-only visuals; colliders keep default", () => {
  assert.equal(typeof THREE.Mesh.prototype.raycast, "function", "r170 Mesh.prototype.raycast exists");
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.raycast, THREE.Mesh.prototype.raycast, "default Mesh uses prototype.raycast");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 6 + 4 + 2 + 1, "LOD0 6 + LOD1 4 + LOD2 2 + fastener 1");
  const counts = countVisualRaycast(crate);
  assert.equal(counts.total, 13);
  assert.equal(counts.disabled, 13, "all color-only visual MeshBasics get the no-op raycast");
  assert.equal(counts.defaultRaycast, 0, "no visual MeshBasic keeps Mesh.prototype.raycast");

  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3, "body LOD0/1/2 still matrix-frozen");
  assert.equal(matrixCounts.live, 10, "lid/latch/tool/fastener still matrix-live");

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.equal(lidMesh.raycast, noopColorOnlyVisualRaycast);
  assert.equal(latchMesh.raycast, noopColorOnlyVisualRaycast);
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
  assert.equal(lidMesh.matrixAutoUpdate, true);
  assert.equal(latchMesh.matrixAutoUpdate, true);
  assert.equal(fastener.matrixAutoUpdate, true);

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false);
  assert.equal(bodyHero.raycast, noopColorOnlyVisualRaycast);

  const intersects = [];
  bodyHero.raycast(new THREE.Raycaster(), intersects);
  fastener.raycast(new THREE.Raycaster(), intersects);
  assert.equal(intersects.length, 0, "no-op raycast does not push intersections");

  for (const c of crate.userData.colliders) {
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast, "colliders keep default Mesh raycast");
    assert.notEqual(c.raycast, noopColorOnlyVisualRaycast, "colliders are not assigned the visual no-op");
  }
});

test("L4/L5 activity smoke still passes after visual raycast disable", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast, "L5 drive does not restore mesh raycast");
});

test("pick path still hits collider AABBs after visual raycast disable", async () => {
  const { collectPickables, firstHit } = await import("./interaction.js");
  const crate = createToolbox();
  crate.updateMatrixWorld(true);
  const list = collectPickables([crate]);
  assert.ok(list.every((o) => o.userData.collider || o.name.startsWith("collider_")));
  assert.ok(list.every((o) => o.raycast === THREE.Mesh.prototype.raycast));
  assert.ok(!list.some((o) => o.raycast === noopColorOnlyVisualRaycast));

  const raycaster = new THREE.Raycaster();
  raycaster.ray.origin.set(0, 0.075, 1);
  raycaster.ray.direction.set(0, 0, -1);
  const hit = firstHit(raycaster, list);
  assert.ok(hit, "AABB firstHit still finds a collider");
  assert.ok(hit.object.name.startsWith("collider_"), "picks hit colliders only, not visual meshes");
  assert.equal(hit.object.raycast, THREE.Mesh.prototype.raycast);
  assert.notEqual(hit.object.raycast, noopColorOnlyVisualRaycast);
});

test("disableColorOnlyVisualRaycast skips mapped MeshBasic, morph, and colliders", () => {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  body.add(mapped, colorOnly, morph);
  root.add(body, collider);
  disableColorOnlyVisualRaycast(root);
  assert.equal(colorOnly.raycast, noopColorOnlyVisualRaycast);
  assert.equal(mapped.raycast, THREE.Mesh.prototype.raycast, "mapped MeshBasic keeps default raycast");
  assert.equal(morph.raycast, THREE.Mesh.prototype.raycast, "morph color-only MeshBasic is skipped");
  assert.equal(collider.raycast, THREE.Mesh.prototype.raycast, "collider keeps default raycast");
});

test("v0.49 pins castShadow/receiveShadow false on color-only visual meshes; envelope stays v0.48", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.castShadow, false, "r170 Mesh defaults castShadow false");
  assert.equal(fresh.receiveShadow, false, "r170 Mesh defaults receiveShadow false");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFlags(mesh.material);
  }
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count is 13");
  assert.equal(shadowCounts.on, 0);

  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  for (const c of crate.userData.colliders) {
    assert.equal(c.castShadow, false, "collider Mesh keeps r170 castShadow default");
    assert.equal(c.receiveShadow, false, "collider Mesh keeps r170 receiveShadow default");
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("L4/L5 activity smoke still passes after Mesh shadow-flag pin", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitShadowFlags(fastener, "fastener after L5 drive");
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
});

test("pinColorOnlyUnlitBasicShadowFlags corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.castShadow, false, "r170 Mesh defaults castShadow false");
  assert.equal(fresh.receiveShadow, false, "r170 Mesh defaults receiveShadow false");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  wrong.castShadow = true;
  wrong.receiveShadow = true;
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.castShadow, true);
  assert.equal(wrong.receiveShadow, true);
  pinColorOnlyUnlitBasicShadowFlags(wrong);
  assertQuestSafeUnlitShadowFlags(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.material.fog, true, "shadow pin does not change fog");
  assert.equal(wrong.material.toneMapped, true, "shadow pin does not change toneMapped");
  assert.equal(wrong.material.transparent, false, "shadow pin does not change opaque FrontSide");
  assert.equal(wrong.material.side, THREE.FrontSide, "shadow pin does not change FrontSide");
});

test("pinColorOnlyUnlitBasicShadowFlags / pinColorOnlyVisualShadowFlags skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.castShadow = true;
  colorOnly.receiveShadow = true;
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.castShadow = true;
  mapped.receiveShadow = true;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.castShadow = true;
  std.receiveShadow = true;
  pinColorOnlyUnlitBasicShadowFlags(colorOnly);
  pinColorOnlyUnlitBasicShadowFlags(mapped);
  pinColorOnlyUnlitBasicShadowFlags(std);
  assertQuestSafeUnlitShadowFlags(colorOnly);
  assert.equal(mapped.castShadow, true, "mapped MeshBasic stays authored castShadow");
  assert.equal(mapped.receiveShadow, true, "mapped MeshBasic stays authored receiveShadow");
  assert.equal(std.castShadow, true, "MeshStandard stays authored castShadow");
  assert.equal(std.receiveShadow, true, "MeshStandard stays authored receiveShadow");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.castShadow = true;
  colorMesh.receiveShadow = true;
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.castShadow = true;
  morph.receiveShadow = true;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.castShadow = true;
  collider.receiveShadow = true;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.castShadow = true;
  sharedVisual.receiveShadow = true;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.castShadow = true;
  sharedCollider.receiveShadow = true;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualShadowFlags(root);
  assertQuestSafeUnlitShadowFlags(colorMesh, "entity helper color-only");
  assert.equal(mapped.castShadow, true, "mapped MeshBasic stays authored via entity helper");
  assert.equal(mapped.receiveShadow, true);
  assert.equal(morph.castShadow, true, "morph color-only MeshBasic is skipped");
  assert.equal(morph.receiveShadow, true);
  assert.equal(collider.castShadow, true, "collider Mesh stays authored");
  assert.equal(collider.receiveShadow, true);
  assert.equal(sharedVisual.castShadow, true, "shared collider material visual stays unpinned");
  assert.equal(sharedVisual.receiveShadow, true, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.castShadow, true, "shared collider stays authored");
  assert.equal(sharedCollider.receiveShadow, true);
  assert.equal(std.castShadow, true, "MeshStandard stays authored via entity helper");
  assert.equal(std.receiveShadow, true);
});

test("v0.50 pins frustumCulled true on color-only visual meshes; envelope stays v0.49", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.frustumCulled, true, "r170 Mesh defaults frustumCulled true");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFlags(mesh.material);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count is 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);

  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFrustumCulled(lidMesh, "lidMesh");
  assertQuestSafeUnlitFrustumCulled(latchMesh, "latchMesh");
  assertQuestSafeUnlitFrustumCulled(fastener, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.frustumCulled, true, "collider Mesh keeps r170 frustumCulled default");
    assert.equal(c.castShadow, false, "collider Mesh keeps r170 castShadow default");
    assert.equal(c.receiveShadow, false, "collider Mesh keeps r170 receiveShadow default");
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("L4/L5 activity smoke still passes after Mesh frustumCulled pin", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitShadowFlags(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitFrustumCulled(fastener, "fastener after L5 drive");
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
});

test("pinColorOnlyUnlitBasicFrustumCulled corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.frustumCulled, true, "r170 Mesh defaults frustumCulled true");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  wrong.frustumCulled = false;
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.frustumCulled, false);
  pinColorOnlyUnlitBasicFrustumCulled(wrong);
  assertQuestSafeUnlitFrustumCulled(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.castShadow, false, "frustum pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "frustum pin does not change receiveShadow");
  assert.equal(wrong.material.fog, true, "frustum pin does not change fog");
  assert.equal(wrong.material.toneMapped, true, "frustum pin does not change toneMapped");
  assert.equal(wrong.material.transparent, false, "frustum pin does not change opaque FrontSide");
  assert.equal(wrong.material.side, THREE.FrontSide, "frustum pin does not change FrontSide");
});

test("pinColorOnlyUnlitBasicFrustumCulled / pinColorOnlyVisualFrustumCulled skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.frustumCulled = false;
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.frustumCulled = false;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.frustumCulled = false;
  pinColorOnlyUnlitBasicFrustumCulled(colorOnly);
  pinColorOnlyUnlitBasicFrustumCulled(mapped);
  pinColorOnlyUnlitBasicFrustumCulled(std);
  assertQuestSafeUnlitFrustumCulled(colorOnly);
  assert.equal(mapped.frustumCulled, false, "mapped MeshBasic stays authored frustumCulled");
  assert.equal(std.frustumCulled, false, "MeshStandard stays authored frustumCulled");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.frustumCulled = false;
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.frustumCulled = false;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.frustumCulled = false;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.frustumCulled = false;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.frustumCulled = false;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualFrustumCulled(root);
  assertQuestSafeUnlitFrustumCulled(colorMesh, "entity helper color-only");
  assert.equal(mapped.frustumCulled, false, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.frustumCulled, false, "morph color-only MeshBasic is skipped");
  assert.equal(collider.frustumCulled, false, "collider Mesh stays authored");
  assert.equal(sharedVisual.frustumCulled, false, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.frustumCulled, false, "shared collider stays authored");
  assert.equal(std.frustumCulled, false, "MeshStandard stays authored via entity helper");
});

test("v0.51 pins NormalBlending / premultipliedAlpha false / alphaTest 0 on unique color-only MeshBasics; envelope stays v0.50", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.blending, THREE.NormalBlending, "collider MeshBasic keeps r170 blending default");
    assert.equal(c.material.premultipliedAlpha, false, "collider MeshBasic keeps r170 premultipliedAlpha default");
    assert.equal(c.material.alphaTest, 0, "collider MeshBasic keeps r170 alphaTest default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.52 pins wireframe false / colorWrite true / depthFunc LessEqualDepth / polygonOffset off on unique color-only MeshBasics; envelope stays v0.51", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.blending, THREE.NormalBlending, "collider MeshBasic keeps r170 blending default");
    assert.equal(c.material.premultipliedAlpha, false, "collider MeshBasic keeps r170 premultipliedAlpha default");
    assert.equal(c.material.alphaTest, 0, "collider MeshBasic keeps r170 alphaTest default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.colorWrite, true, "collider MeshBasic keeps r170 colorWrite default");
    assert.equal(c.material.depthFunc, THREE.LessEqualDepth, "collider MeshBasic keeps r170 depthFunc default");
    assert.equal(c.material.polygonOffset, false, "collider MeshBasic keeps r170 polygonOffset default");
    assert.equal(c.material.polygonOffsetFactor, 0, "collider MeshBasic keeps r170 polygonOffsetFactor default");
    assert.equal(c.material.polygonOffsetUnits, 0, "collider MeshBasic keeps r170 polygonOffsetUnits default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.53 pins r170 stencil defaults on unique color-only MeshBasics; envelope stays v0.52", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.stencilWrite, false, "collider MeshBasic keeps r170 stencilWrite default");
    assert.equal(c.material.stencilFunc, THREE.AlwaysStencilFunc, "collider MeshBasic keeps r170 stencilFunc default");
    assert.equal(c.material.stencilRef, 0, "collider MeshBasic keeps r170 stencilRef default");
    assert.equal(c.material.stencilWriteMask, 0xff, "collider MeshBasic keeps r170 stencilWriteMask default");
    assert.equal(c.material.stencilFuncMask, 0xff, "collider MeshBasic keeps r170 stencilFuncMask default");
    assert.equal(c.material.stencilFail, THREE.KeepStencilOp, "collider MeshBasic keeps r170 stencilFail default");
    assert.equal(c.material.stencilZFail, THREE.KeepStencilOp, "collider MeshBasic keeps r170 stencilZFail default");
    assert.equal(c.material.stencilZPass, THREE.KeepStencilOp, "collider MeshBasic keeps r170 stencilZPass default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.54 pins r170 clipping defaults on unique color-only MeshBasics; envelope stays v0.53", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.55 pins r170 alphaHash/forceSinglePass defaults on unique color-only MeshBasics; envelope stays v0.54", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.56 pins r170 NormalBlending factor/equation companions on unique color-only MeshBasics; envelope stays v0.55", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.material.vertexColors, false, "collider MeshBasic keeps r170 vertexColors default");
    assert.equal(c.material.precision, null, "collider MeshBasic keeps r170 precision default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.57 pins r170 vertexColors false on unique color-only MeshBasics; envelope stays v0.56", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.material.vertexColors, false, "collider MeshBasic keeps r170 vertexColors default");
    assert.equal(c.material.precision, null, "collider MeshBasic keeps r170 precision default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.58 pins r170 precision null on unique color-only MeshBasics; envelope stays v0.57", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.precision, null, "color-only MeshBasic pins precision null");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.precision, null, "wood pins precision null");
  assert.equal(named.brass.precision, null, "brass pins precision null");
  assert.equal(named.steel.precision, null, "steel pins precision null");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.material.vertexColors, false, "collider MeshBasic keeps r170 vertexColors default");
    assert.equal(c.material.precision, null, "collider MeshBasic keeps r170 precision default");
    assert.equal(c.material.shadowSide, null, "collider MeshBasic keeps r170 shadowSide default");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.59 pins r170 shadowSide null on unique color-only MeshBasics; envelope stays v0.58", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.shadowSide, null, "color-only MeshBasic pins shadowSide null");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.shadowSide, null, "wood pins shadowSide null");
  assert.equal(named.brass.shadowSide, null, "brass pins shadowSide null");
  assert.equal(named.steel.shadowSide, null, "steel pins shadowSide null");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
  }
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
    assert.equal(c.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
    assert.equal(c.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
    assert.equal(c.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
    assert.equal(c.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
    assert.equal(c.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
    assert.equal(c.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
    assert.equal(c.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
    assert.equal(c.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
    assert.equal(c.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
    assert.equal(c.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
    assert.equal(c.material.vertexColors, false, "collider MeshBasic keeps r170 vertexColors default");
    assert.equal(c.material.precision, null, "collider MeshBasic keeps r170 precision default");
    assert.equal(c.material.shadowSide, null, "collider MeshBasic keeps r170 shadowSide default");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.60 pins renderOrder 0 on color-only visual meshes; envelope stays v0.59", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.renderOrder, 0, "r170 Mesh defaults renderOrder 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFlags(mesh.material);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count is 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);

  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitRenderOrder(lidMesh, "lidMesh");
  assertQuestSafeUnlitRenderOrder(latchMesh, "latchMesh");
  assertQuestSafeUnlitRenderOrder(fastener, "fastenerMesh");

  for (const c of crate.userData.colliders) {
    assert.equal(c.renderOrder, 0, "collider Mesh keeps r170 renderOrder default");
    assert.equal(c.frustumCulled, true, "collider Mesh keeps r170 frustumCulled default");
    assert.equal(c.castShadow, false, "collider Mesh keeps r170 castShadow default");
    assert.equal(c.receiveShadow, false, "collider Mesh keeps r170 receiveShadow default");
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden; material pin does not change it");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("v0.61 pins r170 Material visible true on unique color-only MeshBasics; envelope stays v0.60", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.visible, true, "color-only MeshBasic pins visible true");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.visible, true, "wood pins visible true");
  assert.equal(named.brass.visible, true, "brass pins visible true");
  assert.equal(named.steel.visible, true, "steel pins visible true");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.visible, true, "fastener material.visible stays true after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.62 pins r170 MeshBasic envMap companions on unique color-only MeshBasics; envelope stays v0.61", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assert.equal(fresh.envMap, null, "r170 MeshBasicMaterial defaults envMap null");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.envMap, null, "color-only MeshBasic envMap stays null; pin does not attach envMap");
    assert.equal(mat.combine, THREE.MultiplyOperation, "color-only MeshBasic pins MultiplyOperation");
    assert.equal(mat.reflectivity, 1, "color-only MeshBasic pins reflectivity 1");
    assert.equal(mat.refractionRatio, 0.98, "color-only MeshBasic pins refractionRatio 0.98");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.combine, THREE.MultiplyOperation, "wood pins MultiplyOperation");
  assert.equal(named.brass.combine, THREE.MultiplyOperation, "brass pins MultiplyOperation");
  assert.equal(named.steel.combine, THREE.MultiplyOperation, "steel pins MultiplyOperation");
  assert.equal(named.wood.reflectivity, 1, "wood pins reflectivity 1");
  assert.equal(named.brass.reflectivity, 1, "brass pins reflectivity 1");
  assert.equal(named.steel.reflectivity, 1, "steel pins reflectivity 1");
  assert.equal(named.wood.refractionRatio, 0.98, "wood pins refractionRatio 0.98");
  assert.equal(named.brass.refractionRatio, 0.98, "brass pins refractionRatio 0.98");
  assert.equal(named.steel.refractionRatio, 0.98, "steel pins refractionRatio 0.98");
  assert.equal(named.wood.envMap, null, "wood envMap stays null");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.material.combine, THREE.MultiplyOperation, "collider MeshBasic keeps r170 combine default");
    assert.equal(c.material.reflectivity, 1, "collider MeshBasic keeps r170 reflectivity default");
    assert.equal(c.material.refractionRatio, 0.98, "collider MeshBasic keeps r170 refractionRatio default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.combine, THREE.MultiplyOperation, "fastener combine stays MultiplyOperation after L5");
  assert.equal(fastener.material.reflectivity, 1, "fastener reflectivity stays 1 after L5");
  assert.equal(fastener.material.refractionRatio, 0.98, "fastener refractionRatio stays 0.98 after L5");
  assert.equal(fastener.material.envMap, null, "fastener envMap stays null after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.63 pins r170 MeshBasic map-intensity companions on unique color-only MeshBasics; envelope stays v0.62", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assert.equal(fresh.envMap, null, "r170 MeshBasicMaterial defaults envMap null");
  assert.equal(fresh.lightMap, null, "r170 MeshBasicMaterial defaults lightMap null");
  assert.equal(fresh.aoMap, null, "r170 MeshBasicMaterial defaults aoMap null");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.lightMap, null, "color-only MeshBasic lightMap stays null; pin does not attach lightMap");
    assert.equal(mat.aoMap, null, "color-only MeshBasic aoMap stays null; pin does not attach aoMap");
    assert.equal(mat.lightMapIntensity, 1, "color-only MeshBasic pins lightMapIntensity 1");
    assert.equal(mat.aoMapIntensity, 1, "color-only MeshBasic pins aoMapIntensity 1");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.lightMapIntensity, 1, "wood pins lightMapIntensity 1");
  assert.equal(named.brass.lightMapIntensity, 1, "brass pins lightMapIntensity 1");
  assert.equal(named.steel.lightMapIntensity, 1, "steel pins lightMapIntensity 1");
  assert.equal(named.wood.aoMapIntensity, 1, "wood pins aoMapIntensity 1");
  assert.equal(named.brass.aoMapIntensity, 1, "brass pins aoMapIntensity 1");
  assert.equal(named.steel.aoMapIntensity, 1, "steel pins aoMapIntensity 1");
  assert.equal(named.wood.lightMap, null, "wood lightMap stays null");
  assert.equal(named.wood.aoMap, null, "wood aoMap stays null");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.material.lightMapIntensity, 1, "collider MeshBasic keeps r170 lightMapIntensity default");
    assert.equal(c.material.aoMapIntensity, 1, "collider MeshBasic keeps r170 aoMapIntensity default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.lightMapIntensity, 1, "fastener lightMapIntensity stays 1 after L5");
  assert.equal(fastener.material.aoMapIntensity, 1, "fastener aoMapIntensity stays 1 after L5");
  assert.equal(fastener.material.lightMap, null, "fastener lightMap stays null after L5");
  assert.equal(fastener.material.aoMap, null, "fastener aoMap stays null after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.64 pins r170 MeshBasic wireframeLinewidth on unique color-only MeshBasics; envelope stays v0.63", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.wireframeLinewidth, 1, "r170 MeshBasicMaterial defaults wireframeLinewidth 1");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.wireframe, false, "color-only MeshBasic pins wireframe false; pin does not enable wireframe");
    assert.equal(mat.wireframeLinewidth, 1, "color-only MeshBasic pins wireframeLinewidth 1");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.wireframeLinewidth, 1, "wood pins wireframeLinewidth 1");
  assert.equal(named.brass.wireframeLinewidth, 1, "brass pins wireframeLinewidth 1");
  assert.equal(named.steel.wireframeLinewidth, 1, "steel pins wireframeLinewidth 1");
  assert.equal(named.wood.wireframe, false, "wood wireframe stays false");
  assert.equal(named.brass.wireframe, false, "brass wireframe stays false");
  assert.equal(named.steel.wireframe, false, "steel wireframe stays false");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.wireframe, false, "visual MeshBasic wireframe stays false");
    assert.equal(mesh.material.wireframeLinewidth, 1, "visual MeshBasic wireframeLinewidth stays 1");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.wireframeLinewidth, 1, "collider MeshBasic keeps r170 wireframeLinewidth default");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.wireframe, false, "fastener wireframe stays false after L5");
  assert.equal(fastener.material.wireframeLinewidth, 1, "fastener wireframeLinewidth stays 1 after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.65 pins r170 MeshBasic wireframe line style on unique color-only MeshBasics; envelope stays v0.64", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.wireframeLinewidth, 1, "r170 MeshBasicMaterial defaults wireframeLinewidth 1");
  assert.equal(fresh.wireframeLinecap, "round", "r170 MeshBasicMaterial defaults wireframeLinecap round");
  assert.equal(fresh.wireframeLinejoin, "round", "r170 MeshBasicMaterial defaults wireframeLinejoin round");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.wireframe, false, "color-only MeshBasic pins wireframe false; pin does not enable wireframe");
    assert.equal(mat.wireframeLinewidth, 1, "color-only MeshBasic pins wireframeLinewidth 1");
    assert.equal(mat.wireframeLinecap, "round", "color-only MeshBasic pins wireframeLinecap round");
    assert.equal(mat.wireframeLinejoin, "round", "color-only MeshBasic pins wireframeLinejoin round");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.wireframeLinecap, "round", "wood pins wireframeLinecap round");
  assert.equal(named.brass.wireframeLinecap, "round", "brass pins wireframeLinecap round");
  assert.equal(named.steel.wireframeLinecap, "round", "steel pins wireframeLinecap round");
  assert.equal(named.wood.wireframeLinejoin, "round", "wood pins wireframeLinejoin round");
  assert.equal(named.brass.wireframeLinejoin, "round", "brass pins wireframeLinejoin round");
  assert.equal(named.steel.wireframeLinejoin, "round", "steel pins wireframeLinejoin round");
  assert.equal(named.wood.wireframe, false, "wood wireframe stays false");
  assert.equal(named.brass.wireframe, false, "brass wireframe stays false");
  assert.equal(named.steel.wireframe, false, "steel wireframe stays false");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.wireframe, false, "visual MeshBasic wireframe stays false");
    assert.equal(mesh.material.wireframeLinewidth, 1, "visual MeshBasic wireframeLinewidth stays 1");
    assert.equal(mesh.material.wireframeLinecap, "round", "visual MeshBasic wireframeLinecap stays round");
    assert.equal(mesh.material.wireframeLinejoin, "round", "visual MeshBasic wireframeLinejoin stays round");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.wireframeLinewidth, 1, "collider MeshBasic keeps r170 wireframeLinewidth default");
    assert.equal(c.material.wireframeLinecap, "round", "collider MeshBasic keeps r170 wireframeLinecap default");
    assert.equal(c.material.wireframeLinejoin, "round", "collider MeshBasic keeps r170 wireframeLinejoin default");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.wireframe, false, "fastener wireframe stays false after L5");
  assert.equal(fastener.material.wireframeLinewidth, 1, "fastener wireframeLinewidth stays 1 after L5");
  assert.equal(fastener.material.wireframeLinecap, "round", "fastener wireframeLinecap stays round after L5");
  assert.equal(fastener.material.wireframeLinejoin, "round", "fastener wireframeLinejoin stays round after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.66 pins r170 MeshBasic envMapRotation on unique color-only MeshBasics; envelope stays v0.65", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.envMap, null, "r170 MeshBasicMaterial defaults envMap null");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  const freshRotation = fresh.envMapRotation;
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.envMapRotation.x, 0, "r170 MeshBasicMaterial defaults envMapRotation.x 0");
  assert.equal(fresh.envMapRotation.y, 0, "r170 MeshBasicMaterial defaults envMapRotation.y 0");
  assert.equal(fresh.envMapRotation.z, 0, "r170 MeshBasicMaterial defaults envMapRotation.z 0");
  assert.equal(fresh.envMapRotation.order, "XYZ", "r170 MeshBasicMaterial defaults envMapRotation.order XYZ");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.wireframe, false, "color-only MeshBasic pins wireframe false; pin does not enable wireframe");
    assert.equal(mat.envMap, null, "color-only MeshBasic leaves envMap null; pin does not force envMap");
    assert.equal(mat.envMapRotation.x, 0, "color-only MeshBasic pins envMapRotation.x 0");
    assert.equal(mat.envMapRotation.y, 0, "color-only MeshBasic pins envMapRotation.y 0");
    assert.equal(mat.envMapRotation.z, 0, "color-only MeshBasic pins envMapRotation.z 0");
    assert.equal(mat.envMapRotation.order, "XYZ", "color-only MeshBasic pins envMapRotation.order XYZ");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.envMapRotation.x, 0, "wood pins envMapRotation.x 0");
  assert.equal(named.brass.envMapRotation.x, 0, "brass pins envMapRotation.x 0");
  assert.equal(named.steel.envMapRotation.x, 0, "steel pins envMapRotation.x 0");
  assert.equal(named.wood.envMapRotation.y, 0, "wood pins envMapRotation.y 0");
  assert.equal(named.brass.envMapRotation.y, 0, "brass pins envMapRotation.y 0");
  assert.equal(named.steel.envMapRotation.y, 0, "steel pins envMapRotation.y 0");
  assert.equal(named.wood.envMapRotation.z, 0, "wood pins envMapRotation.z 0");
  assert.equal(named.brass.envMapRotation.z, 0, "brass pins envMapRotation.z 0");
  assert.equal(named.steel.envMapRotation.z, 0, "steel pins envMapRotation.z 0");
  assert.equal(named.wood.envMap, null, "wood envMap stays null");
  assert.equal(named.brass.envMap, null, "brass envMap stays null");
  assert.equal(named.steel.envMap, null, "steel envMap stays null");
  assert.equal(named.wood.wireframe, false, "wood wireframe stays false");
  assert.equal(named.brass.wireframe, false, "brass wireframe stays false");
  assert.equal(named.steel.wireframe, false, "steel wireframe stays false");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.wireframe, false, "visual MeshBasic wireframe stays false");
    assert.equal(mesh.material.envMap, null, "visual MeshBasic envMap stays null");
    assert.equal(mesh.material.envMapRotation.x, 0, "visual MeshBasic envMapRotation.x stays 0");
    assert.equal(mesh.material.envMapRotation.y, 0, "visual MeshBasic envMapRotation.y stays 0");
    assert.equal(mesh.material.envMapRotation.z, 0, "visual MeshBasic envMapRotation.z stays 0");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
  }
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.envMap, null, "collider MeshBasic keeps r170 envMap default");
    assert.equal(c.material.envMapRotation.x, 0, "collider MeshBasic keeps r170 envMapRotation.x default");
    assert.equal(c.material.envMapRotation.y, 0, "collider MeshBasic keeps r170 envMapRotation.y default");
    assert.equal(c.material.envMapRotation.z, 0, "collider MeshBasic keeps r170 envMapRotation.z default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.material.visible, true, "collider MeshBasic keeps r170 visible default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.wireframe, false, "fastener wireframe stays false after L5");
  assert.equal(fastener.material.envMap, null, "fastener envMap stays null after L5");
  assert.equal(fastener.material.envMapRotation.x, 0, "fastener envMapRotation.x stays 0 after L5");
  assert.equal(fastener.material.envMapRotation.y, 0, "fastener envMapRotation.y stays 0 after L5");
  assert.equal(fastener.material.envMapRotation.z, 0, "fastener envMapRotation.z stays 0 after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fresh.envMapRotation, freshRotation, "fresh MeshBasic keeps its Euler instance");
});

test("L4/L5 activity smoke still passes after Mesh renderOrder pin", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitShadowFlags(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitFrustumCulled(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitRenderOrder(fastener, "fastener after L5 drive");
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
});

test("pinColorOnlyUnlitBasicRenderOrder corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.renderOrder, 0, "r170 Mesh defaults renderOrder 0");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  wrong.renderOrder = 2;
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.renderOrder, 2);
  pinColorOnlyUnlitBasicRenderOrder(wrong);
  assertQuestSafeUnlitRenderOrder(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.frustumCulled, true, "renderOrder pin does not change frustumCulled");
  assert.equal(wrong.castShadow, false, "renderOrder pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "renderOrder pin does not change receiveShadow");
  assert.equal(wrong.visible, true, "renderOrder pin does not change visible");
  assert.equal(wrong.material.fog, true, "renderOrder pin does not change fog");
  assert.equal(wrong.material.toneMapped, true, "renderOrder pin does not change toneMapped");
  assert.equal(wrong.material.transparent, false, "renderOrder pin does not change opaque FrontSide");
  assert.equal(wrong.material.side, THREE.FrontSide, "renderOrder pin does not change FrontSide");
});

test("pinColorOnlyUnlitBasicRenderOrder / pinColorOnlyVisualRenderOrder skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.renderOrder = 3;
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.renderOrder = 4;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.renderOrder = 5;
  pinColorOnlyUnlitBasicRenderOrder(colorOnly);
  pinColorOnlyUnlitBasicRenderOrder(mapped);
  pinColorOnlyUnlitBasicRenderOrder(std);
  assertQuestSafeUnlitRenderOrder(colorOnly);
  assert.equal(mapped.renderOrder, 4, "mapped MeshBasic stays authored renderOrder");
  assert.equal(std.renderOrder, 5, "MeshStandard stays authored renderOrder");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.renderOrder = 6;
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.renderOrder = 7;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.renderOrder = 8;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.renderOrder = 9;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.renderOrder = 10;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualRenderOrder(root);
  assertQuestSafeUnlitRenderOrder(colorMesh, "entity helper color-only");
  assert.equal(mapped.renderOrder, 4, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.renderOrder, 7, "morph color-only MeshBasic is skipped");
  assert.equal(collider.renderOrder, 8, "collider Mesh stays authored");
  assert.equal(sharedVisual.renderOrder, 9, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.renderOrder, 10, "shared collider stays authored");
  assert.equal(std.renderOrder, 5, "MeshStandard stays authored via entity helper");
});

test("v0.67 pins r170 Object3D layers default on packed color-only visuals; envelope stays v0.66", () => {
  const freshMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170Object3DLayersDefault(freshMesh, "r170 Mesh");
  assertR170Object3DLayersDefault(freshObj, "r170 Object3D");
  const freshLayers = freshMesh.layers;
  const freshMatrixAuto = freshMesh.matrixAutoUpdate;
  const freshMatrixWorldAuto = freshMesh.matrixWorldAutoUpdate;
  const freshVisible = freshMesh.visible;

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.envMapRotation.x, 0, "prior envMapRotation.x pin stays 0");
    assert.equal(mat.envMapRotation.y, 0, "prior envMapRotation.y pin stays 0");
    assert.equal(mat.envMapRotation.z, 0, "prior envMapRotation.z pin stays 0");
    assert.equal(mat.envMapRotation.order, "XYZ", "prior envMapRotation.order pin stays XYZ");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.envMapRotation.x, 0, "visual MeshBasic envMapRotation.x stays 0");
    assert.equal(mesh.material.envMapRotation.y, 0, "visual MeshBasic envMapRotation.y stays 0");
    assert.equal(mesh.material.envMapRotation.z, 0, "visual MeshBasic envMapRotation.z stays 0");
  }
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count is 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitLayers(lidMesh, "lidMesh");
  assertQuestSafeUnlitLayers(latchMesh, "latchMesh");
  assertQuestSafeUnlitLayers(fastener, "fastenerMesh");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assertR170Object3DLayersDefault(c, "collider Mesh keeps r170 layers default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitLayers(fastener, "fastener after L5 drive");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fastener.material.envMapRotation.x, 0, "fastener envMapRotation.x stays 0 after L5");
  assert.equal(freshMesh.layers, freshLayers, "fresh Mesh keeps its Layers instance");
  assert.equal(freshMesh.matrixAutoUpdate, freshMatrixAuto, "layers pin does not touch matrixAutoUpdate");
  assert.equal(freshMesh.matrixWorldAutoUpdate, freshMatrixWorldAuto, "layers pin does not touch matrixWorldAutoUpdate");
  assert.equal(freshMesh.visible, freshVisible, "layers pin does not touch mesh.visible");
});

test("v0.68 pins r170 Material blendColor/blendAlpha on unique color-only MeshBasics; envelope stays v0.67", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  assertR170MeshBasicBlendColorAlphaDefaults(fresh);
  const freshBlendColor = fresh.blendColor;
  assert.equal(fresh.blending, THREE.NormalBlending, "r170 MeshBasicMaterial defaults NormalBlending");
  assert.equal(fresh.blendColor.r, 0, "r170 MeshBasicMaterial defaults blendColor.r 0");
  assert.equal(fresh.blendColor.g, 0, "r170 MeshBasicMaterial defaults blendColor.g 0");
  assert.equal(fresh.blendColor.b, 0, "r170 MeshBasicMaterial defaults blendColor.b 0");
  assert.equal(fresh.blendAlpha, 0, "r170 MeshBasicMaterial defaults blendAlpha 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.blending, THREE.NormalBlending, "color-only MeshBasic stays NormalBlending; pin does not enable CustomBlending");
    assert.equal(mat.blendColor.r, 0, "color-only MeshBasic pins blendColor.r 0");
    assert.equal(mat.blendColor.g, 0, "color-only MeshBasic pins blendColor.g 0");
    assert.equal(mat.blendColor.b, 0, "color-only MeshBasic pins blendColor.b 0");
    assert.equal(mat.blendAlpha, 0, "color-only MeshBasic pins blendAlpha 0");
    assert.equal(mat.envMapRotation.x, 0, "prior envMapRotation.x pin stays 0");
    assert.equal(mat.envMapRotation.y, 0, "prior envMapRotation.y pin stays 0");
    assert.equal(mat.envMapRotation.z, 0, "prior envMapRotation.z pin stays 0");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.blendColor.r, 0, "wood pins blendColor.r 0");
  assert.equal(named.brass.blendColor.r, 0, "brass pins blendColor.r 0");
  assert.equal(named.steel.blendColor.r, 0, "steel pins blendColor.r 0");
  assert.equal(named.wood.blendColor.g, 0, "wood pins blendColor.g 0");
  assert.equal(named.brass.blendColor.g, 0, "brass pins blendColor.g 0");
  assert.equal(named.steel.blendColor.g, 0, "steel pins blendColor.g 0");
  assert.equal(named.wood.blendColor.b, 0, "wood pins blendColor.b 0");
  assert.equal(named.brass.blendColor.b, 0, "brass pins blendColor.b 0");
  assert.equal(named.steel.blendColor.b, 0, "steel pins blendColor.b 0");
  assert.equal(named.wood.blendAlpha, 0, "wood pins blendAlpha 0");
  assert.equal(named.brass.blendAlpha, 0, "brass pins blendAlpha 0");
  assert.equal(named.steel.blendAlpha, 0, "steel pins blendAlpha 0");
  assert.equal(named.wood.blending, THREE.NormalBlending, "wood blending stays NormalBlending");
  assert.equal(named.brass.blending, THREE.NormalBlending, "brass blending stays NormalBlending");
  assert.equal(named.steel.blending, THREE.NormalBlending, "steel blending stays NormalBlending");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assert.equal(mesh.material.visible, true, "visual MeshBasic material.visible true");
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.blending, THREE.NormalBlending, "visual MeshBasic blending stays NormalBlending");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendColor.g, 0, "visual MeshBasic blendColor.g stays 0");
    assert.equal(mesh.material.blendColor.b, 0, "visual MeshBasic blendColor.b stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
    assert.equal(mesh.material.envMapRotation.x, 0, "visual MeshBasic envMapRotation.x stays 0");
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
  }
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not material.visible");
  assert.equal(named.wood.visible, true, "material.visible stays true while LOD0 group is hidden");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.blendColor.r, 0, "collider MeshBasic keeps r170 blendColor.r default");
    assert.equal(c.material.blendColor.g, 0, "collider MeshBasic keeps r170 blendColor.g default");
    assert.equal(c.material.blendColor.b, 0, "collider MeshBasic keeps r170 blendColor.b default");
    assert.equal(c.material.blendAlpha, 0, "collider MeshBasic keeps r170 blendAlpha default");
    assert.equal(c.material.blending, THREE.NormalBlending, "collider MeshBasic keeps r170 blending default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.blending, THREE.NormalBlending, "fastener blending stays NormalBlending after L5");
  assert.equal(fastener.material.blendColor.r, 0, "fastener blendColor.r stays 0 after L5");
  assert.equal(fastener.material.blendColor.g, 0, "fastener blendColor.g stays 0 after L5");
  assert.equal(fastener.material.blendColor.b, 0, "fastener blendColor.b stays 0 after L5");
  assert.equal(fastener.material.blendAlpha, 0, "fastener blendAlpha stays 0 after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fresh.blendColor, freshBlendColor, "fresh MeshBasic keeps its Color instance");
});

test("L4/L5 activity smoke still passes after Mesh layers pin", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitShadowFlags(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitFrustumCulled(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitRenderOrder(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitLayers(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(fastener, "fastener after L5 drive");
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
});

test("pinColorOnlyUnlitBasicLayers corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170Object3DLayersDefault(fresh, "r170 Mesh");
  const freshLayers = fresh.layers;

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const wrongLayers = wrong.layers;
  wrong.layers.enable(2);
  wrong.layers.enable(4);
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.layers.mask !== 1, true, "DCC leftover is a non-default layer mask");
  assert.equal(wrong.layers.isEnabled(2), true);
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const matrixWorldAutoBefore = wrong.matrixWorldAutoUpdate;
  const visibleBefore = wrong.visible;
  pinColorOnlyUnlitBasicLayers(wrong);
  assertQuestSafeUnlitLayers(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.layers, wrongLayers, "layers pin keeps the existing Layers instance");
  assert.notEqual(wrong.layers, new THREE.Layers(), "layers pin does not replace Layers with a new instance");
  assert.equal(wrong.frustumCulled, true, "layers pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "layers pin does not change renderOrder");
  assert.equal(wrong.castShadow, false, "layers pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "layers pin does not change receiveShadow");
  assert.equal(wrong.visible, visibleBefore, "layers pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "layers pin does not change matrixAutoUpdate");
  assert.equal(wrong.matrixWorldAutoUpdate, matrixWorldAutoBefore, "layers pin does not change matrixWorldAutoUpdate");
  assert.equal(wrong.material.fog, true, "layers pin does not change fog");
  assert.equal(wrong.material.envMapRotation.x, 0, "layers pin does not change envMapRotation");
  assert.equal(fresh.layers, freshLayers, "fresh Mesh keeps its Layers instance");
});

test("pinColorOnlyUnlitBasicLayers / pinColorOnlyVisualLayers skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.layers.enable(3);
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.layers.enable(4);
  const mappedMask = mapped.layers.mask;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.layers.enable(5);
  const stdMask = std.layers.mask;
  pinColorOnlyUnlitBasicLayers(colorOnly);
  pinColorOnlyUnlitBasicLayers(mapped);
  pinColorOnlyUnlitBasicLayers(std);
  assertQuestSafeUnlitLayers(colorOnly);
  assert.equal(mapped.layers.mask, mappedMask, "mapped MeshBasic stays authored layers");
  assert.equal(std.layers.mask, stdMask, "MeshStandard stays authored layers");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.layers.enable(6);
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.layers.enable(7);
  const morphMask = morph.layers.mask;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.layers.enable(8);
  const colliderMask = collider.layers.mask;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.layers.enable(9);
  const sharedVisualMask = sharedVisual.layers.mask;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.layers.enable(10);
  const sharedColliderMask = sharedCollider.layers.mask;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualLayers(root);
  assertQuestSafeUnlitLayers(colorMesh, "entity helper color-only");
  assert.equal(mapped.layers.mask, mappedMask, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.layers.mask, morphMask, "morph color-only MeshBasic is skipped");
  assert.equal(collider.layers.mask, colliderMask, "collider Mesh stays authored");
  assert.equal(sharedVisual.layers.mask, sharedVisualMask, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.layers.mask, sharedColliderMask, "shared collider stays authored");
  assert.equal(std.layers.mask, stdMask, "MeshStandard stays authored via entity helper");
});

test("v0.69 pins r170 Object3D matrixWorldAutoUpdate on packed color-only visuals; envelope stays v0.68", () => {
  const freshMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(freshMesh.matrixWorldAutoUpdate, true, "r170 Mesh defaults matrixWorldAutoUpdate true");
  assert.equal(freshObj.matrixWorldAutoUpdate, true, "r170 Object3D defaults matrixWorldAutoUpdate true");
  assert.equal(THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, true, "r170 DEFAULT_MATRIX_WORLD_AUTO_UPDATE is true");
  assertR170Object3DMatrixWorldAutoUpdateDefault(freshMesh, "r170 Mesh");
  assertR170Object3DMatrixWorldAutoUpdateDefault(freshObj, "r170 Object3D");
  const freshMatrixAuto = freshMesh.matrixAutoUpdate;
  const freshVisible = freshMesh.visible;
  const freshLayersMask = freshMesh.layers.mask;
  const freshBlendColor = freshMesh.material.blendColor;
  const freshBlendAlpha = freshMesh.material.blendAlpha;

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count is 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(lidMesh, "lidMesh");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(latchMesh, "latchMesh");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(fastener, "fastenerMesh");
  assert.equal(lidMesh.matrixAutoUpdate, true, "lidMesh stays matrix-live");
  assert.equal(latchMesh.matrixAutoUpdate, true, "latchMesh stays matrix-live");
  assert.equal(fastener.matrixAutoUpdate, true, "fastenerMesh stays matrix-live");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false, "v0.45 body LOD leaf still frozen");
  assert.equal(bodyHero.matrixWorldAutoUpdate, true, "v0.45 freeze does not stall world-matrix auto-update");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assertR170Object3DMatrixWorldAutoUpdateDefault(c, "collider Mesh keeps r170 matrixWorldAutoUpdate default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(fastener, "fastener after L5 drive");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fastener.material.blendColor.r, 0, "fastener blendColor.r stays 0 after L5");
  assert.equal(fastener.material.blendAlpha, 0, "fastener blendAlpha stays 0 after L5");
  assert.equal(freshMesh.matrixAutoUpdate, freshMatrixAuto, "matrixWorldAutoUpdate pin does not touch matrixAutoUpdate");
  assert.equal(freshMesh.visible, freshVisible, "matrixWorldAutoUpdate pin does not touch mesh.visible");
  assert.equal(freshMesh.layers.mask, freshLayersMask, "matrixWorldAutoUpdate pin does not touch layers");
  assert.equal(freshMesh.material.blendColor, freshBlendColor, "matrixWorldAutoUpdate pin does not replace blendColor");
  assert.equal(freshMesh.material.blendAlpha, freshBlendAlpha, "matrixWorldAutoUpdate pin does not touch blendAlpha");
});

test("pinColorOnlyUnlitBasicMatrixWorldAutoUpdate corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170Object3DMatrixWorldAutoUpdateDefault(fresh, "r170 Mesh");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  wrong.matrixWorldAutoUpdate = false;
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.matrixWorldAutoUpdate, false, "DCC leftover is matrixWorldAutoUpdate false");
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const visibleBefore = wrong.visible;
  const layersMaskBefore = wrong.layers.mask;
  const blendColorBefore = wrong.material.blendColor;
  const blendAlphaBefore = wrong.material.blendAlpha;
  pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(wrong);
  assertQuestSafeUnlitMatrixWorldAutoUpdate(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.frustumCulled, true, "matrixWorldAutoUpdate pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "matrixWorldAutoUpdate pin does not change renderOrder");
  assert.equal(wrong.castShadow, false, "matrixWorldAutoUpdate pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "matrixWorldAutoUpdate pin does not change receiveShadow");
  assert.equal(wrong.visible, visibleBefore, "matrixWorldAutoUpdate pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "matrixWorldAutoUpdate pin does not change matrixAutoUpdate");
  assert.equal(wrong.layers.mask, layersMaskBefore, "matrixWorldAutoUpdate pin does not change layers");
  assert.equal(wrong.material.blendColor, blendColorBefore, "matrixWorldAutoUpdate pin does not replace blendColor");
  assert.equal(wrong.material.blendAlpha, blendAlphaBefore, "matrixWorldAutoUpdate pin does not change blendAlpha");
  assert.equal(wrong.material.fog, true, "matrixWorldAutoUpdate pin does not change fog");
  assert.equal(wrong.material.envMapRotation.x, 0, "matrixWorldAutoUpdate pin does not change envMapRotation");
});

test("pinColorOnlyUnlitBasicMatrixWorldAutoUpdate / pinColorOnlyVisualMatrixWorldAutoUpdate skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.matrixWorldAutoUpdate = false;
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.matrixWorldAutoUpdate = false;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.matrixWorldAutoUpdate = false;
  pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(colorOnly);
  pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(mapped);
  pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(std);
  assertQuestSafeUnlitMatrixWorldAutoUpdate(colorOnly);
  assert.equal(mapped.matrixWorldAutoUpdate, false, "mapped MeshBasic stays authored matrixWorldAutoUpdate");
  assert.equal(std.matrixWorldAutoUpdate, false, "MeshStandard stays authored matrixWorldAutoUpdate");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.matrixWorldAutoUpdate = false;
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.matrixWorldAutoUpdate = false;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.matrixWorldAutoUpdate = false;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.matrixWorldAutoUpdate = false;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.matrixWorldAutoUpdate = false;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualMatrixWorldAutoUpdate(root);
  assertQuestSafeUnlitMatrixWorldAutoUpdate(colorMesh, "entity helper color-only");
  assert.equal(mapped.matrixWorldAutoUpdate, false, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.matrixWorldAutoUpdate, false, "morph color-only MeshBasic is skipped");
  assert.equal(collider.matrixWorldAutoUpdate, false, "collider Mesh stays authored");
  assert.equal(sharedVisual.matrixWorldAutoUpdate, false, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.matrixWorldAutoUpdate, false, "shared collider stays authored");
  assert.equal(std.matrixWorldAutoUpdate, false, "MeshStandard stays authored via entity helper");
});

test("v0.70 pins r170 Object3D up on packed color-only visuals; envelope stays v0.69", () => {
  const freshMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(THREE.Object3D.DEFAULT_UP.x, 0, "r170 Object3D.DEFAULT_UP.x is 0");
  assert.equal(THREE.Object3D.DEFAULT_UP.y, 1, "r170 Object3D.DEFAULT_UP.y is 1");
  assert.equal(THREE.Object3D.DEFAULT_UP.z, 0, "r170 Object3D.DEFAULT_UP.z is 0");
  assert.ok(freshMesh.up.equals(THREE.Object3D.DEFAULT_UP), "r170 Mesh.up equals Object3D.DEFAULT_UP");
  assert.ok(freshObj.up.equals(THREE.Object3D.DEFAULT_UP), "r170 Object3D.up equals Object3D.DEFAULT_UP");
  assert.notEqual(freshMesh.up, THREE.Object3D.DEFAULT_UP, "Mesh.up is a clone, not DEFAULT_UP itself");
  assertR170Object3DUpDefault(freshMesh, "r170 Mesh");
  assertR170Object3DUpDefault(freshObj, "r170 Object3D");
  const freshUp = freshMesh.up;
  const freshMatrixAuto = freshMesh.matrixAutoUpdate;
  const freshWorldAuto = freshMesh.matrixWorldAutoUpdate;
  const freshVisible = freshMesh.visible;
  const freshLayersMask = freshMesh.layers.mask;
  const freshBlendColor = freshMesh.material.blendColor;
  const freshBlendAlpha = freshMesh.material.blendAlpha;

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count is 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitUp(lidMesh, "lidMesh");
  assertQuestSafeUnlitUp(latchMesh, "latchMesh");
  assertQuestSafeUnlitUp(fastener, "fastenerMesh");
  assert.equal(lidMesh.matrixAutoUpdate, true, "lidMesh stays matrix-live");
  assert.equal(latchMesh.matrixAutoUpdate, true, "latchMesh stays matrix-live");
  assert.equal(fastener.matrixAutoUpdate, true, "fastenerMesh stays matrix-live");
  assert.equal(lidMesh.matrixWorldAutoUpdate, true, "lidMesh world-matrix auto-update stays on");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false, "v0.45 body LOD leaf still frozen");
  assert.equal(bodyHero.matrixWorldAutoUpdate, true, "v0.45 freeze does not stall world-matrix auto-update");
  assertQuestSafeUnlitUp(bodyHero, "body LOD leaf");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assertR170Object3DUpDefault(c, "collider Mesh keeps r170 up default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitUp(fastener, "fastener after L5 drive");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fastener.material.blendColor.r, 0, "fastener blendColor.r stays 0 after L5");
  assert.equal(fastener.material.blendAlpha, 0, "fastener blendAlpha stays 0 after L5");
  assert.equal(freshMesh.up, freshUp, "up pin does not replace a fresh Mesh.up instance");
  assert.equal(freshMesh.matrixAutoUpdate, freshMatrixAuto, "up pin does not touch matrixAutoUpdate");
  assert.equal(freshMesh.matrixWorldAutoUpdate, freshWorldAuto, "up pin does not touch matrixWorldAutoUpdate");
  assert.equal(freshMesh.visible, freshVisible, "up pin does not touch mesh.visible");
  assert.equal(freshMesh.layers.mask, freshLayersMask, "up pin does not touch layers");
  assert.equal(freshMesh.material.blendColor, freshBlendColor, "up pin does not replace blendColor");
  assert.equal(freshMesh.material.blendAlpha, freshBlendAlpha, "up pin does not touch blendAlpha");
});

test("pinColorOnlyUnlitBasicUp corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170Object3DUpDefault(fresh, "r170 Mesh");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const upBefore = wrong.up;
  wrong.up.set(0, 0, 1);
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.up.x, 0, "DCC leftover is Z-up x 0");
  assert.equal(wrong.up.y, 0, "DCC leftover is Z-up y 0");
  assert.equal(wrong.up.z, 1, "DCC leftover is Z-up z 1");
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const worldAutoBefore = wrong.matrixWorldAutoUpdate;
  const visibleBefore = wrong.visible;
  const layersMaskBefore = wrong.layers.mask;
  const blendColorBefore = wrong.material.blendColor;
  const blendAlphaBefore = wrong.material.blendAlpha;
  pinColorOnlyUnlitBasicUp(wrong);
  assertQuestSafeUnlitUp(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.up, upBefore, "up pin keeps the existing Vector3 instance");
  assert.equal(wrong.frustumCulled, true, "up pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "up pin does not change renderOrder");
  assert.equal(wrong.castShadow, false, "up pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "up pin does not change receiveShadow");
  assert.equal(wrong.visible, visibleBefore, "up pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "up pin does not change matrixAutoUpdate");
  assert.equal(wrong.matrixWorldAutoUpdate, worldAutoBefore, "up pin does not change matrixWorldAutoUpdate");
  assert.equal(wrong.layers.mask, layersMaskBefore, "up pin does not change layers");
  assert.equal(wrong.material.blendColor, blendColorBefore, "up pin does not replace blendColor");
  assert.equal(wrong.material.blendAlpha, blendAlphaBefore, "up pin does not change blendAlpha");
  assert.equal(wrong.material.fog, true, "up pin does not change fog");
  assert.equal(wrong.material.envMapRotation.x, 0, "up pin does not change envMapRotation");
});

test("pinColorOnlyUnlitBasicUp / pinColorOnlyVisualUp skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.up.set(0, 0, 1);
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.up.set(0, 0, 1);
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.up.set(0, 0, 1);
  pinColorOnlyUnlitBasicUp(colorOnly);
  pinColorOnlyUnlitBasicUp(mapped);
  pinColorOnlyUnlitBasicUp(std);
  assertQuestSafeUnlitUp(colorOnly);
  assert.equal(mapped.up.z, 1, "mapped MeshBasic stays authored up");
  assert.equal(std.up.z, 1, "MeshStandard stays authored up");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.up.set(1, 0, 0);
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.up.set(0, 0, 1);
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.up.set(0, 0, 1);
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.up.set(0, 0, 1);
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.up.set(0, 0, 1);
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualUp(root);
  assertQuestSafeUnlitUp(colorMesh, "entity helper color-only");
  assert.equal(mapped.up.z, 1, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.up.z, 1, "morph color-only MeshBasic is skipped");
  assert.equal(collider.up.z, 1, "collider Mesh stays authored");
  assert.equal(sharedVisual.up.z, 1, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.up.z, 1, "shared collider stays authored");
  assert.equal(std.up.z, 1, "MeshStandard stays authored via entity helper");
});

test("v0.71 pins r170 Object3D scale on packed color-only visuals; envelope stays v0.70", () => {
  const freshMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(freshMesh.scale.x, 1, "r170 Mesh.scale.x is 1");
  assert.equal(freshMesh.scale.y, 1, "r170 Mesh.scale.y is 1");
  assert.equal(freshMesh.scale.z, 1, "r170 Mesh.scale.z is 1");
  assert.equal(freshObj.scale.x, 1, "r170 Object3D.scale.x is 1");
  assert.equal(freshObj.scale.y, 1, "r170 Object3D.scale.y is 1");
  assert.equal(freshObj.scale.z, 1, "r170 Object3D.scale.z is 1");
  assertR170Object3DScaleDefault(freshMesh, "r170 Mesh");
  assertR170Object3DScaleDefault(freshObj, "r170 Object3D");
  const freshScale = freshMesh.scale;
  const freshUp = freshMesh.up;
  const freshMatrixAuto = freshMesh.matrixAutoUpdate;
  const freshWorldAuto = freshMesh.matrixWorldAutoUpdate;
  const freshVisible = freshMesh.visible;
  const freshLayersMask = freshMesh.layers.mask;
  const freshBlendColor = freshMesh.material.blendColor;
  const freshBlendAlpha = freshMesh.material.blendAlpha;

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count is 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitScale(lidMesh, "lidMesh");
  assertQuestSafeUnlitScale(latchMesh, "latchMesh");
  assertQuestSafeUnlitScale(fastener, "fastenerMesh");
  assertQuestSafeUnlitUp(lidMesh, "lidMesh");
  assert.equal(lidMesh.matrixAutoUpdate, true, "lidMesh stays matrix-live");
  assert.equal(latchMesh.matrixAutoUpdate, true, "latchMesh stays matrix-live");
  assert.equal(fastener.matrixAutoUpdate, true, "fastenerMesh stays matrix-live");
  assert.equal(lidMesh.matrixWorldAutoUpdate, true, "lidMesh world-matrix auto-update stays on");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false, "v0.45 body LOD leaf still frozen");
  assert.equal(bodyHero.matrixWorldAutoUpdate, true, "v0.45 freeze does not stall world-matrix auto-update");
  assertQuestSafeUnlitScale(bodyHero, "body LOD leaf");
  assertQuestSafeUnlitUp(bodyHero, "body LOD leaf");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assertR170Object3DScaleDefault(c, "collider Mesh keeps r170 scale default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitScale(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitUp(fastener, "fastener after L5 drive");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fastener.material.blendColor.r, 0, "fastener blendColor.r stays 0 after L5");
  assert.equal(fastener.material.blendAlpha, 0, "fastener blendAlpha stays 0 after L5");
  assert.equal(freshMesh.scale, freshScale, "scale pin does not replace a fresh Mesh.scale instance");
  assert.equal(freshMesh.up, freshUp, "scale pin does not replace a fresh Mesh.up instance");
  assert.equal(freshMesh.matrixAutoUpdate, freshMatrixAuto, "scale pin does not touch matrixAutoUpdate");
  assert.equal(freshMesh.matrixWorldAutoUpdate, freshWorldAuto, "scale pin does not touch matrixWorldAutoUpdate");
  assert.equal(freshMesh.visible, freshVisible, "scale pin does not touch mesh.visible");
  assert.equal(freshMesh.layers.mask, freshLayersMask, "scale pin does not touch layers");
  assert.equal(freshMesh.material.blendColor, freshBlendColor, "scale pin does not replace blendColor");
  assert.equal(freshMesh.material.blendAlpha, freshBlendAlpha, "scale pin does not touch blendAlpha");
});

test("v0.72 pins r170 Material dithering/alphaToCoverage on unique color-only MeshBasics; envelope stays v0.71", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  assertR170MeshBasicBlendColorAlphaDefaults(fresh);
  assertR170MeshBasicDitheringAlphaToCoverageDefaults(fresh);
  assert.equal(fresh.dithering, false, "r170 MeshBasicMaterial defaults dithering false");
  assert.equal(fresh.alphaToCoverage, false, "r170 MeshBasicMaterial defaults alphaToCoverage false");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.dithering, false, "color-only MeshBasic pins dithering false");
    assert.equal(mat.alphaToCoverage, false, "color-only MeshBasic pins alphaToCoverage false");
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.dithering, false, "wood pins dithering false");
  assert.equal(named.brass.dithering, false, "brass pins dithering false");
  assert.equal(named.steel.dithering, false, "steel pins dithering false");
  assert.equal(named.wood.alphaToCoverage, false, "wood pins alphaToCoverage false");
  assert.equal(named.brass.alphaToCoverage, false, "brass pins alphaToCoverage false");
  assert.equal(named.steel.alphaToCoverage, false, "steel pins alphaToCoverage false");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.dithering, false, "visual MeshBasic dithering stays false");
    assert.equal(mesh.material.alphaToCoverage, false, "visual MeshBasic alphaToCoverage stays false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count stays 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");
  assert.equal(fastener.material.dithering, false, "fastenerMesh pins dithering false");
  assert.equal(fastener.material.alphaToCoverage, false, "fastenerMesh pins alphaToCoverage false");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.dithering, false, "collider MeshBasic keeps r170 dithering default");
    assert.equal(c.material.alphaToCoverage, false, "collider MeshBasic keeps r170 alphaToCoverage default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.dithering, false, "fastener dithering stays false after L5");
  assert.equal(fastener.material.alphaToCoverage, false, "fastener alphaToCoverage stays false after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("pinColorOnlyUnlitBasicScale corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170Object3DScaleDefault(fresh, "r170 Mesh");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const scaleBefore = wrong.scale;
  wrong.scale.set(1, -1, 1);
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.scale.x, 1, "DCC leftover is negative-Y scale x 1");
  assert.equal(wrong.scale.y, -1, "DCC leftover is negative-Y scale y -1");
  assert.equal(wrong.scale.z, 1, "DCC leftover is negative-Y scale z 1");
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const worldAutoBefore = wrong.matrixWorldAutoUpdate;
  const visibleBefore = wrong.visible;
  const layersMaskBefore = wrong.layers.mask;
  const upBefore = wrong.up.clone();
  const blendColorBefore = wrong.material.blendColor;
  const blendAlphaBefore = wrong.material.blendAlpha;
  pinColorOnlyUnlitBasicScale(wrong);
  assertQuestSafeUnlitScale(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.scale, scaleBefore, "scale pin keeps the existing Vector3 instance");
  assert.equal(wrong.up.x, upBefore.x, "scale pin does not change up.x");
  assert.equal(wrong.up.y, upBefore.y, "scale pin does not change up.y");
  assert.equal(wrong.up.z, upBefore.z, "scale pin does not change up.z");
  assert.equal(wrong.frustumCulled, true, "scale pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "scale pin does not change renderOrder");
  assert.equal(wrong.castShadow, false, "scale pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "scale pin does not change receiveShadow");
  assert.equal(wrong.visible, visibleBefore, "scale pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "scale pin does not change matrixAutoUpdate");
  assert.equal(wrong.matrixWorldAutoUpdate, worldAutoBefore, "scale pin does not change matrixWorldAutoUpdate");
  assert.equal(wrong.layers.mask, layersMaskBefore, "scale pin does not change layers");
  assert.equal(wrong.material.blendColor, blendColorBefore, "scale pin does not replace blendColor");
  assert.equal(wrong.material.blendAlpha, blendAlphaBefore, "scale pin does not change blendAlpha");
  assert.equal(wrong.material.fog, true, "scale pin does not change fog");
  assert.equal(wrong.material.envMapRotation.x, 0, "scale pin does not change envMapRotation");
});

test("pinColorOnlyUnlitBasicScale / pinColorOnlyVisualScale skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.scale.set(2, 2, 2);
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.scale.set(2, 2, 2);
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.scale.set(2, 2, 2);
  pinColorOnlyUnlitBasicScale(colorOnly);
  pinColorOnlyUnlitBasicScale(mapped);
  pinColorOnlyUnlitBasicScale(std);
  assertQuestSafeUnlitScale(colorOnly);
  assert.equal(mapped.scale.x, 2, "mapped MeshBasic stays authored scale");
  assert.equal(std.scale.x, 2, "MeshStandard stays authored scale");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.scale.set(1, -1, 1);
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.scale.set(2, 2, 2);
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.scale.set(2, 2, 2);
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.scale.set(2, 2, 2);
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.scale.set(2, 2, 2);
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualScale(root);
  assertQuestSafeUnlitScale(colorMesh, "entity helper color-only");
  assert.equal(mapped.scale.x, 2, "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.scale.x, 2, "morph color-only MeshBasic is skipped");
  assert.equal(collider.scale.x, 2, "collider Mesh stays authored");
  assert.equal(sharedVisual.scale.x, 2, "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.scale.x, 2, "shared collider stays authored");
  assert.equal(std.scale.x, 2, "MeshStandard stays authored via entity helper");
});

test("v0.73 pins r170 Object3D rotation.order XYZ on packed color-only visuals; envelope stays v0.72", () => {
  const freshMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(freshMesh.rotation.order, "XYZ", "r170 Mesh.rotation.order is XYZ");
  assert.equal(freshObj.rotation.order, "XYZ", "r170 Object3D.rotation.order is XYZ");
  assertR170Object3DRotationOrderDefault(freshMesh, "r170 Mesh");
  assertR170Object3DRotationOrderDefault(freshObj, "r170 Object3D");
  const freshRotation = freshMesh.rotation;
  const freshQuat = freshMesh.quaternion;
  const freshScale = freshMesh.scale;
  const freshUp = freshMesh.up;
  const freshMatrixAuto = freshMesh.matrixAutoUpdate;
  const freshWorldAuto = freshMesh.matrixWorldAutoUpdate;
  const freshVisible = freshMesh.visible;
  const freshLayersMask = freshMesh.layers.mask;
  const freshBlendColor = freshMesh.material.blendColor;
  const freshBlendAlpha = freshMesh.material.blendAlpha;
  const freshDithering = freshMesh.material.dithering;
  const freshA2C = freshMesh.material.alphaToCoverage;

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.dithering, false, "prior dithering pin stays false");
    assert.equal(mat.alphaToCoverage, false, "prior alphaToCoverage pin stays false");
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assertQuestSafeUnlitRotationOrder(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.dithering, false, "visual MeshBasic dithering stays false");
    assert.equal(mesh.material.alphaToCoverage, false, "visual MeshBasic alphaToCoverage stays false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const rotationCounts = countVisualRotationOrderXYZ(crate);
  assert.equal(rotationCounts.xyz, 13, "rotation-order-XYZ count is 13");
  assert.equal(rotationCounts.other, 0);
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count stays 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitRotationOrder(lidMesh, "lidMesh");
  assertQuestSafeUnlitRotationOrder(latchMesh, "latchMesh");
  assertQuestSafeUnlitRotationOrder(fastener, "fastenerMesh");
  assertQuestSafeUnlitScale(lidMesh, "lidMesh");
  assertQuestSafeUnlitUp(lidMesh, "lidMesh");
  assert.equal(lidMesh.matrixAutoUpdate, true, "lidMesh stays matrix-live");
  assert.equal(latchMesh.matrixAutoUpdate, true, "latchMesh stays matrix-live");
  assert.equal(fastener.matrixAutoUpdate, true, "fastenerMesh stays matrix-live");
  assert.equal(lidMesh.matrixWorldAutoUpdate, true, "lidMesh world-matrix auto-update stays on");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const tool = crate.userData.parts.tool;
  const toolMeshes = [];
  tool.traverse((o) => {
    if (o.isMesh && !o.userData.collider) toolMeshes.push(o);
  });
  assert.ok(toolMeshes.length >= 2, "tool shaft/grip stay present");
  const shaftOrGrip = toolMeshes.find((m) => Math.abs(m.rotation.z - Math.PI / 2) < 1e-6);
  assert.ok(shaftOrGrip, "tool shaft/grip keep intentional local rotation.z");
  assert.equal(shaftOrGrip.rotation.order, "XYZ", "tool mesh pin keeps XYZ without rewriting xyz");
  assert.ok(Math.abs(shaftOrGrip.rotation.z - Math.PI / 2) < 1e-6, "tool mesh rotation.z stays PI/2");

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false, "v0.45 body LOD leaf still frozen");
  assert.equal(bodyHero.matrixWorldAutoUpdate, true, "v0.45 freeze does not stall world-matrix auto-update");
  assertQuestSafeUnlitRotationOrder(bodyHero, "body LOD leaf");
  assertQuestSafeUnlitScale(bodyHero, "body LOD leaf");
  assertQuestSafeUnlitUp(bodyHero, "body LOD leaf");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assertR170Object3DRotationOrderDefault(c, "collider Mesh keeps r170 rotation.order default");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assert.equal(fastener.rotation.order, "XYZ", "fastener rotation.order stays XYZ after L5");
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitRotationOrder(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitScale(fastener, "fastener after L5 drive");
  assertQuestSafeUnlitUp(fastener, "fastener after L5 drive");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
  assert.equal(fastener.material.dithering, false, "fastener dithering stays false after L5");
  assert.equal(fastener.material.alphaToCoverage, false, "fastener alphaToCoverage stays false after L5");
  assert.equal(fastener.material.blendColor.r, 0, "fastener blendColor.r stays 0 after L5");
  assert.equal(fastener.material.blendAlpha, 0, "fastener blendAlpha stays 0 after L5");
  assert.equal(freshMesh.rotation, freshRotation, "rotation-order pin does not replace a fresh Mesh.rotation instance");
  assert.equal(freshMesh.quaternion, freshQuat, "rotation-order pin does not replace a fresh Mesh.quaternion instance");
  assert.equal(freshMesh.scale, freshScale, "rotation-order pin does not replace a fresh Mesh.scale instance");
  assert.equal(freshMesh.up, freshUp, "rotation-order pin does not replace a fresh Mesh.up instance");
  assert.equal(freshMesh.matrixAutoUpdate, freshMatrixAuto, "rotation-order pin does not touch matrixAutoUpdate");
  assert.equal(freshMesh.matrixWorldAutoUpdate, freshWorldAuto, "rotation-order pin does not touch matrixWorldAutoUpdate");
  assert.equal(freshMesh.visible, freshVisible, "rotation-order pin does not touch mesh.visible");
  assert.equal(freshMesh.layers.mask, freshLayersMask, "rotation-order pin does not touch layers");
  assert.equal(freshMesh.material.blendColor, freshBlendColor, "rotation-order pin does not replace blendColor");
  assert.equal(freshMesh.material.blendAlpha, freshBlendAlpha, "rotation-order pin does not touch blendAlpha");
  assert.equal(freshMesh.material.dithering, freshDithering, "rotation-order pin does not touch dithering");
  assert.equal(freshMesh.material.alphaToCoverage, freshA2C, "rotation-order pin does not touch alphaToCoverage");
});

test("pinColorOnlyUnlitBasicRotationOrder corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170Object3DRotationOrderDefault(fresh, "r170 Mesh");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const rotationBefore = wrong.rotation;
  const quatBefore = wrong.quaternion;
  wrong.rotation.set(0.25, -0.5, 0.75, "YXZ");
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.rotation.order, "YXZ", "DCC leftover is non-XYZ Euler order");
  assert.equal(wrong.rotation.x, 0.25, "DCC leftover keeps authored rotation.x");
  assert.equal(wrong.rotation.y, -0.5, "DCC leftover keeps authored rotation.y");
  assert.equal(wrong.rotation.z, 0.75, "DCC leftover keeps authored rotation.z");
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const worldAutoBefore = wrong.matrixWorldAutoUpdate;
  const visibleBefore = wrong.visible;
  const layersMaskBefore = wrong.layers.mask;
  const upBefore = wrong.up.clone();
  const scaleBefore = wrong.scale.clone();
  const blendColorBefore = wrong.material.blendColor;
  const blendAlphaBefore = wrong.material.blendAlpha;
  const ditheringBefore = wrong.material.dithering;
  const a2cBefore = wrong.material.alphaToCoverage;
  pinColorOnlyUnlitBasicRotationOrder(wrong);
  assertQuestSafeUnlitRotationOrder(wrong, "deliberately wrong color-only Mesh");
  assert.equal(wrong.rotation, rotationBefore, "rotation-order pin keeps the existing Euler instance");
  assert.equal(wrong.quaternion, quatBefore, "rotation-order pin does not replace quaternion");
  assert.equal(wrong.rotation.x, 0.25, "rotation-order pin does not rewrite rotation.x");
  assert.equal(wrong.rotation.y, -0.5, "rotation-order pin does not rewrite rotation.y");
  assert.equal(wrong.rotation.z, 0.75, "rotation-order pin does not rewrite rotation.z");
  assert.ok(
    wrong.quaternion.x !== 0 || wrong.quaternion.y !== 0 || wrong.quaternion.z !== 0 || wrong.quaternion.w !== 1,
    "rotation-order pin does not force identity quaternion"
  );
  assert.equal(wrong.scale.x, scaleBefore.x, "rotation-order pin does not change scale.x");
  assert.equal(wrong.scale.y, scaleBefore.y, "rotation-order pin does not change scale.y");
  assert.equal(wrong.scale.z, scaleBefore.z, "rotation-order pin does not change scale.z");
  assert.equal(wrong.up.x, upBefore.x, "rotation-order pin does not change up.x");
  assert.equal(wrong.up.y, upBefore.y, "rotation-order pin does not change up.y");
  assert.equal(wrong.up.z, upBefore.z, "rotation-order pin does not change up.z");
  assert.equal(wrong.frustumCulled, true, "rotation-order pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "rotation-order pin does not change renderOrder");
  assert.equal(wrong.castShadow, false, "rotation-order pin does not change castShadow");
  assert.equal(wrong.receiveShadow, false, "rotation-order pin does not change receiveShadow");
  assert.equal(wrong.visible, visibleBefore, "rotation-order pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "rotation-order pin does not change matrixAutoUpdate");
  assert.equal(wrong.matrixWorldAutoUpdate, worldAutoBefore, "rotation-order pin does not change matrixWorldAutoUpdate");
  assert.equal(wrong.layers.mask, layersMaskBefore, "rotation-order pin does not change layers");
  assert.equal(wrong.material.blendColor, blendColorBefore, "rotation-order pin does not replace blendColor");
  assert.equal(wrong.material.blendAlpha, blendAlphaBefore, "rotation-order pin does not change blendAlpha");
  assert.equal(wrong.material.dithering, ditheringBefore, "rotation-order pin does not change dithering");
  assert.equal(wrong.material.alphaToCoverage, a2cBefore, "rotation-order pin does not change alphaToCoverage");
  assert.equal(wrong.material.fog, true, "rotation-order pin does not change fog");
  assert.equal(wrong.material.envMapRotation.x, 0, "rotation-order pin does not change envMapRotation");
});

test("pinColorOnlyUnlitBasicRotationOrder / pinColorOnlyVisualRotationOrder skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.rotation.set(0.1, 0.2, 0.3, "ZYX");
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  mapped.rotation.order = "YXZ";
  mapped.rotation.set(0.1, 0.2, 0.3);
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  std.rotation.order = "YXZ";
  std.rotation.set(0.1, 0.2, 0.3);
  pinColorOnlyUnlitBasicRotationOrder(colorOnly);
  pinColorOnlyUnlitBasicRotationOrder(mapped);
  pinColorOnlyUnlitBasicRotationOrder(std);
  assertQuestSafeUnlitRotationOrder(colorOnly);
  assert.equal(colorOnly.rotation.x, 0.1, "color-only keeps authored rotation.x");
  assert.equal(mapped.rotation.order, "YXZ", "mapped MeshBasic stays authored rotation.order");
  assert.equal(std.rotation.order, "YXZ", "MeshStandard stays authored rotation.order");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.rotation.set(0.4, 0.5, 0.6, "YXZ");
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  morph.rotation.order = "YXZ";
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.rotation.order = "YXZ";
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedVisual.rotation.order = "YXZ";
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  sharedCollider.rotation.order = "YXZ";
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualRotationOrder(root);
  assertQuestSafeUnlitRotationOrder(colorMesh, "entity helper color-only");
  assert.equal(colorMesh.rotation.x, 0.4, "entity helper keeps authored rotation.x");
  assert.equal(colorMesh.rotation.y, 0.5, "entity helper keeps authored rotation.y");
  assert.equal(colorMesh.rotation.z, 0.6, "entity helper keeps authored rotation.z");
  assert.equal(mapped.rotation.order, "YXZ", "mapped MeshBasic stays authored via entity helper");
  assert.equal(morph.rotation.order, "YXZ", "morph color-only MeshBasic is skipped");
  assert.equal(collider.rotation.order, "YXZ", "collider Mesh stays authored");
  assert.equal(sharedVisual.rotation.order, "YXZ", "shared collider material visual stays unpinned");
  assert.equal(sharedCollider.rotation.order, "YXZ", "shared collider stays authored");
  assert.equal(std.rotation.order, "YXZ", "MeshStandard stays authored via entity helper");
});

test("v0.74 pins r170 Material polygonOffset companions on unique color-only MeshBasics; envelope stays v0.73", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  assertR170MeshBasicBlendColorAlphaDefaults(fresh);
  assertR170MeshBasicDitheringAlphaToCoverageDefaults(fresh);
  assertR170MeshBasicPolygonOffsetCompanionDefaults(fresh);
  assert.equal(fresh.polygonOffset, false, "r170 MeshBasicMaterial defaults polygonOffset false");
  assert.equal(fresh.polygonOffsetFactor, 0, "r170 MeshBasicMaterial defaults polygonOffsetFactor 0");
  assert.equal(fresh.polygonOffsetUnits, 0, "r170 MeshBasicMaterial defaults polygonOffsetUnits 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.polygonOffset, false, "color-only MeshBasic pins polygonOffset false");
    assert.equal(mat.polygonOffsetFactor, 0, "color-only MeshBasic pins polygonOffsetFactor 0");
    assert.equal(mat.polygonOffsetUnits, 0, "color-only MeshBasic pins polygonOffsetUnits 0");
    assert.equal(mat.dithering, false, "prior dithering pin stays false");
    assert.equal(mat.alphaToCoverage, false, "prior alphaToCoverage pin stays false");
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.polygonOffset, false, "wood pins polygonOffset false");
  assert.equal(named.brass.polygonOffset, false, "brass pins polygonOffset false");
  assert.equal(named.steel.polygonOffset, false, "steel pins polygonOffset false");
  assert.equal(named.wood.polygonOffsetFactor, 0, "wood pins polygonOffsetFactor 0");
  assert.equal(named.brass.polygonOffsetFactor, 0, "brass pins polygonOffsetFactor 0");
  assert.equal(named.steel.polygonOffsetFactor, 0, "steel pins polygonOffsetFactor 0");
  assert.equal(named.wood.polygonOffsetUnits, 0, "wood pins polygonOffsetUnits 0");
  assert.equal(named.brass.polygonOffsetUnits, 0, "brass pins polygonOffsetUnits 0");
  assert.equal(named.steel.polygonOffsetUnits, 0, "steel pins polygonOffsetUnits 0");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assertQuestSafeUnlitRotationOrder(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.polygonOffset, false, "visual MeshBasic polygonOffset stays false");
    assert.equal(mesh.material.polygonOffsetFactor, 0, "visual MeshBasic polygonOffsetFactor stays 0");
    assert.equal(mesh.material.polygonOffsetUnits, 0, "visual MeshBasic polygonOffsetUnits stays 0");
    assert.equal(mesh.material.dithering, false, "visual MeshBasic dithering stays false");
    assert.equal(mesh.material.alphaToCoverage, false, "visual MeshBasic alphaToCoverage stays false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const rotationCounts = countVisualRotationOrderXYZ(crate);
  assert.equal(rotationCounts.xyz, 13, "rotation-order-XYZ count stays 13");
  assert.equal(rotationCounts.other, 0);
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count stays 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");
  assert.equal(fastener.material.polygonOffset, false, "fastenerMesh pins polygonOffset false");
  assert.equal(fastener.material.polygonOffsetFactor, 0, "fastenerMesh pins polygonOffsetFactor 0");
  assert.equal(fastener.material.polygonOffsetUnits, 0, "fastenerMesh pins polygonOffsetUnits 0");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.polygonOffset, false, "collider MeshBasic keeps r170 polygonOffset default");
    assert.equal(c.material.polygonOffsetFactor, 0, "collider MeshBasic keeps r170 polygonOffsetFactor default");
    assert.equal(c.material.polygonOffsetUnits, 0, "collider MeshBasic keeps r170 polygonOffsetUnits default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.polygonOffset, false, "fastener polygonOffset stays false after L5");
  assert.equal(fastener.material.polygonOffsetFactor, 0, "fastener polygonOffsetFactor stays 0 after L5");
  assert.equal(fastener.material.polygonOffsetUnits, 0, "fastener polygonOffsetUnits stays 0 after L5");
  assert.equal(fastener.material.dithering, false, "fastener dithering stays false after L5");
  assert.equal(fastener.material.alphaToCoverage, false, "fastener alphaToCoverage stays false after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.75 pins r170 Material stencil companions on unique color-only MeshBasics; envelope stays v0.74", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  assertR170MeshBasicBlendColorAlphaDefaults(fresh);
  assertR170MeshBasicDitheringAlphaToCoverageDefaults(fresh);
  assertR170MeshBasicPolygonOffsetCompanionDefaults(fresh);
  assertR170MeshBasicStencilCompanionDefaults(fresh);
  assert.equal(fresh.stencilWrite, false, "r170 MeshBasicMaterial defaults stencilWrite false");
  assert.equal(fresh.stencilRef, 0, "r170 MeshBasicMaterial defaults stencilRef 0");
  assert.equal(fresh.stencilWriteMask, 0xff, "r170 MeshBasicMaterial defaults stencilWriteMask 0xff");
  assert.equal(fresh.stencilFuncMask, 0xff, "r170 MeshBasicMaterial defaults stencilFuncMask 0xff");
  assert.equal(fresh.stencilZFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZFail Keep");
  assert.equal(fresh.stencilZPass, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZPass Keep");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.stencilWrite, false, "color-only MeshBasic pins stencilWrite false");
    assert.equal(mat.stencilRef, 0, "color-only MeshBasic pins stencilRef 0");
    assert.equal(mat.stencilWriteMask, 0xff, "color-only MeshBasic pins stencilWriteMask 0xff");
    assert.equal(mat.stencilFuncMask, 0xff, "color-only MeshBasic pins stencilFuncMask 0xff");
    assert.equal(mat.stencilZFail, THREE.KeepStencilOp, "color-only MeshBasic pins stencilZFail Keep");
    assert.equal(mat.stencilZPass, THREE.KeepStencilOp, "color-only MeshBasic pins stencilZPass Keep");
    assert.equal(mat.polygonOffset, false, "prior polygonOffset pin stays false");
    assert.equal(mat.polygonOffsetFactor, 0, "prior polygonOffsetFactor pin stays 0");
    assert.equal(mat.polygonOffsetUnits, 0, "prior polygonOffsetUnits pin stays 0");
    assert.equal(mat.dithering, false, "prior dithering pin stays false");
    assert.equal(mat.alphaToCoverage, false, "prior alphaToCoverage pin stays false");
    assert.equal(mat.blendColor.r, 0, "prior blendColor.r pin stays 0");
    assert.equal(mat.blendColor.g, 0, "prior blendColor.g pin stays 0");
    assert.equal(mat.blendColor.b, 0, "prior blendColor.b pin stays 0");
    assert.equal(mat.blendAlpha, 0, "prior blendAlpha pin stays 0");
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood.stencilWrite, false, "wood pins stencilWrite false");
  assert.equal(named.brass.stencilWrite, false, "brass pins stencilWrite false");
  assert.equal(named.steel.stencilWrite, false, "steel pins stencilWrite false");
  assert.equal(named.wood.stencilRef, 0, "wood pins stencilRef 0");
  assert.equal(named.brass.stencilRef, 0, "brass pins stencilRef 0");
  assert.equal(named.steel.stencilRef, 0, "steel pins stencilRef 0");
  assert.equal(named.wood.stencilWriteMask, 0xff, "wood pins stencilWriteMask 0xff");
  assert.equal(named.brass.stencilWriteMask, 0xff, "brass pins stencilWriteMask 0xff");
  assert.equal(named.steel.stencilWriteMask, 0xff, "steel pins stencilWriteMask 0xff");
  assert.equal(named.wood.stencilFuncMask, 0xff, "wood pins stencilFuncMask 0xff");
  assert.equal(named.brass.stencilFuncMask, 0xff, "brass pins stencilFuncMask 0xff");
  assert.equal(named.steel.stencilFuncMask, 0xff, "steel pins stencilFuncMask 0xff");
  assert.equal(named.wood.stencilZFail, THREE.KeepStencilOp, "wood pins stencilZFail Keep");
  assert.equal(named.brass.stencilZFail, THREE.KeepStencilOp, "brass pins stencilZFail Keep");
  assert.equal(named.steel.stencilZFail, THREE.KeepStencilOp, "steel pins stencilZFail Keep");
  assert.equal(named.wood.stencilZPass, THREE.KeepStencilOp, "wood pins stencilZPass Keep");
  assert.equal(named.brass.stencilZPass, THREE.KeepStencilOp, "brass pins stencilZPass Keep");
  assert.equal(named.steel.stencilZPass, THREE.KeepStencilOp, "steel pins stencilZPass Keep");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assertQuestSafeUnlitRotationOrder(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.material.stencilWrite, false, "visual MeshBasic stencilWrite stays false");
    assert.equal(mesh.material.stencilRef, 0, "visual MeshBasic stencilRef stays 0");
    assert.equal(mesh.material.stencilWriteMask, 0xff, "visual MeshBasic stencilWriteMask stays 0xff");
    assert.equal(mesh.material.stencilFuncMask, 0xff, "visual MeshBasic stencilFuncMask stays 0xff");
    assert.equal(mesh.material.stencilZFail, THREE.KeepStencilOp, "visual MeshBasic stencilZFail stays Keep");
    assert.equal(mesh.material.stencilZPass, THREE.KeepStencilOp, "visual MeshBasic stencilZPass stays Keep");
    assert.equal(mesh.material.polygonOffsetFactor, 0, "visual MeshBasic polygonOffsetFactor stays 0");
    assert.equal(mesh.material.polygonOffsetUnits, 0, "visual MeshBasic polygonOffsetUnits stays 0");
    assert.equal(mesh.material.dithering, false, "visual MeshBasic dithering stays false");
    assert.equal(mesh.material.alphaToCoverage, false, "visual MeshBasic alphaToCoverage stays false");
    assert.equal(mesh.material.blendColor.r, 0, "visual MeshBasic blendColor.r stays 0");
    assert.equal(mesh.material.blendAlpha, 0, "visual MeshBasic blendAlpha stays 0");
  }
  const rotationCounts = countVisualRotationOrderXYZ(crate);
  assert.equal(rotationCounts.xyz, 13, "rotation-order-XYZ count stays 13");
  assert.equal(rotationCounts.other, 0);
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count stays 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(lidMesh.material, "lidMesh");
  assertQuestSafeUnlitFlags(latchMesh.material, "latchMesh");
  assertQuestSafeUnlitFlags(fastener.material, "fastenerMesh");
  assert.equal(fastener.material.stencilWrite, false, "fastenerMesh pins stencilWrite false");
  assert.equal(fastener.material.stencilRef, 0, "fastenerMesh pins stencilRef 0");
  assert.equal(fastener.material.stencilWriteMask, 0xff, "fastenerMesh pins stencilWriteMask 0xff");
  assert.equal(fastener.material.stencilFuncMask, 0xff, "fastenerMesh pins stencilFuncMask 0xff");
  assert.equal(fastener.material.stencilZFail, THREE.KeepStencilOp, "fastenerMesh pins stencilZFail Keep");
  assert.equal(fastener.material.stencilZPass, THREE.KeepStencilOp, "fastenerMesh pins stencilZPass Keep");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.stencilWrite, false, "collider MeshBasic keeps r170 stencilWrite default");
    assert.equal(c.material.stencilRef, 0, "collider MeshBasic keeps r170 stencilRef default");
    assert.equal(c.material.stencilWriteMask, 0xff, "collider MeshBasic keeps r170 stencilWriteMask default");
    assert.equal(c.material.stencilFuncMask, 0xff, "collider MeshBasic keeps r170 stencilFuncMask default");
    assert.equal(c.material.stencilZFail, THREE.KeepStencilOp, "collider MeshBasic keeps r170 stencilZFail default");
    assert.equal(c.material.stencilZPass, THREE.KeepStencilOp, "collider MeshBasic keeps r170 stencilZPass default");
    assert.equal(c.material.wireframe, true, "collider MeshBasic keeps authored wireframe");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.material.stencilWrite, false, "fastener stencilWrite stays false after L5");
  assert.equal(fastener.material.stencilRef, 0, "fastener stencilRef stays 0 after L5");
  assert.equal(fastener.material.stencilWriteMask, 0xff, "fastener stencilWriteMask stays 0xff after L5");
  assert.equal(fastener.material.stencilFuncMask, 0xff, "fastener stencilFuncMask stays 0xff after L5");
  assert.equal(fastener.material.stencilZFail, THREE.KeepStencilOp, "fastener stencilZFail stays Keep after L5");
  assert.equal(fastener.material.stencilZPass, THREE.KeepStencilOp, "fastener stencilZPass stays Keep after L5");
  assert.equal(fastener.material.polygonOffsetFactor, 0, "fastener polygonOffsetFactor stays 0 after L5");
  assert.equal(fastener.material.polygonOffsetUnits, 0, "fastener polygonOffsetUnits stays 0 after L5");
  assert.equal(fastener.material.dithering, false, "fastener dithering stays false after L5");
  assert.equal(fastener.material.alphaToCoverage, false, "fastener alphaToCoverage stays false after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("v0.48 pins fog/toneMapped false and opaque FrontSide on unique color-only MeshBasics; envelope stays v0.47", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
  }
  const named = crate.userData.materials.lod0;
  assertQuestSafeUnlitFlags(named.wood, "wood");
  assertQuestSafeUnlitFlags(named.brass, "brass");
  assertQuestSafeUnlitFlags(named.steel, "steel");
  assert.equal(named.wood, crate.userData.materials.lod1.wood);
  assert.equal(named.brass, crate.userData.materials.lod1.brass);

  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);
  assert.equal(crateVisualMeshes(crate).length, 13);

  for (const c of crate.userData.colliders) {
    assert.equal(c.material.fog, true, "collider MeshBasic keeps r170 fog default");
    assert.equal(c.material.toneMapped, true, "collider MeshBasic keeps r170 toneMapped default");
    assert.equal(c.material.transparent, true, "collider MeshBasic keeps authored transparent");
    assert.equal(c.material.opacity, 0.55, "collider MeshBasic keeps authored opacity");
    assert.equal(c.material.depthTest, false, "collider MeshBasic keeps authored depthTest");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
  }
});

test("L4/L5 activity smoke still passes after MeshBasic flag pin", () => {
  const crate = createToolbox();
  const { lidPivot, latchPivot } = crate.userData.parts;
  const fastener = crate.userData.fastener.mesh;
  assert.equal(activityState(crate), "closed");

  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");

  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);

  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);

  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
});

test("pinColorOnlyUnlitBasicFlags corrects a wrong color-only MeshBasic that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);
  assertR170MeshBasicBlendingAlphaDefaults(fresh);
  assertR170MeshBasicGpuStateDefaults(fresh);
  assertR170MeshBasicStencilDefaults(fresh);
  assertR170MeshBasicClippingDefaults(fresh);
  assertR170MeshBasicAlphaHashForceSinglePassDefaults(fresh);
  assertR170MeshBasicNormalBlendingCompanions(fresh);
  assertR170MeshBasicVertexColorsDefault(fresh);
  assertR170MeshBasicPrecisionDefault(fresh);
  assertR170MeshBasicShadowSideDefault(fresh);
  assertR170MeshBasicVisibleDefault(fresh);
  assertR170MeshBasicEnvMapCompanions(fresh);
  assertR170MeshBasicMapIntensityCompanions(fresh);
  assertR170MeshBasicWireframeLinewidthDefault(fresh);
  assertR170MeshBasicWireframeLineStyleDefaults(fresh);
  assertR170MeshBasicEnvMapRotationDefault(fresh);
  assertR170MeshBasicBlendColorAlphaDefaults(fresh);

  const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x633318 }));
  hiddenMesh.visible = false;
  pinColorOnlyUnlitBasicFlags(hiddenMesh.material);
  assert.equal(hiddenMesh.material.visible, true, "material pin sets material.visible true");
  assert.equal(hiddenMesh.visible, false, "material pin does not change mesh.visible");

  const linewidthOnly = new THREE.MeshBasicMaterial({ color: 0x633318, wireframeLinewidth: 2 });
  assert.equal(linewidthOnly.wireframe, false, "r170 leftover keeps wireframe false");
  assert.equal(linewidthOnly.wireframeLinewidth, 2);
  pinColorOnlyUnlitBasicFlags(linewidthOnly);
  assert.equal(linewidthOnly.wireframe, false, "wireframeLinewidth pin does not enable wireframe");
  assert.equal(linewidthOnly.wireframeLinewidth, 1, "non-1 leftover is corrected to r170 default 1");

  const lineStyleOnly = new THREE.MeshBasicMaterial({
    color: 0x633318,
    wireframeLinecap: "butt",
    wireframeLinejoin: "miter",
  });
  assert.equal(lineStyleOnly.wireframe, false, "r170 leftover keeps wireframe false");
  assert.equal(lineStyleOnly.wireframeLinecap, "butt");
  assert.equal(lineStyleOnly.wireframeLinejoin, "miter");
  pinColorOnlyUnlitBasicFlags(lineStyleOnly);
  assert.equal(lineStyleOnly.wireframe, false, "wireframe line-style pin does not enable wireframe");
  assert.equal(lineStyleOnly.wireframeLinecap, "round", "non-round leftover is corrected to r170 default round");
  assert.equal(lineStyleOnly.wireframeLinejoin, "round", "non-round leftover is corrected to r170 default round");

  const rotationOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const rotationInst = rotationOnly.envMapRotation;
  rotationOnly.envMapRotation.x = 0.5;
  rotationOnly.envMapRotation.y = 1.2;
  rotationOnly.envMapRotation.z = -0.4;
  rotationOnly.envMapRotation.order = "ZYX";
  assert.equal(rotationOnly.envMap, null, "r170 leftover keeps envMap null");
  assert.equal(rotationOnly.wireframe, false, "r170 leftover keeps wireframe false");
  pinColorOnlyUnlitBasicFlags(rotationOnly);
  assert.equal(rotationOnly.envMapRotation, rotationInst, "envMapRotation pin keeps the existing Euler instance");
  assert.equal(rotationOnly.envMapRotation.x, 0, "non-zero leftover x is corrected to r170 default 0");
  assert.equal(rotationOnly.envMapRotation.y, 0, "non-zero leftover y is corrected to r170 default 0");
  assert.equal(rotationOnly.envMapRotation.z, 0, "non-zero leftover z is corrected to r170 default 0");
  assert.equal(rotationOnly.envMapRotation.order, "XYZ", "non-XYZ leftover order is corrected to r170 default XYZ");
  assert.equal(rotationOnly.envMap, null, "envMapRotation pin does not force envMap");
  assert.equal(rotationOnly.wireframe, false, "envMapRotation pin does not enable wireframe");

  const blendOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const blendColorInst = blendOnly.blendColor;
  blendOnly.blendColor.r = 0.25;
  blendOnly.blendColor.g = 0.5;
  blendOnly.blendColor.b = 0.75;
  blendOnly.blendAlpha = 0.4;
  assert.equal(blendOnly.blending, THREE.NormalBlending, "r170 leftover keeps NormalBlending");
  pinColorOnlyUnlitBasicFlags(blendOnly);
  assert.equal(blendOnly.blendColor, blendColorInst, "blendColor pin keeps the existing Color instance");
  assert.equal(blendOnly.blendColor.r, 0, "non-zero leftover r is corrected to r170 default 0");
  assert.equal(blendOnly.blendColor.g, 0, "non-zero leftover g is corrected to r170 default 0");
  assert.equal(blendOnly.blendColor.b, 0, "non-zero leftover b is corrected to r170 default 0");
  assert.equal(blendOnly.blendAlpha, 0, "non-zero leftover blendAlpha is corrected to r170 default 0");
  assert.equal(blendOnly.blending, THREE.NormalBlending, "blendColor pin does not enable CustomBlending");

  const ditherOnly = new THREE.MeshBasicMaterial({
    color: 0x633318,
    dithering: true,
    alphaToCoverage: true,
  });
  assert.equal(isColorOnlyUnlitBasic(ditherOnly), true, "dithering leftover still passes isColorOnlyUnlitBasic");
  assert.equal(ditherOnly.dithering, true, "DCC leftover is dithering true");
  assert.equal(ditherOnly.alphaToCoverage, true, "DCC leftover is alphaToCoverage true");
  assert.equal(ditherOnly.blending, THREE.NormalBlending, "r170 leftover keeps NormalBlending");
  pinColorOnlyUnlitBasicFlags(ditherOnly);
  assert.equal(ditherOnly.dithering, false, "dithering leftover is corrected to r170 default false");
  assert.equal(ditherOnly.alphaToCoverage, false, "alphaToCoverage leftover is corrected to r170 default false");
  assert.equal(ditherOnly.blending, THREE.NormalBlending, "dithering pin does not change blending");
  assertQuestSafeUnlitFlags(ditherOnly, "dithering leftover color-only MeshBasic");

  const offsetCompanionsOnly = new THREE.MeshBasicMaterial({
    color: 0x633318,
    polygonOffset: false,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  assert.equal(isColorOnlyUnlitBasic(offsetCompanionsOnly), true, "polygonOffset companion leftover still passes isColorOnlyUnlitBasic");
  assert.equal(offsetCompanionsOnly.polygonOffset, false, "DCC leftover keeps polygonOffset false");
  assert.equal(offsetCompanionsOnly.polygonOffsetFactor, 1, "DCC leftover is polygonOffsetFactor 1");
  assert.equal(offsetCompanionsOnly.polygonOffsetUnits, 1, "DCC leftover is polygonOffsetUnits 1");
  pinColorOnlyUnlitBasicFlags(offsetCompanionsOnly);
  assert.equal(offsetCompanionsOnly.polygonOffset, false, "polygonOffset companion pin does not enable polygonOffset");
  assert.equal(offsetCompanionsOnly.polygonOffsetFactor, 0, "non-zero leftover factor is corrected to r170 default 0");
  assert.equal(offsetCompanionsOnly.polygonOffsetUnits, 0, "non-zero leftover units is corrected to r170 default 0");
  assertQuestSafeUnlitFlags(offsetCompanionsOnly, "polygonOffset companion leftover color-only MeshBasic");

  const stencilCompanionsOnly = new THREE.MeshBasicMaterial({
    color: 0x633318,
    stencilWrite: false,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
  });
  assert.equal(isColorOnlyUnlitBasic(stencilCompanionsOnly), true, "stencil companion leftover still passes isColorOnlyUnlitBasic");
  assert.equal(stencilCompanionsOnly.stencilWrite, false, "DCC leftover keeps stencilWrite false");
  assert.equal(stencilCompanionsOnly.stencilRef, 1, "DCC leftover is stencilRef 1");
  assert.equal(stencilCompanionsOnly.stencilWriteMask, 0x0f, "DCC leftover is stencilWriteMask 0x0f");
  assert.equal(stencilCompanionsOnly.stencilFuncMask, 0x0f, "DCC leftover is stencilFuncMask 0x0f");
  assert.equal(stencilCompanionsOnly.stencilZFail, THREE.IncrementStencilOp, "DCC leftover is stencilZFail Increment");
  assert.equal(stencilCompanionsOnly.stencilZPass, THREE.DecrementStencilOp, "DCC leftover is stencilZPass Decrement");
  pinColorOnlyUnlitBasicFlags(stencilCompanionsOnly);
  assert.equal(stencilCompanionsOnly.stencilWrite, false, "stencil companion pin does not enable stencil write");
  assert.equal(stencilCompanionsOnly.stencilRef, 0, "non-zero leftover stencilRef is corrected to r170 default 0");
  assert.equal(stencilCompanionsOnly.stencilWriteMask, 0xff, "non-0xff leftover stencilWriteMask is corrected to r170 default 0xff");
  assert.equal(stencilCompanionsOnly.stencilFuncMask, 0xff, "non-0xff leftover stencilFuncMask is corrected to r170 default 0xff");
  assert.equal(stencilCompanionsOnly.stencilZFail, THREE.KeepStencilOp, "non-Keep leftover stencilZFail is corrected to r170 Keep");
  assert.equal(stencilCompanionsOnly.stencilZPass, THREE.KeepStencilOp, "non-Keep leftover stencilZPass is corrected to r170 Keep");
  assertQuestSafeUnlitFlags(stencilCompanionsOnly, "stencil companion leftover color-only MeshBasic");

  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
    alphaTest: 0.5,
    dithering: true,
    alphaToCoverage: true,
    wireframe: true,
    colorWrite: false,
    depthFunc: THREE.AlwaysDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    stencilWrite: true,
    stencilFunc: THREE.EqualStencilFunc,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
    clippingPlanes: [new THREE.Plane()],
    clipIntersection: true,
    clipShadows: true,
    alphaHash: true,
    forceSinglePass: true,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor,
    blendEquation: THREE.SubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
    vertexColors: true,
    precision: "highp",
    shadowSide: THREE.DoubleSide,
    visible: false,
    combine: THREE.MixOperation,
    reflectivity: 0.25,
    refractionRatio: 0.5,
    lightMapIntensity: 0.4,
    aoMapIntensity: 0.25,
    wireframeLinewidth: 2,
    wireframeLinecap: "butt",
    wireframeLinejoin: "miter",
  });
  assert.equal(wrong.transparent, true);
  assert.equal(wrong.opacity, 0.5);
  assert.equal(wrong.depthWrite, false);
  assert.equal(wrong.depthTest, false);
  assert.equal(wrong.side, THREE.DoubleSide);
  assert.equal(wrong.blending, THREE.AdditiveBlending);
  assert.equal(wrong.premultipliedAlpha, true);
  assert.equal(wrong.alphaTest, 0.5);
  assert.equal(wrong.dithering, true);
  assert.equal(wrong.alphaToCoverage, true);
  assert.equal(wrong.wireframe, true);
  assert.equal(wrong.colorWrite, false);
  assert.equal(wrong.depthFunc, THREE.AlwaysDepth);
  assert.equal(wrong.polygonOffset, true);
  assert.equal(wrong.polygonOffsetFactor, 1);
  assert.equal(wrong.polygonOffsetUnits, 1);
  assert.equal(wrong.stencilWrite, true);
  assert.equal(wrong.stencilFunc, THREE.EqualStencilFunc);
  assert.equal(wrong.stencilRef, 1);
  assert.equal(wrong.stencilWriteMask, 0x0f);
  assert.equal(wrong.stencilFuncMask, 0x0f);
  assert.equal(wrong.stencilFail, THREE.ReplaceStencilOp);
  assert.equal(wrong.stencilZFail, THREE.IncrementStencilOp);
  assert.equal(wrong.stencilZPass, THREE.DecrementStencilOp);
  assert.ok(wrong.clippingPlanes);
  assert.equal(wrong.clippingPlanes.length, 1);
  assert.equal(wrong.clipIntersection, true);
  assert.equal(wrong.clipShadows, true);
  assert.equal(wrong.alphaHash, true);
  assert.equal(wrong.forceSinglePass, true);
  assert.equal(wrong.blendSrc, THREE.OneFactor);
  assert.equal(wrong.blendDst, THREE.ZeroFactor);
  assert.equal(wrong.blendEquation, THREE.SubtractEquation);
  assert.equal(wrong.blendSrcAlpha, THREE.OneFactor);
  assert.equal(wrong.blendDstAlpha, THREE.ZeroFactor);
  assert.equal(wrong.blendEquationAlpha, THREE.ReverseSubtractEquation);
  assert.equal(wrong.vertexColors, true);
  assert.equal(wrong.precision, "highp");
  assert.equal(wrong.shadowSide, THREE.DoubleSide);
  assert.equal(wrong.visible, false);
  assert.equal(wrong.combine, THREE.MixOperation);
  assert.equal(wrong.reflectivity, 0.25);
  assert.equal(wrong.refractionRatio, 0.5);
  assert.equal(wrong.lightMapIntensity, 0.4);
  assert.equal(wrong.aoMapIntensity, 0.25);
  assert.equal(wrong.wireframeLinewidth, 2);
  assert.equal(wrong.wireframeLinecap, "butt");
  assert.equal(wrong.wireframeLinejoin, "miter");
  const wrongRotation = wrong.envMapRotation;
  wrong.envMapRotation.x = 0.3;
  wrong.envMapRotation.y = -0.8;
  wrong.envMapRotation.z = 1.1;
  wrong.envMapRotation.order = "YXZ";
  assert.equal(wrong.envMapRotation.x, 0.3);
  assert.equal(wrong.envMapRotation.y, -0.8);
  assert.equal(wrong.envMapRotation.z, 1.1);
  const wrongBlendColor = wrong.blendColor;
  wrong.blendColor.r = 0.2;
  wrong.blendColor.g = 0.4;
  wrong.blendColor.b = 0.6;
  wrong.blendAlpha = 0.35;
  assert.equal(wrong.blendColor.r, 0.2);
  assert.equal(wrong.blendAlpha, 0.35);
  pinColorOnlyUnlitBasicFlags(wrong);
  assertQuestSafeUnlitFlags(wrong, "deliberately wrong color-only MeshBasic");
  assert.equal(wrong.envMapRotation, wrongRotation, "wrong color-only MeshBasic keeps its Euler instance");
  assert.equal(wrong.blendColor, wrongBlendColor, "wrong color-only MeshBasic keeps its Color instance");
  assert.equal(wrong.wireframe, false, "wireframe line-style pin does not enable wireframe");
  assert.equal(wrong.wireframeLinewidth, 1, "wrong color-only MeshBasic wireframeLinewidth is corrected to 1");
  assert.equal(wrong.wireframeLinecap, "round", "wrong color-only MeshBasic wireframeLinecap is corrected to round");
  assert.equal(wrong.wireframeLinejoin, "round", "wrong color-only MeshBasic wireframeLinejoin is corrected to round");
  assert.equal(wrong.envMap, null, "wrong color-only MeshBasic envMap stays null");
  assert.equal(wrong.envMapRotation.x, 0, "wrong color-only MeshBasic envMapRotation.x is corrected to 0");
  assert.equal(wrong.envMapRotation.y, 0, "wrong color-only MeshBasic envMapRotation.y is corrected to 0");
  assert.equal(wrong.envMapRotation.z, 0, "wrong color-only MeshBasic envMapRotation.z is corrected to 0");
  assert.equal(wrong.envMapRotation.order, "XYZ", "wrong color-only MeshBasic envMapRotation.order is corrected to XYZ");
  assert.equal(wrong.blending, THREE.NormalBlending, "wrong color-only MeshBasic blending is corrected to NormalBlending");
  assert.equal(wrong.blendColor.r, 0, "wrong color-only MeshBasic blendColor.r is corrected to 0");
  assert.equal(wrong.blendColor.g, 0, "wrong color-only MeshBasic blendColor.g is corrected to 0");
  assert.equal(wrong.blendColor.b, 0, "wrong color-only MeshBasic blendColor.b is corrected to 0");
  assert.equal(wrong.blendAlpha, 0, "wrong color-only MeshBasic blendAlpha is corrected to 0");
});

test("pinColorOnlyUnlitBasicFlags / pinColorOnlyVisualMaterialFlags skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const mappedPlanes = [new THREE.Plane()];
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
    alphaTest: 0.25,
    dithering: true,
    alphaToCoverage: true,
    wireframe: true,
    colorWrite: false,
    depthFunc: THREE.AlwaysDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    stencilWrite: true,
    stencilFunc: THREE.EqualStencilFunc,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
    clippingPlanes: mappedPlanes,
    clipIntersection: true,
    clipShadows: true,
    alphaHash: true,
    forceSinglePass: true,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor,
    blendEquation: THREE.SubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
    vertexColors: true,
    precision: "highp",
    shadowSide: THREE.FrontSide,
    visible: false,
    combine: THREE.MixOperation,
    reflectivity: 0.25,
    refractionRatio: 0.5,
    lightMapIntensity: 0.25,
    aoMapIntensity: 0.5,
    wireframeLinewidth: 2,
    wireframeLinecap: "butt",
    wireframeLinejoin: "bevel",
  });
  mapped.envMapRotation.x = 0.4;
  mapped.envMapRotation.y = 0.8;
  mapped.envMapRotation.z = -0.2;
  mapped.envMapRotation.order = "YXZ";
  mapped.blendColor.r = 0.3;
  mapped.blendColor.g = 0.6;
  mapped.blendColor.b = 0.9;
  mapped.blendAlpha = 0.45;
  const stdPlanes = [new THREE.Plane()];
  const std = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    premultipliedAlpha: true,
    alphaTest: 0.25,
    dithering: true,
    alphaToCoverage: true,
    wireframe: true,
    colorWrite: false,
    depthFunc: THREE.AlwaysDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    stencilWrite: true,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: 2,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
    clippingPlanes: stdPlanes,
    clipIntersection: true,
    clipShadows: true,
    alphaHash: true,
    forceSinglePass: true,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.SrcColorFactor,
    blendEquation: THREE.ReverseSubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    blendEquationAlpha: THREE.MinEquation,
    vertexColors: true,
    precision: "mediump",
    shadowSide: THREE.BackSide,
    visible: false,
  });
  std.combine = THREE.AddOperation;
  std.reflectivity = 0.4;
  std.refractionRatio = 0.7;
  std.lightMapIntensity = 0.4;
  std.aoMapIntensity = 0.7;
  std.wireframeLinewidth = 3;
  std.wireframeLinecap = "square";
  std.wireframeLinejoin = "miter";
  std.envMapRotation.x = 0.6;
  std.envMapRotation.y = -0.3;
  std.envMapRotation.z = 0.9;
  std.envMapRotation.order = "ZYX";
  std.blendColor.r = 0.15;
  std.blendColor.g = 0.35;
  std.blendColor.b = 0.55;
  std.blendAlpha = 0.7;
  assert.equal(colorOnly.fog, true);
  assert.equal(colorOnly.toneMapped, true);
  pinColorOnlyUnlitBasicFlags(colorOnly);
  pinColorOnlyUnlitBasicFlags(mapped);
  pinColorOnlyUnlitBasicFlags(std);
  assertQuestSafeUnlitFlags(colorOnly);
  assert.equal(mapped.fog, true, "mapped MeshBasic stays r170 fog default");
  assert.equal(mapped.toneMapped, true, "mapped MeshBasic stays r170 toneMapped default");
  assert.equal(mapped.transparent, true, "mapped MeshBasic stays authored transparent");
  assert.equal(mapped.opacity, 0.5, "mapped MeshBasic stays authored opacity");
  assert.equal(mapped.side, THREE.DoubleSide, "mapped MeshBasic stays authored DoubleSide");
  assert.equal(mapped.blending, THREE.AdditiveBlending, "mapped MeshBasic stays authored blending");
  assert.equal(mapped.premultipliedAlpha, true, "mapped MeshBasic stays authored premultipliedAlpha");
  assert.equal(mapped.alphaTest, 0.25, "mapped MeshBasic stays authored alphaTest");
  assert.equal(mapped.dithering, true, "mapped MeshBasic stays authored dithering");
  assert.equal(mapped.alphaToCoverage, true, "mapped MeshBasic stays authored alphaToCoverage");
  assert.equal(mapped.wireframe, true, "mapped MeshBasic stays authored wireframe");
  assert.equal(mapped.colorWrite, false, "mapped MeshBasic stays authored colorWrite");
  assert.equal(mapped.depthFunc, THREE.AlwaysDepth, "mapped MeshBasic stays authored depthFunc");
  assert.equal(mapped.polygonOffset, true, "mapped MeshBasic stays authored polygonOffset");
  assert.equal(mapped.polygonOffsetFactor, 1, "mapped MeshBasic stays authored polygonOffsetFactor");
  assert.equal(mapped.polygonOffsetUnits, 1, "mapped MeshBasic stays authored polygonOffsetUnits");
  assert.equal(mapped.stencilWrite, true, "mapped MeshBasic stays authored stencilWrite");
  assert.equal(mapped.stencilFunc, THREE.EqualStencilFunc, "mapped MeshBasic stays authored stencilFunc");
  assert.equal(mapped.stencilRef, 1, "mapped MeshBasic stays authored stencilRef");
  assert.equal(mapped.stencilWriteMask, 0x0f, "mapped MeshBasic stays authored stencilWriteMask");
  assert.equal(mapped.stencilFuncMask, 0x0f, "mapped MeshBasic stays authored stencilFuncMask");
  assert.equal(mapped.stencilFail, THREE.ReplaceStencilOp, "mapped MeshBasic stays authored stencilFail");
  assert.equal(mapped.stencilZFail, THREE.IncrementStencilOp, "mapped MeshBasic stays authored stencilZFail");
  assert.equal(mapped.stencilZPass, THREE.DecrementStencilOp, "mapped MeshBasic stays authored stencilZPass");
  assert.equal(mapped.clippingPlanes, mappedPlanes, "mapped MeshBasic stays authored clippingPlanes");
  assert.equal(mapped.clipIntersection, true, "mapped MeshBasic stays authored clipIntersection");
  assert.equal(mapped.clipShadows, true, "mapped MeshBasic stays authored clipShadows");
  assert.equal(mapped.alphaHash, true, "mapped MeshBasic stays authored alphaHash");
  assert.equal(mapped.forceSinglePass, true, "mapped MeshBasic stays authored forceSinglePass");
  assert.equal(mapped.blendSrc, THREE.OneFactor, "mapped MeshBasic stays authored blendSrc");
  assert.equal(mapped.blendDst, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDst");
  assert.equal(mapped.blendEquation, THREE.SubtractEquation, "mapped MeshBasic stays authored blendEquation");
  assert.equal(mapped.blendSrcAlpha, THREE.OneFactor, "mapped MeshBasic stays authored blendSrcAlpha");
  assert.equal(mapped.blendDstAlpha, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDstAlpha");
  assert.equal(mapped.blendEquationAlpha, THREE.ReverseSubtractEquation, "mapped MeshBasic stays authored blendEquationAlpha");
  assert.equal(mapped.vertexColors, true, "mapped MeshBasic stays authored vertexColors");
  assert.equal(mapped.precision, "highp", "mapped MeshBasic stays authored precision");
  assert.equal(mapped.shadowSide, THREE.FrontSide, "mapped MeshBasic stays authored shadowSide");
  assert.equal(mapped.visible, false, "mapped MeshBasic stays authored visible");
  assert.equal(mapped.combine, THREE.MixOperation, "mapped MeshBasic stays authored combine");
  assert.equal(mapped.reflectivity, 0.25, "mapped MeshBasic stays authored reflectivity");
  assert.equal(mapped.refractionRatio, 0.5, "mapped MeshBasic stays authored refractionRatio");
  assert.equal(mapped.lightMapIntensity, 0.25, "mapped MeshBasic stays authored lightMapIntensity");
  assert.equal(mapped.aoMapIntensity, 0.5, "mapped MeshBasic stays authored aoMapIntensity");
  assert.equal(mapped.wireframeLinewidth, 2, "mapped MeshBasic stays authored wireframeLinewidth");
  assert.equal(mapped.wireframeLinecap, "butt", "mapped MeshBasic stays authored wireframeLinecap");
  assert.equal(mapped.wireframeLinejoin, "bevel", "mapped MeshBasic stays authored wireframeLinejoin");
  assert.equal(mapped.envMapRotation.x, 0.4, "mapped MeshBasic stays authored envMapRotation.x");
  assert.equal(mapped.envMapRotation.y, 0.8, "mapped MeshBasic stays authored envMapRotation.y");
  assert.equal(mapped.envMapRotation.z, -0.2, "mapped MeshBasic stays authored envMapRotation.z");
  assert.equal(mapped.envMapRotation.order, "YXZ", "mapped MeshBasic stays authored envMapRotation.order");
  assert.equal(mapped.blendColor.r, 0.3, "mapped MeshBasic stays authored blendColor.r");
  assert.equal(mapped.blendColor.g, 0.6, "mapped MeshBasic stays authored blendColor.g");
  assert.equal(mapped.blendColor.b, 0.9, "mapped MeshBasic stays authored blendColor.b");
  assert.equal(mapped.blendAlpha, 0.45, "mapped MeshBasic stays authored blendAlpha");
  assert.equal(std.fog, true, "MeshStandard stays r170 fog default");
  assert.equal(std.toneMapped, true, "MeshStandard stays r170 toneMapped default");
  assert.equal(std.transparent, true, "MeshStandard stays authored transparent");
  assert.equal(std.side, THREE.DoubleSide, "MeshStandard stays authored DoubleSide");
  assert.equal(std.blending, THREE.CustomBlending, "MeshStandard stays authored blending");
  assert.equal(std.premultipliedAlpha, true, "MeshStandard stays authored premultipliedAlpha");
  assert.equal(std.alphaTest, 0.25, "MeshStandard stays authored alphaTest");
  assert.equal(std.dithering, true, "MeshStandard stays authored dithering");
  assert.equal(std.alphaToCoverage, true, "MeshStandard stays authored alphaToCoverage");
  assert.equal(std.wireframe, true, "MeshStandard stays authored wireframe");
  assert.equal(std.colorWrite, false, "MeshStandard stays authored colorWrite");
  assert.equal(std.depthFunc, THREE.AlwaysDepth, "MeshStandard stays authored depthFunc");
  assert.equal(std.polygonOffset, true, "MeshStandard stays authored polygonOffset");
  assert.equal(std.stencilWrite, true, "MeshStandard stays authored stencilWrite");
  assert.equal(std.stencilFunc, THREE.NotEqualStencilFunc, "MeshStandard stays authored stencilFunc");
  assert.equal(std.stencilRef, 2, "MeshStandard stays authored stencilRef");
  assert.equal(std.stencilWriteMask, 0x0f, "MeshStandard stays authored stencilWriteMask");
  assert.equal(std.stencilFuncMask, 0x0f, "MeshStandard stays authored stencilFuncMask");
  assert.equal(std.stencilFail, THREE.ReplaceStencilOp, "MeshStandard stays authored stencilFail");
  assert.equal(std.stencilZFail, THREE.IncrementStencilOp, "MeshStandard stays authored stencilZFail");
  assert.equal(std.stencilZPass, THREE.DecrementStencilOp, "MeshStandard stays authored stencilZPass");
  assert.equal(std.clippingPlanes, stdPlanes, "MeshStandard stays authored clippingPlanes");
  assert.equal(std.clipIntersection, true, "MeshStandard stays authored clipIntersection");
  assert.equal(std.clipShadows, true, "MeshStandard stays authored clipShadows");
  assert.equal(std.alphaHash, true, "MeshStandard stays authored alphaHash");
  assert.equal(std.forceSinglePass, true, "MeshStandard stays authored forceSinglePass");
  assert.equal(std.blendSrc, THREE.DstColorFactor, "MeshStandard stays authored blendSrc");
  assert.equal(std.blendDst, THREE.SrcColorFactor, "MeshStandard stays authored blendDst");
  assert.equal(std.blendEquation, THREE.ReverseSubtractEquation, "MeshStandard stays authored blendEquation");
  assert.equal(std.blendSrcAlpha, THREE.OneFactor, "MeshStandard stays authored blendSrcAlpha");
  assert.equal(std.blendDstAlpha, THREE.ZeroFactor, "MeshStandard stays authored blendDstAlpha");
  assert.equal(std.blendEquationAlpha, THREE.MinEquation, "MeshStandard stays authored blendEquationAlpha");
  assert.equal(std.vertexColors, true, "MeshStandard stays authored vertexColors");
  assert.equal(std.precision, "mediump", "MeshStandard stays authored precision");
  assert.equal(std.shadowSide, THREE.BackSide, "MeshStandard stays authored shadowSide");
  assert.equal(std.visible, false, "MeshStandard stays authored visible");
  assert.equal(std.combine, THREE.AddOperation, "MeshStandard stays authored combine leftover");
  assert.equal(std.reflectivity, 0.4, "MeshStandard stays authored reflectivity leftover");
  assert.equal(std.refractionRatio, 0.7, "MeshStandard stays authored refractionRatio leftover");
  assert.equal(std.lightMapIntensity, 0.4, "MeshStandard stays authored lightMapIntensity leftover");
  assert.equal(std.aoMapIntensity, 0.7, "MeshStandard stays authored aoMapIntensity leftover");
  assert.equal(std.wireframeLinewidth, 3, "MeshStandard stays authored wireframeLinewidth leftover");
  assert.equal(std.wireframeLinecap, "square", "MeshStandard stays authored wireframeLinecap leftover");
  assert.equal(std.wireframeLinejoin, "miter", "MeshStandard stays authored wireframeLinejoin leftover");
  assert.equal(std.envMapRotation.x, 0.6, "MeshStandard stays authored envMapRotation.x leftover");
  assert.equal(std.envMapRotation.y, -0.3, "MeshStandard stays authored envMapRotation.y leftover");
  assert.equal(std.envMapRotation.z, 0.9, "MeshStandard stays authored envMapRotation.z leftover");
  assert.equal(std.envMapRotation.order, "ZYX", "MeshStandard stays authored envMapRotation.order leftover");
  assert.equal(std.blendColor.r, 0.15, "MeshStandard stays authored blendColor.r leftover");
  assert.equal(std.blendColor.g, 0.35, "MeshStandard stays authored blendColor.g leftover");
  assert.equal(std.blendColor.b, 0.55, "MeshStandard stays authored blendColor.b leftover");
  assert.equal(std.blendAlpha, 0.7, "MeshStandard stays authored blendAlpha leftover");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mapped);
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  collider.material.visible = false;
  collider.material.combine = THREE.AddOperation;
  collider.material.reflectivity = 0.3;
  collider.material.refractionRatio = 0.4;
  collider.material.lightMapIntensity = 0.3;
  collider.material.aoMapIntensity = 0.4;
  collider.material.wireframeLinewidth = 4;
  collider.material.wireframeLinecap = "square";
  collider.material.wireframeLinejoin = "bevel";
  collider.material.envMapRotation.x = 0.15;
  collider.material.envMapRotation.y = 0.25;
  collider.material.envMapRotation.z = 0.35;
  collider.material.envMapRotation.order = "YZX";
  collider.material.blendColor.r = 0.12;
  collider.material.blendColor.g = 0.22;
  collider.material.blendColor.b = 0.32;
  collider.material.blendAlpha = 0.18;
  collider.material.dithering = true;
  collider.material.alphaToCoverage = true;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  sharedBlocked.visible = false;
  sharedBlocked.combine = THREE.MixOperation;
  sharedBlocked.reflectivity = 0.2;
  sharedBlocked.refractionRatio = 0.6;
  sharedBlocked.lightMapIntensity = 0.2;
  sharedBlocked.aoMapIntensity = 0.6;
  sharedBlocked.wireframeLinewidth = 5;
  sharedBlocked.wireframeLinecap = "butt";
  sharedBlocked.wireframeLinejoin = "miter";
  sharedBlocked.envMapRotation.x = 0.11;
  sharedBlocked.envMapRotation.y = 0.22;
  sharedBlocked.envMapRotation.z = 0.33;
  sharedBlocked.envMapRotation.order = "XZY";
  sharedBlocked.blendColor.r = 0.08;
  sharedBlocked.blendColor.g = 0.16;
  sharedBlocked.blendColor.b = 0.24;
  sharedBlocked.blendAlpha = 0.28;
  sharedBlocked.dithering = true;
  sharedBlocked.alphaToCoverage = true;
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider);
  pinColorOnlyVisualMaterialFlags(root);
  assertQuestSafeUnlitFlags(colorMesh.material, "entity helper color-only");
  assert.equal(mapped.fog, true, "mapped MeshBasic stays default via entity helper");
  assert.equal(mapped.toneMapped, true);
  assert.equal(mapped.transparent, true, "mapped MeshBasic stays authored transparent via entity helper");
  assert.equal(mapped.side, THREE.DoubleSide, "mapped MeshBasic stays authored DoubleSide via entity helper");
  assert.equal(mapped.blending, THREE.AdditiveBlending, "mapped MeshBasic stays authored blending via entity helper");
  assert.equal(mapped.premultipliedAlpha, true, "mapped MeshBasic stays authored premultipliedAlpha via entity helper");
  assert.equal(mapped.alphaTest, 0.25, "mapped MeshBasic stays authored alphaTest via entity helper");
  assert.equal(mapped.dithering, true, "mapped MeshBasic stays authored dithering via entity helper");
  assert.equal(mapped.alphaToCoverage, true, "mapped MeshBasic stays authored alphaToCoverage via entity helper");
  assert.equal(mapped.wireframe, true, "mapped MeshBasic stays authored wireframe via entity helper");
  assert.equal(mapped.colorWrite, false, "mapped MeshBasic stays authored colorWrite via entity helper");
  assert.equal(mapped.depthFunc, THREE.AlwaysDepth, "mapped MeshBasic stays authored depthFunc via entity helper");
  assert.equal(mapped.polygonOffset, true, "mapped MeshBasic stays authored polygonOffset via entity helper");
  assert.equal(mapped.stencilWrite, true, "mapped MeshBasic stays authored stencilWrite via entity helper");
  assert.equal(mapped.stencilFunc, THREE.EqualStencilFunc, "mapped MeshBasic stays authored stencilFunc via entity helper");
  assert.equal(mapped.clippingPlanes, mappedPlanes, "mapped MeshBasic stays authored clippingPlanes via entity helper");
  assert.equal(mapped.clipIntersection, true, "mapped MeshBasic stays authored clipIntersection via entity helper");
  assert.equal(mapped.clipShadows, true, "mapped MeshBasic stays authored clipShadows via entity helper");
  assert.equal(mapped.alphaHash, true, "mapped MeshBasic stays authored alphaHash via entity helper");
  assert.equal(mapped.forceSinglePass, true, "mapped MeshBasic stays authored forceSinglePass via entity helper");
  assert.equal(mapped.blendSrc, THREE.OneFactor, "mapped MeshBasic stays authored blendSrc via entity helper");
  assert.equal(mapped.blendDst, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDst via entity helper");
  assert.equal(mapped.blendEquation, THREE.SubtractEquation, "mapped MeshBasic stays authored blendEquation via entity helper");
  assert.equal(mapped.blendSrcAlpha, THREE.OneFactor, "mapped MeshBasic stays authored blendSrcAlpha via entity helper");
  assert.equal(mapped.blendDstAlpha, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDstAlpha via entity helper");
  assert.equal(mapped.blendEquationAlpha, THREE.ReverseSubtractEquation, "mapped MeshBasic stays authored blendEquationAlpha via entity helper");
  assert.equal(mapped.vertexColors, true, "mapped MeshBasic stays authored vertexColors via entity helper");
  assert.equal(mapped.precision, "highp", "mapped MeshBasic stays authored precision via entity helper");
  assert.equal(mapped.shadowSide, THREE.FrontSide, "mapped MeshBasic stays authored shadowSide via entity helper");
  assert.equal(mapped.visible, false, "mapped MeshBasic stays authored visible via entity helper");
  assert.equal(mapped.combine, THREE.MixOperation, "mapped MeshBasic stays authored combine via entity helper");
  assert.equal(mapped.reflectivity, 0.25, "mapped MeshBasic stays authored reflectivity via entity helper");
  assert.equal(mapped.refractionRatio, 0.5, "mapped MeshBasic stays authored refractionRatio via entity helper");
  assert.equal(mapped.lightMapIntensity, 0.25, "mapped MeshBasic stays authored lightMapIntensity via entity helper");
  assert.equal(mapped.aoMapIntensity, 0.5, "mapped MeshBasic stays authored aoMapIntensity via entity helper");
  assert.equal(mapped.wireframeLinewidth, 2, "mapped MeshBasic stays authored wireframeLinewidth via entity helper");
  assert.equal(mapped.wireframeLinecap, "butt", "mapped MeshBasic stays authored wireframeLinecap via entity helper");
  assert.equal(mapped.wireframeLinejoin, "bevel", "mapped MeshBasic stays authored wireframeLinejoin via entity helper");
  assert.equal(mapped.envMapRotation.x, 0.4, "mapped MeshBasic stays authored envMapRotation.x via entity helper");
  assert.equal(mapped.envMapRotation.y, 0.8, "mapped MeshBasic stays authored envMapRotation.y via entity helper");
  assert.equal(mapped.envMapRotation.z, -0.2, "mapped MeshBasic stays authored envMapRotation.z via entity helper");
  assert.equal(mapped.envMapRotation.order, "YXZ", "mapped MeshBasic stays authored envMapRotation.order via entity helper");
  assert.equal(mapped.blendColor.r, 0.3, "mapped MeshBasic stays authored blendColor.r via entity helper");
  assert.equal(mapped.blendColor.g, 0.6, "mapped MeshBasic stays authored blendColor.g via entity helper");
  assert.equal(mapped.blendColor.b, 0.9, "mapped MeshBasic stays authored blendColor.b via entity helper");
  assert.equal(mapped.blendAlpha, 0.45, "mapped MeshBasic stays authored blendAlpha via entity helper");
  assert.equal(morph.material.fog, true, "morph color-only MeshBasic is skipped");
  assert.equal(morph.material.toneMapped, true);
  assert.equal(morph.material.transparent, false, "morph color-only MeshBasic keeps r170 transparent default");
  assert.equal(morph.material.side, THREE.FrontSide, "morph color-only MeshBasic keeps r170 FrontSide default");
  assert.equal(morph.material.blending, THREE.NormalBlending, "morph color-only MeshBasic keeps r170 blending default");
  assert.equal(morph.material.wireframe, false, "morph color-only MeshBasic keeps r170 wireframe default");
  assert.equal(morph.material.colorWrite, true, "morph color-only MeshBasic keeps r170 colorWrite default");
  assert.equal(morph.material.depthFunc, THREE.LessEqualDepth, "morph color-only MeshBasic keeps r170 depthFunc default");
  assert.equal(morph.material.polygonOffset, false, "morph color-only MeshBasic keeps r170 polygonOffset default");
  assert.equal(morph.material.stencilWrite, false, "morph color-only MeshBasic keeps r170 stencilWrite default");
  assert.equal(morph.material.stencilFunc, THREE.AlwaysStencilFunc, "morph color-only MeshBasic keeps r170 stencilFunc default");
  assert.equal(morph.material.clippingPlanes, null, "morph color-only MeshBasic keeps r170 clippingPlanes default");
  assert.equal(morph.material.clipIntersection, false, "morph color-only MeshBasic keeps r170 clipIntersection default");
  assert.equal(morph.material.clipShadows, false, "morph color-only MeshBasic keeps r170 clipShadows default");
  assert.equal(morph.material.alphaHash, false, "morph color-only MeshBasic keeps r170 alphaHash default");
  assert.equal(morph.material.forceSinglePass, false, "morph color-only MeshBasic keeps r170 forceSinglePass default");
  assert.equal(morph.material.blendSrc, THREE.SrcAlphaFactor, "morph color-only MeshBasic keeps r170 blendSrc default");
  assert.equal(morph.material.blendDst, THREE.OneMinusSrcAlphaFactor, "morph color-only MeshBasic keeps r170 blendDst default");
  assert.equal(morph.material.blendEquation, THREE.AddEquation, "morph color-only MeshBasic keeps r170 blendEquation default");
  assert.equal(morph.material.blendSrcAlpha, null, "morph color-only MeshBasic keeps r170 blendSrcAlpha default");
  assert.equal(morph.material.blendDstAlpha, null, "morph color-only MeshBasic keeps r170 blendDstAlpha default");
  assert.equal(morph.material.blendEquationAlpha, null, "morph color-only MeshBasic keeps r170 blendEquationAlpha default");
  assert.equal(morph.material.vertexColors, false, "morph color-only MeshBasic keeps r170 vertexColors default");
  assert.equal(morph.material.precision, null, "morph color-only MeshBasic keeps r170 precision default");
  assert.equal(morph.material.shadowSide, null, "morph color-only MeshBasic keeps r170 shadowSide default");
  assert.equal(morph.material.visible, true, "morph color-only MeshBasic keeps r170 visible default");
  assert.equal(morph.material.combine, THREE.MultiplyOperation, "morph color-only MeshBasic keeps r170 combine default");
  assert.equal(morph.material.reflectivity, 1, "morph color-only MeshBasic keeps r170 reflectivity default");
  assert.equal(morph.material.refractionRatio, 0.98, "morph color-only MeshBasic keeps r170 refractionRatio default");
  assert.equal(morph.material.lightMapIntensity, 1, "morph color-only MeshBasic keeps r170 lightMapIntensity default");
  assert.equal(morph.material.aoMapIntensity, 1, "morph color-only MeshBasic keeps r170 aoMapIntensity default");
  assert.equal(morph.material.wireframeLinewidth, 1, "morph color-only MeshBasic keeps r170 wireframeLinewidth default");
  assert.equal(morph.material.wireframeLinecap, "round", "morph color-only MeshBasic keeps r170 wireframeLinecap default");
  assert.equal(morph.material.wireframeLinejoin, "round", "morph color-only MeshBasic keeps r170 wireframeLinejoin default");
  assert.equal(morph.material.envMapRotation.x, 0, "morph color-only MeshBasic keeps r170 envMapRotation.x default");
  assert.equal(morph.material.envMapRotation.y, 0, "morph color-only MeshBasic keeps r170 envMapRotation.y default");
  assert.equal(morph.material.envMapRotation.z, 0, "morph color-only MeshBasic keeps r170 envMapRotation.z default");
  assert.equal(morph.material.blendColor.r, 0, "morph color-only MeshBasic keeps r170 blendColor.r default");
  assert.equal(morph.material.blendColor.g, 0, "morph color-only MeshBasic keeps r170 blendColor.g default");
  assert.equal(morph.material.blendColor.b, 0, "morph color-only MeshBasic keeps r170 blendColor.b default");
  assert.equal(morph.material.blendAlpha, 0, "morph color-only MeshBasic keeps r170 blendAlpha default");
  assert.equal(collider.material.fog, true, "collider MeshBasic stays default");
  assert.equal(collider.material.toneMapped, true);
  assert.equal(collider.material.wireframe, false, "collider MeshBasic keeps r170 wireframe default");
  assert.equal(collider.material.colorWrite, true, "collider MeshBasic keeps r170 colorWrite default");
  assert.equal(collider.material.depthFunc, THREE.LessEqualDepth, "collider MeshBasic keeps r170 depthFunc default");
  assert.equal(collider.material.polygonOffset, false, "collider MeshBasic keeps r170 polygonOffset default");
  assert.equal(sharedVisual.material.fog, true, "shared collider material stays default");
  assert.equal(sharedVisual.material.toneMapped, true, "shared collider material stays default");
  assert.equal(sharedVisual.material.transparent, false, "shared collider material stays unpinned");
  assert.equal(sharedVisual.material.side, THREE.FrontSide, "shared collider material stays unpinned FrontSide");
  assert.equal(sharedVisual.material.blending, THREE.NormalBlending, "shared collider material stays unpinned blending");
  assert.equal(sharedVisual.material.wireframe, false, "shared collider material stays unpinned wireframe");
  assert.equal(sharedVisual.material.colorWrite, true, "shared collider material stays unpinned colorWrite");
  assert.equal(sharedVisual.material.depthFunc, THREE.LessEqualDepth, "shared collider material stays unpinned depthFunc");
  assert.equal(sharedVisual.material.polygonOffset, false, "shared collider material stays unpinned polygonOffset");
  assert.equal(sharedVisual.material.stencilWrite, false, "shared collider material stays unpinned stencilWrite");
  assert.equal(sharedVisual.material.stencilFunc, THREE.AlwaysStencilFunc, "shared collider material stays unpinned stencilFunc");
  assert.equal(sharedVisual.material.clippingPlanes, null, "shared collider material stays unpinned clippingPlanes");
  assert.equal(sharedVisual.material.clipIntersection, false, "shared collider material stays unpinned clipIntersection");
  assert.equal(sharedVisual.material.clipShadows, false, "shared collider material stays unpinned clipShadows");
  assert.equal(sharedVisual.material.alphaHash, false, "shared collider material stays unpinned alphaHash");
  assert.equal(sharedVisual.material.forceSinglePass, false, "shared collider material stays unpinned forceSinglePass");
  assert.equal(sharedVisual.material.blendSrc, THREE.SrcAlphaFactor, "shared collider material stays unpinned blendSrc");
  assert.equal(sharedVisual.material.blendDst, THREE.OneMinusSrcAlphaFactor, "shared collider material stays unpinned blendDst");
  assert.equal(sharedVisual.material.blendEquation, THREE.AddEquation, "shared collider material stays unpinned blendEquation");
  assert.equal(sharedVisual.material.blendSrcAlpha, null, "shared collider material stays unpinned blendSrcAlpha");
  assert.equal(sharedVisual.material.blendDstAlpha, null, "shared collider material stays unpinned blendDstAlpha");
  assert.equal(sharedVisual.material.blendEquationAlpha, null, "shared collider material stays unpinned blendEquationAlpha");
  assert.equal(sharedVisual.material.vertexColors, false, "shared collider material stays unpinned vertexColors");
  assert.equal(sharedVisual.material.precision, null, "shared collider material stays unpinned precision");
  assert.equal(sharedVisual.material.shadowSide, null, "shared collider material stays unpinned shadowSide");
  assert.equal(sharedVisual.material.visible, false, "shared collider material stays unpinned visible");
  assert.equal(sharedVisual.material.combine, THREE.MixOperation, "shared collider material stays unpinned combine");
  assert.equal(sharedVisual.material.reflectivity, 0.2, "shared collider material stays unpinned reflectivity");
  assert.equal(sharedVisual.material.refractionRatio, 0.6, "shared collider material stays unpinned refractionRatio");
  assert.equal(sharedVisual.material.lightMapIntensity, 0.2, "shared collider material stays unpinned lightMapIntensity");
  assert.equal(sharedVisual.material.aoMapIntensity, 0.6, "shared collider material stays unpinned aoMapIntensity");
  assert.equal(sharedVisual.material.wireframeLinewidth, 5, "shared collider material stays unpinned wireframeLinewidth");
  assert.equal(sharedVisual.material.wireframeLinecap, "butt", "shared collider material stays unpinned wireframeLinecap");
  assert.equal(sharedVisual.material.wireframeLinejoin, "miter", "shared collider material stays unpinned wireframeLinejoin");
  assert.equal(sharedVisual.material.envMapRotation.x, 0.11, "shared collider material stays unpinned envMapRotation.x");
  assert.equal(sharedVisual.material.envMapRotation.y, 0.22, "shared collider material stays unpinned envMapRotation.y");
  assert.equal(sharedVisual.material.envMapRotation.z, 0.33, "shared collider material stays unpinned envMapRotation.z");
  assert.equal(sharedVisual.material.envMapRotation.order, "XZY", "shared collider material stays unpinned envMapRotation.order");
  assert.equal(sharedVisual.material.blendColor.r, 0.08, "shared collider material stays unpinned blendColor.r");
  assert.equal(sharedVisual.material.blendColor.g, 0.16, "shared collider material stays unpinned blendColor.g");
  assert.equal(sharedVisual.material.blendColor.b, 0.24, "shared collider material stays unpinned blendColor.b");
  assert.equal(sharedVisual.material.blendAlpha, 0.28, "shared collider material stays unpinned blendAlpha");
  assert.equal(sharedVisual.material.dithering, true, "shared collider material stays unpinned dithering");
  assert.equal(sharedVisual.material.alphaToCoverage, true, "shared collider material stays unpinned alphaToCoverage");
  assert.equal(collider.material.stencilWrite, false, "collider MeshBasic keeps r170 stencilWrite default");
  assert.equal(collider.material.stencilFunc, THREE.AlwaysStencilFunc, "collider MeshBasic keeps r170 stencilFunc default");
  assert.equal(collider.material.clippingPlanes, null, "collider MeshBasic keeps r170 clippingPlanes default");
  assert.equal(collider.material.clipIntersection, false, "collider MeshBasic keeps r170 clipIntersection default");
  assert.equal(collider.material.clipShadows, false, "collider MeshBasic keeps r170 clipShadows default");
  assert.equal(collider.material.alphaHash, false, "collider MeshBasic keeps r170 alphaHash default");
  assert.equal(collider.material.forceSinglePass, false, "collider MeshBasic keeps r170 forceSinglePass default");
  assert.equal(collider.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic keeps r170 blendSrc default");
  assert.equal(collider.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic keeps r170 blendDst default");
  assert.equal(collider.material.blendEquation, THREE.AddEquation, "collider MeshBasic keeps r170 blendEquation default");
  assert.equal(collider.material.blendSrcAlpha, null, "collider MeshBasic keeps r170 blendSrcAlpha default");
  assert.equal(collider.material.blendDstAlpha, null, "collider MeshBasic keeps r170 blendDstAlpha default");
  assert.equal(collider.material.blendEquationAlpha, null, "collider MeshBasic keeps r170 blendEquationAlpha default");
  assert.equal(collider.material.vertexColors, false, "collider MeshBasic keeps r170 vertexColors default");
  assert.equal(collider.material.precision, null, "collider MeshBasic keeps r170 precision default");
  assert.equal(collider.material.shadowSide, null, "collider MeshBasic keeps r170 shadowSide default");
  assert.equal(collider.material.visible, false, "collider MeshBasic stays authored visible");
  assert.equal(collider.material.combine, THREE.AddOperation, "collider MeshBasic stays authored combine");
  assert.equal(collider.material.reflectivity, 0.3, "collider MeshBasic stays authored reflectivity");
  assert.equal(collider.material.refractionRatio, 0.4, "collider MeshBasic stays authored refractionRatio");
  assert.equal(collider.material.lightMapIntensity, 0.3, "collider MeshBasic stays authored lightMapIntensity");
  assert.equal(collider.material.aoMapIntensity, 0.4, "collider MeshBasic stays authored aoMapIntensity");
  assert.equal(collider.material.wireframeLinewidth, 4, "collider MeshBasic stays authored wireframeLinewidth");
  assert.equal(collider.material.wireframeLinecap, "square", "collider MeshBasic stays authored wireframeLinecap");
  assert.equal(collider.material.wireframeLinejoin, "bevel", "collider MeshBasic stays authored wireframeLinejoin");
  assert.equal(collider.material.envMapRotation.x, 0.15, "collider MeshBasic stays authored envMapRotation.x");
  assert.equal(collider.material.envMapRotation.y, 0.25, "collider MeshBasic stays authored envMapRotation.y");
  assert.equal(collider.material.envMapRotation.z, 0.35, "collider MeshBasic stays authored envMapRotation.z");
  assert.equal(collider.material.envMapRotation.order, "YZX", "collider MeshBasic stays authored envMapRotation.order");
  assert.equal(collider.material.blendColor.r, 0.12, "collider MeshBasic stays authored blendColor.r");
  assert.equal(collider.material.blendColor.g, 0.22, "collider MeshBasic stays authored blendColor.g");
  assert.equal(collider.material.blendColor.b, 0.32, "collider MeshBasic stays authored blendColor.b");
  assert.equal(collider.material.blendAlpha, 0.18, "collider MeshBasic stays authored blendAlpha");
  assert.equal(collider.material.dithering, true, "collider MeshBasic stays authored dithering");
  assert.equal(collider.material.alphaToCoverage, true, "collider MeshBasic stays authored alphaToCoverage");
});

test("v0.76 clears leftover Mesh customDepth/Distance on color-only visual meshes; envelope stays v0.75", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal("customDepthMaterial" in fresh, false, "r170 Mesh does not define customDepthMaterial on the instance");
  assert.equal("customDistanceMaterial" in fresh, false, "r170 Mesh does not define customDistanceMaterial on the instance");
  assertR170MeshCustomShadowMaterialsAbsent(fresh, "r170 Mesh");
  assert.equal(fresh.castShadow, false, "r170 Mesh defaults castShadow false");
  assert.equal(fresh.receiveShadow, false, "r170 Mesh defaults receiveShadow false");

  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 2820 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1176 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 432 });
  assert.equal(crate.userData.l2.uniqueMaterials, 3);
  assert.equal(crate.userData.l2.uniqueTextures, 0);

  const mats = collectCrateVisualMaterials(crate);
  assert.equal(mats.length, 3, "unique procedural MeshBasic instances stay 3");
  for (const mat of mats) {
    assert.equal(isColorOnlyUnlitBasic(mat), true);
    assertQuestSafeUnlitFlags(mat);
    assert.equal(mat.stencilWrite, false, "prior stencilWrite pin stays false");
    assert.equal(mat.stencilRef, 0, "prior stencilRef pin stays 0");
    assert.equal(mat.stencilWriteMask, 0xff, "prior stencilWriteMask pin stays 0xff");
    assert.equal(mat.stencilFuncMask, 0xff, "prior stencilFuncMask pin stays 0xff");
    assert.equal(mat.stencilZFail, THREE.KeepStencilOp, "prior stencilZFail pin stays Keep");
    assert.equal(mat.stencilZPass, THREE.KeepStencilOp, "prior stencilZPass pin stays Keep");
    assert.equal(mat.polygonOffsetFactor, 0, "prior polygonOffsetFactor pin stays 0");
    assert.equal(mat.polygonOffsetUnits, 0, "prior polygonOffsetUnits pin stays 0");
    assert.equal(mat.dithering, false, "prior dithering pin stays false");
    assert.equal(mat.alphaToCoverage, false, "prior alphaToCoverage pin stays false");
  }

  const visuals = crateVisualMeshes(crate);
  assert.equal(visuals.length, 13);
  for (const mesh of visuals) {
    assertQuestSafeUnlitFlags(mesh.material);
    assertQuestSafeUnlitCustomShadowMaterials(mesh);
    assertQuestSafeUnlitShadowFlags(mesh);
    assertQuestSafeUnlitFrustumCulled(mesh);
    assertQuestSafeUnlitRenderOrder(mesh);
    assertQuestSafeUnlitLayers(mesh);
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh);
    assertQuestSafeUnlitUp(mesh);
    assertQuestSafeUnlitScale(mesh);
    assertQuestSafeUnlitRotationOrder(mesh);
    assert.equal(mesh.visible, true, "procedural visuals keep mesh.visible true; pin does not force false");
    assert.equal(mesh.castShadow, false, "custom-shadow pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "custom-shadow pin does not enable receiveShadow");
    assert.equal(mesh.material.stencilRef, 0, "visual MeshBasic stencilRef stays 0");
    assert.equal(mesh.material.stencilWriteMask, 0xff, "visual MeshBasic stencilWriteMask stays 0xff");
    assert.equal(mesh.material.stencilFuncMask, 0xff, "visual MeshBasic stencilFuncMask stays 0xff");
    assert.equal(mesh.material.stencilZFail, THREE.KeepStencilOp, "visual MeshBasic stencilZFail stays Keep");
    assert.equal(mesh.material.stencilZPass, THREE.KeepStencilOp, "visual MeshBasic stencilZPass stays Keep");
  }
  const customCounts = countVisualCustomShadowMaterials(crate);
  assert.equal(customCounts.absent, 13, "customDepth/Distance-absent count is 13");
  assert.equal(customCounts.leftover, 0);
  const rotationCounts = countVisualRotationOrderXYZ(crate);
  assert.equal(rotationCounts.xyz, 13, "rotation-order-XYZ count stays 13");
  assert.equal(rotationCounts.other, 0);
  const scaleCounts = countVisualScaleDefault(crate);
  assert.equal(scaleCounts.unit, 13, "scale-default count stays 13");
  assert.equal(scaleCounts.other, 0);
  const upCounts = countVisualUpDefault(crate);
  assert.equal(upCounts.yUp, 13, "up-default count stays 13");
  assert.equal(upCounts.other, 0);
  const worldAutoCounts = countVisualMatrixWorldAutoUpdate(crate);
  assert.equal(worldAutoCounts.on, 13, "matrixWorldAutoUpdate-on count stays 13");
  assert.equal(worldAutoCounts.off, 0);
  const layerCounts = countVisualLayersDefault(crate);
  assert.equal(layerCounts.layer0Only, 13, "layers-default count stays 13");
  assert.equal(layerCounts.other, 0);
  const renderOrderCounts = countVisualRenderOrder(crate);
  assert.equal(renderOrderCounts.zero, 13, "renderOrder-0 count stays 13");
  assert.equal(renderOrderCounts.nonzero, 0);
  const frustumCounts = countVisualFrustumCulled(crate);
  assert.equal(frustumCounts.on, 13, "frustumCulled-on count stays 13");
  assert.equal(frustumCounts.off, 0);
  const shadowCounts = countVisualShadowFlags(crate);
  assert.equal(shadowCounts.off, 13, "shadow-off count stays 13");
  assert.equal(shadowCounts.on, 0);
  const rayCounts = countVisualRaycast(crate);
  assert.equal(rayCounts.disabled, 13, "raycast-off count stays 13");
  assert.equal(rayCounts.defaultRaycast, 0);
  const matrixCounts = countVisualMatrixAutoUpdate(crate);
  assert.equal(matrixCounts.frozen, 3);
  assert.equal(matrixCounts.live, 10);

  const fastener = crate.getObjectByName("fastenerMesh");
  const lidMesh = crate.getObjectByName("lidMesh");
  const latchMesh = crate.getObjectByName("latchMesh");
  assert.ok(lidMesh, "named lidMesh kept");
  assert.ok(latchMesh, "named latchMesh kept");
  assert.ok(fastener, "named fastenerMesh kept");
  assertQuestSafeUnlitCustomShadowMaterials(lidMesh, "lidMesh");
  assertQuestSafeUnlitCustomShadowMaterials(latchMesh, "latchMesh");
  assertQuestSafeUnlitCustomShadowMaterials(fastener, "fastenerMesh");
  assert.equal(fastener.geometry.getAttribute("position") ? cpuAttrBytes(fastener.geometry) : 0, 216, "fastener attrBytes stay 216");

  const lod0Group = crate.userData.lod.groups[0][0];
  assert.equal(lod0Group.visible, true, "LOD0 group starts visible");
  setToolboxLod(crate, 1);
  assert.equal(lod0Group.visible, false, "LOD hides via group.visible, not mesh.visible");
  assert.equal(lidMesh.visible, true, "mesh.visible is not pinned; LOD uses group.visible");
  setToolboxLod(crate, 0);

  const bodyL0 = crate.userData.lod.groups[0][0];
  const bodyHero = bodyL0.children.find((o) => o.isMesh && !o.userData.collider);
  assert.equal(bodyHero.matrixAutoUpdate, false, "v0.45 body LOD leaf still frozen");
  assertQuestSafeUnlitCustomShadowMaterials(bodyHero, "body LOD leaf");

  for (const c of crate.userData.colliders) {
    assertR170MeshCustomShadowMaterialsAbsent(c, "collider Mesh keeps r170 customDepth/Distance absence");
    assert.equal(c.visible, false, "collider mesh.visible stays authored hidden");
    assert.equal(c.raycast, THREE.Mesh.prototype.raycast);
    assert.equal(c.matrixAutoUpdate, true, "collider matrixAutoUpdate stays live");
  }

  const { lidPivot, latchPivot } = crate.userData.parts;
  assert.equal(activityState(crate), "closed");
  const nack = tryUse(crate, "collider_lid");
  assert.equal(nack.ok, false);
  assert.equal(activityState(crate), "closed");
  const unlatch = tryUse(crate, "collider_latch");
  assert.equal(unlatch.ok, true);
  assert.equal(unlatch.to, "unlatched");
  applyActivityVisual(crate, 1);
  assert.ok(latchPivot.rotation.x < -1);
  const open = tryUse(crate, "collider_lid");
  assert.equal(open.ok, true);
  assert.equal(open.to, "open");
  applyActivityVisual(crate, 1);
  assert.ok(lidPivot.rotation.x < -2);
  const drive = tryDriveFastener(crate);
  assert.equal(drive.ok, true);
  assert.equal(drive.turns, 1);
  assert.ok(Math.abs(fastener.rotation.z - Math.PI / 2) < 1e-6);
  assertQuestSafeUnlitFlags(fastener.material, "fastener after L5 drive");
  assertQuestSafeUnlitCustomShadowMaterials(fastener, "fastener after L5 drive");
  assert.equal(fastener.castShadow, false, "fastener castShadow stays false after L5");
  assert.equal(fastener.receiveShadow, false, "fastener receiveShadow stays false after L5");
  assert.equal(fastener.material.stencilRef, 0, "fastener stencilRef stays 0 after L5");
  assert.equal(fastener.visible, true, "fastener mesh.visible is not pinned");
});

test("pinColorOnlyUnlitBasicCustomShadowMaterials corrects a wrong color-only Mesh that still passes isColorOnlyUnlitBasic", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assertR170MeshCustomShadowMaterialsAbsent(fresh, "r170 Mesh");

  const wrong = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  const leftoverDepth = { isMaterial: true, name: "leftoverDepth" };
  const leftoverDistance = { isMaterial: true, name: "leftoverDistance" };
  wrong.customDepthMaterial = leftoverDepth;
  wrong.customDistanceMaterial = leftoverDistance;
  assert.equal(isColorOnlyUnlitBasic(wrong.material), true, "color-only MeshBasic still passes the gate");
  assert.equal(wrong.customDepthMaterial, leftoverDepth, "DCC leftover is a stub customDepthMaterial");
  assert.equal(wrong.customDistanceMaterial, leftoverDistance, "DCC leftover is a stub customDistanceMaterial");
  const matrixAutoBefore = wrong.matrixAutoUpdate;
  const worldAutoBefore = wrong.matrixWorldAutoUpdate;
  const visibleBefore = wrong.visible;
  const layersMaskBefore = wrong.layers.mask;
  const rotationOrderBefore = wrong.rotation.order;
  const blendColorBefore = wrong.material.blendColor;
  const blendAlphaBefore = wrong.material.blendAlpha;
  const ditheringBefore = wrong.material.dithering;
  const a2cBefore = wrong.material.alphaToCoverage;
  const stencilRefBefore = wrong.material.stencilRef;
  pinColorOnlyUnlitBasicCustomShadowMaterials(wrong);
  assertQuestSafeUnlitCustomShadowMaterials(wrong, "deliberately wrong color-only Mesh");
  assert.notEqual(wrong.customDepthMaterial, leftoverDepth, "leftover customDepthMaterial stub is cleared");
  assert.notEqual(wrong.customDistanceMaterial, leftoverDistance, "leftover customDistanceMaterial stub is cleared");
  assert.equal(wrong.castShadow, false, "custom-shadow pin does not enable castShadow");
  assert.equal(wrong.receiveShadow, false, "custom-shadow pin does not enable receiveShadow");
  assert.equal(wrong.frustumCulled, true, "custom-shadow pin does not change frustumCulled");
  assert.equal(wrong.renderOrder, 0, "custom-shadow pin does not change renderOrder");
  assert.equal(wrong.visible, visibleBefore, "custom-shadow pin does not change mesh.visible");
  assert.equal(wrong.matrixAutoUpdate, matrixAutoBefore, "custom-shadow pin does not change matrixAutoUpdate");
  assert.equal(wrong.matrixWorldAutoUpdate, worldAutoBefore, "custom-shadow pin does not change matrixWorldAutoUpdate");
  assert.equal(wrong.layers.mask, layersMaskBefore, "custom-shadow pin does not change layers");
  assert.equal(wrong.rotation.order, rotationOrderBefore, "custom-shadow pin does not change rotation.order");
  assert.equal(wrong.material.blendColor, blendColorBefore, "custom-shadow pin does not replace blendColor");
  assert.equal(wrong.material.blendAlpha, blendAlphaBefore, "custom-shadow pin does not change blendAlpha");
  assert.equal(wrong.material.dithering, ditheringBefore, "custom-shadow pin does not change dithering");
  assert.equal(wrong.material.alphaToCoverage, a2cBefore, "custom-shadow pin does not change alphaToCoverage");
  assert.equal(wrong.material.stencilRef, stencilRefBefore, "custom-shadow pin does not change stencilRef");
  assert.equal(wrong.material.fog, true, "custom-shadow pin does not change fog");
});

test("pinColorOnlyUnlitBasicCustomShadowMaterials / pinColorOnlyVisualCustomShadowMaterials skip mapped, lit, morph, colliders, shared blocked", () => {
  const leftover = () => ({ isMaterial: true });
  const colorOnly = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x633318 })
  );
  colorOnly.customDepthMaterial = leftover();
  colorOnly.customDistanceMaterial = leftover();
  const mapped = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } })
  );
  const mappedDepth = leftover();
  const mappedDistance = leftover();
  mapped.customDepthMaterial = mappedDepth;
  mapped.customDistanceMaterial = mappedDistance;
  const std = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial()
  );
  const stdDepth = leftover();
  const stdDistance = leftover();
  std.customDepthMaterial = stdDepth;
  std.customDistanceMaterial = stdDistance;
  pinColorOnlyUnlitBasicCustomShadowMaterials(colorOnly);
  pinColorOnlyUnlitBasicCustomShadowMaterials(mapped);
  pinColorOnlyUnlitBasicCustomShadowMaterials(std);
  assertQuestSafeUnlitCustomShadowMaterials(colorOnly);
  assert.equal(mapped.customDepthMaterial, mappedDepth, "mapped MeshBasic stays authored customDepthMaterial");
  assert.equal(mapped.customDistanceMaterial, mappedDistance, "mapped MeshBasic stays authored customDistanceMaterial");
  assert.equal(std.customDepthMaterial, stdDepth, "MeshStandard stays authored customDepthMaterial");
  assert.equal(std.customDistanceMaterial, stdDistance, "MeshStandard stays authored customDistanceMaterial");

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  const mappedMesh = mapped;
  const colorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xbe7e31 })
  );
  colorMesh.customDepthMaterial = leftover();
  colorMesh.customDistanceMaterial = leftover();
  const morph = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xc1c3c9 })
  );
  morph.geometry.morphAttributes.position = [morph.geometry.getAttribute("position").clone()];
  const morphDepth = leftover();
  const morphDistance = leftover();
  morph.customDepthMaterial = morphDepth;
  morph.customDistanceMaterial = morphDistance;
  const collider = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  collider.name = "collider_grab";
  collider.userData.collider = true;
  const colliderDepth = leftover();
  const colliderDistance = leftover();
  collider.customDepthMaterial = colliderDepth;
  collider.customDistanceMaterial = colliderDistance;
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
  const sharedVisual = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  const sharedVisualDepth = leftover();
  const sharedVisualDistance = leftover();
  sharedVisual.customDepthMaterial = sharedVisualDepth;
  sharedVisual.customDistanceMaterial = sharedVisualDistance;
  const sharedCollider = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), sharedBlocked);
  sharedCollider.name = "collider_shared";
  sharedCollider.userData.collider = true;
  const sharedColliderDepth = leftover();
  const sharedColliderDistance = leftover();
  sharedCollider.customDepthMaterial = sharedColliderDepth;
  sharedCollider.customDistanceMaterial = sharedColliderDistance;
  body.add(mappedMesh, colorMesh, morph, sharedVisual);
  root.add(body, collider, sharedCollider, std);
  pinColorOnlyVisualCustomShadowMaterials(root);
  assertQuestSafeUnlitCustomShadowMaterials(colorMesh, "entity helper color-only");
  assert.equal(mapped.customDepthMaterial, mappedDepth, "mapped MeshBasic stays authored via entity helper");
  assert.equal(mapped.customDistanceMaterial, mappedDistance);
  assert.equal(morph.customDepthMaterial, morphDepth, "morph color-only MeshBasic is skipped");
  assert.equal(morph.customDistanceMaterial, morphDistance);
  assert.equal(collider.customDepthMaterial, colliderDepth, "collider Mesh stays authored");
  assert.equal(collider.customDistanceMaterial, colliderDistance);
  assert.equal(sharedVisual.customDepthMaterial, sharedVisualDepth, "shared collider material visual stays unpinned");
  assert.equal(sharedVisual.customDistanceMaterial, sharedVisualDistance);
  assert.equal(sharedCollider.customDepthMaterial, sharedColliderDepth, "shared collider stays authored");
  assert.equal(sharedCollider.customDistanceMaterial, sharedColliderDistance);
  assert.equal(std.customDepthMaterial, stdDepth, "MeshStandard stays authored via entity helper");
  assert.equal(std.customDistanceMaterial, stdDistance);
});

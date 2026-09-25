import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import sidecar from "./behavior.json" with { type: "json" };
import {
  discoverPackagedLodGroups,
  ingestPackagedRoot,
  packagedLodLevel,
} from "./packaged-visual.js";
import {
  isCpuArrayReleaseOnUpload,
  mergeSameMaterialMeshes,
  noopColorOnlyVisualRaycast,
  setToolboxLod,
  TOOLBOX_LOD_DISTANCES,
  updateToolboxLod,
  weldCoincidentVertices,
} from "./toolbox.js";

function mesh(name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  m.name = name;
  return m;
}

function addRequiredColliders(root) {
  for (const name of ["collider_grab", "collider_latch", "collider_lid", "collider_tool"]) {
    root.add(mesh(name));
  }
}

function makePackagedFixture({ withLod = true, lodNames } = {}) {
  const root = new THREE.Group();
  root.name = "authored";

  const body = new THREE.Group();
  body.name = "body";
  const lid = new THREE.Group();
  lid.name = "lid";
  const latch = new THREE.Group();
  latch.name = "latch";
  const tool = new THREE.Group();
  tool.name = "tool";
  const fastener = mesh("fastenerMesh");

  const named = lodNames ?? { 0: "lod0", 1: "lod1", 2: "lod2" };
  const groups = { 0: [], 1: [], 2: [] };

  if (withLod) {
    for (const part of [body, lid, latch, tool]) {
      for (const level of [0, 1, 2]) {
        const g = new THREE.Group();
        g.name = named[level];
        g.userData.lodLevel = level;
        g.add(mesh(`${part.name}L${level}`));
        part.add(g);
        groups[level].push(g);
      }
    }
  } else {
    body.add(mesh("bodyMesh"));
    lid.add(mesh("lidMesh"));
    latch.add(mesh("latchMesh"));
    tool.add(mesh("toolMesh"));
  }

  addRequiredColliders(root);
  root.add(body, lid, latch, tool, fastener);
  return { root, body, lid, latch, tool, fastener, groups };
}

function visualMeshes(group) {
  return group.children.filter((o) => o.isMesh && !o.userData.collider);
}

function boxMesh(name, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material);
  m.name = name;
  return m;
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

function assertR170Object3DRenderCallbacksAbsent(obj, label = "r170 Object3D") {
  assert.equal(Object.hasOwn(obj, "onBeforeRender"), false, `${label} onBeforeRender is not an own property`);
  assert.equal(Object.hasOwn(obj, "onAfterRender"), false, `${label} onAfterRender is not an own property`);
  assert.equal(obj.onBeforeRender, THREE.Object3D.prototype.onBeforeRender, `${label} onBeforeRender is the r170 prototype empty no-op`);
  assert.equal(obj.onAfterRender, THREE.Object3D.prototype.onAfterRender, `${label} onAfterRender is the r170 prototype empty no-op`);
}

function assertQuestSafeUnlitRenderCallbacks(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DRenderCallbacksAbsent(mesh, label);
}

function assertR170MaterialRenderCallbacksAbsent(mat, label = "r170 Material") {
  assert.equal(Object.hasOwn(mat, "onBeforeCompile"), false, `${label} onBeforeCompile is not an own property`);
  assert.equal(Object.hasOwn(mat, "onBeforeRender"), false, `${label} onBeforeRender is not an own property`);
  assert.equal(mat.onBeforeCompile, THREE.Material.prototype.onBeforeCompile, `${label} onBeforeCompile is the r170 prototype empty no-op`);
  assert.equal(mat.onBeforeRender, THREE.Material.prototype.onBeforeRender, `${label} onBeforeRender is the r170 prototype empty no-op`);
}

function assertQuestSafeUnlitMaterialRenderCallbacks(mat, label = "color-only MeshBasic") {
  assertR170MaterialRenderCallbacksAbsent(mat, label);
}

function assertR170Object3DShadowCallbacksAbsent(obj, label = "r170 Object3D") {
  assert.equal(Object.hasOwn(obj, "onBeforeShadow"), false, `${label} onBeforeShadow is not an own property`);
  assert.equal(Object.hasOwn(obj, "onAfterShadow"), false, `${label} onAfterShadow is not an own property`);
  assert.equal(obj.onBeforeShadow, THREE.Object3D.prototype.onBeforeShadow, `${label} onBeforeShadow is the r170 prototype empty no-op`);
  assert.equal(obj.onAfterShadow, THREE.Object3D.prototype.onAfterShadow, `${label} onAfterShadow is the r170 prototype empty no-op`);
}

function assertQuestSafeUnlitShadowCallbacks(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DShadowCallbacksAbsent(mesh, label);
}

function assertR170MaterialCustomProgramCacheKeyDefault(mat, label = "r170 Material") {
  assert.equal(Object.hasOwn(mat, "customProgramCacheKey"), false, `${label} customProgramCacheKey is not an own property`);
  assert.equal(mat.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey, `${label} customProgramCacheKey is the r170 prototype method`);
}

function assertQuestSafeUnlitCustomProgramCacheKey(mat, label = "color-only MeshBasic") {
  assertR170MaterialCustomProgramCacheKeyDefault(mat, label);
}

function assertR170MaterialDefinesAbsent(mat, label = "r170 Material") {
  assert.equal(mat.defines, undefined, `${label} defines is undefined`);
  assert.equal(Object.hasOwn(mat, "defines"), false, `${label} defines is not an own property`);
}

function assertQuestSafeUnlitDefines(mat, label = "color-only MeshBasic") {
  assertR170MaterialDefinesAbsent(mat, label);
}

function assertR170MaterialFlatShadingUnset(mat, label = "r170 Material") {
  assert.equal(mat.flatShading, undefined, `${label} flatShading is unset`);
  assert.equal(Object.hasOwn(mat, "flatShading"), false, `${label} flatShading is not an own property`);
}

function assertQuestSafeUnlitFlatShading(mat, label = "color-only MeshBasic") {
  assert.equal(mat.flatShading, false, `${label} flatShading is false`);
}

function assertR170MaterialGlslVersionAbsent(mat, label = "r170 Material") {
  assert.equal(mat.glslVersion, undefined, `${label} glslVersion is undefined`);
  assert.equal(Object.hasOwn(mat, "glslVersion"), false, `${label} glslVersion is not an own property`);
}

function assertQuestSafeUnlitGlslVersion(mat, label = "color-only MeshBasic") {
  assertR170MaterialGlslVersionAbsent(mat, label);
}

function assertR170Object3DAnimationsEmpty(obj, label = "r170 Object3D") {
  assert.equal(Array.isArray(obj.animations), true, `${label} animations is an Array`);
  assert.equal(obj.animations.length, 0, `${label} animations length is 0`);
}

function assertQuestSafeUnlitAnimations(mesh, label = "color-only MeshBasic mesh") {
  assertR170Object3DAnimationsEmpty(mesh, label);
}

function assertR170MeshMorphTargetsAbsent(mesh, label = "r170 Mesh") {
  assert.equal(mesh.morphTargetInfluences, undefined, `${label} morphTargetInfluences is undefined`);
  assert.equal(mesh.morphTargetDictionary, undefined, `${label} morphTargetDictionary is undefined`);
  assert.equal(Object.hasOwn(mesh, "morphTargetInfluences"), false, `${label} morphTargetInfluences is not an own property`);
  assert.equal(Object.hasOwn(mesh, "morphTargetDictionary"), false, `${label} morphTargetDictionary is not an own property`);
  assert.notEqual(mesh.morphTargetInfluences, null, `${label} morphTargetInfluences is not null`);
  assert.notEqual(mesh.morphTargetDictionary, null, `${label} morphTargetDictionary is not null`);
}

function assertQuestSafeUnlitMorphTargets(mesh, label = "color-only MeshBasic mesh") {
  assertR170MeshMorphTargetsAbsent(mesh, label);
}

function assertQuestSafeUnlitMorphAttributes(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  assert.equal(geometry.morphTargetsRelative, false, `${label} morphTargetsRelative is false`);
  assert.ok(geometry.morphAttributes && typeof geometry.morphAttributes === "object", `${label} morphAttributes is an object`);
  assert.equal(Array.isArray(geometry.morphAttributes), false, `${label} morphAttributes is not an array`);
  assert.notEqual(geometry.morphAttributes, null, `${label} morphAttributes is not null`);
  assert.equal(Object.keys(geometry.morphAttributes).length, 0, `${label} morphAttributes has no keys`);
}

function assertQuestSafeUnlitGroups(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  assert.equal(Array.isArray(geometry.groups), true, `${label} groups is an Array`);
  assert.equal(geometry.groups.length, 0, `${label} groups length is 0`);
}

function assertQuestSafeUnlitDrawRange(mesh, label = "color-only MeshBasic mesh") {
  const drawRange = mesh.geometry.drawRange;
  assert.ok(drawRange && typeof drawRange === "object", `${label} drawRange is an object`);
  assert.notEqual(drawRange, null, `${label} drawRange is not null`);
  assert.equal(drawRange.start, 0, `${label} drawRange.start is 0`);
  assert.equal(drawRange.count, Infinity, `${label} drawRange.count is Infinity`);
}

function assertQuestSafeUnlitSkinAttributes(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.geometry.getAttribute("skinIndex"), undefined, `${label} skinIndex is absent`);
  assert.equal(mesh.geometry.getAttribute("skinWeight"), undefined, `${label} skinWeight is absent`);
  assert.ok(mesh.geometry.getAttribute("position"), `${label} keeps position`);
  assert.notEqual(mesh.isSkinnedMesh, true, `${label} is not a SkinnedMesh`);
}

function attachLeftoverSkinAttributes(geometry) {
  const count = geometry.getAttribute("position").count;
  const skinIndex = new THREE.Uint16BufferAttribute(count * 4, 4);
  const skinWeight = new THREE.Float32BufferAttribute(count * 4, 4);
  geometry.setAttribute("skinIndex", skinIndex);
  geometry.setAttribute("skinWeight", skinWeight);
  return { skinIndex, skinWeight, skinBytes: skinIndex.array.byteLength + skinWeight.array.byteLength };
}

function assertQuestSafeUnlitUpdateRange(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  const names = Object.keys(geometry.attributes || {});
  assert.ok(names.length > 0, `${label} has attributes`);
  for (const name of names) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.updateRange.offset, 0, `${label} ${name} updateRange.offset is 0`);
    assert.equal(attribute.updateRange.count, -1, `${label} ${name} updateRange.count is -1`);
  }
  if (geometry.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.updateRange.offset, 0, `${label} index updateRange.offset is 0`);
    assert.equal(geometry.index.updateRange.count, -1, `${label} index updateRange.count is -1`);
  }
}

function spoilBufferAttributeUpdateRange(geometry, offset = 4, count = 2) {
  const touched = [];
  for (const name of Object.keys(geometry.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    attribute.updateRange = { offset, count };
    touched.push(attribute);
  }
  if (geometry.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    geometry.index.updateRange = { offset, count };
    touched.push(geometry.index);
  }
  return touched;
}

function boxTris(mesh) {
  const idx = mesh.geometry.index;
  if (idx) return idx.count / 3;
  return mesh.geometry.getAttribute("position").count / 3;
}

function visibleLevels(lod) {
  return {
    0: lod.groups[0].every((g) => g.visible),
    1: lod.groups[1].every((g) => g.visible),
    2: lod.groups[2].every((g) => g.visible),
    hidden0: lod.groups[0].every((g) => !g.visible),
    hidden1: lod.groups[1].every((g) => !g.visible),
    hidden2: lod.groups[2].every((g) => !g.visible),
  };
}

test("ingest wires lod0/lod1/lod2 groups and shows only LOD0", () => {
  const { root, fastener, groups } = makePackagedFixture();
  const ingested = ingestPackagedRoot(root, sidecar);
  assert.equal(ingested, root);
  const lod = root.userData.lod;
  assert.ok(lod, "packaged ingest must populate userData.lod when lod* groups exist");
  assert.equal(lod.current, 0);
  assert.equal(lod.mode, "auto");
  assert.deepEqual(lod.distances, {
    lod1: TOOLBOX_LOD_DISTANCES.lod1,
    lod2: TOOLBOX_LOD_DISTANCES.lod2,
    hysteresis: TOOLBOX_LOD_DISTANCES.hysteresis,
  });
  assert.equal(lod.distances.lod1, 2.4);
  assert.equal(lod.distances.lod2, 4.5);
  assert.equal(lod.distances.hysteresis, 0.2);
  assert.deepEqual(lod.groups[0], groups[0]);
  assert.deepEqual(lod.groups[1], groups[1]);
  assert.deepEqual(lod.groups[2], groups[2]);
  const vis = visibleLevels(lod);
  assert.equal(vis[0], true);
  assert.equal(vis.hidden1, true);
  assert.equal(vis.hidden2, true);
  assert.equal(fastener.visible, true, "fastener is not an LOD mesh");
  for (const c of root.userData.colliders) {
    assert.equal(c.visible, false);
    assert.ok(!lod.groups[0].includes(c));
    assert.ok(!lod.groups[1].includes(c));
    assert.ok(!lod.groups[2].includes(c));
  }
  assert.ok(!lod.groups[0].includes(fastener));
  assert.ok(lod.stats[0].draws > 0);
});

test("setToolboxLod / keys 1/2/3 hide inactive packaged LOD meshes", () => {
  const { root } = makePackagedFixture();
  ingestPackagedRoot(root, sidecar);
  const lod = root.userData.lod;

  setToolboxLod(root, 1);
  assert.equal(lod.current, 1);
  assert.equal(lod.mode, "auto");
  let vis = visibleLevels(lod);
  assert.equal(vis.hidden0, true);
  assert.equal(vis[1], true);
  assert.equal(vis.hidden2, true);

  setToolboxLod(root, 2);
  assert.equal(lod.current, 2);
  vis = visibleLevels(lod);
  assert.equal(vis.hidden0, true);
  assert.equal(vis.hidden1, true);
  assert.equal(vis[2], true);

  setToolboxLod(root, 0);
  vis = visibleLevels(lod);
  assert.equal(vis[0], true);
  assert.equal(vis.hidden1, true);
  assert.equal(vis.hidden2, true);

  lod.mode = "force";
  setToolboxLod(root, Number("2") - 1);
  assert.equal(lod.current, 1);
  vis = visibleLevels(lod);
  assert.equal(vis[1], true);
  assert.equal(vis.hidden0, true);
  assert.equal(vis.hidden2, true);
});

test("updateToolboxLod distance switch hides inactive packaged LODs", () => {
  const { root } = makePackagedFixture();
  ingestPackagedRoot(root, sidecar);
  root.position.set(0, 0, 0);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 5.0);
  camera.updateMatrixWorld();
  root.updateMatrixWorld();
  // Auto path steps 0→1 then 1→2 (hysteresis); same helper as procedural.
  updateToolboxLod(root, camera);
  assert.equal(root.userData.lod.current, 1);
  updateToolboxLod(root, camera);
  assert.equal(root.userData.lod.current, 2);
  const vis = visibleLevels(root.userData.lod);
  assert.equal(vis[2], true);
  assert.equal(vis.hidden0, true);
  assert.equal(vis.hidden1, true);
});

test("missing LOD groups fail soft without inventing fake LODs", () => {
  const { root, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = root.getObjectByName("bodyMesh");
  const ingested = ingestPackagedRoot(root, sidecar);
  assert.equal(ingested, root);
  assert.equal(root.userData.lod, undefined, "must not invent userData.lod");
  assert.equal(setToolboxLod(root, 1), undefined);
  assert.equal(updateToolboxLod(root, new THREE.PerspectiveCamera()), undefined);
  assert.equal(bodyMesh.visible, true);
  assert.equal(fastener.visible, true);
  assert.equal(discoverPackagedLodGroups(root), null);
});

test("uppercase LOD0 / lod_1 / lod-2 names are equivalent", () => {
  const { root } = makePackagedFixture({
    withLod: true,
    lodNames: { 0: "LOD0", 1: "lod_1", 2: "lod-2" },
  });
  ingestPackagedRoot(root, sidecar);
  const lod = root.userData.lod;
  assert.equal(lod.groups[0].length, 4);
  assert.equal(lod.groups[1].length, 4);
  assert.equal(lod.groups[2].length, 4);
  assert.equal(lod.current, 0);
  setToolboxLod(root, 2);
  assert.equal(visibleLevels(lod)[2], true);
  assert.equal(visibleLevels(lod).hidden0, true);
});

test("packagedLodLevel skips colliders and fastener", () => {
  const collider = mesh("collider_grab");
  collider.userData.collider = true;
  assert.equal(packagedLodLevel(collider), null);
  assert.equal(packagedLodLevel(mesh("fastenerMesh")), null);
  assert.equal(packagedLodLevel(mesh("fastener")), null);
  const tagged = new THREE.Group();
  tagged.userData.lodLevel = 1;
  assert.equal(packagedLodLevel(tagged), 1);
  const named = new THREE.Group();
  named.name = "lod2";
  assert.equal(packagedLodLevel(named), 2);
});

test("ingest still requires lid/latch/tool and does not crash without LODs", () => {
  const root = new THREE.Group();
  addRequiredColliders(root);
  root.add(mesh("body"));
  assert.equal(ingestPackagedRoot(root, sidecar), null);
  const { root: ok } = makePackagedFixture({ withLod: false });
  assert.ok(ingestPackagedRoot(ok, sidecar));
  assert.doesNotThrow(() => setToolboxLod(ok, 0));
  assert.doesNotThrow(() => setToolboxLod(ok, 2));
});

test("packaged ingest merges same-material MeshBasic children inside each lod* group", () => {
  const { root, body, lid, latch, tool, fastener, groups } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const bodyLod0 = groups[0][0];
  bodyLod0.clear();
  bodyLod0.add(boxMesh("crateFloor", shared), boxMesh("crateWallA", shared), boxMesh("crateWallB", shared));
  const lidLod0 = groups[0][1];
  const latchLod0 = groups[0][2];
  const toolLod0 = groups[0][3];
  const bodyLod1 = groups[1][0];
  const beforeBody = visualMeshes(bodyLod0).length;
  const beforeTris = visualMeshes(bodyLod0).reduce((n, m) => n + boxTris(m), 0);
  assert.equal(beforeBody, 3);
  assert.equal(beforeTris, 36);
  assert.equal(visualMeshes(lidLod0).length, 1, "single-mesh lid lod0 is a no-op candidate");
  const lidOnly = lidLod0.children[0];
  const latchOnly = latchLod0.children[0];
  const toolOnly = toolLod0.children[0];
  const bodyLod1Only = bodyLod1.children[0];
  const fastenerMat = fastener.material;
  const colliderGrab = root.getObjectByName("collider_grab");

  const ingested = ingestPackagedRoot(root, sidecar);
  assert.equal(ingested, root);
  const afterBody = visualMeshes(bodyLod0);
  assert.equal(afterBody.length, 1, "mock packaged lod0 3 → 1 (unit evidence, not headset)");
  assert.equal(afterBody[0].material, shared, "survivor keeps the shared material reference");
  assert.equal(afterBody[0].name, "", "v1.3.0 mesh-name pin clears the merged survivor name");
  assert.equal(boxTris(afterBody[0]), beforeTris, "tris stay concatenated (weld does not drop faces)");
  assert.equal(afterBody[0].geometry.getAttribute("position").count, 8, "unit/mock: 3 coincident boxes weld 72 → 8 unique verts");
  assert.equal(afterBody[0].geometry.getAttribute("normal"), undefined, "color-only MeshBasic drops unused normal after weld");
  assert.equal(afterBody[0].geometry.getAttribute("uv"), undefined, "color-only MeshBasic drops unused uv after weld");
  assert.ok(afterBody[0].geometry.getAttribute("position").isFloat16BufferAttribute, "merged color-only position is Float16");
  assert.equal(visualMeshes(lidLod0).length, 1);
  assert.equal(lidLod0.children[0], lidOnly, "single-mesh lod groups stay the same mesh (attrs may strip)");
  assert.equal(latchLod0.children[0], latchOnly);
  assert.equal(toolLod0.children[0], toolOnly);
  assert.equal(bodyLod1.children[0], bodyLod1Only, "must not merge across lod levels");
  assert.equal(fastener.visible, true);
  assert.equal(fastener.parent, root, "fastener stays on the packaged root");
  assert.equal(fastener.material, fastenerMat);
  assert.ok(fastener.geometry, "fastener geometry is not disposed");
  assert.equal(fastener.geometry.getAttribute("uv"), undefined, "root fastener MeshBasic strips unused uv (v0.41)");
  assert.equal(fastener.geometry.getAttribute("normal"), undefined, "root fastener MeshBasic strips unused normal (v0.41)");
  assert.equal(fastener.geometry.index.array.BYTES_PER_ELEMENT, 2, "root fastener index is Uint16");
  assert.equal(colliderGrab.visible, false);
  assert.equal(colliderGrab.parent, root);
  assert.ok(body.children.includes(bodyLod0));
  assert.ok(lid.children.includes(lidLod0));
  assert.ok(latch.children.includes(latchLod0));
  assert.ok(tool.children.includes(toolLod0));

  const stats = root.userData.lod.stats;
  // body 1 + lid 1 + latch 1 + tool 1 after merge (was 3+1+1+1 = 6 draws)
  assert.equal(stats[0].draws, 4, "packaged lod.stats draws drop after merge");
  assert.equal(stats[0].tris, 72, "tris stay the concatenated envelope (3×12 + 3×12)");
  assert.equal(stats[0].verts, 80, "unit/mock unique verts: welded body 8 + 3 unmerged boxes 24");
  // v0.39 weld-with-uv-normal: 8×32+216 + 3×(24×32+72) = 472 + 2520 = 2992
  // v0.40 position-only: 8×12+216 + 3×(24×12+72) = 312 + 1080 = 1392
  // v0.44 Float16 position: 8×6+216 + 3×(24×6+72) = 264 + 648 = 912
  assert.equal(stats[0].attrBytes, 912, "unit/mock attrBytes after Float16 position quantize");
  assert.ok(stats[0].attrBytes < 1392, "measurable attrByte drop vs v0.43 Float32 position");
  assert.ok(stats[1].draws > 0);
  assert.equal(lidOnly.geometry.getAttribute("uv"), undefined, "unmerged color-only packaged mesh also strips unused uv");
  assert.equal(lidOnly.geometry.index.array.BYTES_PER_ELEMENT, 2, "unmerged packaged lid index stays Uint16");
  assert.equal(afterBody[0].geometry.index.array.BYTES_PER_ELEMENT, 2, "welded packaged body index is Uint16");
});

test("packaged merge skips colliders and fastener even when they share a material", () => {
  const { root, fastener, groups } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0xbe7e31 });
  const bodyLod0 = groups[0][0];
  bodyLod0.clear();
  const a = boxMesh("plaqueA", shared);
  const b = boxMesh("plaqueB", shared);
  const colliderInLod = boxMesh("collider_in_lod", shared);
  colliderInLod.userData.collider = true;
  colliderInLod.visible = false;
  bodyLod0.add(a, b, colliderInLod);
  fastener.material = shared;

  ingestPackagedRoot(root, sidecar);
  const visuals = visualMeshes(bodyLod0);
  assert.equal(visuals.length, 1, "two brass plaques merge; collider stays out");
  assert.equal(bodyLod0.children.includes(colliderInLod), true, "collider child is not merged away");
  assert.equal(colliderInLod.material, shared);
  assert.ok(colliderInLod.geometry);
  assert.equal(fastener.parent, root);
  assert.equal(fastener.material, shared);
  assert.ok(fastener.isMesh);
  assert.equal(fastener.geometry.getAttribute("uv"), undefined, "skipped fastener still gets unused-attr strip");
});

test("single-mesh packaged lod groups are no-ops", () => {
  const { root, groups } = makePackagedFixture();
  const identities = groups[0].map((g) => g.children[0]);
  ingestPackagedRoot(root, sidecar);
  for (let i = 0; i < groups[0].length; i++) {
    assert.equal(visualMeshes(groups[0][i]).length, 1);
    assert.equal(groups[0][i].children[0], identities[i]);
  }
});

test("no lod groups skips merge and still fails soft", () => {
  const { root, fastener } = makePackagedFixture({ withLod: false });
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const body = root.getObjectByName("body");
  const extraA = boxMesh("bodyExtraA", shared);
  const extraB = boxMesh("bodyExtraB", shared);
  const extraC = boxMesh("bodyExtraC", shared);
  body.add(extraA, extraB, extraC);
  const before = body.children.filter((o) => o.isMesh).length;
  assert.ok(before >= 3);

  const ingested = ingestPackagedRoot(root, sidecar);
  assert.equal(ingested, root);
  assert.equal(root.userData.lod, undefined, "must not invent userData.lod");
  assert.equal(body.children.includes(extraA), true);
  assert.equal(body.children.includes(extraB), true);
  assert.equal(body.children.includes(extraC), true);
  assert.equal(extraA.geometry.uuid === extraB.geometry.uuid, false);
  assert.equal(visualMeshes(body).length, before, "without lod* groups, same-material meshes stay unmerged");
  assert.equal(fastener.visible, true);
  assert.equal(fastener.geometry.getAttribute("uv"), undefined, "authored fastener still strips without lod groups");
});

test("mergeSameMaterialMeshes is the shared helper (direct call matches ingest)", () => {
  const g = new THREE.Group();
  g.name = "lod0";
  const mat = new THREE.MeshBasicMaterial();
  g.add(boxMesh("namedWall", mat), boxMesh("", mat));
  const other = new THREE.MeshBasicMaterial();
  const lonely = boxMesh("lonely", other);
  g.add(lonely);
  const multi = boxMesh("multi", [mat, other]);
  g.add(multi);
  const mapped = new THREE.MeshBasicMaterial({ map: { isTexture: true } });
  const mappedMesh = boxMesh("mapped", mapped);
  g.add(mappedMesh);
  mergeSameMaterialMeshes(g);
  const meshes = visualMeshes(g);
  assert.equal(meshes.length, 4, "two shared-mat merge; lonely + multi-material + mapped stay");
  const merged = meshes.find((m) => m.material === mat);
  assert.equal(merged.name, "namedWall", "keep a non-empty .name from one input");
  assert.equal(boxTris(merged), 24, "two boxes stay 24 tris after weld");
  assert.equal(merged.geometry.getAttribute("position").count, 8, "two coincident boxes weld 48 → 8 unique verts");
  assert.equal(merged.geometry.getAttribute("uv"), undefined, "color-only merge strips unused uv");
  assert.equal(merged.geometry.getAttribute("normal"), undefined, "color-only merge strips unused normal");
  assert.equal(merged.geometry.getAttribute("position").isFloat16BufferAttribute, true, "color-only merge quantizes position to Float16");
  assert.equal(meshes.includes(lonely), true);
  assert.equal(lonely.geometry.getAttribute("uv"), undefined, "unmerged color-only lonely also strips");
  assert.equal(meshes.includes(multi), true);
  assert.ok(multi.geometry.getAttribute("uv"), "multi-material is skipped and keeps uv");
  assert.ok(mappedMesh.geometry.getAttribute("uv"), "mapped MeshBasic keeps uv");
  assert.ok(mappedMesh.geometry.getAttribute("normal"), "mapped MeshBasic keeps normal");
});

test("weldCoincidentVertices hashes position and keeps other attribute channels", () => {
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const beforeTris = geo.index.count / 3;
  const beforeVerts = geo.getAttribute("position").count;
  assert.equal(beforeVerts, 24);
  const welded = weldCoincidentVertices(geo);
  assert.equal(welded.getAttribute("position").count, 8);
  assert.equal(welded.index.count / 3, beforeTris, "index tri count unchanged");
  assert.ok(welded.getAttribute("normal"));
  assert.ok(welded.getAttribute("uv"));
  assert.equal(geo.getAttribute("position").count, 24, "source geometry is not rewritten in place when verts drop");
});

test("merge compact converts concat Uint32 when weld early-returns", () => {
  const g = new THREE.Group();
  g.name = "lod0";
  const mat = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  b.position.set(10, 0, 0);
  g.add(a, b);
  mergeSameMaterialMeshes(g);
  const merged = visualMeshes(g)[0];
  assert.equal(merged.geometry.getAttribute("position").count, 8, "two offset planes stay 8 unique verts (weld no-op)");
  assert.equal(merged.geometry.index.count / 3, 4, "two planes stay 4 tris");
  assert.ok(merged.geometry.index.array instanceof Uint16Array, "concat Uint32 compacted to Uint16");
  assert.equal(merged.geometry.index.array.byteLength, 24, "12 indices × 2 B");
  assert.equal(merged.geometry.getAttribute("uv"), undefined);
  assert.equal(merged.geometry.getAttribute("position").isFloat16BufferAttribute, true);
  assert.equal(merged.geometry.getAttribute("position").array.byteLength, 8 * 3 * 2, "8 verts × Float16 xyz");
});

function simulateGpuUpload(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    geometry.getAttribute(name)?.onUploadCallback();
  }
  geometry.index?.onUploadCallback();
}

test("packaged ingest hooks onUpload CPU-array release on color-only MeshBasic, not colliders", () => {
  const { root, fastener, groups } = makePackagedFixture();
  ingestPackagedRoot(root, sidecar);
  const bodyMerged = visualMeshes(groups[0][0])[0];
  const lidOnly = visualMeshes(groups[0][1])[0];
  assert.ok(bodyMerged.geometry.getAttribute("position").isFloat16BufferAttribute, "packaged lod mesh position is Float16");
  assert.ok(bodyMerged.geometry.getAttribute("position").array, "pre-upload arrays present for lod.stats");
  assert.equal(bodyMerged.geometry.getAttribute("position").usage, THREE.StaticDrawUsage);
  assert.equal(root.userData.lod.stats[0].attrBytes, 864, "default fixture: 4 packed boxes × 216 B Float16 pre-upload");
  simulateGpuUpload(bodyMerged.geometry);
  simulateGpuUpload(lidOnly.geometry);
  simulateGpuUpload(fastener.geometry);
  assert.equal(bodyMerged.geometry.getAttribute("position").array, null);
  assert.equal(bodyMerged.geometry.index.array, null);
  assert.equal(lidOnly.geometry.getAttribute("position").array, null);
  assert.equal(fastener.geometry.getAttribute("position").array, null);
  assert.equal(fastener.geometry.index.array, null);
  const colliderGrab = root.getObjectByName("collider_grab");
  simulateGpuUpload(colliderGrab.geometry);
  assert.ok(colliderGrab.geometry.getAttribute("position").array, "collider CPU arrays are not released");
  assert.equal(colliderGrab.geometry.getAttribute("position").isFloat16BufferAttribute, undefined, "collider position stays Float32");
});

test("packaged ingest freezes static body MeshBasic leaves; lid/latch/tool/fastener stay live", () => {
  const { root, body, lid, latch, tool, fastener, groups } = makePackagedFixture();
  ingestPackagedRoot(root, sidecar);

  const bodyMeshes = groups[0].concat(groups[1], groups[2])
    .filter((g) => g.parent === body)
    .flatMap((g) => visualMeshes(g));
  assert.equal(bodyMeshes.length, 3, "one body mesh per LOD in the fixture");
  for (const mesh of bodyMeshes) {
    assert.equal(mesh.matrixAutoUpdate, false, "static packaged body MeshBasic is frozen");
  }

  const liveParents = new Set([lid, latch, tool]);
  const pivotMeshes = groups[0].concat(groups[1], groups[2])
    .filter((g) => liveParents.has(g.parent))
    .flatMap((g) => visualMeshes(g));
  assert.equal(pivotMeshes.length, 9);
  for (const mesh of pivotMeshes) {
    assert.equal(mesh.matrixAutoUpdate, true, "meshes under lid/latch/tool stay live");
  }
  assert.equal(fastener.matrixAutoUpdate, true, "packaged fastener stays live (L5 visual)");
  assert.equal(lid.matrixAutoUpdate, true);
  assert.equal(latch.matrixAutoUpdate, true);
  assert.equal(tool.matrixAutoUpdate, true);
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.matrixAutoUpdate, true);
});

test("packaged ingest without lod groups still freezes static body MeshBasic", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  const bodyMesh = visualMeshes(body)[0];
  assert.equal(bodyMesh.matrixAutoUpdate, false);
  assert.equal(visualMeshes(lid)[0].matrixAutoUpdate, true);
  assert.equal(visualMeshes(latch)[0].matrixAutoUpdate, true);
  assert.equal(visualMeshes(tool)[0].matrixAutoUpdate, true);
  assert.equal(fastener.matrixAutoUpdate, true);
});

test("packaged ingest disables color-only visual raycast; collider_grab does not", () => {
  const { root, body, lid, latch, tool, fastener, groups } = makePackagedFixture();
  ingestPackagedRoot(root, sidecar);

  const bodyMeshes = groups[0].concat(groups[1], groups[2])
    .filter((g) => g.parent === body)
    .flatMap((g) => visualMeshes(g));
  assert.equal(bodyMeshes.length, 3);
  for (const mesh of bodyMeshes) {
    assert.equal(mesh.raycast, noopColorOnlyVisualRaycast, "packed color-only body visuals skip triangle raycast");
  }

  const liveParents = new Set([lid, latch, tool]);
  const pivotMeshes = groups[0].concat(groups[1], groups[2])
    .filter((g) => liveParents.has(g.parent))
    .flatMap((g) => visualMeshes(g));
  assert.equal(pivotMeshes.length, 9);
  for (const mesh of pivotMeshes) {
    assert.equal(mesh.raycast, noopColorOnlyVisualRaycast, "lid/latch/tool visuals skip triangle raycast");
  }
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast, "packaged fastener visual raycast is disabled");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.raycast, THREE.Mesh.prototype.raycast, "collider_grab keeps default Mesh raycast");
  assert.notEqual(colliderGrab.raycast, noopColorOnlyVisualRaycast);
});

test("packaged ingest without lod groups still disables static body visual raycast", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assert.equal(visualMeshes(body)[0].raycast, noopColorOnlyVisualRaycast);
  assert.equal(visualMeshes(lid)[0].raycast, noopColorOnlyVisualRaycast);
  assert.equal(visualMeshes(latch)[0].raycast, noopColorOnlyVisualRaycast);
  assert.equal(visualMeshes(tool)[0].raycast, noopColorOnlyVisualRaycast);
  assert.equal(fastener.raycast, noopColorOnlyVisualRaycast);
  assert.equal(root.getObjectByName("collider_grab").raycast, THREE.Mesh.prototype.raycast);
});

test("packaged ingest pins fog/toneMapped and opaque FrontSide on color-only MeshBasics; mapped/lit stay default", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assert.equal(fresh.transparent, false, "r170 MeshBasicMaterial defaults transparent false");
  assert.equal(fresh.opacity, 1, "r170 MeshBasicMaterial defaults opacity 1");
  assert.equal(fresh.depthWrite, true, "r170 MeshBasicMaterial defaults depthWrite true");
  assert.equal(fresh.depthTest, true, "r170 MeshBasicMaterial defaults depthTest true");
  assert.equal(fresh.side, THREE.FrontSide, "r170 MeshBasicMaterial defaults FrontSide");
  assert.equal(THREE.FrontSide, 0, "r170 FrontSide is 0");
  assert.equal(fresh.blending, THREE.NormalBlending, "r170 MeshBasicMaterial defaults NormalBlending");
  assert.equal(fresh.premultipliedAlpha, false, "r170 MeshBasicMaterial defaults premultipliedAlpha false");
  assert.equal(fresh.alphaTest, 0, "r170 MeshBasicMaterial defaults alphaTest 0");
  assert.equal(fresh.dithering, false, "r170 MeshBasicMaterial defaults dithering false");
  assert.equal(fresh.alphaToCoverage, false, "r170 MeshBasicMaterial defaults alphaToCoverage false");
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.colorWrite, true, "r170 MeshBasicMaterial defaults colorWrite true");
  assert.equal(fresh.depthFunc, THREE.LessEqualDepth, "r170 MeshBasicMaterial defaults LessEqualDepth");
  assert.equal(fresh.polygonOffset, false, "r170 MeshBasicMaterial defaults polygonOffset false");
  assert.equal(fresh.polygonOffsetFactor, 0, "r170 MeshBasicMaterial defaults polygonOffsetFactor 0");
  assert.equal(fresh.polygonOffsetUnits, 0, "r170 MeshBasicMaterial defaults polygonOffsetUnits 0");
  assert.equal(THREE.LessEqualDepth, 3, "r170 LessEqualDepth is 3");
  assert.equal(fresh.stencilWrite, false, "r170 MeshBasicMaterial defaults stencilWrite false");
  assert.equal(fresh.stencilFunc, THREE.AlwaysStencilFunc, "r170 MeshBasicMaterial defaults AlwaysStencilFunc");
  assert.equal(fresh.stencilRef, 0, "r170 MeshBasicMaterial defaults stencilRef 0");
  assert.equal(fresh.stencilWriteMask, 0xff, "r170 MeshBasicMaterial defaults stencilWriteMask 0xff");
  assert.equal(fresh.stencilFuncMask, 0xff, "r170 MeshBasicMaterial defaults stencilFuncMask 0xff");
  assert.equal(fresh.stencilFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilFail Keep");
  assert.equal(fresh.stencilZFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZFail Keep");
  assert.equal(fresh.stencilZPass, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZPass Keep");
  assert.equal(THREE.AlwaysStencilFunc, 519, "r170 AlwaysStencilFunc is 519");
  assert.equal(THREE.KeepStencilOp, 7680, "r170 KeepStencilOp is 7680");
  assert.equal(fresh.clippingPlanes, null, "r170 MeshBasicMaterial defaults clippingPlanes null");
  assert.equal(fresh.clipIntersection, false, "r170 MeshBasicMaterial defaults clipIntersection false");
  assert.equal(fresh.clipShadows, false, "r170 MeshBasicMaterial defaults clipShadows false");
  assert.equal(fresh.alphaHash, false, "r170 MeshBasicMaterial defaults alphaHash false");
  assert.equal(fresh.forceSinglePass, false, "r170 MeshBasicMaterial defaults forceSinglePass false");
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");
  assert.equal(fresh.vertexColors, false, "r170 MeshBasicMaterial defaults vertexColors false");
  assert.equal(fresh.precision, null, "r170 MeshBasicMaterial defaults precision null");
  assert.equal(fresh.shadowSide, null, "r170 MeshBasicMaterial defaults shadowSide null");
  assert.equal(fresh.visible, true, "r170 MeshBasicMaterial defaults visible true");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
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
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
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
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: 2,
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
    combine: THREE.AddOperation,
    reflectivity: 0.4,
    refractionRatio: 0.7,
    lightMapIntensity: 0.4,
    aoMapIntensity: 0.25,
    wireframeLinewidth: 2,
    wireframeLinecap: "butt",
    wireframeLinejoin: "miter",
  });
  const wrongMesh = boxMesh("dccDoubleSide", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC DoubleSide / CustomBlending color-only MeshBasic");
  assert.equal(mapped.fog, true, "mapped MeshBasic stays r170 fog default");
  assert.equal(mapped.toneMapped, true, "mapped MeshBasic stays r170 toneMapped default");
  assert.equal(mapped.transparent, true, "mapped MeshBasic stays authored transparent");
  assert.equal(mapped.opacity, 0.5, "mapped MeshBasic stays authored opacity");
  assert.equal(mapped.side, THREE.DoubleSide, "mapped MeshBasic stays authored DoubleSide");
  assert.equal(mapped.blending, THREE.AdditiveBlending, "mapped MeshBasic stays authored blending");
  assert.equal(mapped.premultipliedAlpha, true, "mapped MeshBasic stays authored premultipliedAlpha");
  assert.equal(mapped.alphaTest, 0.25, "mapped MeshBasic stays authored alphaTest");
  assert.equal(mapped.wireframe, true, "mapped MeshBasic stays authored wireframe");
  assert.equal(mapped.colorWrite, false, "mapped MeshBasic stays authored colorWrite");
  assert.equal(mapped.depthFunc, THREE.AlwaysDepth, "mapped MeshBasic stays authored depthFunc");
  assert.equal(mapped.polygonOffset, true, "mapped MeshBasic stays authored polygonOffset");
  assert.equal(mapped.stencilWrite, true, "mapped MeshBasic stays authored stencilWrite");
  assert.equal(mapped.stencilFunc, THREE.EqualStencilFunc, "mapped MeshBasic stays authored stencilFunc");
  assert.equal(mapped.stencilRef, 1, "mapped MeshBasic stays authored stencilRef");
  assert.equal(mapped.stencilFail, THREE.ReplaceStencilOp, "mapped MeshBasic stays authored stencilFail");
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
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.fog, true, "collider MeshBasic stays default fog");
  assert.equal(colliderGrab.material.toneMapped, true, "collider MeshBasic stays default toneMapped");
  assert.equal(colliderGrab.material.transparent, false, "collider MeshBasic stays r170 transparent default");
  assert.equal(colliderGrab.material.side, THREE.FrontSide, "collider MeshBasic stays r170 FrontSide default");
  assert.equal(colliderGrab.material.blending, THREE.NormalBlending, "collider MeshBasic stays r170 blending default");
  assert.equal(colliderGrab.material.premultipliedAlpha, false, "collider MeshBasic stays r170 premultipliedAlpha default");
  assert.equal(colliderGrab.material.alphaTest, 0, "collider MeshBasic stays r170 alphaTest default");
  assert.equal(colliderGrab.material.wireframe, false, "collider MeshBasic stays r170 wireframe default");
  assert.equal(colliderGrab.material.colorWrite, true, "collider MeshBasic stays r170 colorWrite default");
  assert.equal(colliderGrab.material.depthFunc, THREE.LessEqualDepth, "collider MeshBasic stays r170 depthFunc default");
  assert.equal(colliderGrab.material.polygonOffset, false, "collider MeshBasic stays r170 polygonOffset default");
  assert.equal(colliderGrab.material.stencilWrite, false, "collider MeshBasic stays r170 stencilWrite default");
  assert.equal(colliderGrab.material.stencilFunc, THREE.AlwaysStencilFunc, "collider MeshBasic stays r170 stencilFunc default");
  assert.equal(colliderGrab.material.stencilFail, THREE.KeepStencilOp, "collider MeshBasic stays r170 stencilFail default");
  assert.equal(colliderGrab.material.clippingPlanes, null, "collider MeshBasic stays r170 clippingPlanes default");
  assert.equal(colliderGrab.material.clipIntersection, false, "collider MeshBasic stays r170 clipIntersection default");
  assert.equal(colliderGrab.material.clipShadows, false, "collider MeshBasic stays r170 clipShadows default");
  assert.equal(colliderGrab.material.alphaHash, false, "collider MeshBasic stays r170 alphaHash default");
  assert.equal(colliderGrab.material.forceSinglePass, false, "collider MeshBasic stays r170 forceSinglePass default");
  assert.equal(colliderGrab.material.blendSrc, THREE.SrcAlphaFactor, "collider MeshBasic stays r170 blendSrc default");
  assert.equal(colliderGrab.material.blendDst, THREE.OneMinusSrcAlphaFactor, "collider MeshBasic stays r170 blendDst default");
  assert.equal(colliderGrab.material.blendEquation, THREE.AddEquation, "collider MeshBasic stays r170 blendEquation default");
  assert.equal(colliderGrab.material.blendSrcAlpha, null, "collider MeshBasic stays r170 blendSrcAlpha default");
  assert.equal(colliderGrab.material.blendDstAlpha, null, "collider MeshBasic stays r170 blendDstAlpha default");
  assert.equal(colliderGrab.material.blendEquationAlpha, null, "collider MeshBasic stays r170 blendEquationAlpha default");
  assert.equal(colliderGrab.material.vertexColors, false, "collider MeshBasic stays r170 vertexColors default");
  assert.equal(colliderGrab.material.precision, null, "collider MeshBasic stays r170 precision default");
  assert.equal(colliderGrab.material.shadowSide, null, "collider MeshBasic stays r170 shadowSide default");
  assert.equal(colliderGrab.material.visible, true, "collider MeshBasic stays r170 visible default");
  assert.equal(colliderGrab.material.combine, THREE.MultiplyOperation, "collider MeshBasic stays r170 combine default");
  assert.equal(colliderGrab.material.reflectivity, 1, "collider MeshBasic stays r170 reflectivity default");
  assert.equal(colliderGrab.material.refractionRatio, 0.98, "collider MeshBasic stays r170 refractionRatio default");
  assert.equal(colliderGrab.material.lightMapIntensity, 1, "collider MeshBasic stays r170 lightMapIntensity default");
  assert.equal(colliderGrab.material.aoMapIntensity, 1, "collider MeshBasic stays r170 aoMapIntensity default");
});

test("packaged ingest without lod groups still pins color-only MeshBasic flags", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitFlags(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitFlags(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitFlags(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitFlags(fastener.material, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.fog, true);
  assert.equal(colliderGrab.material.toneMapped, true);
  assert.equal(colliderGrab.material.transparent, false, "fail-soft collider stays r170 transparent default");
  assert.equal(colliderGrab.material.side, THREE.FrontSide, "fail-soft collider stays r170 FrontSide default");
  assert.equal(colliderGrab.material.blending, THREE.NormalBlending, "fail-soft collider stays r170 blending default");
  assert.equal(colliderGrab.material.premultipliedAlpha, false, "fail-soft collider stays r170 premultipliedAlpha default");
  assert.equal(colliderGrab.material.alphaTest, 0, "fail-soft collider stays r170 alphaTest default");
  assert.equal(colliderGrab.material.wireframe, false, "fail-soft collider stays r170 wireframe default");
  assert.equal(colliderGrab.material.colorWrite, true, "fail-soft collider stays r170 colorWrite default");
  assert.equal(colliderGrab.material.depthFunc, THREE.LessEqualDepth, "fail-soft collider stays r170 depthFunc default");
  assert.equal(colliderGrab.material.polygonOffset, false, "fail-soft collider stays r170 polygonOffset default");
  assert.equal(colliderGrab.material.stencilWrite, false, "fail-soft collider stays r170 stencilWrite default");
  assert.equal(colliderGrab.material.stencilFunc, THREE.AlwaysStencilFunc, "fail-soft collider stays r170 stencilFunc default");
  assert.equal(colliderGrab.material.stencilFail, THREE.KeepStencilOp, "fail-soft collider stays r170 stencilFail default");
  assert.equal(colliderGrab.material.clippingPlanes, null, "fail-soft collider stays r170 clippingPlanes default");
  assert.equal(colliderGrab.material.clipIntersection, false, "fail-soft collider stays r170 clipIntersection default");
  assert.equal(colliderGrab.material.clipShadows, false, "fail-soft collider stays r170 clipShadows default");
  assert.equal(colliderGrab.material.alphaHash, false, "fail-soft collider stays r170 alphaHash default");
  assert.equal(colliderGrab.material.forceSinglePass, false, "fail-soft collider stays r170 forceSinglePass default");
  assert.equal(colliderGrab.material.blendSrc, THREE.SrcAlphaFactor, "fail-soft collider stays r170 blendSrc default");
  assert.equal(colliderGrab.material.blendDst, THREE.OneMinusSrcAlphaFactor, "fail-soft collider stays r170 blendDst default");
  assert.equal(colliderGrab.material.blendEquation, THREE.AddEquation, "fail-soft collider stays r170 blendEquation default");
  assert.equal(colliderGrab.material.blendSrcAlpha, null, "fail-soft collider stays r170 blendSrcAlpha default");
  assert.equal(colliderGrab.material.blendDstAlpha, null, "fail-soft collider stays r170 blendDstAlpha default");
  assert.equal(colliderGrab.material.blendEquationAlpha, null, "fail-soft collider stays r170 blendEquationAlpha default");
  assert.equal(colliderGrab.material.vertexColors, false, "fail-soft collider stays r170 vertexColors default");
  assert.equal(colliderGrab.material.precision, null, "fail-soft collider stays r170 precision default");
  assert.equal(colliderGrab.material.shadowSide, null, "fail-soft collider stays r170 shadowSide default");
  assert.equal(colliderGrab.material.visible, true, "fail-soft collider stays r170 visible default");
  assert.equal(colliderGrab.material.combine, THREE.MultiplyOperation, "fail-soft collider stays r170 combine default");
  assert.equal(colliderGrab.material.reflectivity, 1, "fail-soft collider stays r170 reflectivity default");
  assert.equal(colliderGrab.material.refractionRatio, 0.98, "fail-soft collider stays r170 refractionRatio default");
  assert.equal(colliderGrab.material.lightMapIntensity, 1, "fail-soft collider stays r170 lightMapIntensity default");
  assert.equal(colliderGrab.material.aoMapIntensity, 1, "fail-soft collider stays r170 aoMapIntensity default");
});

test("packaged ingest pins NormalBlending / premultipliedAlpha false / alphaTest 0; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.blending, THREE.NormalBlending, "r170 MeshBasicMaterial defaults NormalBlending");
  assert.equal(fresh.premultipliedAlpha, false, "r170 MeshBasicMaterial defaults premultipliedAlpha false");
  assert.equal(fresh.alphaTest, 0, "r170 MeshBasicMaterial defaults alphaTest 0");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    blending: THREE.AdditiveBlending,
    premultipliedAlpha: true,
    alphaTest: 0.25,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    blending: THREE.CustomBlending,
    premultipliedAlpha: true,
    alphaTest: 0.5,
  });
  const wrongMesh = boxMesh("dccCustomBlending", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.blending = THREE.AdditiveBlending;
  colliderGrabBefore.material.premultipliedAlpha = true;
  colliderGrabBefore.material.alphaTest = 0.4;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC CustomBlending color-only MeshBasic");
  assert.equal(mapped.blending, THREE.AdditiveBlending, "mapped MeshBasic stays authored blending");
  assert.equal(mapped.premultipliedAlpha, true, "mapped MeshBasic stays authored premultipliedAlpha");
  assert.equal(mapped.alphaTest, 0.25, "mapped MeshBasic stays authored alphaTest");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.blending, THREE.AdditiveBlending, "collider MeshBasic stays authored blending");
  assert.equal(colliderGrab.material.premultipliedAlpha, true, "collider MeshBasic stays authored premultipliedAlpha");
  assert.equal(colliderGrab.material.alphaTest, 0.4, "collider MeshBasic stays authored alphaTest");
});

test("packaged ingest pins wireframe false / colorWrite true / depthFunc LessEqualDepth / polygonOffset off; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.colorWrite, true, "r170 MeshBasicMaterial defaults colorWrite true");
  assert.equal(fresh.depthFunc, THREE.LessEqualDepth, "r170 MeshBasicMaterial defaults LessEqualDepth");
  assert.equal(fresh.polygonOffset, false, "r170 MeshBasicMaterial defaults polygonOffset false");
  assert.equal(fresh.polygonOffsetFactor, 0, "r170 MeshBasicMaterial defaults polygonOffsetFactor 0");
  assert.equal(fresh.polygonOffsetUnits, 0, "r170 MeshBasicMaterial defaults polygonOffsetUnits 0");
  assert.equal(THREE.LessEqualDepth, 3, "r170 LessEqualDepth is 3");
  assert.equal(fresh.stencilWrite, false, "r170 MeshBasicMaterial defaults stencilWrite false");
  assert.equal(fresh.stencilFunc, THREE.AlwaysStencilFunc, "r170 MeshBasicMaterial defaults AlwaysStencilFunc");
  assert.equal(fresh.stencilRef, 0, "r170 MeshBasicMaterial defaults stencilRef 0");
  assert.equal(fresh.stencilWriteMask, 0xff, "r170 MeshBasicMaterial defaults stencilWriteMask 0xff");
  assert.equal(fresh.stencilFuncMask, 0xff, "r170 MeshBasicMaterial defaults stencilFuncMask 0xff");
  assert.equal(fresh.stencilFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilFail Keep");
  assert.equal(fresh.stencilZFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZFail Keep");
  assert.equal(fresh.stencilZPass, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZPass Keep");
  assert.equal(THREE.AlwaysStencilFunc, 519, "r170 AlwaysStencilFunc is 519");
  assert.equal(THREE.KeepStencilOp, 7680, "r170 KeepStencilOp is 7680");
  assert.equal(fresh.clippingPlanes, null, "r170 MeshBasicMaterial defaults clippingPlanes null");
  assert.equal(fresh.clipIntersection, false, "r170 MeshBasicMaterial defaults clipIntersection false");
  assert.equal(fresh.clipShadows, false, "r170 MeshBasicMaterial defaults clipShadows false");
  assert.equal(fresh.alphaHash, false, "r170 MeshBasicMaterial defaults alphaHash false");
  assert.equal(fresh.forceSinglePass, false, "r170 MeshBasicMaterial defaults forceSinglePass false");
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    wireframe: true,
    colorWrite: false,
    depthFunc: THREE.AlwaysDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    wireframe: true,
    colorWrite: false,
    depthFunc: THREE.AlwaysDepth,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const wrongMesh = boxMesh("dccWireframeGpuState", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.wireframe = true;
  colliderGrabBefore.material.colorWrite = false;
  colliderGrabBefore.material.depthFunc = THREE.AlwaysDepth;
  colliderGrabBefore.material.polygonOffset = true;
  colliderGrabBefore.material.polygonOffsetFactor = 1;
  colliderGrabBefore.material.polygonOffsetUnits = 1;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC wireframe/colorWrite/depthFunc/polygonOffset color-only MeshBasic");
  assert.equal(mapped.wireframe, true, "mapped MeshBasic stays authored wireframe");
  assert.equal(mapped.colorWrite, false, "mapped MeshBasic stays authored colorWrite");
  assert.equal(mapped.depthFunc, THREE.AlwaysDepth, "mapped MeshBasic stays authored depthFunc");
  assert.equal(mapped.polygonOffset, true, "mapped MeshBasic stays authored polygonOffset");
  assert.equal(mapped.polygonOffsetFactor, 1, "mapped MeshBasic stays authored polygonOffsetFactor");
  assert.equal(mapped.polygonOffsetUnits, 1, "mapped MeshBasic stays authored polygonOffsetUnits");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.wireframe, true, "collider MeshBasic stays authored wireframe");
  assert.equal(colliderGrab.material.colorWrite, false, "collider MeshBasic stays authored colorWrite");
  assert.equal(colliderGrab.material.depthFunc, THREE.AlwaysDepth, "collider MeshBasic stays authored depthFunc");
  assert.equal(colliderGrab.material.polygonOffset, true, "collider MeshBasic stays authored polygonOffset");
  assert.equal(colliderGrab.material.polygonOffsetFactor, 1, "collider MeshBasic stays authored polygonOffsetFactor");
  assert.equal(colliderGrab.material.polygonOffsetUnits, 1, "collider MeshBasic stays authored polygonOffsetUnits");
});

test("packaged ingest pins r170 stencil defaults; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.stencilWrite, false, "r170 MeshBasicMaterial defaults stencilWrite false");
  assert.equal(fresh.stencilFunc, THREE.AlwaysStencilFunc, "r170 MeshBasicMaterial defaults AlwaysStencilFunc");
  assert.equal(fresh.stencilRef, 0, "r170 MeshBasicMaterial defaults stencilRef 0");
  assert.equal(fresh.stencilWriteMask, 0xff, "r170 MeshBasicMaterial defaults stencilWriteMask 0xff");
  assert.equal(fresh.stencilFuncMask, 0xff, "r170 MeshBasicMaterial defaults stencilFuncMask 0xff");
  assert.equal(fresh.stencilFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilFail Keep");
  assert.equal(fresh.stencilZFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZFail Keep");
  assert.equal(fresh.stencilZPass, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZPass Keep");
  assert.equal(THREE.AlwaysStencilFunc, 519, "r170 AlwaysStencilFunc is 519");
  assert.equal(THREE.KeepStencilOp, 7680, "r170 KeepStencilOp is 7680");
  assert.equal(fresh.clippingPlanes, null, "r170 MeshBasicMaterial defaults clippingPlanes null");
  assert.equal(fresh.clipIntersection, false, "r170 MeshBasicMaterial defaults clipIntersection false");
  assert.equal(fresh.clipShadows, false, "r170 MeshBasicMaterial defaults clipShadows false");
  assert.equal(fresh.alphaHash, false, "r170 MeshBasicMaterial defaults alphaHash false");
  assert.equal(fresh.forceSinglePass, false, "r170 MeshBasicMaterial defaults forceSinglePass false");
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    stencilWrite: true,
    stencilFunc: THREE.EqualStencilFunc,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    stencilWrite: true,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: 2,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
  });
  const wrongMesh = boxMesh("dccStencilOn", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.stencilWrite = true;
  colliderGrabBefore.material.stencilFunc = THREE.EqualStencilFunc;
  colliderGrabBefore.material.stencilRef = 1;
  colliderGrabBefore.material.stencilWriteMask = 0x0f;
  colliderGrabBefore.material.stencilFuncMask = 0x0f;
  colliderGrabBefore.material.stencilFail = THREE.ReplaceStencilOp;
  colliderGrabBefore.material.stencilZFail = THREE.IncrementStencilOp;
  colliderGrabBefore.material.stencilZPass = THREE.DecrementStencilOp;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC stencilWrite/non-Always/non-Keep color-only MeshBasic");
  assert.equal(mapped.stencilWrite, true, "mapped MeshBasic stays authored stencilWrite");
  assert.equal(mapped.stencilFunc, THREE.EqualStencilFunc, "mapped MeshBasic stays authored stencilFunc");
  assert.equal(mapped.stencilRef, 1, "mapped MeshBasic stays authored stencilRef");
  assert.equal(mapped.stencilWriteMask, 0x0f, "mapped MeshBasic stays authored stencilWriteMask");
  assert.equal(mapped.stencilFuncMask, 0x0f, "mapped MeshBasic stays authored stencilFuncMask");
  assert.equal(mapped.stencilFail, THREE.ReplaceStencilOp, "mapped MeshBasic stays authored stencilFail");
  assert.equal(mapped.stencilZFail, THREE.IncrementStencilOp, "mapped MeshBasic stays authored stencilZFail");
  assert.equal(mapped.stencilZPass, THREE.DecrementStencilOp, "mapped MeshBasic stays authored stencilZPass");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.stencilWrite, true, "collider MeshBasic stays authored stencilWrite");
  assert.equal(colliderGrab.material.stencilFunc, THREE.EqualStencilFunc, "collider MeshBasic stays authored stencilFunc");
  assert.equal(colliderGrab.material.stencilRef, 1, "collider MeshBasic stays authored stencilRef");
  assert.equal(colliderGrab.material.stencilWriteMask, 0x0f, "collider MeshBasic stays authored stencilWriteMask");
  assert.equal(colliderGrab.material.stencilFuncMask, 0x0f, "collider MeshBasic stays authored stencilFuncMask");
  assert.equal(colliderGrab.material.stencilFail, THREE.ReplaceStencilOp, "collider MeshBasic stays authored stencilFail");
  assert.equal(colliderGrab.material.stencilZFail, THREE.IncrementStencilOp, "collider MeshBasic stays authored stencilZFail");
  assert.equal(colliderGrab.material.stencilZPass, THREE.DecrementStencilOp, "collider MeshBasic stays authored stencilZPass");
});

test("packaged ingest pins r170 clipping defaults; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.clippingPlanes, null, "r170 MeshBasicMaterial defaults clippingPlanes null");
  assert.equal(fresh.clipIntersection, false, "r170 MeshBasicMaterial defaults clipIntersection false");
  assert.equal(fresh.clipShadows, false, "r170 MeshBasicMaterial defaults clipShadows false");
  assert.equal(fresh.alphaHash, false, "r170 MeshBasicMaterial defaults alphaHash false");
  assert.equal(fresh.forceSinglePass, false, "r170 MeshBasicMaterial defaults forceSinglePass false");
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");

  const { root, fastener, groups } = makePackagedFixture();
  const mappedPlanes = [new THREE.Plane()];
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    clippingPlanes: mappedPlanes,
    clipIntersection: true,
    clipShadows: true,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    clippingPlanes: [new THREE.Plane()],
    clipIntersection: true,
    clipShadows: true,
  });
  const wrongMesh = boxMesh("dccClippingOn", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderPlanes = [new THREE.Plane()];
  colliderGrabBefore.material.clippingPlanes = colliderPlanes;
  colliderGrabBefore.material.clipIntersection = true;
  colliderGrabBefore.material.clipShadows = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC clippingPlanes/clipIntersection/clipShadows color-only MeshBasic");
  assert.equal(mapped.clippingPlanes, mappedPlanes, "mapped MeshBasic stays authored clippingPlanes");
  assert.equal(mapped.clipIntersection, true, "mapped MeshBasic stays authored clipIntersection");
  assert.equal(mapped.clipShadows, true, "mapped MeshBasic stays authored clipShadows");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.clippingPlanes, colliderPlanes, "collider MeshBasic stays authored clippingPlanes");
  assert.equal(colliderGrab.material.clipIntersection, true, "collider MeshBasic stays authored clipIntersection");
  assert.equal(colliderGrab.material.clipShadows, true, "collider MeshBasic stays authored clipShadows");
});

test("packaged ingest pins r170 alphaHash/forceSinglePass defaults; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.alphaHash, false, "r170 MeshBasicMaterial defaults alphaHash false");
  assert.equal(fresh.forceSinglePass, false, "r170 MeshBasicMaterial defaults forceSinglePass false");
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    alphaHash: true,
    forceSinglePass: true,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    alphaHash: true,
    forceSinglePass: true,
  });
  const wrongMesh = boxMesh("dccAlphaHashOn", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.alphaHash = true;
  colliderGrabBefore.material.forceSinglePass = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC alphaHash/forceSinglePass color-only MeshBasic");
  assert.equal(mapped.alphaHash, true, "mapped MeshBasic stays authored alphaHash");
  assert.equal(mapped.forceSinglePass, true, "mapped MeshBasic stays authored forceSinglePass");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.alphaHash, true, "collider MeshBasic stays authored alphaHash");
  assert.equal(colliderGrab.material.forceSinglePass, true, "collider MeshBasic stays authored forceSinglePass");
});

test("packaged ingest pins r170 NormalBlending factor/equation companions; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.blendSrc, THREE.SrcAlphaFactor, "r170 MeshBasicMaterial defaults SrcAlphaFactor");
  assert.equal(fresh.blendDst, THREE.OneMinusSrcAlphaFactor, "r170 MeshBasicMaterial defaults OneMinusSrcAlphaFactor");
  assert.equal(fresh.blendEquation, THREE.AddEquation, "r170 MeshBasicMaterial defaults AddEquation");
  assert.equal(fresh.blendSrcAlpha, null, "r170 MeshBasicMaterial defaults blendSrcAlpha null");
  assert.equal(fresh.blendDstAlpha, null, "r170 MeshBasicMaterial defaults blendDstAlpha null");
  assert.equal(fresh.blendEquationAlpha, null, "r170 MeshBasicMaterial defaults blendEquationAlpha null");
  assert.equal(THREE.SrcAlphaFactor, 204, "r170 SrcAlphaFactor is 204");
  assert.equal(THREE.OneMinusSrcAlphaFactor, 205, "r170 OneMinusSrcAlphaFactor is 205");
  assert.equal(THREE.AddEquation, 100, "r170 AddEquation is 100");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor,
    blendEquation: THREE.SubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.ZeroFactor,
    blendEquation: THREE.SubtractEquation,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.ZeroFactor,
    blendEquationAlpha: THREE.ReverseSubtractEquation,
  });
  const wrongMesh = boxMesh("dccBlendFactorsOn", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.blendSrc = THREE.OneFactor;
  colliderGrabBefore.material.blendDst = THREE.ZeroFactor;
  colliderGrabBefore.material.blendEquation = THREE.SubtractEquation;
  colliderGrabBefore.material.blendSrcAlpha = THREE.OneFactor;
  colliderGrabBefore.material.blendDstAlpha = THREE.ZeroFactor;
  colliderGrabBefore.material.blendEquationAlpha = THREE.ReverseSubtractEquation;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC NormalBlending companion leftovers color-only MeshBasic");
  assert.equal(mapped.blendSrc, THREE.OneFactor, "mapped MeshBasic stays authored blendSrc");
  assert.equal(mapped.blendDst, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDst");
  assert.equal(mapped.blendEquation, THREE.SubtractEquation, "mapped MeshBasic stays authored blendEquation");
  assert.equal(mapped.blendSrcAlpha, THREE.OneFactor, "mapped MeshBasic stays authored blendSrcAlpha");
  assert.equal(mapped.blendDstAlpha, THREE.ZeroFactor, "mapped MeshBasic stays authored blendDstAlpha");
  assert.equal(mapped.blendEquationAlpha, THREE.ReverseSubtractEquation, "mapped MeshBasic stays authored blendEquationAlpha");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.blendSrc, THREE.OneFactor, "collider MeshBasic stays authored blendSrc");
  assert.equal(colliderGrab.material.blendDst, THREE.ZeroFactor, "collider MeshBasic stays authored blendDst");
  assert.equal(colliderGrab.material.blendEquation, THREE.SubtractEquation, "collider MeshBasic stays authored blendEquation");
  assert.equal(colliderGrab.material.blendSrcAlpha, THREE.OneFactor, "collider MeshBasic stays authored blendSrcAlpha");
  assert.equal(colliderGrab.material.blendDstAlpha, THREE.ZeroFactor, "collider MeshBasic stays authored blendDstAlpha");
  assert.equal(colliderGrab.material.blendEquationAlpha, THREE.ReverseSubtractEquation, "collider MeshBasic stays authored blendEquationAlpha");
});

test("packaged ingest pins r170 vertexColors false; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.vertexColors, false, "r170 MeshBasicMaterial defaults vertexColors false");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    vertexColors: true,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    vertexColors: true,
  });
  const wrongMesh = boxMesh("dccVertexColorsOn", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.vertexColors = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC vertexColors leftover color-only MeshBasic");
  assert.equal(mapped.vertexColors, true, "mapped MeshBasic stays authored vertexColors");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.vertexColors, true, "collider MeshBasic stays authored vertexColors");
});

test("packaged ingest pins r170 precision null; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.precision, null, "r170 MeshBasicMaterial defaults precision null");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    precision: "highp",
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    precision: "highp",
  });
  const wrongMesh = boxMesh("dccPrecisionHighp", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.precision = "highp";

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC precision leftover color-only MeshBasic");
  assert.equal(mapped.precision, "highp", "mapped MeshBasic stays authored precision");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.precision, "highp", "collider MeshBasic stays authored precision");
});

test("packaged ingest pins r170 shadowSide null; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.shadowSide, null, "r170 MeshBasicMaterial defaults shadowSide null");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    shadowSide: THREE.FrontSide,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    shadowSide: THREE.DoubleSide,
  });
  const wrongMesh = boxMesh("dccShadowSideDouble", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.shadowSide = THREE.BackSide;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC shadowSide leftover color-only MeshBasic");
  assert.equal(mapped.shadowSide, THREE.FrontSide, "mapped MeshBasic stays authored shadowSide");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.shadowSide, THREE.BackSide, "collider MeshBasic stays authored shadowSide");
});

test("packaged ingest pins r170 Material visible true; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.visible, true, "r170 MeshBasicMaterial defaults visible true");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    visible: false,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    visible: false,
  });
  const wrongMesh = boxMesh("dccMaterialHidden", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.visible = false;
  const hiddenVisual = boxMesh("lodVisibleMesh", new THREE.MeshBasicMaterial({ color: 0xbe7e31 }));
  hiddenVisual.visible = false;
  groups[0][0].add(hiddenVisual);

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC visible leftover color-only MeshBasic");
  assert.equal(mapped.visible, false, "mapped MeshBasic stays authored visible");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(hiddenVisual.material.visible, true, "material pin sets material.visible true");
  assert.equal(hiddenVisual.visible, false, "material pin does not change mesh.visible");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.visible, false, "collider MeshBasic stays authored visible");
});

test("packaged ingest pins r170 MeshBasic envMap companions; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.combine, THREE.MultiplyOperation, "r170 MeshBasicMaterial defaults MultiplyOperation");
  assert.equal(fresh.reflectivity, 1, "r170 MeshBasicMaterial defaults reflectivity 1");
  assert.equal(fresh.refractionRatio, 0.98, "r170 MeshBasicMaterial defaults refractionRatio 0.98");
  assert.equal(fresh.envMap, null, "r170 MeshBasicMaterial defaults envMap null");
  assert.equal(THREE.MultiplyOperation, 0, "r170 MultiplyOperation is 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    combine: THREE.MixOperation,
    reflectivity: 0.25,
    refractionRatio: 0.5,
    lightMapIntensity: 0.25,
    aoMapIntensity: 0.5,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    combine: THREE.AddOperation,
    reflectivity: 0.4,
    refractionRatio: 0.7,
    lightMapIntensity: 0.4,
    aoMapIntensity: 0.25,
  });
  const wrongMesh = boxMesh("dccEnvMapCompanions", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.combine = THREE.MixOperation;
  colliderGrabBefore.material.reflectivity = 0.3;
  colliderGrabBefore.material.refractionRatio = 0.4;
  colliderGrabBefore.material.lightMapIntensity = 0.3;
  colliderGrabBefore.material.aoMapIntensity = 0.4;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.envMap, null, "color-only pin does not attach envMap");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC envMap companion leftover color-only MeshBasic");
  assert.equal(wrong.envMap, null, "color-only leftover still has no envMap");
  assert.equal(mapped.combine, THREE.MixOperation, "mapped MeshBasic stays authored combine");
  assert.equal(mapped.reflectivity, 0.25, "mapped MeshBasic stays authored reflectivity");
  assert.equal(mapped.refractionRatio, 0.5, "mapped MeshBasic stays authored refractionRatio");
  assert.equal(mapped.lightMapIntensity, 0.25, "mapped MeshBasic stays authored lightMapIntensity");
  assert.equal(mapped.aoMapIntensity, 0.5, "mapped MeshBasic stays authored aoMapIntensity");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.combine, THREE.MixOperation, "collider MeshBasic stays authored combine");
  assert.equal(colliderGrab.material.reflectivity, 0.3, "collider MeshBasic stays authored reflectivity");
  assert.equal(colliderGrab.material.refractionRatio, 0.4, "collider MeshBasic stays authored refractionRatio");
  assert.equal(colliderGrab.material.lightMapIntensity, 0.3, "collider MeshBasic stays authored lightMapIntensity");
  assert.equal(colliderGrab.material.aoMapIntensity, 0.4, "collider MeshBasic stays authored aoMapIntensity");
});

test("packaged ingest pins r170 MeshBasic map-intensity companions; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.lightMapIntensity, 1, "r170 MeshBasicMaterial defaults lightMapIntensity 1");
  assert.equal(fresh.aoMapIntensity, 1, "r170 MeshBasicMaterial defaults aoMapIntensity 1");
  assert.equal(fresh.lightMap, null, "r170 MeshBasicMaterial defaults lightMap null");
  assert.equal(fresh.aoMap, null, "r170 MeshBasicMaterial defaults aoMap null");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    lightMapIntensity: 0.25,
    aoMapIntensity: 0.5,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    lightMapIntensity: 0.4,
    aoMapIntensity: 0.25,
  });
  const wrongMesh = boxMesh("dccMapIntensityCompanions", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.lightMapIntensity = 0.3;
  colliderGrabBefore.material.aoMapIntensity = 0.4;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.lightMap, null, "color-only pin does not attach lightMap");
    assert.equal(mesh.material.aoMap, null, "color-only pin does not attach aoMap");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC map-intensity leftover color-only MeshBasic");
  assert.equal(wrong.lightMap, null, "color-only leftover still has no lightMap");
  assert.equal(wrong.aoMap, null, "color-only leftover still has no aoMap");
  assert.equal(mapped.lightMapIntensity, 0.25, "mapped MeshBasic stays authored lightMapIntensity");
  assert.equal(mapped.aoMapIntensity, 0.5, "mapped MeshBasic stays authored aoMapIntensity");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.lightMapIntensity, 0.3, "collider MeshBasic stays authored lightMapIntensity");
  assert.equal(colliderGrab.material.aoMapIntensity, 0.4, "collider MeshBasic stays authored aoMapIntensity");
});

test("packaged ingest pins r170 MeshBasic wireframeLinewidth; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.wireframeLinewidth, 1, "r170 MeshBasicMaterial defaults wireframeLinewidth 1");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    wireframeLinewidth: 3,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    wireframeLinewidth: 2,
  });
  const wrongMesh = boxMesh("dccWireframeLinewidth", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.wireframeLinewidth = 4;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.wireframe, false, "color-only pin does not enable wireframe");
    assert.equal(mesh.material.wireframeLinewidth, 1, "color-only pin sets wireframeLinewidth 1");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC non-1 wireframeLinewidth color-only MeshBasic");
  assert.equal(wrong.wireframe, false, "color-only leftover still has wireframe false");
  assert.equal(wrong.wireframeLinewidth, 1, "DCC non-1 wireframeLinewidth is corrected to 1");
  assert.equal(mapped.wireframeLinewidth, 3, "mapped MeshBasic stays authored wireframeLinewidth");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.wireframeLinewidth, 4, "collider MeshBasic stays authored wireframeLinewidth");
});

test("packaged ingest pins r170 MeshBasic wireframe line style; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.wireframe, false, "r170 MeshBasicMaterial defaults wireframe false");
  assert.equal(fresh.wireframeLinecap, "round", "r170 MeshBasicMaterial defaults wireframeLinecap round");
  assert.equal(fresh.wireframeLinejoin, "round", "r170 MeshBasicMaterial defaults wireframeLinejoin round");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    wireframeLinecap: "square",
    wireframeLinejoin: "bevel",
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    wireframeLinecap: "butt",
    wireframeLinejoin: "miter",
  });
  const wrongMesh = boxMesh("dccWireframeLineStyle", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.wireframeLinecap = "square";
  colliderGrabBefore.material.wireframeLinejoin = "bevel";

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.wireframe, false, "color-only pin does not enable wireframe");
    assert.equal(mesh.material.wireframeLinecap, "round", "color-only pin sets wireframeLinecap round");
    assert.equal(mesh.material.wireframeLinejoin, "round", "color-only pin sets wireframeLinejoin round");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC non-round linecap/linejoin color-only MeshBasic");
  assert.equal(wrong.wireframe, false, "color-only leftover still has wireframe false");
  assert.equal(wrong.wireframeLinecap, "round", "DCC non-round wireframeLinecap is corrected to round");
  assert.equal(wrong.wireframeLinejoin, "round", "DCC non-round wireframeLinejoin is corrected to round");
  assert.equal(mapped.wireframeLinecap, "square", "mapped MeshBasic stays authored wireframeLinecap");
  assert.equal(mapped.wireframeLinejoin, "bevel", "mapped MeshBasic stays authored wireframeLinejoin");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.wireframeLinecap, "square", "collider MeshBasic stays authored wireframeLinecap");
  assert.equal(colliderGrab.material.wireframeLinejoin, "bevel", "collider MeshBasic stays authored wireframeLinejoin");
});

test("packaged ingest pins r170 MeshBasic envMapRotation; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.envMap, null, "r170 MeshBasicMaterial defaults envMap null");
  assert.equal(fresh.envMapRotation.x, 0, "r170 MeshBasicMaterial defaults envMapRotation.x 0");
  assert.equal(fresh.envMapRotation.y, 0, "r170 MeshBasicMaterial defaults envMapRotation.y 0");
  assert.equal(fresh.envMapRotation.z, 0, "r170 MeshBasicMaterial defaults envMapRotation.z 0");
  assert.equal(fresh.envMapRotation.order, "XYZ", "r170 MeshBasicMaterial defaults envMapRotation.order XYZ");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  mapped.envMapRotation.x = 0.4;
  mapped.envMapRotation.y = 0.8;
  mapped.envMapRotation.z = -0.2;
  mapped.envMapRotation.order = "YXZ";
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongRotation = wrong.envMapRotation;
  wrong.envMapRotation.x = 0.5;
  wrong.envMapRotation.y = 1.2;
  wrong.envMapRotation.z = -0.4;
  wrong.envMapRotation.order = "ZYX";
  const wrongMesh = boxMesh("dccEnvMapRotation", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.envMapRotation.x = 0.15;
  colliderGrabBefore.material.envMapRotation.y = 0.25;
  colliderGrabBefore.material.envMapRotation.z = 0.35;
  colliderGrabBefore.material.envMapRotation.order = "YZX";

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.wireframe, false, "color-only pin does not enable wireframe");
    assert.equal(mesh.material.envMap, null, "color-only pin does not force envMap");
    assert.equal(mesh.material.envMapRotation.x, 0, "color-only pin sets envMapRotation.x 0");
    assert.equal(mesh.material.envMapRotation.y, 0, "color-only pin sets envMapRotation.y 0");
    assert.equal(mesh.material.envMapRotation.z, 0, "color-only pin sets envMapRotation.z 0");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC non-zero envMapRotation color-only MeshBasic");
  assert.equal(wrong.envMapRotation, wrongRotation, "DCC leftover keeps its Euler instance");
  assert.equal(wrong.wireframe, false, "color-only leftover still has wireframe false");
  assert.equal(wrong.envMap, null, "DCC leftover envMap stays null");
  assert.equal(wrong.envMapRotation.x, 0, "DCC non-zero envMapRotation.x is corrected to 0");
  assert.equal(wrong.envMapRotation.y, 0, "DCC non-zero envMapRotation.y is corrected to 0");
  assert.equal(wrong.envMapRotation.z, 0, "DCC non-zero envMapRotation.z is corrected to 0");
  assert.equal(wrong.envMapRotation.order, "XYZ", "DCC leftover envMapRotation.order is corrected to XYZ");
  assert.equal(mapped.envMapRotation.x, 0.4, "mapped MeshBasic stays authored envMapRotation.x");
  assert.equal(mapped.envMapRotation.y, 0.8, "mapped MeshBasic stays authored envMapRotation.y");
  assert.equal(mapped.envMapRotation.z, -0.2, "mapped MeshBasic stays authored envMapRotation.z");
  assert.equal(mapped.envMapRotation.order, "YXZ", "mapped MeshBasic stays authored envMapRotation.order");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.envMapRotation.x, 0.15, "collider MeshBasic stays authored envMapRotation.x");
  assert.equal(colliderGrab.material.envMapRotation.y, 0.25, "collider MeshBasic stays authored envMapRotation.y");
  assert.equal(colliderGrab.material.envMapRotation.z, 0.35, "collider MeshBasic stays authored envMapRotation.z");
  assert.equal(colliderGrab.material.envMapRotation.order, "YZX", "collider MeshBasic stays authored envMapRotation.order");
});

test("packaged ingest pins castShadow/receiveShadow off on color-only meshes; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.castShadow, false, "r170 Mesh defaults castShadow false");
  assert.equal(fresh.receiveShadow, false, "r170 Mesh defaults receiveShadow false");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.castShadow = true;
  mappedMesh.receiveShadow = true;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccShadowOn", wrong);
  wrongMesh.castShadow = true;
  wrongMesh.receiveShadow = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.castShadow = true;
  colliderGrabBefore.receiveShadow = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitShadowFlags(wrongMesh, "packaged DCC shadow-on color-only Mesh");
  assert.equal(mappedMesh.castShadow, true, "mapped MeshBasic stays authored castShadow");
  assert.equal(mappedMesh.receiveShadow, true, "mapped MeshBasic stays authored receiveShadow");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.castShadow, true, "collider Mesh stays authored castShadow");
  assert.equal(colliderGrab.receiveShadow, true, "collider Mesh stays authored receiveShadow");
});

test("packaged ingest without lod groups still pins color-only Mesh shadow flags", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitShadowFlags(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitShadowFlags(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitShadowFlags(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitShadowFlags(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitShadowFlags(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.castShadow, false);
  assert.equal(colliderGrab.receiveShadow, false);
});

test("packaged ingest pins frustumCulled true on color-only meshes; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.frustumCulled, true, "r170 Mesh defaults frustumCulled true");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.frustumCulled = false;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccFrustumOff", wrong);
  wrongMesh.frustumCulled = false;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.frustumCulled = false;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitFrustumCulled(wrongMesh, "packaged DCC frustumCulled-off color-only Mesh");
  assert.equal(mappedMesh.frustumCulled, false, "mapped MeshBasic stays authored frustumCulled");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.frustumCulled, false, "collider Mesh stays authored frustumCulled");
});

test("packaged ingest without lod groups still pins color-only Mesh frustumCulled", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFrustumCulled(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitFrustumCulled(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitFrustumCulled(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitFrustumCulled(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitFrustumCulled(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.frustumCulled, true, "fail-soft collider keeps r170 frustumCulled default");
});

test("packaged ingest pins renderOrder 0 on color-only meshes; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(fresh.renderOrder, 0, "r170 Mesh defaults renderOrder 0");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.renderOrder = 2;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccRenderOrder", wrong);
  wrongMesh.renderOrder = 3;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.renderOrder = 4;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
  }
  assertQuestSafeUnlitRenderOrder(wrongMesh, "packaged DCC renderOrder leftover color-only Mesh");
  assert.equal(mappedMesh.renderOrder, 2, "mapped MeshBasic stays authored renderOrder");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.renderOrder, 4, "collider Mesh stays authored renderOrder");
});

test("packaged ingest without lod groups still pins color-only Mesh renderOrder", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitRenderOrder(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitRenderOrder(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitRenderOrder(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitRenderOrder(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitRenderOrder(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.renderOrder, 0, "fail-soft collider keeps r170 renderOrder default");
});

test("packaged ingest pins r170 Object3D layers default; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170Object3DLayersDefault(fresh, "r170 Mesh");
  assertR170Object3DLayersDefault(freshObj, "r170 Object3D");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.layers.enable(2);
  const mappedMask = mappedMesh.layers.mask;
  const mappedLayers = mappedMesh.layers;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccLayers", wrong);
  const wrongLayers = wrongMesh.layers;
  wrongMesh.layers.enable(3);
  wrongMesh.layers.enable(5);
  const matrixAutoBefore = wrongMesh.matrixAutoUpdate;
  const matrixWorldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const visibleBefore = wrongMesh.visible;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.layers.enable(4);
  const colliderMask = colliderGrabBefore.layers.mask;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitLayers(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.envMapRotation.x, 0, "prior envMapRotation pin stays intact");
  }
  assertQuestSafeUnlitLayers(wrongMesh, "packaged DCC leftover layers color-only Mesh");
  assert.equal(wrongMesh.layers, wrongLayers, "DCC leftover keeps its Layers instance");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; layers pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, matrixWorldAutoBefore, "layers pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "layers pin does not change mesh.visible");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; layers pin does not freeze it");
  assert.equal(matrixAutoBefore, true, "pre-ingest DCC leftover started matrix-live");
  assert.equal(mappedMesh.layers.mask, mappedMask, "mapped MeshBasic stays authored layers");
  assert.equal(mappedMesh.layers, mappedLayers, "mapped MeshBasic keeps its Layers instance");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.layers.mask, colliderMask, "collider Mesh stays authored layers");
});

test("packaged ingest without lod groups still pins color-only Mesh layers", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitLayers(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitLayers(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitLayers(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitLayers(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitLayers(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DLayersDefault(colliderGrab, "fail-soft collider keeps r170 layers default");
});

test("packaged ingest pins r170 Material blendColor/blendAlpha; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.blending, THREE.NormalBlending, "r170 MeshBasicMaterial defaults NormalBlending");
  assert.ok(fresh.blendColor, "r170 MeshBasicMaterial has blendColor");
  assert.equal(fresh.blendColor.isColor, true, "r170 blendColor is Color");
  assert.equal(fresh.blendColor.r, 0, "r170 MeshBasicMaterial defaults blendColor.r 0");
  assert.equal(fresh.blendColor.g, 0, "r170 MeshBasicMaterial defaults blendColor.g 0");
  assert.equal(fresh.blendColor.b, 0, "r170 MeshBasicMaterial defaults blendColor.b 0");
  assert.equal(fresh.blendAlpha, 0, "r170 MeshBasicMaterial defaults blendAlpha 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  mapped.blendColor.r = 0.3;
  mapped.blendColor.g = 0.6;
  mapped.blendColor.b = 0.9;
  mapped.blendAlpha = 0.45;
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongBlendColor = wrong.blendColor;
  wrong.blendColor.r = 0.25;
  wrong.blendColor.g = 0.5;
  wrong.blendColor.b = 0.75;
  wrong.blendAlpha = 0.4;
  const wrongMesh = boxMesh("dccBlendColor", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.blendColor.r = 0.12;
  colliderGrabBefore.material.blendColor.g = 0.22;
  colliderGrabBefore.material.blendColor.b = 0.32;
  colliderGrabBefore.material.blendAlpha = 0.18;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.blending, THREE.NormalBlending, "color-only pin does not enable CustomBlending");
    assert.equal(mesh.material.blendColor.r, 0, "color-only pin sets blendColor.r 0");
    assert.equal(mesh.material.blendColor.g, 0, "color-only pin sets blendColor.g 0");
    assert.equal(mesh.material.blendColor.b, 0, "color-only pin sets blendColor.b 0");
    assert.equal(mesh.material.blendAlpha, 0, "color-only pin sets blendAlpha 0");
    assert.equal(mesh.material.envMapRotation.x, 0, "prior envMapRotation pin stays intact");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC leftover blendColor/blendAlpha color-only MeshBasic");
  assert.equal(wrong.blendColor, wrongBlendColor, "DCC leftover keeps its Color instance");
  assert.equal(wrong.blending, THREE.NormalBlending, "color-only leftover still has NormalBlending");
  assert.equal(wrong.blendColor.r, 0, "DCC non-zero blendColor.r is corrected to 0");
  assert.equal(wrong.blendColor.g, 0, "DCC non-zero blendColor.g is corrected to 0");
  assert.equal(wrong.blendColor.b, 0, "DCC non-zero blendColor.b is corrected to 0");
  assert.equal(wrong.blendAlpha, 0, "DCC leftover blendAlpha is corrected to 0");
  assert.equal(mapped.blendColor.r, 0.3, "mapped MeshBasic stays authored blendColor.r");
  assert.equal(mapped.blendColor.g, 0.6, "mapped MeshBasic stays authored blendColor.g");
  assert.equal(mapped.blendColor.b, 0.9, "mapped MeshBasic stays authored blendColor.b");
  assert.equal(mapped.blendAlpha, 0.45, "mapped MeshBasic stays authored blendAlpha");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.blendColor.r, 0.12, "collider MeshBasic stays authored blendColor.r");
  assert.equal(colliderGrab.material.blendColor.g, 0.22, "collider MeshBasic stays authored blendColor.g");
  assert.equal(colliderGrab.material.blendColor.b, 0.32, "collider MeshBasic stays authored blendColor.b");
  assert.equal(colliderGrab.material.blendAlpha, 0.18, "collider MeshBasic stays authored blendAlpha");
});

test("packaged ingest pins r170 Material dithering/alphaToCoverage; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.dithering, false, "r170 MeshBasicMaterial defaults dithering false");
  assert.equal(fresh.alphaToCoverage, false, "r170 MeshBasicMaterial defaults alphaToCoverage false");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    dithering: true,
    alphaToCoverage: true,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    dithering: true,
    alphaToCoverage: true,
  });
  const wrongMesh = boxMesh("dccDithering", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.dithering = true;
  colliderGrabBefore.material.alphaToCoverage = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.dithering, false, "color-only pin sets dithering false");
    assert.equal(mesh.material.alphaToCoverage, false, "color-only pin sets alphaToCoverage false");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC leftover dithering/A2C color-only MeshBasic");
  assert.equal(wrong.dithering, false, "DCC leftover dithering is corrected to false");
  assert.equal(wrong.alphaToCoverage, false, "DCC leftover alphaToCoverage is corrected to false");
  assert.equal(mapped.dithering, true, "mapped MeshBasic stays authored dithering");
  assert.equal(mapped.alphaToCoverage, true, "mapped MeshBasic stays authored alphaToCoverage");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.dithering, true, "collider MeshBasic stays authored dithering");
  assert.equal(colliderGrab.material.alphaToCoverage, true, "collider MeshBasic stays authored alphaToCoverage");
});

test("packaged ingest without lod groups still pins color-only MeshBasic dithering/alphaToCoverage", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.dithering = true;
  visualMeshes(body)[0].material.alphaToCoverage = true;
  visualMeshes(lid)[0].material.dithering = true;
  visualMeshes(lid)[0].material.alphaToCoverage = true;
  visualMeshes(latch)[0].material.dithering = true;
  visualMeshes(latch)[0].material.alphaToCoverage = true;
  visualMeshes(tool)[0].material.dithering = true;
  visualMeshes(tool)[0].material.alphaToCoverage = true;
  fastener.material.dithering = true;
  fastener.material.alphaToCoverage = true;
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitFlags(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitFlags(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitFlags(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitFlags(fastener.material, "fail-soft fastener");
  assert.equal(visualMeshes(body)[0].material.dithering, false, "fail-soft body pins dithering false");
  assert.equal(visualMeshes(body)[0].material.alphaToCoverage, false, "fail-soft body pins alphaToCoverage false");
  assert.equal(fastener.material.dithering, false, "fail-soft fastener pins dithering false");
  assert.equal(fastener.material.alphaToCoverage, false, "fail-soft fastener pins alphaToCoverage false");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.dithering, false, "fail-soft collider stays r170 dithering default");
  assert.equal(colliderGrab.material.alphaToCoverage, false, "fail-soft collider stays r170 alphaToCoverage default");
});

test("packaged ingest pins r170 Object3D matrixWorldAutoUpdate; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(fresh.matrixWorldAutoUpdate, true, "r170 Mesh defaults matrixWorldAutoUpdate true");
  assert.equal(freshObj.matrixWorldAutoUpdate, true, "r170 Object3D defaults matrixWorldAutoUpdate true");
  assert.equal(THREE.Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, true, "r170 DEFAULT_MATRIX_WORLD_AUTO_UPDATE is true");
  assertR170Object3DMatrixWorldAutoUpdateDefault(fresh, "r170 Mesh");
  assertR170Object3DMatrixWorldAutoUpdateDefault(freshObj, "r170 Object3D");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.matrixWorldAutoUpdate = false;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccMatrixWorldAuto", wrong);
  wrongMesh.matrixWorldAutoUpdate = false;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.matrixWorldAutoUpdate = false;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitLayers(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
  }
  assertQuestSafeUnlitMatrixWorldAutoUpdate(wrongMesh, "packaged DCC leftover matrixWorldAutoUpdate color-only Mesh");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; matrixWorldAutoUpdate pin does not unfreeze");
  assert.equal(wrongMesh.visible, visibleBefore, "matrixWorldAutoUpdate pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "matrixWorldAutoUpdate pin does not change layers");
  assert.equal(wrong.blendColor, blendColorBefore, "matrixWorldAutoUpdate pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "matrixWorldAutoUpdate pin does not change blendAlpha");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; matrixWorldAutoUpdate pin does not freeze it");
  assert.equal(fastener.matrixWorldAutoUpdate, true, "fastener world-matrix auto-update stays on");
  assert.equal(mappedMesh.matrixWorldAutoUpdate, false, "mapped MeshBasic stays authored matrixWorldAutoUpdate");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.matrixWorldAutoUpdate, false, "collider Mesh stays authored matrixWorldAutoUpdate");
});

test("packaged ingest without lod groups still pins color-only Mesh matrixWorldAutoUpdate", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitMatrixWorldAutoUpdate(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitMatrixWorldAutoUpdate(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DMatrixWorldAutoUpdateDefault(colliderGrab, "fail-soft collider keeps r170 matrixWorldAutoUpdate default");
});

test("packaged ingest pins r170 Object3D up; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(THREE.Object3D.DEFAULT_UP.x, 0, "r170 Object3D.DEFAULT_UP.x is 0");
  assert.equal(THREE.Object3D.DEFAULT_UP.y, 1, "r170 Object3D.DEFAULT_UP.y is 1");
  assert.equal(THREE.Object3D.DEFAULT_UP.z, 0, "r170 Object3D.DEFAULT_UP.z is 0");
  assert.ok(fresh.up.equals(THREE.Object3D.DEFAULT_UP), "r170 Mesh.up equals Object3D.DEFAULT_UP");
  assert.ok(freshObj.up.equals(THREE.Object3D.DEFAULT_UP), "r170 Object3D.up equals Object3D.DEFAULT_UP");
  assertR170Object3DUpDefault(fresh, "r170 Mesh");
  assertR170Object3DUpDefault(freshObj, "r170 Object3D");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.up.set(0, 0, 1);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccUp", wrong);
  const upBefore = wrongMesh.up;
  wrongMesh.up.set(0, 0, 1);
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.up.set(0, 0, 1);

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitUp(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitLayers(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
  }
  assertQuestSafeUnlitUp(wrongMesh, "packaged DCC leftover up color-only Mesh");
  assert.equal(wrongMesh.up, upBefore, "DCC leftover keeps its Vector3 instance");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; up pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "up pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "up pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "up pin does not change layers");
  assert.equal(wrong.blendColor, blendColorBefore, "up pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "up pin does not change blendAlpha");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; up pin does not freeze it");
  assert.equal(fastener.matrixWorldAutoUpdate, true, "fastener world-matrix auto-update stays on");
  assertQuestSafeUnlitUp(fastener, "fastener");
  assert.equal(mappedMesh.up.x, 0, "mapped MeshBasic stays authored up.x");
  assert.equal(mappedMesh.up.y, 0, "mapped MeshBasic stays authored up.y");
  assert.equal(mappedMesh.up.z, 1, "mapped MeshBasic stays authored up.z");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.up.x, 0, "collider Mesh stays authored up.x");
  assert.equal(colliderGrab.up.y, 0, "collider Mesh stays authored up.y");
  assert.equal(colliderGrab.up.z, 1, "collider Mesh stays authored up.z");
});

test("packaged ingest without lod groups still pins color-only Mesh up", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitUp(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitUp(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitUp(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitUp(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitUp(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DUpDefault(colliderGrab, "fail-soft collider keeps r170 up default");
});

test("packaged ingest pins r170 Object3D scale; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(fresh.scale.x, 1, "r170 Mesh.scale.x is 1");
  assert.equal(fresh.scale.y, 1, "r170 Mesh.scale.y is 1");
  assert.equal(fresh.scale.z, 1, "r170 Mesh.scale.z is 1");
  assert.equal(freshObj.scale.x, 1, "r170 Object3D.scale.x is 1");
  assert.equal(freshObj.scale.y, 1, "r170 Object3D.scale.y is 1");
  assert.equal(freshObj.scale.z, 1, "r170 Object3D.scale.z is 1");
  assertR170Object3DScaleDefault(fresh, "r170 Mesh");
  assertR170Object3DScaleDefault(freshObj, "r170 Object3D");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.scale.set(2, 2, 2);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccScale", wrong);
  const scaleBefore = wrongMesh.scale;
  wrongMesh.scale.set(1, -1, 1);
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const upBefore = wrongMesh.up.clone();
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.scale.set(2, 2, 2);

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitScale(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitUp(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitLayers(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
  }
  assertQuestSafeUnlitScale(wrongMesh, "packaged DCC leftover scale color-only Mesh");
  assert.equal(wrongMesh.scale, scaleBefore, "DCC leftover keeps its Vector3 instance");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; scale pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "scale pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "scale pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "scale pin does not change layers");
  assert.equal(wrongMesh.up.x, upBefore.x, "scale pin does not change up.x");
  assert.equal(wrongMesh.up.y, upBefore.y, "scale pin does not change up.y");
  assert.equal(wrongMesh.up.z, upBefore.z, "scale pin does not change up.z");
  assert.equal(wrong.blendColor, blendColorBefore, "scale pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "scale pin does not change blendAlpha");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; scale pin does not freeze it");
  assert.equal(fastener.matrixWorldAutoUpdate, true, "fastener world-matrix auto-update stays on");
  assertQuestSafeUnlitScale(fastener, "fastener");
  assert.equal(mappedMesh.scale.x, 2, "mapped MeshBasic stays authored scale.x");
  assert.equal(mappedMesh.scale.y, 2, "mapped MeshBasic stays authored scale.y");
  assert.equal(mappedMesh.scale.z, 2, "mapped MeshBasic stays authored scale.z");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.scale.x, 2, "collider Mesh stays authored scale.x");
  assert.equal(colliderGrab.scale.y, 2, "collider Mesh stays authored scale.y");
  assert.equal(colliderGrab.scale.z, 2, "collider Mesh stays authored scale.z");
});

test("packaged ingest without lod groups still pins color-only Mesh scale", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitScale(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitScale(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitScale(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitScale(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitScale(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DScaleDefault(colliderGrab, "fail-soft collider keeps r170 scale default");
});

test("packaged ingest pins r170 Object3D rotation.order XYZ; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  const freshObj = new THREE.Object3D();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(fresh.rotation.order, "XYZ", "r170 Mesh.rotation.order is XYZ");
  assert.equal(freshObj.rotation.order, "XYZ", "r170 Object3D.rotation.order is XYZ");
  assertR170Object3DRotationOrderDefault(fresh, "r170 Mesh");
  assertR170Object3DRotationOrderDefault(freshObj, "r170 Object3D");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.rotation.set(0.1, 0.2, 0.3, "YXZ");
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccRotationOrder", wrong);
  const rotationBefore = wrongMesh.rotation;
  const quatBefore = wrongMesh.quaternion;
  wrongMesh.rotation.set(0.25, -0.5, 0.75, "YXZ");
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const upBefore = wrongMesh.up.clone();
  const scaleBefore = wrongMesh.scale.clone();
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.rotation.order = "ZYX";

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitScale(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitUp(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMatrixWorldAutoUpdate(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitLayers(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFrustumCulled(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
  }
  assertQuestSafeUnlitRotationOrder(wrongMesh, "packaged DCC leftover rotation.order color-only Mesh");
  assert.equal(wrongMesh.rotation, rotationBefore, "DCC leftover keeps its Euler instance");
  assert.equal(wrongMesh.quaternion, quatBefore, "DCC leftover keeps its quaternion instance");
  assert.equal(wrongMesh.rotation.x, 0.25, "DCC leftover keeps authored rotation.x");
  assert.equal(wrongMesh.rotation.y, -0.5, "DCC leftover keeps authored rotation.y");
  assert.equal(wrongMesh.rotation.z, 0.75, "DCC leftover keeps authored rotation.z");
  assert.ok(
    wrongMesh.quaternion.x !== 0 || wrongMesh.quaternion.y !== 0 || wrongMesh.quaternion.z !== 0 || wrongMesh.quaternion.w !== 1,
    "rotation-order pin does not force identity quaternion"
  );
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; rotation-order pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "rotation-order pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "rotation-order pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "rotation-order pin does not change layers");
  assert.equal(wrongMesh.up.x, upBefore.x, "rotation-order pin does not change up.x");
  assert.equal(wrongMesh.up.y, upBefore.y, "rotation-order pin does not change up.y");
  assert.equal(wrongMesh.up.z, upBefore.z, "rotation-order pin does not change up.z");
  assert.equal(wrongMesh.scale.x, scaleBefore.x, "rotation-order pin does not change scale.x");
  assert.equal(wrongMesh.scale.y, scaleBefore.y, "rotation-order pin does not change scale.y");
  assert.equal(wrongMesh.scale.z, scaleBefore.z, "rotation-order pin does not change scale.z");
  assert.equal(wrong.blendColor, blendColorBefore, "rotation-order pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "rotation-order pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "rotation-order pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "rotation-order pin does not change alphaToCoverage");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; rotation-order pin does not freeze it");
  assert.equal(fastener.matrixWorldAutoUpdate, true, "fastener world-matrix auto-update stays on");
  assertQuestSafeUnlitRotationOrder(fastener, "fastener");
  assert.equal(mappedMesh.rotation.order, "YXZ", "mapped MeshBasic stays authored rotation.order");
  assert.equal(mappedMesh.rotation.x, 0.1, "mapped MeshBasic stays authored rotation.x");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.rotation.order, "ZYX", "collider Mesh stays authored rotation.order");
});

test("packaged ingest without lod groups still pins color-only Mesh rotation.order", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].rotation.set(0.1, 0.2, 0.3, "YXZ");
  visualMeshes(lid)[0].rotation.order = "ZYX";
  visualMeshes(latch)[0].rotation.order = "YZX";
  visualMeshes(tool)[0].rotation.order = "XZY";
  fastener.rotation.order = "YXZ";
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitRotationOrder(visualMeshes(body)[0], "fail-soft body");
  assert.equal(visualMeshes(body)[0].rotation.x, 0.1, "fail-soft body keeps authored rotation.x");
  assert.equal(visualMeshes(body)[0].rotation.y, 0.2, "fail-soft body keeps authored rotation.y");
  assert.equal(visualMeshes(body)[0].rotation.z, 0.3, "fail-soft body keeps authored rotation.z");
  assertQuestSafeUnlitRotationOrder(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitRotationOrder(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitRotationOrder(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitRotationOrder(fastener, "fail-soft fastener");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DRotationOrderDefault(colliderGrab, "fail-soft collider keeps r170 rotation.order default");
});

test("packaged ingest pins r170 Material polygonOffset companions; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.polygonOffset, false, "r170 MeshBasicMaterial defaults polygonOffset false");
  assert.equal(fresh.polygonOffsetFactor, 0, "r170 MeshBasicMaterial defaults polygonOffsetFactor 0");
  assert.equal(fresh.polygonOffsetUnits, 0, "r170 MeshBasicMaterial defaults polygonOffsetUnits 0");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    polygonOffset: false,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const wrongMesh = boxMesh("dccPolygonOffsetCompanions", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.polygonOffset = true;
  colliderGrabBefore.material.polygonOffsetFactor = 1;
  colliderGrabBefore.material.polygonOffsetUnits = 1;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.polygonOffset, false, "color-only pin sets polygonOffset false");
    assert.equal(mesh.material.polygonOffsetFactor, 0, "color-only pin sets polygonOffsetFactor 0");
    assert.equal(mesh.material.polygonOffsetUnits, 0, "color-only pin sets polygonOffsetUnits 0");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior alphaToCoverage pin stays intact");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC leftover polygonOffset companions color-only MeshBasic");
  assert.equal(wrong.polygonOffset, false, "DCC leftover polygonOffset stays false; pin does not enable it");
  assert.equal(wrong.polygonOffsetFactor, 0, "DCC leftover polygonOffsetFactor is corrected to 0");
  assert.equal(wrong.polygonOffsetUnits, 0, "DCC leftover polygonOffsetUnits is corrected to 0");
  assert.equal(mapped.polygonOffset, true, "mapped MeshBasic stays authored polygonOffset");
  assert.equal(mapped.polygonOffsetFactor, 1, "mapped MeshBasic stays authored polygonOffsetFactor");
  assert.equal(mapped.polygonOffsetUnits, 1, "mapped MeshBasic stays authored polygonOffsetUnits");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.polygonOffset, true, "collider MeshBasic stays authored polygonOffset");
  assert.equal(colliderGrab.material.polygonOffsetFactor, 1, "collider MeshBasic stays authored polygonOffsetFactor");
  assert.equal(colliderGrab.material.polygonOffsetUnits, 1, "collider MeshBasic stays authored polygonOffsetUnits");
});

test("packaged ingest without lod groups still pins color-only MeshBasic polygonOffset companions", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.polygonOffsetFactor = 1;
  visualMeshes(body)[0].material.polygonOffsetUnits = 1;
  visualMeshes(lid)[0].material.polygonOffsetFactor = 2;
  visualMeshes(lid)[0].material.polygonOffsetUnits = 2;
  visualMeshes(latch)[0].material.polygonOffsetFactor = 1;
  visualMeshes(latch)[0].material.polygonOffsetUnits = 1;
  visualMeshes(tool)[0].material.polygonOffsetFactor = 3;
  visualMeshes(tool)[0].material.polygonOffsetUnits = 3;
  fastener.material.polygonOffsetFactor = 1;
  fastener.material.polygonOffsetUnits = 1;
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitFlags(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitFlags(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitFlags(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitFlags(fastener.material, "fail-soft fastener");
  assert.equal(visualMeshes(body)[0].material.polygonOffset, false, "fail-soft body pins polygonOffset false");
  assert.equal(visualMeshes(body)[0].material.polygonOffsetFactor, 0, "fail-soft body pins polygonOffsetFactor 0");
  assert.equal(visualMeshes(body)[0].material.polygonOffsetUnits, 0, "fail-soft body pins polygonOffsetUnits 0");
  assert.equal(fastener.material.polygonOffset, false, "fail-soft fastener pins polygonOffset false");
  assert.equal(fastener.material.polygonOffsetFactor, 0, "fail-soft fastener pins polygonOffsetFactor 0");
  assert.equal(fastener.material.polygonOffsetUnits, 0, "fail-soft fastener pins polygonOffsetUnits 0");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.polygonOffset, false, "fail-soft collider stays r170 polygonOffset default");
  assert.equal(colliderGrab.material.polygonOffsetFactor, 0, "fail-soft collider stays r170 polygonOffsetFactor default");
  assert.equal(colliderGrab.material.polygonOffsetUnits, 0, "fail-soft collider stays r170 polygonOffsetUnits default");
});

test("packaged ingest pins r170 Material stencil companions; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.stencilWrite, false, "r170 MeshBasicMaterial defaults stencilWrite false");
  assert.equal(fresh.stencilRef, 0, "r170 MeshBasicMaterial defaults stencilRef 0");
  assert.equal(fresh.stencilWriteMask, 0xff, "r170 MeshBasicMaterial defaults stencilWriteMask 0xff");
  assert.equal(fresh.stencilFuncMask, 0xff, "r170 MeshBasicMaterial defaults stencilFuncMask 0xff");
  assert.equal(fresh.stencilZFail, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZFail Keep");
  assert.equal(fresh.stencilZPass, THREE.KeepStencilOp, "r170 MeshBasicMaterial defaults stencilZPass Keep");
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    stencilWrite: true,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    stencilWrite: false,
    stencilRef: 1,
    stencilWriteMask: 0x0f,
    stencilFuncMask: 0x0f,
    stencilZFail: THREE.IncrementStencilOp,
    stencilZPass: THREE.DecrementStencilOp,
  });
  const wrongMesh = boxMesh("dccStencilCompanions", wrong);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.stencilWrite = true;
  colliderGrabBefore.material.stencilRef = 1;
  colliderGrabBefore.material.stencilWriteMask = 0x0f;
  colliderGrabBefore.material.stencilFuncMask = 0x0f;
  colliderGrabBefore.material.stencilZFail = THREE.IncrementStencilOp;
  colliderGrabBefore.material.stencilZPass = THREE.DecrementStencilOp;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.material.stencilWrite, false, "color-only pin sets stencilWrite false");
    assert.equal(mesh.material.stencilRef, 0, "color-only pin sets stencilRef 0");
    assert.equal(mesh.material.stencilWriteMask, 0xff, "color-only pin sets stencilWriteMask 0xff");
    assert.equal(mesh.material.stencilFuncMask, 0xff, "color-only pin sets stencilFuncMask 0xff");
    assert.equal(mesh.material.stencilZFail, THREE.KeepStencilOp, "color-only pin sets stencilZFail Keep");
    assert.equal(mesh.material.stencilZPass, THREE.KeepStencilOp, "color-only pin sets stencilZPass Keep");
    assert.equal(mesh.material.polygonOffsetFactor, 0, "prior polygonOffsetFactor pin stays intact");
    assert.equal(mesh.material.polygonOffsetUnits, 0, "prior polygonOffsetUnits pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior alphaToCoverage pin stays intact");
    assert.equal(mesh.material.blendColor.r, 0, "prior blendColor pin stays intact");
    assert.equal(mesh.material.blendAlpha, 0, "prior blendAlpha pin stays intact");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assertQuestSafeUnlitFlags(wrong, "packaged DCC leftover stencil companions color-only MeshBasic");
  assert.equal(wrong.stencilWrite, false, "DCC leftover stencilWrite stays false; pin does not enable it");
  assert.equal(wrong.stencilRef, 0, "DCC leftover stencilRef is corrected to 0");
  assert.equal(wrong.stencilWriteMask, 0xff, "DCC leftover stencilWriteMask is corrected to 0xff");
  assert.equal(wrong.stencilFuncMask, 0xff, "DCC leftover stencilFuncMask is corrected to 0xff");
  assert.equal(wrong.stencilZFail, THREE.KeepStencilOp, "DCC leftover stencilZFail is corrected to Keep");
  assert.equal(wrong.stencilZPass, THREE.KeepStencilOp, "DCC leftover stencilZPass is corrected to Keep");
  assert.equal(mapped.stencilWrite, true, "mapped MeshBasic stays authored stencilWrite");
  assert.equal(mapped.stencilRef, 1, "mapped MeshBasic stays authored stencilRef");
  assert.equal(mapped.stencilWriteMask, 0x0f, "mapped MeshBasic stays authored stencilWriteMask");
  assert.equal(mapped.stencilFuncMask, 0x0f, "mapped MeshBasic stays authored stencilFuncMask");
  assert.equal(mapped.stencilZFail, THREE.IncrementStencilOp, "mapped MeshBasic stays authored stencilZFail");
  assert.equal(mapped.stencilZPass, THREE.DecrementStencilOp, "mapped MeshBasic stays authored stencilZPass");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.stencilWrite, true, "collider MeshBasic stays authored stencilWrite");
  assert.equal(colliderGrab.material.stencilRef, 1, "collider MeshBasic stays authored stencilRef");
  assert.equal(colliderGrab.material.stencilWriteMask, 0x0f, "collider MeshBasic stays authored stencilWriteMask");
  assert.equal(colliderGrab.material.stencilFuncMask, 0x0f, "collider MeshBasic stays authored stencilFuncMask");
  assert.equal(colliderGrab.material.stencilZFail, THREE.IncrementStencilOp, "collider MeshBasic stays authored stencilZFail");
  assert.equal(colliderGrab.material.stencilZPass, THREE.DecrementStencilOp, "collider MeshBasic stays authored stencilZPass");
});

test("packaged ingest without lod groups still pins color-only MeshBasic stencil companions", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.stencilRef = 1;
  visualMeshes(body)[0].material.stencilWriteMask = 0x0f;
  visualMeshes(body)[0].material.stencilFuncMask = 0x0f;
  visualMeshes(body)[0].material.stencilZFail = THREE.IncrementStencilOp;
  visualMeshes(body)[0].material.stencilZPass = THREE.DecrementStencilOp;
  visualMeshes(lid)[0].material.stencilRef = 2;
  visualMeshes(lid)[0].material.stencilWriteMask = 0x0f;
  visualMeshes(lid)[0].material.stencilFuncMask = 0x0f;
  visualMeshes(lid)[0].material.stencilZFail = THREE.IncrementStencilOp;
  visualMeshes(lid)[0].material.stencilZPass = THREE.DecrementStencilOp;
  visualMeshes(latch)[0].material.stencilRef = 1;
  visualMeshes(latch)[0].material.stencilWriteMask = 0x0f;
  visualMeshes(latch)[0].material.stencilFuncMask = 0x0f;
  visualMeshes(latch)[0].material.stencilZFail = THREE.IncrementStencilOp;
  visualMeshes(latch)[0].material.stencilZPass = THREE.DecrementStencilOp;
  visualMeshes(tool)[0].material.stencilRef = 3;
  visualMeshes(tool)[0].material.stencilWriteMask = 0x0f;
  visualMeshes(tool)[0].material.stencilFuncMask = 0x0f;
  visualMeshes(tool)[0].material.stencilZFail = THREE.IncrementStencilOp;
  visualMeshes(tool)[0].material.stencilZPass = THREE.DecrementStencilOp;
  fastener.material.stencilRef = 1;
  fastener.material.stencilWriteMask = 0x0f;
  fastener.material.stencilFuncMask = 0x0f;
  fastener.material.stencilZFail = THREE.IncrementStencilOp;
  fastener.material.stencilZPass = THREE.DecrementStencilOp;
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitFlags(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitFlags(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitFlags(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitFlags(fastener.material, "fail-soft fastener");
  assert.equal(visualMeshes(body)[0].material.stencilWrite, false, "fail-soft body pins stencilWrite false");
  assert.equal(visualMeshes(body)[0].material.stencilRef, 0, "fail-soft body pins stencilRef 0");
  assert.equal(visualMeshes(body)[0].material.stencilWriteMask, 0xff, "fail-soft body pins stencilWriteMask 0xff");
  assert.equal(visualMeshes(body)[0].material.stencilFuncMask, 0xff, "fail-soft body pins stencilFuncMask 0xff");
  assert.equal(visualMeshes(body)[0].material.stencilZFail, THREE.KeepStencilOp, "fail-soft body pins stencilZFail Keep");
  assert.equal(visualMeshes(body)[0].material.stencilZPass, THREE.KeepStencilOp, "fail-soft body pins stencilZPass Keep");
  assert.equal(fastener.material.stencilWrite, false, "fail-soft fastener pins stencilWrite false");
  assert.equal(fastener.material.stencilRef, 0, "fail-soft fastener pins stencilRef 0");
  assert.equal(fastener.material.stencilWriteMask, 0xff, "fail-soft fastener pins stencilWriteMask 0xff");
  assert.equal(fastener.material.stencilFuncMask, 0xff, "fail-soft fastener pins stencilFuncMask 0xff");
  assert.equal(fastener.material.stencilZFail, THREE.KeepStencilOp, "fastener pins stencilZFail Keep");
  assert.equal(fastener.material.stencilZPass, THREE.KeepStencilOp, "fastener pins stencilZPass Keep");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.stencilWrite, false, "fail-soft collider stays r170 stencilWrite default");
  assert.equal(colliderGrab.material.stencilRef, 0, "fail-soft collider stays r170 stencilRef default");
  assert.equal(colliderGrab.material.stencilWriteMask, 0xff, "fail-soft collider stays r170 stencilWriteMask default");
  assert.equal(colliderGrab.material.stencilFuncMask, 0xff, "fail-soft collider stays r170 stencilFuncMask default");
  assert.equal(colliderGrab.material.stencilZFail, THREE.KeepStencilOp, "fail-soft collider stays r170 stencilZFail default");
  assert.equal(colliderGrab.material.stencilZPass, THREE.KeepStencilOp, "fail-soft collider stays r170 stencilZPass default");
});

test("packaged ingest clears leftover Mesh customDepth/Distance; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal("customDepthMaterial" in fresh, false, "r170 Mesh does not define customDepthMaterial on the instance");
  assert.equal("customDistanceMaterial" in fresh, false, "r170 Mesh does not define customDistanceMaterial on the instance");
  assertR170MeshCustomShadowMaterialsAbsent(fresh, "r170 Mesh");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedDepth = { isMaterial: true, name: "mappedDepth" };
  const mappedDistance = { isMaterial: true, name: "mappedDistance" };
  mappedMesh.customDepthMaterial = mappedDepth;
  mappedMesh.customDistanceMaterial = mappedDistance;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccCustomShadowMaterials", wrong);
  const leftoverDepth = { isMaterial: true, name: "leftoverDepth" };
  const leftoverDistance = { isMaterial: true, name: "leftoverDistance" };
  wrongMesh.customDepthMaterial = leftoverDepth;
  wrongMesh.customDistanceMaterial = leftoverDistance;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderDepth = { isMaterial: true, name: "colliderDepth" };
  const colliderDistance = { isMaterial: true, name: "colliderDistance" };
  colliderGrabBefore.customDepthMaterial = colliderDepth;
  colliderGrabBefore.customDistanceMaterial = colliderDistance;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitCustomShadowMaterials(wrongMesh, "packaged DCC leftover customDepth/Distance color-only Mesh");
  assert.notEqual(wrongMesh.customDepthMaterial, leftoverDepth, "DCC leftover customDepthMaterial stub is cleared");
  assert.notEqual(wrongMesh.customDistanceMaterial, leftoverDistance, "DCC leftover customDistanceMaterial stub is cleared");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; custom-shadow pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "custom-shadow pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "custom-shadow pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "custom-shadow pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "custom-shadow pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "custom-shadow pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "custom-shadow pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "custom-shadow pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "custom-shadow pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "custom-shadow pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; custom-shadow pin does not freeze it");
  assertQuestSafeUnlitCustomShadowMaterials(fastener, "fastener");
  assert.equal(mappedMesh.customDepthMaterial, mappedDepth, "mapped MeshBasic stays authored customDepthMaterial");
  assert.equal(mappedMesh.customDistanceMaterial, mappedDistance, "mapped MeshBasic stays authored customDistanceMaterial");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.customDepthMaterial, colliderDepth, "collider Mesh stays authored customDepthMaterial");
  assert.equal(colliderGrab.customDistanceMaterial, colliderDistance, "collider Mesh stays authored customDistanceMaterial");
});

test("packaged ingest without lod groups still clears leftover Mesh customDepth/Distance", () => {
  const leftover = () => ({ isMaterial: true });
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].customDepthMaterial = leftover();
  visualMeshes(body)[0].customDistanceMaterial = leftover();
  visualMeshes(lid)[0].customDepthMaterial = leftover();
  visualMeshes(lid)[0].customDistanceMaterial = leftover();
  visualMeshes(latch)[0].customDepthMaterial = leftover();
  visualMeshes(latch)[0].customDistanceMaterial = leftover();
  visualMeshes(tool)[0].customDepthMaterial = leftover();
  visualMeshes(tool)[0].customDistanceMaterial = leftover();
  fastener.customDepthMaterial = leftover();
  fastener.customDistanceMaterial = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitCustomShadowMaterials(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitCustomShadowMaterials(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitCustomShadowMaterials(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitCustomShadowMaterials(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitCustomShadowMaterials(fastener, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MeshCustomShadowMaterialsAbsent(colliderGrab, "fail-soft collider keeps r170 customDepth/Distance absence");
});

test("packaged ingest clears leftover Mesh onBefore/AfterRender; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(Object.hasOwn(fresh, "onBeforeRender"), false, "r170 Mesh does not define onBeforeRender on the instance");
  assert.equal(Object.hasOwn(fresh, "onAfterRender"), false, "r170 Mesh does not define onAfterRender on the instance");
  assertR170Object3DRenderCallbacksAbsent(fresh, "r170 Mesh");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedBefore = () => {};
  const mappedAfter = () => {};
  mappedMesh.onBeforeRender = mappedBefore;
  mappedMesh.onAfterRender = mappedAfter;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccRenderCallbacks", wrong);
  const leftoverBefore = () => {};
  const leftoverAfter = () => {};
  wrongMesh.onBeforeRender = leftoverBefore;
  wrongMesh.onAfterRender = leftoverAfter;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderBefore = () => {};
  const colliderAfter = () => {};
  colliderGrabBefore.onBeforeRender = colliderBefore;
  colliderGrabBefore.onAfterRender = colliderAfter;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitRenderCallbacks(wrongMesh, "packaged DCC leftover onBefore/AfterRender color-only Mesh");
  assert.notEqual(wrongMesh.onBeforeRender, leftoverBefore, "DCC leftover onBeforeRender stub is cleared");
  assert.notEqual(wrongMesh.onAfterRender, leftoverAfter, "DCC leftover onAfterRender stub is cleared");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "render-callback pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "render-callback pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; render-callback pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "render-callback pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "render-callback pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "render-callback pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "render-callback pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "render-callback pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "render-callback pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "render-callback pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "render-callback pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "render-callback pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; render-callback pin does not freeze it");
  assertQuestSafeUnlitRenderCallbacks(fastener, "fastener");
  assert.equal(mappedMesh.onBeforeRender, mappedBefore, "mapped MeshBasic stays authored onBeforeRender");
  assert.equal(mappedMesh.onAfterRender, mappedAfter, "mapped MeshBasic stays authored onAfterRender");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.onBeforeRender, colliderBefore, "collider Mesh stays authored onBeforeRender");
  assert.equal(colliderGrab.onAfterRender, colliderAfter, "collider Mesh stays authored onAfterRender");
});

test("packaged ingest without lod groups still clears leftover Mesh onBefore/AfterRender", () => {
  const leftover = () => () => {};
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].onBeforeRender = leftover();
  visualMeshes(body)[0].onAfterRender = leftover();
  visualMeshes(lid)[0].onBeforeRender = leftover();
  visualMeshes(lid)[0].onAfterRender = leftover();
  visualMeshes(latch)[0].onBeforeRender = leftover();
  visualMeshes(latch)[0].onAfterRender = leftover();
  visualMeshes(tool)[0].onBeforeRender = leftover();
  visualMeshes(tool)[0].onAfterRender = leftover();
  fastener.onBeforeRender = leftover();
  fastener.onAfterRender = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitRenderCallbacks(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitRenderCallbacks(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitRenderCallbacks(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitRenderCallbacks(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitRenderCallbacks(fastener, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DRenderCallbacksAbsent(colliderGrab, "fail-soft collider keeps r170 render-callback absence");
});

test("packaged ingest clears leftover Material onBeforeCompile/onBeforeRender; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(Object.hasOwn(fresh, "onBeforeCompile"), false, "r170 Material does not define onBeforeCompile on the instance");
  assert.equal(Object.hasOwn(fresh, "onBeforeRender"), false, "r170 Material does not define onBeforeRender on the instance");
  assertR170MaterialRenderCallbacksAbsent(fresh, "r170 MeshBasicMaterial");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedCompile = () => {};
  const mappedBefore = () => {};
  mapped.onBeforeCompile = mappedCompile;
  mapped.onBeforeRender = mappedBefore;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccMaterialRenderCallbacks", wrong);
  const leftoverCompile = () => {};
  const leftoverBefore = () => {};
  wrong.onBeforeCompile = leftoverCompile;
  wrong.onBeforeRender = leftoverBefore;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderCompile = () => {};
  const colliderBefore = () => {};
  colliderGrabBefore.material.onBeforeCompile = colliderCompile;
  colliderGrabBefore.material.onBeforeRender = colliderBefore;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitMaterialRenderCallbacks(wrong, "packaged DCC leftover onBeforeCompile/onBeforeRender color-only MeshBasic");
  assert.notEqual(wrong.onBeforeCompile, leftoverCompile, "DCC leftover onBeforeCompile stub is cleared");
  assert.notEqual(wrong.onBeforeRender, leftoverBefore, "DCC leftover onBeforeRender stub is cleared");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "material-callback pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "material-callback pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "material-callback pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "material-callback pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; material-callback pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "material-callback pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "material-callback pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "material-callback pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "material-callback pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "material-callback pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "material-callback pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "material-callback pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "material-callback pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "material-callback pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; material-callback pin does not freeze it");
  assertQuestSafeUnlitMaterialRenderCallbacks(fastener.material, "fastener");
  assert.equal(mapped.onBeforeCompile, mappedCompile, "mapped MeshBasic stays authored onBeforeCompile");
  assert.equal(mapped.onBeforeRender, mappedBefore, "mapped MeshBasic stays authored onBeforeRender");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.onBeforeCompile, colliderCompile, "collider MeshBasic stays authored onBeforeCompile");
  assert.equal(colliderGrab.material.onBeforeRender, colliderBefore, "collider MeshBasic stays authored onBeforeRender");
});

test("packaged ingest without lod groups still clears leftover Material onBeforeCompile/onBeforeRender", () => {
  const leftover = () => () => {};
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.onBeforeCompile = leftover();
  visualMeshes(body)[0].material.onBeforeRender = leftover();
  visualMeshes(lid)[0].material.onBeforeCompile = leftover();
  visualMeshes(lid)[0].material.onBeforeRender = leftover();
  visualMeshes(latch)[0].material.onBeforeCompile = leftover();
  visualMeshes(latch)[0].material.onBeforeRender = leftover();
  visualMeshes(tool)[0].material.onBeforeCompile = leftover();
  visualMeshes(tool)[0].material.onBeforeRender = leftover();
  fastener.material.onBeforeCompile = leftover();
  fastener.material.onBeforeRender = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitMaterialRenderCallbacks(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitMaterialRenderCallbacks(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitMaterialRenderCallbacks(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitMaterialRenderCallbacks(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitMaterialRenderCallbacks(fastener.material, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MaterialRenderCallbacksAbsent(colliderGrab.material, "fail-soft collider keeps r170 material-callback absence");
});

test("packaged ingest clears leftover Mesh onBefore/AfterShadow; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(Object.hasOwn(fresh, "onBeforeShadow"), false, "r170 Mesh does not define onBeforeShadow on the instance");
  assert.equal(Object.hasOwn(fresh, "onAfterShadow"), false, "r170 Mesh does not define onAfterShadow on the instance");
  assertR170Object3DShadowCallbacksAbsent(fresh, "r170 Mesh");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedBefore = () => {};
  const mappedAfter = () => {};
  mappedMesh.onBeforeShadow = mappedBefore;
  mappedMesh.onAfterShadow = mappedAfter;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccShadowCallbacks", wrong);
  const leftoverBefore = () => {};
  const leftoverAfter = () => {};
  wrongMesh.onBeforeShadow = leftoverBefore;
  wrongMesh.onAfterShadow = leftoverAfter;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const matCompileBefore = wrong.onBeforeCompile;
  const matBefore = wrong.onBeforeRender;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderBefore = () => {};
  const colliderAfter = () => {};
  colliderGrabBefore.onBeforeShadow = colliderBefore;
  colliderGrabBefore.onAfterShadow = colliderAfter;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitShadowCallbacks(wrongMesh, "packaged DCC leftover onBefore/AfterShadow color-only Mesh");
  assert.notEqual(wrongMesh.onBeforeShadow, leftoverBefore, "DCC leftover onBeforeShadow stub is cleared");
  assert.notEqual(wrongMesh.onAfterShadow, leftoverAfter, "DCC leftover onAfterShadow stub is cleared");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "shadow-callback pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "shadow-callback pin does not touch Mesh onAfterRender");
  assert.equal(wrong.onBeforeCompile, matCompileBefore, "shadow-callback pin does not touch Material onBeforeCompile");
  assert.equal(wrong.onBeforeRender, matBefore, "shadow-callback pin does not touch Material onBeforeRender");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "shadow-callback pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "shadow-callback pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; shadow-callback pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "shadow-callback pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "shadow-callback pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "shadow-callback pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "shadow-callback pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "shadow-callback pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "shadow-callback pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "shadow-callback pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "shadow-callback pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "shadow-callback pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; shadow-callback pin does not freeze it");
  assertQuestSafeUnlitShadowCallbacks(fastener, "fastener");
  assert.equal(mappedMesh.onBeforeShadow, mappedBefore, "mapped MeshBasic stays authored onBeforeShadow");
  assert.equal(mappedMesh.onAfterShadow, mappedAfter, "mapped MeshBasic stays authored onAfterShadow");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.onBeforeShadow, colliderBefore, "collider Mesh stays authored onBeforeShadow");
  assert.equal(colliderGrab.onAfterShadow, colliderAfter, "collider Mesh stays authored onAfterShadow");
});

test("packaged ingest without lod groups still clears leftover Mesh onBefore/AfterShadow", () => {
  const leftover = () => () => {};
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].onBeforeShadow = leftover();
  visualMeshes(body)[0].onAfterShadow = leftover();
  visualMeshes(lid)[0].onBeforeShadow = leftover();
  visualMeshes(lid)[0].onAfterShadow = leftover();
  visualMeshes(latch)[0].onBeforeShadow = leftover();
  visualMeshes(latch)[0].onAfterShadow = leftover();
  visualMeshes(tool)[0].onBeforeShadow = leftover();
  visualMeshes(tool)[0].onAfterShadow = leftover();
  fastener.onBeforeShadow = leftover();
  fastener.onAfterShadow = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitShadowCallbacks(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitShadowCallbacks(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitShadowCallbacks(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitShadowCallbacks(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitShadowCallbacks(fastener, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170Object3DShadowCallbacksAbsent(colliderGrab, "fail-soft collider keeps r170 shadow-callback absence");
});

test("packaged ingest clears leftover Material customProgramCacheKey; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(Object.hasOwn(fresh, "customProgramCacheKey"), false, "r170 Material does not define customProgramCacheKey on the instance");
  assert.equal(typeof THREE.Material.prototype.customProgramCacheKey, "function", "r170 Material.prototype.customProgramCacheKey is the default method");
  assert.equal(
    fresh.customProgramCacheKey(),
    fresh.onBeforeCompile.toString(),
    "r170 Material.prototype.customProgramCacheKey returns this.onBeforeCompile.toString()"
  );
  assertR170MaterialCustomProgramCacheKeyDefault(fresh, "r170 MeshBasicMaterial");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedKey = () => "mapped-unique-program-key";
  mapped.customProgramCacheKey = mappedKey;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccCustomProgramCacheKey", wrong);
  const leftoverKey = () => "dcc-unique-program-key";
  wrong.customProgramCacheKey = leftoverKey;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const matCompileBefore = wrong.onBeforeCompile;
  const matBefore = wrong.onBeforeRender;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderKey = () => "collider-unique-program-key";
  colliderGrabBefore.material.customProgramCacheKey = colliderKey;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitCustomProgramCacheKey(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitCustomProgramCacheKey(wrong, "packaged DCC leftover customProgramCacheKey color-only MeshBasic");
  assert.notEqual(wrong.customProgramCacheKey, leftoverKey, "DCC leftover customProgramCacheKey stub is cleared");
  assert.equal(wrong.customProgramCacheKey, THREE.Material.prototype.customProgramCacheKey, "prototype customProgramCacheKey remains");
  assert.equal(wrong.onBeforeCompile, matCompileBefore, "customProgramCacheKey pin does not touch Material onBeforeCompile");
  assert.equal(wrong.onBeforeRender, matBefore, "customProgramCacheKey pin does not touch Material onBeforeRender");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "customProgramCacheKey pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "customProgramCacheKey pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "customProgramCacheKey pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "customProgramCacheKey pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "customProgramCacheKey pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "customProgramCacheKey pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; customProgramCacheKey pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "customProgramCacheKey pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "customProgramCacheKey pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "customProgramCacheKey pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "customProgramCacheKey pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "customProgramCacheKey pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "customProgramCacheKey pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "customProgramCacheKey pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "customProgramCacheKey pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "customProgramCacheKey pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; customProgramCacheKey pin does not freeze it");
  assertQuestSafeUnlitCustomProgramCacheKey(fastener.material, "fastener");
  assert.equal(mapped.customProgramCacheKey, mappedKey, "mapped MeshBasic stays authored customProgramCacheKey");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.customProgramCacheKey, colliderKey, "collider MeshBasic stays authored customProgramCacheKey");
});

test("packaged ingest without lod groups still clears leftover Material customProgramCacheKey", () => {
  const leftover = () => () => "dcc-unique-program-key";
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.customProgramCacheKey = leftover();
  visualMeshes(lid)[0].material.customProgramCacheKey = leftover();
  visualMeshes(latch)[0].material.customProgramCacheKey = leftover();
  visualMeshes(tool)[0].material.customProgramCacheKey = leftover();
  fastener.material.customProgramCacheKey = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitCustomProgramCacheKey(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitCustomProgramCacheKey(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitCustomProgramCacheKey(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitCustomProgramCacheKey(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitCustomProgramCacheKey(fastener.material, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MaterialCustomProgramCacheKeyDefault(colliderGrab.material, "fail-soft collider keeps r170 customProgramCacheKey default");
});

test("packaged ingest clears leftover Material defines; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(fresh.defines, undefined, "r170 MeshBasicMaterial does not set defines");
  assert.equal(Object.hasOwn(fresh, "defines"), false, "r170 MeshBasicMaterial does not define defines on the instance");
  assertR170MaterialDefinesAbsent(fresh, "r170 MeshBasicMaterial");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedDefines = { USE_MAP: "" };
  mapped.defines = mappedDefines;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccDefines", wrong);
  const leftoverDefines = { USE_UV: "", DCC_LEFTOVER: 1 };
  wrong.defines = leftoverDefines;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const matCompileBefore = wrong.onBeforeCompile;
  const matBefore = wrong.onBeforeRender;
  const cacheKeyBefore = wrong.customProgramCacheKey;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderDefines = { COLLIDER_LEFTOVER: 1 };
  colliderGrabBefore.material.defines = colliderDefines;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitDefines(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomProgramCacheKey(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitDefines(wrong, "packaged DCC leftover defines color-only MeshBasic");
  assert.notEqual(wrong.defines, leftoverDefines, "DCC leftover defines map is cleared");
  assert.equal(wrong.defines, undefined, "defines is restored to r170 absence");
  assert.equal(wrong.onBeforeCompile, matCompileBefore, "defines pin does not touch Material onBeforeCompile");
  assert.equal(wrong.onBeforeRender, matBefore, "defines pin does not touch Material onBeforeRender");
  assert.equal(wrong.customProgramCacheKey, cacheKeyBefore, "defines pin does not touch Material customProgramCacheKey");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "defines pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "defines pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "defines pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "defines pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "defines pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "defines pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; defines pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "defines pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "defines pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "defines pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "defines pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "defines pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "defines pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "defines pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "defines pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "defines pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; defines pin does not freeze it");
  assertQuestSafeUnlitDefines(fastener.material, "fastener");
  assert.equal(mapped.defines, mappedDefines, "mapped MeshBasic stays authored defines");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.defines, colliderDefines, "collider MeshBasic stays authored defines");
});

test("packaged ingest without lod groups still clears leftover Material defines", () => {
  const leftover = () => ({ USE_UV: "", DCC_LEFTOVER: 1 });
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.defines = leftover();
  visualMeshes(lid)[0].material.defines = leftover();
  visualMeshes(latch)[0].material.defines = leftover();
  visualMeshes(tool)[0].material.defines = leftover();
  fastener.material.defines = leftover();
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitDefines(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitDefines(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitDefines(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitDefines(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitDefines(fastener.material, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MaterialDefinesAbsent(colliderGrab.material, "fail-soft collider keeps r170 defines absence");
});

test("packaged ingest pins Material flatShading false; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170MaterialFlatShadingUnset(fresh, "r170 MeshBasicMaterial");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mapped.flatShading = true;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccFlatShading", wrong);
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const definesBefore = wrong.defines;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const matCompileBefore = wrong.onBeforeCompile;
  const matBefore = wrong.onBeforeRender;
  const cacheKeyBefore = wrong.customProgramCacheKey;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.flatShading = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitFlatShading(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitDefines(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomProgramCacheKey(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.alphaToCoverage, false, "prior A2C pin stays intact");
  }
  assertQuestSafeUnlitFlatShading(wrong, "packaged DCC leftover flatShading color-only MeshBasic");
  assert.equal(wrong.flatShading, false, "DCC leftover flatShading true is pinned false");
  assert.equal(wrong.defines, definesBefore, "flatShading pin does not touch Material defines");
  assert.equal(wrong.onBeforeCompile, matCompileBefore, "flatShading pin does not touch Material onBeforeCompile");
  assert.equal(wrong.onBeforeRender, matBefore, "flatShading pin does not touch Material onBeforeRender");
  assert.equal(wrong.customProgramCacheKey, cacheKeyBefore, "flatShading pin does not touch Material customProgramCacheKey");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "flatShading pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "flatShading pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "flatShading pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "flatShading pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "flatShading pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "flatShading pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; flatShading pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "flatShading pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "flatShading pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "flatShading pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "flatShading pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "flatShading pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "flatShading pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "flatShading pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "flatShading pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "flatShading pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; flatShading pin does not freeze it");
  assertQuestSafeUnlitFlatShading(fastener.material, "fastener");
  assert.equal(mapped.flatShading, true, "mapped MeshBasic stays authored flatShading");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.flatShading, true, "collider MeshBasic stays authored flatShading");
});

test("packaged ingest without lod groups still pins Material flatShading false", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.flatShading = true;
  visualMeshes(lid)[0].material.flatShading = true;
  visualMeshes(latch)[0].material.flatShading = true;
  visualMeshes(tool)[0].material.flatShading = true;
  fastener.material.flatShading = true;
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitFlatShading(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitFlatShading(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitFlatShading(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitFlatShading(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitFlatShading(fastener.material, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MaterialFlatShadingUnset(colliderGrab.material, "fail-soft collider keeps r170 flatShading unset");
});

test("packaged ingest clears leftover Material glslVersion; mapped/lit stay authored", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170MaterialGlslVersionAbsent(fresh, "r170 MeshBasicMaterial");
  assert.equal(THREE.GLSL3, "300 es", "r170 GLSL3 is '300 es'");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mapped.glslVersion = "300 es";
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccGlslVersion", wrong);
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const blendColorBefore = wrong.blendColor;
  const blendAlphaBefore = wrong.blendAlpha;
  const ditheringBefore = wrong.dithering;
  const a2cBefore = wrong.alphaToCoverage;
  const stencilRefBefore = wrong.stencilRef;
  const definesBefore = wrong.defines;
  const flatShadingBefore = wrong.flatShading;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const matCompileBefore = wrong.onBeforeCompile;
  const matBefore = wrong.onBeforeRender;
  const cacheKeyBefore = wrong.customProgramCacheKey;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.glslVersion = "100";

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitGlslVersion(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlatShading(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitDefines(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomProgramCacheKey(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitMaterialRenderCallbacks(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitCustomShadowMaterials(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowFlags(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRotationOrder(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
    assert.equal(mesh.material.stencilRef, 0, "prior stencilRef pin stays intact");
    assert.equal(mesh.material.dithering, false, "prior dithering pin stays intact");
    assert.equal(mesh.material.flatShading, false, "prior flatShading pin stays intact");
  }
  assertQuestSafeUnlitGlslVersion(wrong, "packaged DCC leftover glslVersion color-only MeshBasic");
  assert.equal(wrong.glslVersion, undefined, "DCC leftover glslVersion GLSL3 is deleted");
  assert.equal(Object.hasOwn(wrong, "glslVersion"), false, "DCC leftover glslVersion own property is deleted");
  assert.equal(wrong.flatShading, false, "ingest flags pin still sets flatShading false");
  assert.notEqual(wrong.flatShading, flatShadingBefore, "flags pin corrects leftover flatShading; dedicated glslVersion clear is separate");
  assert.equal(wrong.defines, definesBefore, "glslVersion pin does not touch Material defines");
  assert.equal(wrong.onBeforeCompile, matCompileBefore, "glslVersion pin does not touch Material onBeforeCompile");
  assert.equal(wrong.onBeforeRender, matBefore, "glslVersion pin does not touch Material onBeforeRender");
  assert.equal(wrong.customProgramCacheKey, cacheKeyBefore, "glslVersion pin does not touch Material customProgramCacheKey");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "glslVersion pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "glslVersion pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "glslVersion pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "glslVersion pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "glslVersion pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "glslVersion pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; glslVersion pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "glslVersion pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "glslVersion pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "glslVersion pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "glslVersion pin does not change rotation.order");
  assert.equal(wrong.blendColor, blendColorBefore, "glslVersion pin does not replace blendColor");
  assert.equal(wrong.blendAlpha, blendAlphaBefore, "glslVersion pin does not change blendAlpha");
  assert.equal(wrong.dithering, ditheringBefore, "glslVersion pin does not change dithering");
  assert.equal(wrong.alphaToCoverage, a2cBefore, "glslVersion pin does not change alphaToCoverage");
  assert.equal(wrong.stencilRef, stencilRefBefore, "glslVersion pin does not change stencilRef");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; glslVersion pin does not freeze it");
  assertQuestSafeUnlitGlslVersion(fastener.material, "fastener");
  assert.equal(mapped.glslVersion, "300 es", "mapped MeshBasic stays authored glslVersion");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrong.isShaderMaterial, undefined, "ingest does not convert MeshBasic to ShaderMaterial");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.glslVersion, "100", "collider MeshBasic stays authored glslVersion");
});

test("packaged ingest without lod groups still clears leftover Material glslVersion", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  visualMeshes(body)[0].material.glslVersion = THREE.GLSL3;
  visualMeshes(lid)[0].material.glslVersion = "300 es";
  visualMeshes(latch)[0].material.glslVersion = "100";
  visualMeshes(tool)[0].material.glslVersion = THREE.GLSL3;
  fastener.material.glslVersion = "300 es";
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitGlslVersion(visualMeshes(body)[0].material, "fail-soft body");
  assertQuestSafeUnlitGlslVersion(visualMeshes(lid)[0].material, "fail-soft lid");
  assertQuestSafeUnlitGlslVersion(visualMeshes(latch)[0].material, "fail-soft latch");
  assertQuestSafeUnlitGlslVersion(visualMeshes(tool)[0].material, "fail-soft tool");
  assertQuestSafeUnlitGlslVersion(fastener.material, "fail-soft fastener");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  const colliderGrab = root.getObjectByName("collider_grab");
  assertR170MaterialGlslVersionAbsent(colliderGrab.material, "fail-soft collider keeps r170 glslVersion unset");
});

test("packaged ingest clears leftover Object3D animations; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170Object3DAnimationsEmpty(fresh, "r170 Mesh");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedClips = [new THREE.AnimationClip("mapped-dcc", 1, [])];
  mappedMesh.animations = mappedClips;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccAnimations", wrong);
  const clips = [new THREE.AnimationClip("dcc-leftover", 0.8, [])];
  wrongMesh.animations = clips;
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const scaleBefore = wrongMesh.scale;
  const upBefore = wrongMesh.up;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  const glslBefore = wrong.glslVersion;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderClips = [new THREE.AnimationClip("collider-dcc", 1, [])];
  colliderGrabBefore.animations = colliderClips;
  fastener.animations = null;
  let mixerUpdates = 0;
  const mixer = new THREE.AnimationMixer(wrongMesh);
  mixer.update = () => {
    mixerUpdates += 1;
  };
  wrongMesh.userData.mixer = mixer;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitAnimations(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitGlslVersion(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlatShading(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assert.equal(wrongMesh.animations, clips, "ingest mutates the leftover animations array");
  assert.equal(wrongMesh.animations.length, 0, "DCC leftover animations are cleared");
  assert.equal(mixerUpdates, 0, "ingest does not call AnimationMixer.update");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "v1.4.0 mesh-userData pin clears leftover mixer extras on the color-only visual");
  assert.equal(typeof mixer.update, "function", "the detached mixer object stays callable");
  assert.equal(wrong.glslVersion, undefined, "flags pin still clears leftover glslVersion");
  assert.notEqual(wrong.glslVersion, glslBefore, "glslVersion clear stays a separate material pin");
  assert.equal(wrong.flatShading, false, "ingest flags pin still sets flatShading false");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "animations pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "animations pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "animations pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "animations pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "animations pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "animations pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; animations pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "animations pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "animations pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "animations pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "animations pin does not change rotation.order");
  assert.equal(wrongMesh.scale, scaleBefore, "animations pin keeps the existing scale Vector3");
  assert.equal(wrongMesh.up, upBefore, "animations pin keeps the existing up Vector3");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; animations pin does not freeze it");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assertQuestSafeUnlitAnimations(fastener, "fastener");
  assert.equal(mappedMesh.animations, mappedClips, "mapped MeshBasic stays authored animations");
  assert.equal(mappedMesh.animations.length, 1, "mapped MeshBasic keeps leftover clips");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccAnimations mesh.name");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.animations, colliderClips, "collider Mesh stays authored animations");
  assert.equal(colliderGrab.animations.length, 1, "collider keeps leftover clips");
});

test("packaged ingest without lod groups still clears leftover Object3D animations", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyClips = [new THREE.AnimationClip("body", 1, [])];
  visualMeshes(body)[0].animations = bodyClips;
  visualMeshes(lid)[0].animations = null;
  delete visualMeshes(latch)[0].animations;
  visualMeshes(tool)[0].animations = "not-an-array";
  const fastenerClips = [new THREE.AnimationClip("fastener", 0.2, [])];
  fastener.animations = fastenerClips;
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderClips = [new THREE.AnimationClip("collider", 1, [])];
  colliderGrab.animations = colliderClips;
  ingestPackagedRoot(root, sidecar);
  assert.equal(visualMeshes(body)[0].animations, bodyClips, "fail-soft body array is mutated");
  assertQuestSafeUnlitAnimations(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitAnimations(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitAnimations(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitAnimations(visualMeshes(tool)[0], "fail-soft tool");
  assert.equal(fastener.animations, fastenerClips, "fail-soft fastener array is mutated");
  assertQuestSafeUnlitAnimations(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.animations, colliderClips, "fail-soft collider stays authored animations");
  assert.equal(colliderGrab.animations.length, 1);
});

test("packaged ingest clears leftover Mesh morph targets; mapped/lit stay authored", () => {
  const fresh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial());
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assertR170MeshMorphTargetsAbsent(fresh, "r170 Mesh");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedInfluences = [0.5];
  const mappedDict = { mapped: 0 };
  mappedMesh.morphTargetInfluences = mappedInfluences;
  mappedMesh.morphTargetDictionary = mappedDict;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccMorph", wrong);
  const influences = [0.8, 0.1];
  const dictionary = { lid: 0, latch: 1 };
  wrongMesh.morphTargetInfluences = influences;
  wrongMesh.morphTargetDictionary = dictionary;
  const clips = [new THREE.AnimationClip("keep-clips", 0.4, [])];
  wrongMesh.animations = clips;
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const scaleBefore = wrongMesh.scale;
  const upBefore = wrongMesh.up;
  const meshBefore = wrongMesh.onBeforeRender;
  const meshAfter = wrongMesh.onAfterRender;
  const meshShadowBefore = wrongMesh.onBeforeShadow;
  const meshShadowAfter = wrongMesh.onAfterShadow;
  const customDepthBefore = wrongMesh.customDepthMaterial;
  const customDistanceBefore = wrongMesh.customDistanceMaterial;
  let morphUpdates = 0;
  wrongMesh.updateMorphTargets = () => {
    morphUpdates += 1;
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderInfluences = [0.2];
  const colliderDict = { collider: 0 };
  colliderGrabBefore.morphTargetInfluences = colliderInfluences;
  colliderGrabBefore.morphTargetDictionary = colliderDict;
  fastener.morphTargetInfluences = [];
  fastener.morphTargetDictionary = {};

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitMorphTargets(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitAnimations(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitGlslVersion(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlatShading(mesh.material, "packaged color-only MeshBasic");
    assertQuestSafeUnlitShadowCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitRenderCallbacks(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitFlags(mesh.material, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.receiveShadow, false, "color-only pin does not enable receiveShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assert.equal(morphUpdates, 0, "ingest does not call updateMorphTargets");
  assert.equal(influences.length, 2, "ingest does not rewrite the detached influences array");
  assert.equal(dictionary.lid, 0, "ingest does not rewrite the detached dictionary");
  assert.equal(wrongMesh.animations, clips, "animations pin still mutates the leftover array in place");
  assert.equal(wrongMesh.animations.length, 0, "animations pin still clears leftover clips; morph-target pin does not replace the array");
  assert.equal(wrong.glslVersion, undefined, "flags pin still clears leftover glslVersion");
  assert.equal(wrong.flatShading, false, "ingest flags pin still sets flatShading false");
  assert.equal(wrongMesh.onBeforeRender, meshBefore, "morph-target pin does not touch Mesh onBeforeRender");
  assert.equal(wrongMesh.onAfterRender, meshAfter, "morph-target pin does not touch Mesh onAfterRender");
  assert.equal(wrongMesh.onBeforeShadow, meshShadowBefore, "morph-target pin does not touch Mesh onBeforeShadow");
  assert.equal(wrongMesh.onAfterShadow, meshShadowAfter, "morph-target pin does not touch Mesh onAfterShadow");
  assert.equal(wrongMesh.customDepthMaterial, customDepthBefore, "morph-target pin does not touch customDepthMaterial");
  assert.equal(wrongMesh.customDistanceMaterial, customDistanceBefore, "morph-target pin does not touch customDistanceMaterial");
  assert.equal(wrongMesh.matrixAutoUpdate, false, "body LOD leaf still frozen by v0.45; morph-target pin does not unfreeze");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "morph-target pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "morph-target pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "morph-target pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "morph-target pin does not change rotation.order");
  assert.equal(wrongMesh.scale, scaleBefore, "morph-target pin keeps the existing scale Vector3");
  assert.equal(wrongMesh.up, upBefore, "morph-target pin keeps the existing up Vector3");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live; morph-target pin does not freeze it");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assertQuestSafeUnlitMorphTargets(fastener, "fastener");
  assert.equal(mappedMesh.morphTargetInfluences, mappedInfluences, "mapped MeshBasic stays authored influences");
  assert.equal(mappedMesh.morphTargetDictionary, mappedDict, "mapped MeshBasic stays authored dictionary");
  assert.equal(mappedMesh.material, mapped, "ingest does not invent or replace mapped materials");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccMorph mesh.name");

  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.morphTargetInfluences, colliderInfluences, "collider Mesh stays authored influences");
  assert.equal(colliderGrab.morphTargetDictionary, colliderDict, "collider Mesh stays authored dictionary");
});

test("packaged ingest without lod groups still clears leftover Mesh morph targets", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyInfluences = [0.4];
  const bodyDict = { body: 0 };
  visualMeshes(body)[0].morphTargetInfluences = bodyInfluences;
  visualMeshes(body)[0].morphTargetDictionary = bodyDict;
  visualMeshes(lid)[0].morphTargetInfluences = [];
  visualMeshes(lid)[0].morphTargetDictionary = {};
  visualMeshes(latch)[0].morphTargetInfluences = null;
  visualMeshes(latch)[0].morphTargetDictionary = null;
  delete visualMeshes(tool)[0].morphTargetInfluences;
  delete visualMeshes(tool)[0].morphTargetDictionary;
  fastener.morphTargetInfluences = [0.1];
  fastener.morphTargetDictionary = { fastener: 0 };
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderInfluences = [1];
  const colliderDict = { grab: 0 };
  colliderGrab.morphTargetInfluences = colliderInfluences;
  colliderGrab.morphTargetDictionary = colliderDict;
  ingestPackagedRoot(root, sidecar);
  assertQuestSafeUnlitMorphTargets(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitMorphTargets(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitMorphTargets(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitMorphTargets(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitMorphTargets(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(bodyInfluences.length, 1, "fail-soft pin deletes the property without rewriting the array");
  assertQuestSafeUnlitFlags(visualMeshes(body)[0].material, "fail-soft body");
  assert.equal(visualMeshes(body)[0].castShadow, false, "fail-soft body does not enable castShadow");
  assert.equal(fastener.castShadow, false, "fail-soft fastener does not enable castShadow");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.morphTargetInfluences, colliderInfluences, "fail-soft collider stays authored influences");
  assert.equal(colliderGrab.morphTargetDictionary, colliderDict, "fail-soft collider stays authored dictionary");
});

test("packaged ingest clears leftover BufferGeometry morphAttributes; mapped/lit stay authored", () => {
  const fresh = new THREE.BufferGeometry();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.deepEqual(fresh.morphAttributes, {}, "r170 BufferGeometry morphAttributes starts as {}");
  assert.equal(fresh.morphTargetsRelative, false, "r170 morphTargetsRelative starts false");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedAttr = mappedMesh.geometry.getAttribute("position").clone();
  mappedMesh.geometry.morphAttributes.position = [mappedAttr];
  mappedMesh.geometry.morphTargetsRelative = true;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccMorphAttributes", wrong);
  const bag = wrongMesh.geometry.morphAttributes;
  const leftover = new THREE.BufferAttribute(new Float32Array(9), 3);
  let disposed = 0;
  leftover.dispose = () => {
    disposed += 1;
  };
  bag.position = [leftover];
  bag.color = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  const influences = [0.8];
  const dictionary = { lid: 0 };
  wrongMesh.morphTargetInfluences = influences;
  wrongMesh.morphTargetDictionary = dictionary;
  const clips = [new THREE.AnimationClip("keep-clips", 0.4, [])];
  wrongMesh.animations = clips;
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const scaleBefore = wrongMesh.scale;
  const upBefore = wrongMesh.up;
  let morphUpdates = 0;
  wrongMesh.updateMorphTargets = () => {
    morphUpdates += 1;
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderAttr = colliderGrabBefore.geometry.getAttribute("position").clone();
  colliderGrabBefore.geometry.morphAttributes.position = [colliderAttr];
  colliderGrabBefore.geometry.morphTargetsRelative = true;
  const fastenerBag = fastener.geometry.morphAttributes;
  fastener.geometry.morphAttributes.position = [];
  fastener.geometry.morphTargetsRelative = true;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitMorphAttributes(mesh, "packaged color-only MeshBasic");
    if (mesh !== wrongMesh) assertQuestSafeUnlitMorphTargets(mesh, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assert.equal(morphUpdates, 0, "ingest does not call updateMorphTargets");
  assert.equal(disposed, 1, "ingest disposes the leftover morph BufferAttribute");
  assert.equal(wrongMesh.geometry.morphAttributes, bag, "ingest mutates morphAttributes in place");
  assert.equal(wrongMesh.morphTargetInfluences, influences, "morphAttributes pin does not touch morphTargetInfluences");
  assert.equal(wrongMesh.morphTargetDictionary, dictionary, "morphAttributes pin does not touch morphTargetDictionary");
  assert.equal(influences.length, 1, "ingest does not rewrite the detached influences array");
  assert.equal(wrongMesh.animations, clips, "morphAttributes pin does not replace the animations array");
  assert.equal(wrongMesh.animations.length, 1, "morphAttributes pin does not clear leftover clips");
  assert.equal(wrong.glslVersion, THREE.GLSL3, "morphAttributes pin does not clear Material glslVersion");
  assert.equal(wrong.flatShading, true, "morphAttributes pin does not set Material flatShading");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "morphAttributes pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "morphAttributes pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "morphAttributes pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "morphAttributes pin does not change rotation.order");
  assert.equal(wrongMesh.scale, scaleBefore, "morphAttributes pin keeps the existing scale Vector3");
  assert.equal(wrongMesh.up, upBefore, "morphAttributes pin keeps the existing up Vector3");
  assert.equal(fastener.geometry.morphAttributes, fastenerBag, "fastener morphAttributes object is kept");
  assertQuestSafeUnlitMorphAttributes(fastener, "fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.morphAttributes.position[0], mappedAttr, "mapped MeshBasic stays authored morph attributes");
  assert.equal(mappedMesh.geometry.morphTargetsRelative, true, "mapped MeshBasic stays authored morphTargetsRelative");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccMorphAttributes mesh.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.morphAttributes.position[0], colliderAttr, "collider Mesh stays authored morph attributes");
  assert.equal(colliderGrab.geometry.morphTargetsRelative, true, "collider morphTargetsRelative stays authored");
});

test("packaged ingest without lod groups still clears leftover BufferGeometry morphAttributes", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyBag = visualMeshes(body)[0].geometry.morphAttributes;
  bodyBag.position = [new THREE.BufferAttribute(new Float32Array(3), 3)];
  visualMeshes(body)[0].geometry.morphTargetsRelative = true;
  visualMeshes(lid)[0].geometry.morphAttributes = null;
  visualMeshes(latch)[0].geometry.morphAttributes.normal = [];
  visualMeshes(latch)[0].geometry.morphTargetsRelative = true;
  delete visualMeshes(tool)[0].geometry.morphAttributes;
  fastener.geometry.morphAttributes.position = [];
  fastener.geometry.morphTargetsRelative = true;
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderAttr = new THREE.BufferAttribute(new Float32Array(3), 3);
  colliderGrab.geometry.morphAttributes.position = [colliderAttr];
  colliderGrab.geometry.morphTargetsRelative = true;
  ingestPackagedRoot(root, sidecar);
  assert.equal(visualMeshes(body)[0].geometry.morphAttributes, bodyBag, "fail-soft body bag is mutated in place");
  assertQuestSafeUnlitMorphAttributes(visualMeshes(body)[0], "fail-soft body");
  assertQuestSafeUnlitMorphAttributes(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitMorphAttributes(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitMorphAttributes(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitMorphAttributes(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.morphAttributes.position[0], colliderAttr, "fail-soft collider stays authored morph attributes");
  assert.equal(colliderGrab.geometry.morphTargetsRelative, true, "fail-soft collider morphTargetsRelative stays authored");
});

test("packaged ingest clears leftover BufferGeometry groups; mapped/lit stay authored", () => {
  const fresh = new THREE.BufferGeometry();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.ok(Array.isArray(fresh.groups), "r170 BufferGeometry groups starts as an array");
  assert.equal(fresh.groups.length, 0, "r170 BufferGeometry groups starts empty");
  const replaced = fresh.groups;
  fresh.clearGroups();
  assert.notEqual(fresh.groups, replaced, "r170 clearGroups assigns a new array");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedGroupsBefore = mappedMesh.geometry.groups.length;
  mappedMesh.geometry.addGroup(0, 6, 1);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccGroups", wrong);
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  wrongMesh.geometry.addGroup(3, 3, 1);
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const drawRange = wrongMesh.geometry.drawRange;
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  const influences = [0.8];
  const dictionary = { lid: 0 };
  wrongMesh.morphTargetInfluences = influences;
  wrongMesh.morphTargetDictionary = dictionary;
  const clips = [new THREE.AnimationClip("keep-clips", 0.4, [])];
  wrongMesh.animations = clips;
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const scaleBefore = wrongMesh.scale;
  const upBefore = wrongMesh.up;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderGroupsBefore = colliderGrabBefore.geometry.groups.length;
  colliderGrabBefore.geometry.addGroup(0, 12, 0);
  const fastenerGroups = fastener.geometry.groups;
  fastener.geometry.addGroup(0, 6, 0);

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitGroups(mesh, "packaged color-only MeshBasic");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assert.equal(wrongMesh.geometry.groups, bag, "ingest mutates groups in place");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "v0.88 drawRange pin after groups keeps the drawRange object");
  assert.equal(drawRange.start, 0, "v0.88 drawRange pin after groups restores start 0");
  assert.equal(drawRange.count, Infinity, "v0.88 drawRange pin after groups restores count Infinity");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "groups pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.morphTargetInfluences, influences, "groups pin does not touch morphTargetInfluences");
  assert.equal(wrongMesh.morphTargetDictionary, dictionary, "groups pin does not touch morphTargetDictionary");
  assert.equal(influences.length, 1, "ingest does not rewrite the detached influences array");
  assert.equal(wrongMesh.animations, clips, "groups pin does not replace the animations array");
  assert.equal(wrongMesh.animations.length, 1, "groups pin does not clear leftover clips");
  assert.equal(wrong.glslVersion, THREE.GLSL3, "groups pin does not clear Material glslVersion");
  assert.equal(wrong.flatShading, true, "groups pin does not set Material flatShading");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "groups pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "groups pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "groups pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "groups pin does not change rotation.order");
  assert.equal(wrongMesh.scale, scaleBefore, "groups pin keeps the existing scale Vector3");
  assert.equal(wrongMesh.up, upBefore, "groups pin keeps the existing up Vector3");
  assert.equal(fastener.geometry.groups, fastenerGroups, "fastener groups array is kept");
  assertQuestSafeUnlitGroups(fastener, "fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.groups.length, mappedGroupsBefore + 1, "mapped MeshBasic stays authored groups");
  assert.equal(mappedMesh.geometry.groups.at(-1).materialIndex, 1, "mapped group materialIndex stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(Array.isArray(wrongMesh.material), false, "ingest does not assign a material array");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGroups mesh.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.groups.length, colliderGroupsBefore + 1, "collider Mesh stays authored groups");
});

test("packaged ingest without lod groups still clears leftover BufferGeometry groups", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyGroups = visualMeshes(body)[0].geometry.groups;
  const bodyDrawRange = visualMeshes(body)[0].geometry.drawRange;
  visualMeshes(body)[0].geometry.addGroup(0, 3, 0);
  visualMeshes(body)[0].geometry.drawRange.start = 1;
  visualMeshes(lid)[0].geometry.groups = null;
  visualMeshes(latch)[0].geometry.addGroup(0, 6, 0);
  delete visualMeshes(tool)[0].geometry.groups;
  fastener.geometry.addGroup(0, 3, 0);
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderGroupsBefore = colliderGrab.geometry.groups.length;
  colliderGrab.geometry.addGroup(0, 12, 1);
  ingestPackagedRoot(root, sidecar);
  assert.equal(visualMeshes(body)[0].geometry.groups, bodyGroups, "fail-soft body groups array is mutated in place");
  assertQuestSafeUnlitGroups(visualMeshes(body)[0], "fail-soft body");
  assert.equal(visualMeshes(body)[0].geometry.drawRange, bodyDrawRange, "fail-soft v0.88 drawRange pin keeps the drawRange object");
  assert.equal(bodyDrawRange.start, 0, "fail-soft v0.88 drawRange pin after groups restores start 0");
  assert.equal(bodyDrawRange.count, Infinity, "fail-soft v0.88 drawRange pin after groups restores count Infinity");
  assertQuestSafeUnlitGroups(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitGroups(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitGroups(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitGroups(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.groups.length, colliderGroupsBefore + 1, "fail-soft collider stays authored groups");
  assert.equal(colliderGrab.geometry.groups.at(-1).materialIndex, 1, "fail-soft collider group materialIndex stays authored");
});

test("packaged ingest pins leftover BufferGeometry drawRange after groups; mapped/lit stay authored", () => {
  const fresh = new THREE.BufferGeometry();
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  assert.equal(fresh.drawRange.start, 0, "r170 BufferGeometry drawRange.start is 0");
  assert.equal(fresh.drawRange.count, Infinity, "r170 BufferGeometry drawRange.count is Infinity");
  const replaced = fresh.drawRange;
  fresh.setDrawRange(1, 2);
  assert.equal(fresh.drawRange, replaced, "r170 setDrawRange mutates the existing object");

  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.drawRange.start = 3;
  mappedMesh.geometry.drawRange.count = 6;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccDrawRange", wrong);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  const influences = [0.8];
  const dictionary = { lid: 0 };
  wrongMesh.morphTargetInfluences = influences;
  wrongMesh.morphTargetDictionary = dictionary;
  const clips = [new THREE.AnimationClip("keep-clips", 0.4, [])];
  wrongMesh.animations = clips;
  wrong.glslVersion = THREE.GLSL3;
  wrong.flatShading = true;
  const visibleBefore = wrongMesh.visible;
  const layersMaskBefore = wrongMesh.layers.mask;
  const worldAutoBefore = wrongMesh.matrixWorldAutoUpdate;
  const rotationOrderBefore = wrongMesh.rotation.order;
  const scaleBefore = wrongMesh.scale;
  const upBefore = wrongMesh.up;
  const geometryBefore = wrongMesh.geometry;
  let setDrawRangeCalls = 0;
  const realSetDrawRange = wrongMesh.geometry.setDrawRange.bind(wrongMesh.geometry);
  wrongMesh.geometry.setDrawRange = (...args) => {
    setDrawRangeCalls += 1;
    return realSetDrawRange(...args);
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.drawRange.start = 4;
  colliderGrabBefore.geometry.drawRange.count = 8;
  const fastenerRange = fastener.geometry.drawRange;
  fastener.geometry.drawRange.start = 1;
  fastener.geometry.drawRange.count = 3;

  ingestPackagedRoot(root, sidecar);

  const fixtureVisuals = groups[0]
    .concat(groups[1], groups[2])
    .flatMap((g) => visualMeshes(g))
    .concat(fastener);
  for (const mesh of fixtureVisuals) {
    if (mesh.material === mapped) continue;
    assertQuestSafeUnlitDrawRange(mesh, "packaged color-only MeshBasic");
    assertQuestSafeUnlitGroups(mesh, "packaged color-only MeshBasic groups stay empty");
    assert.equal(mesh.castShadow, false, "color-only pin does not enable castShadow");
    assert.equal(mesh.visible, true, "color-only pin does not pin mesh.visible");
  }
  assert.equal(setDrawRangeCalls, 0, "ingest does not call setDrawRange");
  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "ingest mutates drawRange in place");
  assert.equal(wrongMesh.geometry.groups, bag, "drawRange pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "drawRange pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.morphTargetInfluences, influences, "drawRange pin does not touch morphTargetInfluences");
  assert.equal(wrongMesh.morphTargetDictionary, dictionary, "drawRange pin does not touch morphTargetDictionary");
  assert.equal(wrongMesh.animations, clips, "drawRange pin does not replace the animations array");
  assert.equal(wrongMesh.animations.length, 1, "drawRange pin does not clear leftover clips");
  assert.equal(wrong.glslVersion, THREE.GLSL3, "drawRange pin does not clear Material glslVersion");
  assert.equal(wrong.flatShading, true, "drawRange pin does not set Material flatShading");
  assert.equal(wrongMesh.matrixWorldAutoUpdate, worldAutoBefore, "drawRange pin does not change matrixWorldAutoUpdate");
  assert.equal(wrongMesh.visible, visibleBefore, "drawRange pin does not change mesh.visible");
  assert.equal(wrongMesh.layers.mask, layersMaskBefore, "drawRange pin does not change layers");
  assert.equal(wrongMesh.rotation.order, rotationOrderBefore, "drawRange pin does not change rotation.order");
  assert.equal(wrongMesh.scale, scaleBefore, "drawRange pin keeps the existing scale Vector3");
  assert.equal(wrongMesh.up, upBefore, "drawRange pin keeps the existing up Vector3");
  assert.equal(fastener.geometry.drawRange, fastenerRange, "fastener drawRange object is kept");
  assertQuestSafeUnlitDrawRange(fastener, "fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.drawRange.start, 3, "mapped MeshBasic stays authored drawRange.start");
  assert.equal(mappedMesh.geometry.drawRange.count, 6, "mapped MeshBasic stays authored drawRange.count");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(Array.isArray(wrongMesh.material), false, "ingest does not assign a material array");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccDrawRange mesh.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.drawRange.start, 4, "collider Mesh stays authored drawRange.start");
  assert.equal(colliderGrab.geometry.drawRange.count, 8, "collider Mesh stays authored drawRange.count");
});

test("packaged ingest without lod groups still pins leftover BufferGeometry drawRange", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyRange = visualMeshes(body)[0].geometry.drawRange;
  visualMeshes(body)[0].geometry.drawRange.start = 2;
  visualMeshes(body)[0].geometry.drawRange.count = 4;
  visualMeshes(body)[0].geometry.addGroup(0, 3, 0);
  visualMeshes(lid)[0].geometry.drawRange = null;
  visualMeshes(latch)[0].geometry.drawRange.start = 1;
  visualMeshes(latch)[0].geometry.drawRange.count = 2;
  delete visualMeshes(tool)[0].geometry.drawRange;
  fastener.geometry.drawRange.start = 5;
  fastener.geometry.drawRange.count = 1;
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.drawRange.start = 6;
  colliderGrab.geometry.drawRange.count = 3;
  ingestPackagedRoot(root, sidecar);
  assert.equal(visualMeshes(body)[0].geometry.drawRange, bodyRange, "fail-soft body drawRange object is mutated in place");
  assertQuestSafeUnlitDrawRange(visualMeshes(body)[0], "fail-soft body");
  assert.equal(visualMeshes(body)[0].geometry.groups.length, 0, "fail-soft groups pin still clears groups before drawRange");
  assertQuestSafeUnlitDrawRange(visualMeshes(lid)[0], "fail-soft lid");
  assert.equal(Array.isArray(visualMeshes(lid)[0].geometry.drawRange), false, "fail-soft null drawRange becomes a plain object");
  assertQuestSafeUnlitDrawRange(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitDrawRange(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitDrawRange(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.drawRange.start, 6, "fail-soft collider stays authored drawRange.start");
  assert.equal(colliderGrab.geometry.drawRange.count, 3, "fail-soft collider stays authored drawRange.count");
});

test("packaged ingest strips leftover skinIndex/skinWeight after drawRange; mapped/lit/collider stay authored", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedSkin = attachLeftoverSkinAttributes(mappedMesh.geometry);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccSkin", wrong);
  const skin = attachLeftoverSkinAttributes(wrongMesh.geometry);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  const skeleton = { bones: [{ name: "keep-bone" }] };
  const bindMatrix = new THREE.Matrix4().makeTranslation(0, 2, 0);
  wrongMesh.skeleton = skeleton;
  wrongMesh.bindMatrix = bindMatrix;
  const geometryBefore = wrongMesh.geometry;
  const beforeBytes = skin.skinBytes;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderSkin = attachLeftoverSkinAttributes(colliderGrabBefore.geometry);
  const fastenerSkin = attachLeftoverSkinAttributes(fastener.geometry);
  const fastenerPosition = fastener.geometry.getAttribute("position");

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.notEqual(wrongMesh.isSkinnedMesh, true, "ingest does not convert the visual to SkinnedMesh");
  assertQuestSafeUnlitSkinAttributes(wrongMesh, "packaged color-only MeshBasic");
  assert.equal(wrongMesh.geometry.getAttribute("position").count, 24, "skin strip does not delete position");
  assert.equal(beforeBytes, 576, "BoxGeometry leftover skin attrs are 576 bytes before strip");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "skin strip does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "skin strip does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "skin strip does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.skeleton, skeleton, "skin strip does not touch skeleton");
  assert.equal(wrongMesh.skeleton.bones[0].name, "keep-bone", "skin strip does not delete bones");
  assert.equal(wrongMesh.bindMatrix, bindMatrix, "skin strip does not touch bindMatrix");
  assert.equal(wrongMesh.bindMatrix.elements[13], 2, "skin strip does not rewrite bindMatrix");
  assertQuestSafeUnlitSkinAttributes(fastener, "fastener");
  assert.equal(fastener.geometry.getAttribute("position") === fastenerPosition || fastener.geometry.getAttribute("position").isFloat16BufferAttribute, true, "fastener position stays or is the pack Float16 quantize");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastenerSkin.skinBytes, 576, "fastener fixture carried 576 leftover skin bytes");
  assert.equal(mappedMesh.geometry.getAttribute("skinIndex"), mappedSkin.skinIndex, "mapped MeshBasic keeps skinIndex");
  assert.equal(mappedMesh.geometry.getAttribute("skinWeight"), mappedSkin.skinWeight, "mapped MeshBasic keeps skinWeight");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("skinIndex"), colliderSkin.skinIndex, "collider Mesh keeps skinIndex");
  assert.equal(colliderGrab.geometry.getAttribute("skinWeight"), colliderSkin.skinWeight, "collider Mesh keeps skinWeight");
});

test("packaged ingest without lod groups still strips leftover skinIndex/skinWeight", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodySkin = attachLeftoverSkinAttributes(bodyMesh.geometry);
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyRange = bodyMesh.geometry.drawRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  attachLeftoverSkinAttributes(visualMeshes(lid)[0].geometry);
  attachLeftoverSkinAttributes(visualMeshes(latch)[0].geometry);
  attachLeftoverSkinAttributes(visualMeshes(tool)[0].geometry);
  attachLeftoverSkinAttributes(fastener.geometry);
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderSkin = attachLeftoverSkinAttributes(colliderGrab.geometry);
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays (no pack quantize)");
  assert.equal(bodySkin.skinBytes, 576, "fail-soft body fixture leftover skin bytes");
  assertQuestSafeUnlitSkinAttributes(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.drawRange, bodyRange, "fail-soft skin strip does not replace drawRange");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitSkinAttributes(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitSkinAttributes(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitSkinAttributes(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitSkinAttributes(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("skinIndex"), colliderSkin.skinIndex, "fail-soft collider keeps skinIndex");
  assert.equal(colliderGrab.geometry.getAttribute("skinWeight"), colliderSkin.skinWeight, "fail-soft collider keeps skinWeight");
});

test("packaged ingest pins leftover BufferAttribute updateRange after skin strip; mapped/lit/collider stay authored", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  spoilBufferAttributeUpdateRange(mappedMesh.geometry, 3, 6);
  const mappedRange = mappedMesh.geometry.getAttribute("position").updateRange;
  const mappedIndexRange = mappedMesh.geometry.index.updateRange;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccUpdateRange", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  spoilBufferAttributeUpdateRange(wrongMesh.geometry, 8, 3);
  const positionRange = position.updateRange;
  const indexRange = index.updateRange;
  position.addUpdateRange(2, 4);
  const updateRanges = position.updateRanges;
  position.setUsage(THREE.DynamicDrawUsage);
  const skin = attachLeftoverSkinAttributes(wrongMesh.geometry);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  let addUpdateRangeCalls = 0;
  const realAdd = position.addUpdateRange.bind(position);
  position.addUpdateRange = (...args) => {
    addUpdateRangeCalls += 1;
    return realAdd(...args);
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  spoilBufferAttributeUpdateRange(colliderGrabBefore.geometry, 4, 8);
  const colliderRange = colliderGrabBefore.geometry.getAttribute("position").updateRange;
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  spoilBufferAttributeUpdateRange(fastener.geometry, 5, 1);
  const fastenerRange = fastenerPosition.updateRange;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "ingest does not replace position");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(position.updateRange, positionRange, "ingest mutates position updateRange in place");
  assert.equal(index.updateRange, indexRange, "ingest mutates index updateRange in place");
  assertQuestSafeUnlitUpdateRange(wrongMesh, "packaged color-only MeshBasic");
  assert.equal(addUpdateRangeCalls, 0, "ingest does not call addUpdateRange");
  assert.equal(position.updateRanges, updateRanges, "v0.91 clears updateRanges in place");
  assert.equal(updateRanges.length, 0, "v0.91 clears leftover updateRanges on color-only MeshBasic");
  assert.equal(updateRanges[0], undefined, "v0.91 drops the partial updateRanges entry");
  assert.equal(position.usage, THREE.StaticDrawUsage, "v0.94 usage pin rewrites leftover DynamicDrawUsage");
  assertQuestSafeUnlitSkinAttributes(wrongMesh, "skin strip still holds");
  assert.equal(skin.skinBytes, 576, "BoxGeometry leftover skin attrs are 576 bytes before strip");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "updateRange pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "updateRange pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "updateRange pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position") === fastenerPosition || fastener.geometry.getAttribute("position").isFloat16BufferAttribute, true, "fastener position stays or is the pack Float16 quantize");
  assertQuestSafeUnlitUpdateRange(fastener, "fastener");
  assertQuestSafeUnlitSkinAttributes(fastener, "fastener skin still absent");
  if (fastener.geometry.getAttribute("position") === fastenerPosition) {
    assert.equal(fastenerPosition.updateRange, fastenerRange, "unreplaced fastener position updateRange object is kept");
  }
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.getAttribute("position").updateRange, mappedRange, "mapped MeshBasic keeps its updateRange object");
  assert.equal(mappedRange.offset, 3, "mapped MeshBasic keeps authored updateRange.offset");
  assert.equal(mappedRange.count, 6, "mapped MeshBasic keeps authored updateRange.count");
  assert.equal(mappedMesh.geometry.index.updateRange, mappedIndexRange, "mapped index updateRange object stays");
  assert.equal(mappedIndexRange.offset, 3, "mapped index offset stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccUpdateRange mesh.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").updateRange, colliderRange, "collider Mesh keeps its updateRange object");
  assert.equal(colliderRange.offset, 4, "collider updateRange.offset stays authored");
  assert.equal(colliderRange.count, 8, "collider updateRange.count stays authored");
  assert.equal(fastenerIndex === fastener.geometry.index || fastener.geometry.index?.isBufferAttribute, true, "fastener index stays a BufferAttribute");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute updateRange", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  spoilBufferAttributeUpdateRange(bodyMesh.geometry, 2, 4);
  const bodyRange = bodyPosition.updateRange;
  const bodyIndexRange = bodyIndex.updateRange;
  const bodyDraw = bodyMesh.geometry.drawRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  attachLeftoverSkinAttributes(bodyMesh.geometry);
  spoilBufferAttributeUpdateRange(visualMeshes(lid)[0].geometry, 1, 2);
  visualMeshes(latch)[0].geometry.getAttribute("position").updateRange = null;
  visualMeshes(latch)[0].geometry.index.updateRange = null;
  delete visualMeshes(tool)[0].geometry.getAttribute("position").updateRange;
  delete visualMeshes(tool)[0].geometry.index.updateRange;
  spoilBufferAttributeUpdateRange(fastener.geometry, 5, 1);
  const colliderGrab = root.getObjectByName("collider_grab");
  spoilBufferAttributeUpdateRange(colliderGrab.geometry, 6, 3);
  const colliderRange = colliderGrab.geometry.getAttribute("position").updateRange;
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays (no pack quantize)");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(bodyPosition.updateRange, bodyRange, "fail-soft body updateRange object is mutated in place");
  assert.equal(bodyIndex.updateRange, bodyIndexRange, "fail-soft body index updateRange object is mutated in place");
  assertQuestSafeUnlitUpdateRange(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitSkinAttributes(bodyMesh, "fail-soft body skin still absent");
  assert.equal(bodyMesh.geometry.drawRange, bodyDraw, "fail-soft updateRange pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitUpdateRange(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitUpdateRange(visualMeshes(latch)[0], "fail-soft latch");
  assert.equal(Array.isArray(visualMeshes(latch)[0].geometry.getAttribute("position").updateRange), false, "fail-soft null updateRange becomes a plain object");
  assertQuestSafeUnlitUpdateRange(visualMeshes(tool)[0], "fail-soft tool");
  assertQuestSafeUnlitUpdateRange(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").updateRange, colliderRange, "fail-soft collider keeps its updateRange object");
  assert.equal(colliderRange.offset, 6, "fail-soft collider updateRange.offset stays authored");
  assert.equal(colliderRange.count, 3, "fail-soft collider updateRange.count stays authored");
});

function assertQuestSafeUnlitUpdateRanges(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  const names = Object.keys(geometry.attributes || {});
  assert.ok(names.length > 0, `${label} has attributes`);
  for (const name of names) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.ok(Array.isArray(attribute.updateRanges), `${label} ${name} updateRanges is an array`);
    assert.equal(attribute.updateRanges.length, 0, `${label} ${name} updateRanges is empty`);
  }
  if (geometry.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.ok(Array.isArray(geometry.index.updateRanges), `${label} index updateRanges is an array`);
    assert.equal(geometry.index.updateRanges.length, 0, `${label} index updateRanges is empty`);
  }
}

function spoilBufferAttributeUpdateRanges(geometry, start = 1, count = 2) {
  const touched = [];
  const spoil = (attribute) => {
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) return;
    if (!Array.isArray(attribute.updateRanges)) attribute.updateRanges = [];
    attribute.updateRanges.push({ start, count });
    touched.push(attribute);
  };
  for (const name of Object.keys(geometry.attributes || {})) spoil(geometry.getAttribute(name));
  if (geometry.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) spoil(geometry.index);
  return touched;
}

test("packaged ingest clears leftover BufferAttribute updateRanges after updateRange pin; mapped/lit/collider stay authored", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  spoilBufferAttributeUpdateRanges(mappedMesh.geometry, 3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const mappedIndexRanges = mappedMesh.geometry.index.updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccUpdateRanges", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  spoilBufferAttributeUpdateRanges(wrongMesh.geometry, 2, 4);
  const positionRanges = position.updateRanges;
  const indexRanges = index.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  index.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  const indexRange = index.updateRange;
  position.setUsage(THREE.DynamicDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  let addUpdateRangeCalls = 0;
  const realAdd = position.addUpdateRange.bind(position);
  position.addUpdateRange = (...args) => {
    addUpdateRangeCalls += 1;
    return realAdd(...args);
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  spoilBufferAttributeUpdateRanges(colliderGrabBefore.geometry, 4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  spoilBufferAttributeUpdateRanges(fastener.geometry, 5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;
  fastenerPosition.updateRange = { offset: 5, count: 1 };
  const fastenerRange = fastenerPosition.updateRange;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "ingest does not replace position");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(position.updateRanges, positionRanges, "ingest clears position updateRanges in place");
  assert.equal(index.updateRanges, indexRanges, "ingest clears index updateRanges in place");
  assert.equal(positionRanges.length, 0, "color-only position updateRanges is empty");
  assert.equal(indexRanges.length, 0, "color-only index updateRanges is empty");
  assert.equal(addUpdateRangeCalls, 0, "ingest does not call addUpdateRange");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assertQuestSafeUnlitUpdateRange(wrongMesh, "updateRange pin still holds");
  assert.equal(position.usage, THREE.StaticDrawUsage, "v0.94 usage pin rewrites leftover DynamicDrawUsage");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "updateRanges pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "updateRanges pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "updateRanges pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assert.equal(fastenerPosition.updateRange, fastenerRange, "fastener updateRange object is kept");
  assertQuestSafeUnlitUpdateRange(fastener, "fastener updateRange still pinned");
  assertQuestSafeUnlitUpdateRanges(fastener, "fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.getAttribute("position").updateRanges, mappedRanges, "mapped MeshBasic keeps its updateRanges array");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped MeshBasic keeps authored updateRanges.start");
  assert.equal(mappedRanges[0].count, 6, "mapped MeshBasic keeps authored updateRanges.count");
  assert.equal(mappedMesh.geometry.index.updateRanges, mappedIndexRanges, "mapped index updateRanges array stays");
  assert.equal(mappedIndexRanges.length, 1, "mapped index updateRanges stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").updateRanges, colliderRanges, "collider Mesh keeps its updateRanges array");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
  assert.equal(colliderRanges[0].count, 8, "collider updateRanges.count stays authored");
});

test("packaged ingest without lod groups still clears leftover BufferAttribute updateRanges", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  spoilBufferAttributeUpdateRanges(bodyMesh.geometry, 2, 4);
  const bodyRanges = bodyPosition.updateRanges;
  const bodyIndexRanges = bodyIndex.updateRanges;
  bodyPosition.updateRange = { offset: 2, count: 4 };
  const bodyRange = bodyPosition.updateRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  spoilBufferAttributeUpdateRanges(visualMeshes(lid)[0].geometry, 1, 2);
  visualMeshes(latch)[0].geometry.getAttribute("position").updateRanges = null;
  visualMeshes(latch)[0].geometry.index.updateRanges = null;
  delete visualMeshes(tool)[0].geometry.getAttribute("position").updateRanges;
  delete visualMeshes(tool)[0].geometry.index.updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  spoilBufferAttributeUpdateRanges(fastener.geometry, 5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;
  const colliderGrab = root.getObjectByName("collider_grab");
  spoilBufferAttributeUpdateRanges(colliderGrab.geometry, 6, 3);
  const colliderRanges = colliderGrab.geometry.getAttribute("position").updateRanges;
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(bodyPosition.updateRanges, bodyRanges, "fail-soft body updateRanges array is cleared in place");
  assert.equal(bodyIndex.updateRanges, bodyIndexRanges, "fail-soft body index updateRanges array is cleared in place");
  assert.equal(bodyRanges.length, 0, "fail-soft body updateRanges is empty");
  assert.equal(bodyIndexRanges.length, 0, "fail-soft body index updateRanges is empty");
  assert.equal(bodyPosition.updateRange, bodyRange, "fail-soft updateRanges pin does not replace updateRange");
  assertQuestSafeUnlitUpdateRange(bodyMesh, "fail-soft body updateRange still pinned");
  assertQuestSafeUnlitUpdateRanges(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitUpdateRanges(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitUpdateRanges(visualMeshes(latch)[0], "fail-soft latch");
  assert.equal(Array.isArray(visualMeshes(latch)[0].geometry.getAttribute("position").updateRanges), true, "fail-soft null updateRanges becomes an array");
  assertQuestSafeUnlitUpdateRanges(visualMeshes(tool)[0], "fail-soft tool");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft fastener position stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fail-soft fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fail-soft fastener updateRanges is cleared");
  assertQuestSafeUnlitUpdateRanges(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").updateRanges, colliderRanges, "fail-soft collider keeps its updateRanges array");
  assert.equal(colliderRanges.length, 1, "fail-soft collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 6, "fail-soft collider updateRanges.start stays authored");
  assert.equal(colliderRanges[0].count, 3, "fail-soft collider updateRanges.count stays authored");
});

function assertQuestSafeUnlitBounds(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.geometry.boundingBox, null, `${label} boundingBox is null`);
  assert.equal(mesh.geometry.boundingSphere, null, `${label} boundingSphere is null`);
}

function spoilGeometryBounds(geometry) {
  const box = new THREE.Box3(new THREE.Vector3(9, 8, 7), new THREE.Vector3(10, 11, 12));
  const sphere = new THREE.Sphere(new THREE.Vector3(4, 5, 6), 0.01);
  geometry.boundingBox = box;
  geometry.boundingSphere = sphere;
  return { box, sphere };
}

test("packaged ingest pins leftover BufferGeometry bounds to null after updateRanges clear; mapped/lit/collider stay authored", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccBounds", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.setUsage(THREE.DynamicDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  let computeCalls = 0;
  const realBox = wrongMesh.geometry.computeBoundingBox.bind(wrongMesh.geometry);
  const realSphere = wrongMesh.geometry.computeBoundingSphere.bind(wrongMesh.geometry);
  wrongMesh.geometry.computeBoundingBox = (...args) => {
    computeCalls += 1;
    return realBox(...args);
  };
  wrongMesh.geometry.computeBoundingSphere = (...args) => {
    computeCalls += 1;
    return realSphere(...args);
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(computeCalls, 0, "bounds pin does not call compute*");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only MeshBasic");
  assert.equal(spoiled.box.min.x, 9, "pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "pin does not mutate the detached Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(position.usage, THREE.StaticDrawUsage, "v0.94 usage pin rewrites leftover DynamicDrawUsage");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "bounds pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "bounds pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "bounds pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitBounds(fastener, "fastener");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccBounds mesh.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferGeometry bounds to null", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  bodyPosition.addUpdateRange(2, 4);
  const bodyRanges = bodyPosition.updateRanges;
  bodyPosition.updateRange = { offset: 2, count: 4 };
  const bodyRange = bodyPosition.updateRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  spoilGeometryBounds(visualMeshes(lid)[0].geometry);
  visualMeshes(latch)[0].geometry.boundingBox = null;
  visualMeshes(latch)[0].geometry.boundingSphere = null;
  delete visualMeshes(tool)[0].geometry.boundingBox;
  delete visualMeshes(tool)[0].geometry.boundingSphere;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  spoilGeometryBounds(fastener.geometry);
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached Sphere");
  assert.equal(bodyPosition.updateRanges, bodyRanges, "fail-soft updateRanges array is kept");
  assert.equal(bodyRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(bodyPosition.updateRange, bodyRange, "fail-soft bounds pin does not replace updateRange");
  assert.equal(bodyRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(bodyRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitBounds(visualMeshes(lid)[0], "fail-soft lid");
  assertQuestSafeUnlitBounds(visualMeshes(latch)[0], "fail-soft latch");
  assertQuestSafeUnlitBounds(visualMeshes(tool)[0], "fail-soft tool");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft fastener position stays");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
});

function assertQuestSafeUnlitMeshBoundingSphere(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.boundingSphere, undefined, `${label} object boundingSphere is absent`);
  assert.equal(Object.hasOwn(mesh, "boundingSphere"), false, `${label} has no own boundingSphere`);
}

function spoilMeshBoundingSphere(mesh, radius = 0.01) {
  const sphere = new THREE.Sphere(new THREE.Vector3(4, 5, 6), radius);
  mesh.boundingSphere = sphere;
  return sphere;
}

test("packaged ingest deletes leftover object boundingSphere after geometry bounds pin; mapped/lit/collider keep authored object spheres", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccBounds", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.setUsage(THREE.DynamicDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  let computeCalls = 0;
  const realBox = wrongMesh.geometry.computeBoundingBox.bind(wrongMesh.geometry);
  const realSphere = wrongMesh.geometry.computeBoundingSphere.bind(wrongMesh.geometry);
  wrongMesh.geometry.computeBoundingBox = (...args) => {
    computeCalls += 1;
    return realBox(...args);
  };
  wrongMesh.geometry.computeBoundingSphere = (...args) => {
    computeCalls += 1;
    return realSphere(...args);
  };
  wrongMesh.computeBoundingSphere = () => {
    computeCalls += 1;
  };
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccBounds mesh.name");
  assert.equal(computeCalls, 0, "object-sphere pin does not call compute*");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(position.usage, THREE.StaticDrawUsage, "v0.94 usage pin rewrites leftover DynamicDrawUsage");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "object-sphere pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "object-sphere pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "object-sphere pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still deletes leftover object boundingSphere", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  bodyPosition.addUpdateRange(2, 4);
  const bodyRanges = bodyPosition.updateRanges;
  bodyPosition.updateRange = { offset: 2, count: 4 };
  const bodyRange = bodyPosition.updateRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(bodyPosition.updateRanges, bodyRanges, "fail-soft updateRanges array is kept");
  assert.equal(bodyRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(bodyPosition.updateRange, bodyRange, "fail-soft object-sphere pin does not replace updateRange");
  assert.equal(bodyRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(bodyRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft fastener position stays");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});

function assertQuestSafeUnlitUsage(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  for (const name of Object.keys(geometry?.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.usage, THREE.StaticDrawUsage, `${label} ${name} usage is StaticDrawUsage`);
  }
  if (geometry?.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.usage, THREE.StaticDrawUsage, `${label} index usage is StaticDrawUsage`);
  }
}

function assertQuestSafeUnlitNormalized(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  for (const name of Object.keys(geometry?.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.normalized, false, `${label} ${name} normalized is false`);
  }
  if (geometry?.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.normalized, false, `${label} index normalized is false`);
  }
}

test("packaged ingest pins leftover BufferAttribute usage to StaticDrawUsage after the object-sphere clear; mapped/lit/collider keep authored usage", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  mappedMesh.geometry.index.setUsage(THREE.StreamDrawUsage);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccUsage", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.setUsage(THREE.DynamicDrawUsage);
  index.setUsage(THREE.StreamDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  colliderGrabBefore.geometry.index.setUsage(THREE.DynamicCopyUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastenerIndex.setUsage(THREE.StreamDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccUsage mesh.name");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "usage pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "usage pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "usage pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "usage pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "usage pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "usage pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.frustumCulled, true, "usage pin does not change frustumCulled");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastener.geometry.index, fastenerIndex, "fastener index stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitUsage(fastener, "fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "mapped MeshBasic keeps authored usage");
  assert.equal(mappedMesh.geometry.index.usage, THREE.StreamDrawUsage, "mapped index usage stays authored");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "collider position usage stays authored");
  assert.equal(colliderGrab.geometry.index.usage, THREE.DynamicCopyUsage, "collider index usage stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute usage to StaticDrawUsage", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  bodyPosition.setUsage(THREE.DynamicDrawUsage);
  bodyIndex.setUsage(THREE.StreamDrawUsage);
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  bodyPosition.addUpdateRange(2, 4);
  const bodyRanges = bodyPosition.updateRanges;
  bodyPosition.updateRange = { offset: 2, count: 4 };
  const bodyRange = bodyPosition.updateRange;
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  lidMesh.geometry.index.setUsage(THREE.DynamicCopyUsage);
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.getAttribute("position").usage;
  delete latchMesh.geometry.index.usage;
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.geometry.getAttribute("position").setUsage(THREE.StreamDrawUsage);
  toolMesh.geometry.index.setUsage(THREE.DynamicDrawUsage);
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastener.geometry.index.setUsage(THREE.StreamDrawUsage);
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assertQuestSafeUnlitUsage(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(bodyPosition.updateRanges, bodyRanges, "fail-soft updateRanges array is kept");
  assert.equal(bodyRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(bodyPosition.updateRange, bodyRange, "fail-soft usage pin does not replace updateRange");
  assert.equal(bodyRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(bodyRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitUsage(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitUsage(latchMesh, "fail-soft latch deleted usage");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitUsage(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft fastener position stays");
  assertQuestSafeUnlitUsage(fastener, "fail-soft fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "fail-soft collider keeps authored usage");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});

test("packaged ingest pins leftover BufferAttribute normalized to false after the usage pin; mapped/lit/collider keep authored normalized", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.getAttribute("position").normalized = true;
  mappedMesh.geometry.index.normalized = true;
  mappedMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccNormalized", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.normalized = true;
  index.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  index.setUsage(THREE.StreamDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.getAttribute("position").normalized = true;
  colliderGrabBefore.geometry.index.normalized = true;
  colliderGrabBefore.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.normalized = true;
  fastenerIndex.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastenerIndex.setUsage(THREE.StreamDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccNormalized mesh.name");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "normalized pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "normalized pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "normalized pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "normalized pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "normalized pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "normalized pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.frustumCulled, true, "normalized pin does not change frustumCulled");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.geometry.index, fastenerIndex, "fastener index stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitNormalized(fastener, "fastener");
  assertQuestSafeUnlitUsage(fastener, "fastener usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.getAttribute("position").normalized, true, "mapped MeshBasic keeps authored normalized");
  assert.equal(mappedMesh.geometry.index.normalized, true, "mapped index normalized stays authored");
  assert.equal(mappedMesh.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "mapped MeshBasic keeps authored usage");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "collider position normalized stays authored");
  assert.equal(colliderGrab.geometry.index.normalized, true, "collider index normalized stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "collider position usage stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute normalized to false", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  bodyPosition.normalized = true;
  bodyIndex.normalized = true;
  bodyPosition.setUsage(THREE.DynamicDrawUsage);
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  bodyPosition.addUpdateRange(2, 4);
  bodyPosition.updateRange = { offset: 2, count: 4 };
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.getAttribute("position").normalized = true;
  lidMesh.geometry.index.normalized = true;
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.getAttribute("position").normalized;
  latchMesh.geometry.index.normalized = true;
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.geometry.getAttribute("position").normalized = true;
  toolMesh.geometry.index.normalized = true;
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.normalized = true;
  fastener.geometry.index.normalized = true;
  fastenerPosition.setUsage(THREE.StreamDrawUsage);
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.getAttribute("position").normalized = true;
  colliderGrab.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  const packedBodyPosition = bodyMesh.geometry.getAttribute("position");
  assert.equal(packedBodyPosition, bodyPosition, "fail-soft body position stays");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(packedBodyPosition.normalized, false, "fail-soft body position normalized is false");
  assert.equal(bodyMesh.geometry.index.normalized, false, "fail-soft body index normalized is false");
  assertQuestSafeUnlitNormalized(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitUsage(bodyMesh, "fail-soft body usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(packedBodyPosition.updateRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(packedBodyPosition.updateRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(packedBodyPosition.updateRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitNormalized(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assert.equal(latchMesh.geometry.getAttribute("position").normalized, false, "fail-soft latch deleted normalized is false");
  assertQuestSafeUnlitNormalized(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitNormalized(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fail-soft fastener typed array stays");
  assert.equal(fastenerPosition.normalized, false, "fail-soft fastener normalized is pinned");
  assert.equal(fastenerPosition.usage, THREE.StaticDrawUsage, "fail-soft fastener usage pin still holds");
  assertQuestSafeUnlitNormalized(fastener, "fail-soft fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "fail-soft collider keeps authored normalized");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "fail-soft collider keeps authored usage");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});


function assertQuestSafeUnlitGpuType(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  for (const name of Object.keys(geometry?.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.gpuType, THREE.FloatType, `${label} ${name} gpuType is FloatType`);
  }
  if (geometry?.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.gpuType, THREE.FloatType, `${label} index gpuType is FloatType`);
  }
}

test("packaged ingest pins leftover BufferAttribute gpuType to FloatType after the normalized pin; mapped/lit/collider keep authored gpuType", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  mappedMesh.geometry.index.gpuType = THREE.IntType;
  mappedMesh.geometry.getAttribute("position").normalized = true;
  mappedMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccGpuType", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.gpuType = THREE.IntType;
  index.gpuType = THREE.HalfFloatType;
  position.normalized = true;
  index.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  index.setUsage(THREE.StreamDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrabBefore.geometry.index.gpuType = THREE.IntType;
  colliderGrabBefore.geometry.getAttribute("position").normalized = true;
  colliderGrabBefore.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.gpuType = THREE.IntType;
  fastenerIndex.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerIndex.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastenerIndex.setUsage(THREE.StreamDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGpuType mesh.name");
  assertQuestSafeUnlitGpuType(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only normalized still false");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "gpuType pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "gpuType pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "gpuType pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "gpuType pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "gpuType pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "gpuType pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.frustumCulled, true, "gpuType pin does not change frustumCulled");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.geometry.index, fastenerIndex, "fastener index stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitGpuType(fastener, "fastener");
  assertQuestSafeUnlitNormalized(fastener, "fastener normalized still false");
  assertQuestSafeUnlitUsage(fastener, "fastener usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.getAttribute("position").gpuType, THREE.IntType, "mapped MeshBasic keeps authored gpuType");
  assert.equal(mappedMesh.geometry.index.gpuType, THREE.IntType, "mapped index gpuType stays authored");
  assert.equal(mappedMesh.geometry.getAttribute("position").normalized, true, "mapped MeshBasic keeps authored normalized");
  assert.equal(mappedMesh.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "mapped MeshBasic keeps authored usage");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "collider position gpuType stays authored");
  assert.equal(colliderGrab.geometry.index.gpuType, THREE.IntType, "collider index gpuType stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "collider position normalized stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "collider position usage stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute gpuType to FloatType", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  const float16 = new THREE.Float16BufferAttribute(new Uint16Array(bodyPosition.count * 3), 3);
  float16.gpuType = THREE.IntType;
  float16.normalized = true;
  const float16Array = float16.array;
  bodyMesh.geometry.setAttribute("position", float16);
  bodyIndex.gpuType = THREE.IntType;
  bodyIndex.normalized = true;
  float16.setUsage(THREE.DynamicDrawUsage);
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  float16.addUpdateRange(2, 4);
  float16.updateRange = { offset: 2, count: 4 };
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  lidMesh.geometry.index.gpuType = THREE.IntType;
  lidMesh.geometry.getAttribute("position").normalized = true;
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.getAttribute("position").gpuType;
  latchMesh.geometry.index.gpuType = THREE.HalfFloatType;
  latchMesh.geometry.getAttribute("position").normalized = true;
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  toolMesh.geometry.index.gpuType = THREE.IntType;
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.gpuType = THREE.IntType;
  fastener.geometry.index.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerPosition.setUsage(THREE.StreamDrawUsage);
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrab.geometry.getAttribute("position").normalized = true;
  colliderGrab.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  const packedBodyPosition = bodyMesh.geometry.getAttribute("position");
  assert.equal(packedBodyPosition, float16, "fail-soft Float16 body position stays");
  assert.equal(packedBodyPosition.array, float16Array, "fail-soft Float16 typed array stays");
  assert.equal(packedBodyPosition.isFloat16BufferAttribute, true, "fail-soft body position stays Float16");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(packedBodyPosition.gpuType, THREE.FloatType, "fail-soft Float16 position gpuType is FloatType");
  assert.equal(bodyMesh.geometry.index.gpuType, THREE.FloatType, "fail-soft body index gpuType is FloatType");
  assert.equal(packedBodyPosition.normalized, false, "fail-soft normalized pin still holds on the Float16 position");
  assertQuestSafeUnlitGpuType(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitNormalized(bodyMesh, "fail-soft body normalized");
  assertQuestSafeUnlitUsage(bodyMesh, "fail-soft body usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(packedBodyPosition.updateRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(packedBodyPosition.updateRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(packedBodyPosition.updateRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitGpuType(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assert.equal(latchMesh.geometry.getAttribute("position").gpuType, THREE.FloatType, "fail-soft latch deleted gpuType is FloatType");
  assertQuestSafeUnlitGpuType(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitGpuType(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fail-soft fastener typed array stays");
  assert.equal(fastenerPosition.gpuType, THREE.FloatType, "fail-soft fastener gpuType is pinned");
  assert.equal(fastenerPosition.normalized, false, "fail-soft fastener normalized pin still holds");
  assert.equal(fastenerPosition.usage, THREE.StaticDrawUsage, "fail-soft fastener usage pin still holds");
  assertQuestSafeUnlitGpuType(fastener, "fail-soft fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "fail-soft collider keeps authored gpuType");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "fail-soft collider keeps authored normalized");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "fail-soft collider keeps authored usage");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});


function assertQuestSafeUnlitName(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  for (const name of Object.keys(geometry?.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.name, "", `${label} ${name} name is empty`);
  }
  if (geometry?.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.name, "", `${label} index name is empty`);
  }
}

test("packaged ingest pins leftover BufferAttribute name to empty string after the gpuType pin; mapped/lit/collider keep authored name", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.getAttribute("position").name = "POSITION";
  mappedMesh.geometry.index.name = "indices";
  mappedMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  mappedMesh.geometry.getAttribute("position").normalized = true;
  mappedMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccName", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.name = "POSITION";
  index.name = "accessor_4";
  position.gpuType = THREE.IntType;
  index.gpuType = THREE.HalfFloatType;
  position.normalized = true;
  index.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  index.setUsage(THREE.StreamDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.getAttribute("position").name = "POSITION";
  colliderGrabBefore.geometry.index.name = "indices";
  colliderGrabBefore.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrabBefore.geometry.getAttribute("position").normalized = true;
  colliderGrabBefore.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.name = "POSITION";
  fastenerIndex.name = "indices";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerIndex.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerIndex.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastenerIndex.setUsage(THREE.StreamDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccName mesh.name");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccName mesh.name");
  assertQuestSafeUnlitName(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitGpuType(wrongMesh, "packaged color-only gpuType still FloatType");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only normalized still false");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "name pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "name pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "name pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "name pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "name pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "name pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.frustumCulled, true, "name pin does not change frustumCulled");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.geometry.index, fastenerIndex, "fastener index stays");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitName(fastener, "fastener");
  assertQuestSafeUnlitGpuType(fastener, "fastener gpuType still FloatType");
  assertQuestSafeUnlitNormalized(fastener, "fastener normalized still false");
  assertQuestSafeUnlitUsage(fastener, "fastener usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.getAttribute("position").name, "POSITION", "mapped MeshBasic keeps authored name");
  assert.equal(mappedMesh.geometry.index.name, "indices", "mapped index name stays authored");
  assert.equal(mappedMesh.geometry.getAttribute("position").gpuType, THREE.IntType, "mapped MeshBasic keeps authored gpuType");
  assert.equal(mappedMesh.geometry.getAttribute("position").normalized, true, "mapped MeshBasic keeps authored normalized");
  assert.equal(mappedMesh.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "mapped MeshBasic keeps authored usage");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "collider position name stays authored");
  assert.equal(colliderGrab.geometry.index.name, "indices", "collider index name stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "collider position gpuType stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "collider position normalized stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "collider position usage stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute name to empty string", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  const float16 = new THREE.Float16BufferAttribute(new Uint16Array(bodyPosition.count * 3), 3);
  float16.name = "POSITION";
  float16.gpuType = THREE.IntType;
  float16.normalized = true;
  const float16Array = float16.array;
  bodyMesh.geometry.setAttribute("position", float16);
  bodyIndex.name = "indices";
  bodyIndex.gpuType = THREE.IntType;
  bodyIndex.normalized = true;
  float16.setUsage(THREE.DynamicDrawUsage);
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  float16.addUpdateRange(2, 4);
  float16.updateRange = { offset: 2, count: 4 };
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.getAttribute("position").name = "POSITION";
  lidMesh.geometry.index.name = "indices";
  lidMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.getAttribute("position").name;
  latchMesh.geometry.index.name = "accessor_9";
  latchMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.geometry.getAttribute("position").name = "POSITION";
  toolMesh.geometry.index.name = "indices";
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.name = "POSITION";
  fastener.geometry.index.name = "indices";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerPosition.setUsage(THREE.StreamDrawUsage);
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.getAttribute("position").name = "POSITION";
  colliderGrab.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrab.geometry.getAttribute("position").normalized = true;
  colliderGrab.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  const packedBodyPosition = bodyMesh.geometry.getAttribute("position");
  assert.equal(packedBodyPosition, float16, "fail-soft Float16 body position stays");
  assert.equal(packedBodyPosition.array, float16Array, "fail-soft Float16 typed array stays");
  assert.equal(packedBodyPosition.isFloat16BufferAttribute, true, "fail-soft body position stays Float16");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(packedBodyPosition.name, "", "fail-soft Float16 position name is empty");
  assert.equal(bodyMesh.geometry.index.name, "", "fail-soft body index name is empty");
  assert.equal(packedBodyPosition.gpuType, THREE.FloatType, "fail-soft gpuType pin still holds on the Float16 position");
  assertQuestSafeUnlitName(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitGpuType(bodyMesh, "fail-soft body gpuType");
  assertQuestSafeUnlitNormalized(bodyMesh, "fail-soft body normalized");
  assertQuestSafeUnlitUsage(bodyMesh, "fail-soft body usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(packedBodyPosition.updateRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(packedBodyPosition.updateRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(packedBodyPosition.updateRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitName(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assert.equal(latchMesh.geometry.getAttribute("position").name, "", "fail-soft latch deleted name is empty");
  assertQuestSafeUnlitName(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitGpuType(latchMesh, "fail-soft latch gpuType");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitName(toolMesh, "fail-soft tool");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fail-soft fastener typed array stays");
  assert.equal(fastenerPosition.name, "", "fail-soft fastener name is pinned");
  assert.equal(fastenerPosition.gpuType, THREE.FloatType, "fail-soft fastener gpuType pin still holds");
  assert.equal(fastenerPosition.normalized, false, "fail-soft fastener normalized pin still holds");
  assert.equal(fastenerPosition.usage, THREE.StaticDrawUsage, "fail-soft fastener usage pin still holds");
  assertQuestSafeUnlitName(fastener, "fail-soft fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "fail-soft collider keeps authored name");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "fail-soft collider keeps authored gpuType");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "fail-soft collider keeps authored normalized");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "fail-soft collider keeps authored usage");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});


function assertQuestSafeUnlitVersion(mesh, label = "color-only MeshBasic mesh") {
  const geometry = mesh.geometry;
  for (const name of Object.keys(geometry?.attributes || {})) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || attribute.isInterleavedBufferAttribute || attribute.isBufferAttribute !== true) continue;
    assert.equal(attribute.version, 0, `${label} ${name} version is 0`);
  }
  if (geometry?.index?.isBufferAttribute && !geometry.index.isInterleavedBufferAttribute) {
    assert.equal(geometry.index.version, 0, `${label} index version is 0`);
  }
}

test("packaged ingest pins leftover BufferAttribute version to 0 after the name pin; mapped/lit/collider keep authored version", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.getAttribute("position").version = 8;
  mappedMesh.geometry.index.version = 3;
  mappedMesh.geometry.getAttribute("position").name = "POSITION";
  mappedMesh.geometry.index.name = "indices";
  mappedMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  mappedMesh.geometry.getAttribute("position").normalized = true;
  mappedMesh.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  mappedMesh.geometry.getAttribute("position").addUpdateRange(3, 6);
  const mappedRanges = mappedMesh.geometry.getAttribute("position").updateRanges;
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccVersion", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const upload = () => {};
  position.onUpload(upload);
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  position.needsUpdate = true;
  position.needsUpdate = true;
  index.version = 7;
  position.name = "POSITION";
  index.name = "accessor_4";
  position.gpuType = THREE.IntType;
  index.gpuType = THREE.HalfFloatType;
  position.normalized = true;
  index.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  index.setUsage(THREE.StreamDrawUsage);
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.getAttribute("position").version = 9;
  colliderGrabBefore.geometry.index.version = 9;
  colliderGrabBefore.geometry.getAttribute("position").name = "POSITION";
  colliderGrabBefore.geometry.index.name = "indices";
  colliderGrabBefore.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrabBefore.geometry.getAttribute("position").normalized = true;
  colliderGrabBefore.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  colliderGrabBefore.geometry.getAttribute("position").addUpdateRange(4, 8);
  const colliderRanges = colliderGrabBefore.geometry.getAttribute("position").updateRanges;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerIndex = fastener.geometry.index;
  const fastenerArray = fastenerPosition.array;
  const fastenerUpload = () => {};
  fastenerPosition.onUpload(fastenerUpload);
  fastenerPosition.version = 5;
  fastenerIndex.version = 4;
  fastenerPosition.name = "POSITION";
  fastenerIndex.name = "indices";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerIndex.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerIndex.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  fastenerIndex.setUsage(THREE.StreamDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);
  fastenerPosition.addUpdateRange(5, 1);
  const fastenerRanges = fastenerPosition.updateRanges;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "morph-blocked position stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccVersion mesh.name");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccVersion mesh.name");
  assert.equal(position.version, 0, "leftover position version is pinned to 0");
  assert.equal(index.version, 0, "leftover index version is pinned to 0");
  assert.equal(isCpuArrayReleaseOnUpload(position.onUploadCallback, wrongMesh.geometry), true, "v1.8 onUpload pin replaces a non-release callback after morphs are cleared");
  assert.equal(position.array, positionArray, "v1.8 onUpload pin does not null position.array");
  assertQuestSafeUnlitVersion(wrongMesh, "packaged color-only MeshBasic");
  assertQuestSafeUnlitName(wrongMesh, "packaged color-only name still empty");
  assertQuestSafeUnlitGpuType(wrongMesh, "packaged color-only gpuType still FloatType");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only normalized still false");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "version pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "version pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "version pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "version pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "version pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(wrongMesh.geometry.morphAttributes, morphBag, "version pin does not replace morphAttributes");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(wrongMesh.frustumCulled, true, "version pin does not change frustumCulled");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.geometry.index, fastenerIndex, "fastener index stays");
  assert.equal(isCpuArrayReleaseOnUpload(fastenerPosition.onUploadCallback, fastener.geometry), true, "v1.8 onUpload pin replaces the fastener non-release callback");
  assert.equal(fastenerPosition.array, fastenerArray, "v1.8 onUpload pin does not null the fastener array");
  assert.equal(fastenerPosition.updateRanges, fastenerRanges, "fastener updateRanges array is kept");
  assert.equal(fastenerRanges.length, 0, "fastener leftover updateRanges is cleared");
  assertQuestSafeUnlitVersion(fastener, "fastener");
  assertQuestSafeUnlitName(fastener, "fastener name still empty");
  assertQuestSafeUnlitGpuType(fastener, "fastener gpuType still FloatType");
  assertQuestSafeUnlitNormalized(fastener, "fastener normalized still false");
  assertQuestSafeUnlitUsage(fastener, "fastener usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(fastener.frustumCulled, true, "fastener frustumCulled stays true");
  assert.equal(mappedMesh.geometry.getAttribute("position").version, 8, "mapped MeshBasic keeps authored version");
  assert.equal(mappedMesh.geometry.index.version, 3, "mapped index version stays authored");
  assert.equal(mappedMesh.geometry.getAttribute("position").name, "POSITION", "mapped MeshBasic keeps authored name");
  assert.equal(mappedMesh.geometry.index.name, "indices", "mapped index name stays authored");
  assert.equal(mappedMesh.geometry.getAttribute("position").gpuType, THREE.IntType, "mapped MeshBasic keeps authored gpuType");
  assert.equal(mappedMesh.geometry.getAttribute("position").normalized, true, "mapped MeshBasic keeps authored normalized");
  assert.equal(mappedMesh.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "mapped MeshBasic keeps authored usage");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  assert.equal(mappedRanges.length, 1, "mapped MeshBasic keeps authored updateRanges");
  assert.equal(mappedRanges[0].start, 3, "mapped updateRanges.start stays authored");
  assert.equal(wrongMesh.material, wrong, "ingest does not invent or replace color-only materials");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 9, "collider position version stays authored");
  assert.equal(colliderGrab.geometry.index.version, 9, "collider index version stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "collider position name stays authored");
  assert.equal(colliderGrab.geometry.index.name, "indices", "collider index name stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "collider position gpuType stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "collider position normalized stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "collider position usage stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
  assert.equal(colliderRanges.length, 1, "collider updateRanges stays authored");
  assert.equal(colliderRanges[0].start, 4, "collider updateRanges.start stays authored");
});

test("packaged ingest without lod groups still pins leftover BufferAttribute version to 0", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  const float16 = new THREE.Float16BufferAttribute(new Uint16Array(bodyPosition.count * 3), 3);
  float16.version = 5;
  float16.name = "POSITION";
  float16.gpuType = THREE.IntType;
  float16.normalized = true;
  const float16Array = float16.array;
  const float16Upload = () => {};
  float16.onUpload(float16Upload);
  bodyMesh.geometry.setAttribute("position", float16);
  bodyIndex.version = 4;
  bodyIndex.name = "indices";
  bodyIndex.gpuType = THREE.IntType;
  bodyIndex.normalized = true;
  float16.setUsage(THREE.DynamicDrawUsage);
  const bodySpoiled = spoilGeometryBounds(bodyMesh.geometry);
  const bodySphere = spoilMeshBoundingSphere(bodyMesh);
  float16.addUpdateRange(2, 4);
  float16.updateRange = { offset: 2, count: 4 };
  bodyMesh.geometry.drawRange.start = 2;
  bodyMesh.geometry.drawRange.count = 4;
  bodyMesh.geometry.addGroup(0, 3, 0);
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.getAttribute("position").version = 6;
  lidMesh.geometry.index.version = 2;
  lidMesh.geometry.getAttribute("position").name = "POSITION";
  lidMesh.geometry.index.name = "indices";
  lidMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  spoilGeometryBounds(lidMesh.geometry);
  lidMesh.boundingSphere = null;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.getAttribute("position").version;
  latchMesh.geometry.index.version = 3;
  latchMesh.geometry.getAttribute("position").name = "";
  latchMesh.geometry.index.name = "accessor_9";
  latchMesh.geometry.getAttribute("position").gpuType = THREE.IntType;
  latchMesh.geometry.boundingBox = null;
  latchMesh.geometry.boundingSphere = null;
  delete latchMesh.boundingSphere;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.geometry.getAttribute("position").version = 1;
  toolMesh.geometry.index.version = 1;
  toolMesh.geometry.getAttribute("position").name = "POSITION";
  toolMesh.geometry.index.name = "indices";
  delete toolMesh.geometry.boundingBox;
  delete toolMesh.geometry.boundingSphere;
  const toolSphere = spoilMeshBoundingSphere(toolMesh, 0.08);
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.version = 4;
  fastener.geometry.index.version = 2;
  fastenerPosition.name = "POSITION";
  fastener.geometry.index.name = "indices";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerPosition.setUsage(THREE.StreamDrawUsage);
  spoilGeometryBounds(fastener.geometry);
  spoilMeshBoundingSphere(fastener, 0.09);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.getAttribute("position").version = 10;
  colliderGrab.geometry.getAttribute("position").name = "POSITION";
  colliderGrab.geometry.getAttribute("position").gpuType = THREE.IntType;
  colliderGrab.geometry.getAttribute("position").normalized = true;
  colliderGrab.geometry.getAttribute("position").setUsage(THREE.DynamicDrawUsage);
  const colliderSpoiled = spoilGeometryBounds(colliderGrab.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrab, 0.11);
  ingestPackagedRoot(root, sidecar);
  const packedBodyPosition = bodyMesh.geometry.getAttribute("position");
  assert.equal(packedBodyPosition, float16, "fail-soft Float16 body position stays");
  assert.equal(packedBodyPosition.array, float16Array, "fail-soft Float16 typed array stays");
  assert.equal(packedBodyPosition.isFloat16BufferAttribute, true, "fail-soft body position stays Float16");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(packedBodyPosition.version, 0, "fail-soft Float16 position version is 0");
  assert.equal(bodyMesh.geometry.index.version, 0, "fail-soft body index version is 0");
  assert.equal(packedBodyPosition.name, "", "fail-soft name pin still holds on the Float16 position");
  assert.equal(isCpuArrayReleaseOnUpload(packedBodyPosition.onUploadCallback, bodyMesh.geometry), true, "v1.8 fail-soft onUpload pin replaces a non-release callback");
  assert.equal(packedBodyPosition.array, float16Array, "v1.8 onUpload pin does not null the Float16 array");
  assert.equal(packedBodyPosition.gpuType, THREE.FloatType, "fail-soft gpuType pin still holds on the Float16 position");
  assertQuestSafeUnlitVersion(bodyMesh, "fail-soft body");
  assertQuestSafeUnlitName(bodyMesh, "fail-soft body name");
  assertQuestSafeUnlitGpuType(bodyMesh, "fail-soft body gpuType");
  assertQuestSafeUnlitNormalized(bodyMesh, "fail-soft body normalized");
  assertQuestSafeUnlitUsage(bodyMesh, "fail-soft body usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(bodyMesh, "fail-soft body");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft body boundingBox is null");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft body boundingSphere is null");
  assert.equal(bodySpoiled.box.min.x, 9, "fail-soft pin does not mutate the detached Box3");
  assert.equal(bodySpoiled.sphere.radius, 0.01, "fail-soft pin does not mutate the detached geometry Sphere");
  assert.equal(bodySphere.radius, 0.01, "fail-soft pin does not mutate the detached object Sphere");
  assert.equal(packedBodyPosition.updateRanges.length, 0, "fail-soft updateRanges clear still holds");
  assert.equal(packedBodyPosition.updateRange.offset, 0, "fail-soft updateRange pin still rewrites offset");
  assert.equal(packedBodyPosition.updateRange.count, -1, "fail-soft updateRange pin still rewrites count");
  assertQuestSafeUnlitDrawRange(bodyMesh, "fail-soft body drawRange still pinned");
  assert.equal(bodyMesh.geometry.groups.length, 0, "fail-soft groups pin still clears groups");
  assertQuestSafeUnlitVersion(lidMesh, "fail-soft lid");
  assertQuestSafeUnlitMeshBoundingSphere(lidMesh, "fail-soft lid null object sphere");
  assertQuestSafeUnlitBounds(lidMesh, "fail-soft lid");
  assert.equal(latchMesh.geometry.getAttribute("position").version, 0, "fail-soft latch deleted version is 0");
  assertQuestSafeUnlitVersion(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitName(latchMesh, "fail-soft latch name");
  assertQuestSafeUnlitGpuType(latchMesh, "fail-soft latch gpuType");
  assertQuestSafeUnlitMeshBoundingSphere(latchMesh, "fail-soft latch");
  assertQuestSafeUnlitBounds(latchMesh, "fail-soft latch geometry bounds");
  assertQuestSafeUnlitVersion(toolMesh, "fail-soft tool");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assertQuestSafeUnlitMeshBoundingSphere(toolMesh, "fail-soft tool");
  assertQuestSafeUnlitBounds(toolMesh, "fail-soft tool geometry bounds");
  assert.equal(toolSphere.center.y, 5, "fail-soft tool pin does not mutate the detached Sphere");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fail-soft morph-blocked fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fail-soft fastener typed array stays");
  assert.equal(fastenerPosition.version, 0, "fail-soft fastener version is pinned");
  assert.equal(fastenerPosition.name, "", "fail-soft fastener name pin still holds");
  assert.equal(fastenerPosition.gpuType, THREE.FloatType, "fail-soft fastener gpuType pin still holds");
  assert.equal(fastenerPosition.normalized, false, "fail-soft fastener normalized pin still holds");
  assert.equal(fastenerPosition.usage, THREE.StaticDrawUsage, "fail-soft fastener usage pin still holds");
  assertQuestSafeUnlitVersion(fastener, "fail-soft fastener");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fail-soft fastener");
  assertQuestSafeUnlitBounds(fastener, "fail-soft fastener geometry bounds");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastener.matrixAutoUpdate, true, "fail-soft fastener stays matrix-live");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 10, "fail-soft collider keeps authored version");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "fail-soft collider keeps authored name");
  assert.equal(colliderGrab.geometry.getAttribute("position").gpuType, THREE.IntType, "fail-soft collider keeps authored gpuType");
  assert.equal(colliderGrab.geometry.getAttribute("position").normalized, true, "fail-soft collider keeps authored normalized");
  assert.equal(colliderGrab.geometry.getAttribute("position").usage, THREE.DynamicDrawUsage, "fail-soft collider keeps authored usage");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "fail-soft collider keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "fail-soft collider keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "fail-soft collider keeps its boundingSphere");
  assert.equal(colliderSpoiled.box.min.y, 8, "fail-soft collider box stays authored");
  assert.equal(colliderSphere.radius, 0.11, "fail-soft collider object sphere radius stays authored");
});

test("packaged ingest pins leftover BufferGeometry name to empty after the version pin; mapped/lit/collider keep authored geometry.name", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.geometry.name = "mappedGeo";
  mappedMesh.geometry.getAttribute("position").version = 8;
  mappedMesh.geometry.getAttribute("position").name = "POSITION";
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccGeometryName", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const upload = () => {};
  position.onUpload(upload);
  wrongMesh.geometry.name = "Mesh.001";
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  position.version = 2;
  index.version = 7;
  position.name = "POSITION";
  index.name = "accessor_4";
  position.gpuType = THREE.IntType;
  position.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.geometry.name = "colliderGeo";
  colliderGrabBefore.geometry.getAttribute("position").version = 9;
  colliderGrabBefore.geometry.getAttribute("position").name = "POSITION";
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  fastener.geometry.morphAttributes.position = [];
  fastener.geometry.name = "fastenerPrimitive";
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.version = 5;
  fastener.geometry.index.version = 4;
  fastenerPosition.name = "POSITION";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "position attribute stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGeometryName mesh.name");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGeometryName mesh.name");
  assert.equal(wrongMesh.geometry.name, "", "leftover geometry.name is pinned to empty");
  assert.equal(position.version, 0, "version pin still holds on position");
  assert.equal(index.version, 0, "version pin still holds on the index");
  assert.equal(isCpuArrayReleaseOnUpload(position.onUploadCallback, wrongMesh.geometry), true, "v1.8 onUpload pin replaces a non-release callback after the geometry-name pin");
  assert.equal(position.array, positionArray, "v1.8 onUpload pin does not null position.array");
  assertQuestSafeUnlitVersion(wrongMesh, "packaged color-only version still zero");
  assertQuestSafeUnlitName(wrongMesh, "packaged color-only attribute name still empty");
  assertQuestSafeUnlitGpuType(wrongMesh, "packaged color-only gpuType still FloatType");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only normalized still false");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "geometry-name pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "geometry-name pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "geometry-name pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "geometry-name pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "geometry-name pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.geometry.name, "", "fastener geometry.name is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assertQuestSafeUnlitVersion(fastener, "fastener version still zero");
  assertQuestSafeUnlitName(fastener, "fastener attribute name still empty");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(mappedMesh.geometry.name, "mappedGeo", "mapped MeshBasic keeps authored geometry.name");
  assert.equal(mappedMesh.geometry.getAttribute("position").version, 8, "mapped MeshBasic keeps authored version");
  assert.equal(mappedMesh.geometry.getAttribute("position").name, "POSITION", "mapped MeshBasic keeps authored attribute name");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.name, "colliderGeo", "collider geometry.name stays authored");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 9, "collider position version stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "collider position name stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
});

test("packaged ingest without lod groups still pins leftover BufferGeometry name to empty", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  bodyMesh.geometry.name = "bodyPrimitive";
  bodyPosition.version = 5;
  bodyPosition.name = "POSITION";
  const lidMesh = visualMeshes(lid)[0];
  lidMesh.geometry.name = "";
  lidMesh.geometry.getAttribute("position").version = 6;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.name;
  latchMesh.geometry.getAttribute("position").version = 3;
  latchMesh.geometry.getAttribute("position").name = "POSITION";
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.geometry.name = "toolPrimitive";
  fastener.geometry.morphAttributes.position = [];
  fastener.geometry.name = "fastenerPrimitive";
  const fastenerPosition = fastener.geometry.getAttribute("position");
  fastenerPosition.version = 4;
  fastenerPosition.name = "POSITION";
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.geometry.name = "colliderGeo";
  colliderGrab.geometry.getAttribute("position").version = 10;
  colliderGrab.geometry.getAttribute("position").name = "POSITION";
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.geometry.name, "", "fail-soft body geometry.name is pinned");
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyPosition.version, 0, "fail-soft version pin still holds");
  assert.equal(bodyPosition.name, "", "fail-soft attribute name pin still holds");
  assert.equal(lidMesh.geometry.name, "", "fail-soft already-empty lid geometry.name stays empty");
  assertQuestSafeUnlitVersion(lidMesh, "fail-soft lid version");
  assert.equal(latchMesh.geometry.name, "", "fail-soft deleted geometry.name is restored to empty");
  assert.equal(latchMesh.geometry.getAttribute("position").version, 0, "fail-soft latch version pin still holds");
  assert.equal(toolMesh.geometry.name, "", "fail-soft tool geometry.name is pinned");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assert.equal(fastener.geometry.name, "", "fail-soft fastener geometry.name is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastenerPosition.version, 0, "fail-soft fastener version pin still holds");
  assert.equal(fastenerPosition.name, "", "fail-soft fastener attribute name pin still holds");
  assert.equal(colliderGrab.geometry.name, "colliderGeo", "fail-soft collider geometry.name stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 10, "fail-soft collider keeps authored version");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "fail-soft collider keeps authored attribute name");
});

function meshUserDataEmpty(mesh) {
  const value = mesh?.userData;
  if (value === null || typeof value !== "object") return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Object.getOwnPropertyNames(value).length !== 0) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  return true;
}

function geometryUserDataEmpty(geometry) {
  const value = geometry?.userData;
  if (value === null || typeof value !== "object") return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Object.getOwnPropertyNames(value).length !== 0) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  return true;
}

test("packaged ingest pins leftover BufferGeometry userData to an empty plain object after the geometry-name pin; mapped/lit/collider keep authored geometry.userData", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedExtras = { mapped: true };
  mappedMesh.geometry.userData = mappedExtras;
  mappedMesh.geometry.name = "mappedGeo";
  mappedMesh.geometry.getAttribute("position").version = 8;
  mappedMesh.geometry.getAttribute("position").name = "POSITION";
  const mappedSpoiled = spoilGeometryBounds(mappedMesh.geometry);
  const mappedSphere = spoilMeshBoundingSphere(mappedMesh, 0.02);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const wrongMesh = boxMesh("dccGeometryUserData", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const upload = () => {};
  position.onUpload(upload);
  const extras = { targetNames: ["body"] };
  wrongMesh.geometry.userData = extras;
  wrongMesh.userData.part = "body";
  const meshBag = wrongMesh.userData;
  wrongMesh.geometry.name = "Mesh.001";
  const morphBag = wrongMesh.geometry.morphAttributes;
  morphBag.position = [];
  wrongMesh.geometry.morphTargetsRelative = true;
  position.version = 2;
  index.version = 7;
  position.name = "POSITION";
  index.name = "accessor_4";
  position.gpuType = THREE.IntType;
  position.normalized = true;
  position.setUsage(THREE.DynamicDrawUsage);
  const spoiled = spoilGeometryBounds(wrongMesh.geometry);
  const objectSphere = spoilMeshBoundingSphere(wrongMesh);
  position.addUpdateRange(2, 4);
  const positionRanges = position.updateRanges;
  position.updateRange = { offset: 8, count: 3 };
  const positionRange = position.updateRange;
  const drawRange = wrongMesh.geometry.drawRange;
  wrongMesh.geometry.drawRange.start = 2;
  wrongMesh.geometry.drawRange.count = 9;
  const bag = wrongMesh.geometry.groups;
  wrongMesh.geometry.addGroup(0, 3, 0);
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderExtras = { collider: true };
  colliderGrabBefore.geometry.userData = colliderExtras;
  colliderGrabBefore.geometry.name = "colliderGeo";
  colliderGrabBefore.geometry.getAttribute("position").version = 9;
  colliderGrabBefore.geometry.getAttribute("position").name = "POSITION";
  colliderGrabBefore.userData.layer = "grab";
  const colliderSpoiled = spoilGeometryBounds(colliderGrabBefore.geometry);
  const colliderSphere = spoilMeshBoundingSphere(colliderGrabBefore, 0.06);
  fastener.geometry.morphAttributes.position = [];
  const fastenerExtras = { fastener: "primitive" };
  fastener.geometry.userData = fastenerExtras;
  fastener.geometry.name = "fastenerPrimitive";
  fastener.userData.kept = "fastener-mesh";
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.version = 5;
  fastener.geometry.index.version = 4;
  fastenerPosition.name = "POSITION";
  fastenerPosition.gpuType = THREE.IntType;
  fastenerPosition.normalized = true;
  fastenerPosition.setUsage(THREE.DynamicDrawUsage);
  const fastenerSpoiled = spoilGeometryBounds(fastener.geometry);
  const fastenerSphere = spoilMeshBoundingSphere(fastener, 0.07);

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "position attribute stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGeometryUserData mesh.name");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccGeometryUserData mesh.name");
  assert.notEqual(wrongMesh.userData, meshBag, "v1.4.0 mesh-userData pin replaces leftover mesh userData");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "v1.4.0 mesh-userData pin clears leftover mesh userData");
  assert.notEqual(wrongMesh.geometry.userData, extras, "leftover geometry.userData is replaced");
  assert.deepEqual(extras, { targetNames: ["body"] }, "ingest does not mutate leftover extras");
  assert.equal(geometryUserDataEmpty(wrongMesh.geometry), true, "leftover geometry.userData is pinned to an empty plain object");
  assert.equal(wrongMesh.geometry.name, "", "geometry-name pin still clears leftover geometry.name");
  assert.equal(position.version, 0, "version pin still holds on position");
  assert.equal(index.version, 0, "version pin still holds on the index");
  assert.equal(isCpuArrayReleaseOnUpload(position.onUploadCallback, wrongMesh.geometry), true, "v1.8 onUpload pin replaces a non-release callback after the geometry-userData pin");
  assert.equal(position.array, positionArray, "v1.8 onUpload pin does not null position.array");
  assertQuestSafeUnlitVersion(wrongMesh, "packaged color-only version still zero");
  assertQuestSafeUnlitName(wrongMesh, "packaged color-only attribute name still empty");
  assertQuestSafeUnlitGpuType(wrongMesh, "packaged color-only gpuType still FloatType");
  assertQuestSafeUnlitNormalized(wrongMesh, "packaged color-only normalized still false");
  assertQuestSafeUnlitUsage(wrongMesh, "packaged color-only usage still StaticDrawUsage");
  assertQuestSafeUnlitMeshBoundingSphere(wrongMesh, "packaged color-only object sphere still absent");
  assertQuestSafeUnlitBounds(wrongMesh, "packaged color-only geometry bounds still null");
  assert.equal(objectSphere.radius, 0.01, "geometry-userData pin does not mutate the detached object Sphere");
  assert.equal(spoiled.box.min.x, 9, "geometry-userData pin does not mutate the detached Box3");
  assert.equal(spoiled.sphere.radius, 0.01, "geometry-userData pin does not mutate the detached geometry Sphere");
  assert.equal(position.updateRanges, positionRanges, "ingest still clears updateRanges in place");
  assert.equal(positionRanges.length, 0, "v0.91 updateRanges clear still holds");
  assert.equal(position.updateRange, positionRange, "ingest does not replace updateRange");
  assert.equal(positionRange.offset, 0, "v0.90 updateRange pin still holds");
  assert.equal(positionRange.count, -1, "v0.90 updateRange count still holds");
  assert.equal(wrongMesh.geometry.drawRange, drawRange, "geometry-userData pin does not replace drawRange");
  assertQuestSafeUnlitDrawRange(wrongMesh, "drawRange pin still holds");
  assert.equal(wrongMesh.geometry.groups, bag, "geometry-userData pin does not replace groups");
  assert.equal(bag.length, 0, "earlier groups pin still clears leftover groups");
  assert.equal(Object.keys(morphBag).length, 0, "earlier morphAttributes pin still clears leftover keys");
  assert.equal(wrongMesh.geometry.morphTargetsRelative, false, "earlier morphAttributes pin still pins morphTargetsRelative");
  assert.equal(fastener.geometry.getAttribute("position"), fastenerPosition, "fastener position stays");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.notEqual(fastener.geometry.userData, fastenerExtras, "fastener geometry.userData is replaced");
  assert.equal(geometryUserDataEmpty(fastener.geometry), true, "fastener geometry.userData is pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh name stays");
  assert.equal(fastener.geometry.name, "", "fastener geometry.name is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assertQuestSafeUnlitVersion(fastener, "fastener version still zero");
  assertQuestSafeUnlitName(fastener, "fastener attribute name still empty");
  assertQuestSafeUnlitMeshBoundingSphere(fastener, "fastener object sphere still absent");
  assertQuestSafeUnlitBounds(fastener, "fastener geometry bounds still null");
  assert.equal(fastenerSpoiled.box.min.x, 9, "fastener pin does not mutate the detached Box3");
  assert.equal(fastenerSphere.radius, 0.07, "fastener pin does not mutate the detached object Sphere");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(root.userData.fastener.mesh, fastener, "entity fastener metadata stays");
  assert.equal(mappedMesh.geometry.userData, mappedExtras, "mapped MeshBasic keeps authored geometry.userData");
  assert.equal(mappedMesh.geometry.name, "mappedGeo", "mapped MeshBasic keeps authored geometry.name");
  assert.equal(mappedMesh.geometry.getAttribute("position").version, 8, "mapped MeshBasic keeps authored version");
  assert.equal(mappedMesh.geometry.getAttribute("position").name, "POSITION", "mapped MeshBasic keeps authored attribute name");
  assert.equal(mappedMesh.boundingSphere, mappedSphere, "mapped MeshBasic keeps its object sphere");
  assert.equal(mappedMesh.geometry.boundingBox, mappedSpoiled.box, "mapped MeshBasic keeps its boundingBox");
  assert.equal(mappedMesh.geometry.boundingSphere, mappedSpoiled.sphere, "mapped MeshBasic keeps its boundingSphere");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.geometry.userData, colliderExtras, "collider geometry.userData stays authored");
  assert.equal(colliderGrab.userData.collider, true, "collider mesh userData flag stays");
  assert.equal(colliderGrab.userData.layer, "grab", "collider mesh userData layer stays");
  assert.equal(colliderGrab.geometry.name, "colliderGeo", "collider geometry.name stays authored");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 9, "collider position version stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "collider position name stays authored");
  assert.equal(colliderGrab.boundingSphere, colliderSphere, "collider Mesh keeps its object sphere");
  assert.equal(colliderGrab.geometry.boundingBox, colliderSpoiled.box, "collider Mesh keeps its boundingBox");
  assert.equal(colliderGrab.geometry.boundingSphere, colliderSpoiled.sphere, "collider Mesh keeps its boundingSphere");
});

test("packaged ingest without lod groups still pins leftover BufferGeometry userData to an empty plain object", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyExtras = { body: true };
  bodyMesh.geometry.userData = bodyExtras;
  bodyMesh.geometry.name = "bodyPrimitive";
  bodyMesh.userData.kept = "body";
  bodyPosition.version = 5;
  bodyPosition.name = "POSITION";
  const lidMesh = visualMeshes(lid)[0];
  const lidBag = lidMesh.geometry.userData;
  assert.equal(geometryUserDataEmpty(lidMesh.geometry), true, "fixture lid starts with empty geometry.userData");
  lidMesh.geometry.name = "";
  lidMesh.geometry.getAttribute("position").version = 6;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.geometry.userData;
  latchMesh.geometry.name = "latchPrimitive";
  latchMesh.geometry.getAttribute("position").version = 3;
  latchMesh.geometry.getAttribute("position").name = "POSITION";
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.geometry.userData = { tool: true };
  toolMesh.geometry.name = "toolPrimitive";
  fastener.geometry.morphAttributes.position = [];
  fastener.geometry.userData = { fastener: true };
  fastener.geometry.name = "fastenerPrimitive";
  fastener.userData.kept = "fastener";
  const fastenerPosition = fastener.geometry.getAttribute("position");
  fastenerPosition.version = 4;
  fastenerPosition.name = "POSITION";
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderExtras = { collider: true };
  colliderGrab.geometry.userData = colliderExtras;
  colliderGrab.geometry.name = "colliderGeo";
  colliderGrab.geometry.getAttribute("position").version = 10;
  colliderGrab.geometry.getAttribute("position").name = "POSITION";
  colliderGrab.userData.size = { x: 1, y: 2, z: 3 };
  ingestPackagedRoot(root, sidecar);
  assert.notEqual(bodyMesh.geometry.userData, bodyExtras, "fail-soft body geometry.userData is replaced");
  assert.equal(geometryUserDataEmpty(bodyMesh.geometry), true, "fail-soft body geometry.userData is pinned");
  assert.equal(meshUserDataEmpty(bodyMesh), true, "v1.4.0 fail-soft mesh-userData pin clears leftover body mesh userData");
  assert.equal(bodyMesh.geometry.name, "", "fail-soft body geometry.name is pinned");
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyPosition.version, 0, "fail-soft version pin still holds");
  assert.equal(bodyPosition.name, "", "fail-soft attribute name pin still holds");
  assert.equal(lidMesh.geometry.userData, lidBag, "fail-soft already-empty lid geometry.userData stays the same object");
  assert.equal(geometryUserDataEmpty(lidMesh.geometry), true, "fail-soft lid geometry.userData stays empty");
  assert.equal(lidMesh.geometry.name, "", "fail-soft already-empty lid geometry.name stays empty");
  assertQuestSafeUnlitVersion(lidMesh, "fail-soft lid version");
  assert.equal(geometryUserDataEmpty(latchMesh.geometry), true, "fail-soft deleted geometry.userData is restored");
  assert.equal(latchMesh.geometry.name, "", "fail-soft latch geometry.name is pinned");
  assert.equal(latchMesh.geometry.getAttribute("position").version, 0, "fail-soft latch version pin still holds");
  assert.equal(geometryUserDataEmpty(toolMesh.geometry), true, "fail-soft tool geometry.userData is pinned");
  assert.equal(toolMesh.geometry.name, "", "fail-soft tool geometry.name is pinned");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assert.equal(geometryUserDataEmpty(fastener.geometry), true, "fail-soft fastener geometry.userData is pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 fail-soft mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh name stays");
  assert.equal(fastener.geometry.name, "", "fail-soft fastener geometry.name is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastenerPosition.version, 0, "fail-soft fastener version pin still holds");
  assert.equal(fastenerPosition.name, "", "fail-soft fastener attribute name pin still holds");
  assert.equal(root.userData.parts.fastener, fastener, "fail-soft entity fastener metadata stays");
  assert.equal(colliderGrab.geometry.userData, colliderExtras, "fail-soft collider geometry.userData stays authored");
  assert.equal(colliderGrab.userData.collider, true, "fail-soft collider mesh userData flag stays");
  assert.equal(colliderGrab.userData.size.y, 2, "fail-soft collider size stays");
  assert.equal(colliderGrab.geometry.name, "colliderGeo", "fail-soft collider geometry.name stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").version, 10, "fail-soft collider keeps authored version");
  assert.equal(colliderGrab.geometry.getAttribute("position").name, "POSITION", "fail-soft collider keeps authored attribute name");
});

function materialUserDataEmpty(material) {
  const value = material?.userData;
  if (value === null || typeof value !== "object") return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Object.getOwnPropertyNames(value).length !== 0) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  return true;
}

test("packaged ingest pins leftover Material userData to an empty plain object after the geometry-userData pin; mapped/lit/collider keep authored material.userData", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  mapped.name = "mappedMat";
  const mappedExtras = { mapped: true };
  mapped.userData = mappedExtras;
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  wrong.name = "dccWood";
  const wrongExtras = { targetNames: ["body"] };
  wrong.userData = wrongExtras;
  const wrongMesh = boxMesh("dccMaterialUserData", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const index = wrongMesh.geometry.index;
  const positionArray = position.array;
  const geoExtras = { primitive: "body" };
  wrongMesh.geometry.userData = geoExtras;
  wrongMesh.geometry.name = "Mesh.001";
  wrongMesh.userData.part = "body";
  const meshBag = wrongMesh.userData;
  // Keep the original position through packColorOnlyGeometry so the
  // version pin is observable. Quantize skips morph geometries; the
  // morph pin then clears the leftover before the version pin.
  wrongMesh.geometry.morphAttributes.position = [];
  position.version = 2;
  position.name = "POSITION";
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  const colliderExtras = { collider: true };
  colliderGrabBefore.material.userData = colliderExtras;
  colliderGrabBefore.material.name = "colliderMat";
  colliderGrabBefore.userData.layer = "grab";
  const fastenerExtras = { fastener: "material" };
  fastener.material.userData = fastenerExtras;
  fastener.material.name = "brassStandIn";
  fastener.userData.kept = "fastener-mesh";
  const fastenerGeo = { fastener: "primitive" };
  fastener.geometry.userData = fastenerGeo;
  fastener.geometry.morphAttributes.position = [];
  const fastenerPosition = fastener.geometry.getAttribute("position");
  const fastenerArray = fastenerPosition.array;
  fastenerPosition.version = 5;

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.material, wrong, "ingest does not replace the color-only material");
  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(wrongMesh.geometry.getAttribute("position"), position, "position attribute stays");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrongMesh.geometry.index, index, "ingest does not replace the index");
  assert.equal(wrongMesh.parent != null, true, "ingest does not detach the color-only mesh");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccMaterialUserData mesh.name");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccMaterialUserData mesh.name");
  assert.notEqual(wrongMesh.userData, meshBag, "v1.4.0 mesh-userData pin replaces leftover mesh userData");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "v1.4.0 mesh-userData pin clears leftover mesh userData");
  assert.notEqual(wrong.userData, wrongExtras, "leftover material.userData is replaced");
  assert.deepEqual(wrongExtras, { targetNames: ["body"] }, "ingest does not mutate leftover material extras");
  assert.equal(materialUserDataEmpty(wrong), true, "leftover material.userData is pinned to an empty plain object");
  assert.equal(wrong.name, "", "v1.2.0 name pin clears leftover material.name");
  assert.equal(geometryUserDataEmpty(wrongMesh.geometry), true, "geometry-userData pin still clears leftover geometry.userData");
  assert.equal(wrongMesh.geometry.name, "", "geometry-name pin still clears leftover geometry.name");
  assert.equal(position.version, 0, "version pin still holds on position");
  assert.equal(position.name, "", "attribute name pin still holds");
  assert.notEqual(wrong.userData, wrongMesh.geometry.userData, "material userData stays distinct from geometry userData");
  assert.notEqual(wrong.userData, wrongMesh.userData, "material userData stays distinct from mesh userData");
  assert.notEqual(fastener.material.userData, fastenerExtras, "fastener material.userData is replaced");
  assert.equal(materialUserDataEmpty(fastener.material), true, "fastener material.userData is pinned");
  assert.equal(fastener.material.name, "", "v1.2.0 name pin clears fastener material.name");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh name stays");
  assert.equal(geometryUserDataEmpty(fastener.geometry), true, "fastener geometry.userData is pinned");
  assert.equal(fastenerPosition.array, fastenerArray, "fastener typed array stays");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(fastenerPosition.version, 0, "fastener version pin still holds");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener stays matrix-live");
  assert.equal(root.userData.fastener.mesh, fastener, "entity fastener metadata stays");
  assert.equal(mapped.userData, mappedExtras, "mapped MeshBasic keeps authored material.userData");
  assert.equal(mapped.name, "mappedMat", "mapped MeshBasic keeps authored material.name");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.userData, colliderExtras, "collider material.userData stays authored");
  assert.equal(colliderGrab.material.name, "colliderMat", "collider material.name stays");
  assert.equal(colliderGrab.userData.collider, true, "collider mesh userData flag stays");
  assert.equal(colliderGrab.userData.layer, "grab", "collider mesh userData layer stays");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
});

test("packaged ingest without lod groups still pins leftover Material userData to an empty plain object", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyMat = bodyMesh.material;
  const bodyExtras = { body: true };
  bodyMat.userData = bodyExtras;
  bodyMat.name = "bodyMat";
  bodyMesh.geometry.userData = { bodyGeo: true };
  bodyMesh.userData.kept = "body";
  bodyMesh.geometry.getAttribute("position").version = 5;
  const lidMesh = visualMeshes(lid)[0];
  const lidBag = lidMesh.material.userData;
  assert.equal(materialUserDataEmpty(lidMesh.material), true, "fixture lid starts with empty material.userData");
  lidMesh.material.name = "lidMat";
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.material.userData;
  latchMesh.material.name = "latchMat";
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.material.userData = { tool: true };
  toolMesh.material.name = "toolMat";
  fastener.material.userData = { fastener: true };
  fastener.material.name = "fastenerMat";
  fastener.userData.kept = "fastener";
  fastener.geometry.userData = { fastenerGeo: true };
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderExtras = { collider: true };
  colliderGrab.material.userData = colliderExtras;
  colliderGrab.userData.size = { x: 1, y: 2, z: 3 };
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.notEqual(bodyMat.userData, bodyExtras, "fail-soft body material.userData is replaced");
  assert.equal(materialUserDataEmpty(bodyMat), true, "fail-soft body material.userData is pinned");
  assert.equal(bodyMat.name, "", "fail-soft body material.name is pinned");
  assertQuestSafeUnlitFlags(bodyMat, "fail-soft body flags still hold");
  assert.equal(bodyMat.glslVersion, undefined, "fail-soft glslVersion pin still holds");
  assert.equal(bodyMat.flatShading, false, "fail-soft flatShading pin still holds");
  assert.equal(meshUserDataEmpty(bodyMesh), true, "v1.4.0 fail-soft mesh-userData pin clears leftover body mesh userData");
  assert.equal(geometryUserDataEmpty(bodyMesh.geometry), true, "fail-soft body geometry.userData is pinned");
  assert.equal(lidMesh.material.userData, lidBag, "fail-soft already-empty lid material.userData stays the same object");
  assert.equal(materialUserDataEmpty(lidMesh.material), true, "fail-soft lid material.userData stays empty");
  assert.equal(lidMesh.material.name, "", "fail-soft lid material.name is pinned");
  assert.equal(materialUserDataEmpty(latchMesh.material), true, "fail-soft deleted material.userData is restored");
  assert.equal(latchMesh.material.name, "", "fail-soft latch material.name is pinned");
  assert.equal(materialUserDataEmpty(toolMesh.material), true, "fail-soft tool material.userData is pinned");
  assert.equal(toolMesh.material.name, "", "fail-soft tool material.name is pinned");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assert.equal(materialUserDataEmpty(fastener.material), true, "fail-soft fastener material.userData is pinned");
  assert.equal(fastener.material.name, "", "fail-soft fastener material.name is pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 fail-soft mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh name stays");
  assert.equal(geometryUserDataEmpty(fastener.geometry), true, "fail-soft fastener geometry.userData is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(root.userData.parts.fastener, fastener, "fail-soft entity fastener metadata stays");
  assert.equal(colliderGrab.material.userData, colliderExtras, "fail-soft collider material.userData stays authored");
  assert.equal(colliderGrab.userData.collider, true, "fail-soft collider mesh userData flag stays");
  assert.equal(colliderGrab.userData.size.y, 2, "fail-soft collider size stays");
});

test("packaged ingest pins leftover Material name to the empty string after the material-userData pin; mapped/lit/collider keep authored material.name", () => {
  assert.equal(THREE.REVISION, "170", "verified three@0.170.0 REVISION 170");
  const { root, fastener, groups } = makePackagedFixture();
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
  });
  mapped.name = "mappedMat";
  const mappedExtras = { mapped: true };
  mapped.userData = mappedExtras;
  const mappedMesh = boxMesh("mappedHero", mapped);
  const wrong = new THREE.MeshBasicMaterial({ color: 0x633318 });
  wrong.name = "dccWood";
  const wrongExtras = { targetNames: ["body"] };
  wrong.userData = wrongExtras;
  wrong.glslVersion = "300 es";
  wrong.flatShading = true;
  wrong.fog = true;
  const wrongMesh = boxMesh("dccMaterialName", wrong);
  const geometryBefore = wrongMesh.geometry;
  const position = wrongMesh.geometry.getAttribute("position");
  const positionArray = position.array;
  const geoExtras = { primitive: "body" };
  wrongMesh.geometry.userData = geoExtras;
  wrongMesh.geometry.name = "Mesh.001";
  wrongMesh.userData.part = "body";
  const meshBag = wrongMesh.userData;
  groups[0][0].add(mappedMesh, wrongMesh);
  const colliderGrabBefore = root.getObjectByName("collider_grab");
  colliderGrabBefore.material.name = "colliderMat";
  const colliderExtras = { collider: true };
  colliderGrabBefore.material.userData = colliderExtras;
  fastener.material.name = "brassStandIn";
  const fastenerExtras = { fastener: "material" };
  fastener.material.userData = fastenerExtras;
  fastener.userData.kept = "fastener-mesh";
  fastener.geometry.name = "fastenerPrimitive";

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.material, wrong, "ingest does not replace the color-only material");
  assert.equal(wrongMesh.geometry, geometryBefore, "ingest does not replace the geometry");
  assert.equal(position.array, positionArray, "ingest does not replace the position typed array");
  assert.equal(wrong.name, "", "leftover material.name is pinned to the empty string");
  assert.deepEqual(wrongExtras, { targetNames: ["body"] }, "ingest does not mutate the detached material extras");
  assert.notEqual(wrong.userData, wrongExtras, "material-userData pin replaces leftover material.userData");
  assert.equal(materialUserDataEmpty(wrong), true, "material-userData pin still clears leftover material.userData");
  assert.equal(wrong.glslVersion, undefined, "glslVersion pin still holds");
  assert.equal(wrong.flatShading, false, "flatShading pin still holds");
  assert.equal(wrong.fog, false, "fog pin still holds");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin clears leftover dccMaterialName mesh.name");
  assert.notEqual(wrongMesh.userData, meshBag, "v1.4.0 mesh-userData pin replaces leftover mesh userData");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "v1.4.0 mesh-userData pin clears leftover mesh userData");
  assert.equal(geometryUserDataEmpty(wrongMesh.geometry), true, "geometry-userData pin still clears leftover geometry.userData");
  assert.equal(wrongMesh.geometry.name, "", "geometry-name pin still clears leftover geometry.name");
  assert.equal(fastener.material.name, "", "fastener material.name is pinned");
  assert.equal(materialUserDataEmpty(fastener.material), true, "fastener material.userData is pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh name stays");
  assert.equal(fastener.geometry.name, "", "fastener geometry.name is pinned");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(mapped.name, "mappedMat", "mapped MeshBasic keeps authored material.name");
  assert.equal(mapped.userData, mappedExtras, "mapped MeshBasic keeps authored material.userData");
  const colliderGrab = root.getObjectByName("collider_grab");
  assert.equal(colliderGrab.material.name, "colliderMat", "collider material.name stays");
  assert.equal(colliderGrab.material.userData, colliderExtras, "collider material.userData stays authored");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
});

test("packaged ingest without lod groups still pins leftover Material name to the empty string", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyMat = bodyMesh.material;
  const bodyBag = { body: true };
  bodyMat.name = "bodyMat";
  bodyMat.userData = bodyBag;
  bodyMesh.userData.kept = "body";
  const lidMesh = visualMeshes(lid)[0];
  assert.equal(lidMesh.material.name, "", "fixture lid starts with empty material.name");
  const lidBag = lidMesh.material.userData;
  const latchMesh = visualMeshes(latch)[0];
  delete latchMesh.material.name;
  const latchBag = { latch: true };
  latchMesh.material.userData = latchBag;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.name = "toolMesh";
  toolMesh.material.name = "toolMat";
  fastener.material.name = "fastenerMat";
  const fastenerBag = fastener.material.userData;
  fastener.userData.kept = "fastener";
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.material.name = "colliderMat";
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.equal(bodyMat.name, "", "fail-soft body material.name is pinned");
  assert.equal(materialUserDataEmpty(bodyMat), true, "fail-soft body material.userData is pinned");
  assert.notEqual(bodyMat.userData, bodyBag, "fail-soft body material.userData is replaced");
  assert.equal(meshUserDataEmpty(bodyMesh), true, "v1.4.0 fail-soft mesh-userData pin clears leftover body mesh userData");
  assert.equal(lidMesh.material.name, "", "fail-soft already-empty lid material.name stays empty");
  assert.equal(lidMesh.material.userData, lidBag, "fail-soft already-empty lid material.userData stays the same object");
  assert.equal(latchMesh.material.name, "", "fail-soft deleted material.name is restored");
  assert.equal(materialUserDataEmpty(latchMesh.material), true, "fail-soft latch material.userData is pinned");
  assert.notEqual(latchMesh.material.userData, latchBag, "fail-soft latch material.userData is replaced");
  assert.equal(toolMesh.material.name, "", "fail-soft tool material.name is pinned");
  assert.equal(toolMesh.name, "", "v1.3.0 mesh-name pin clears fail-soft toolMesh name");
  assert.equal(fastener.material.name, "", "fail-soft fastener material.name is pinned");
  assert.equal(fastener.material.userData, fastenerBag, "fail-soft already-empty fastener material.userData stays");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 fail-soft mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh name stays");
  assert.equal(fastener.name, "fastenerMesh", "named fastenerMesh kept");
  assert.equal(colliderGrab.material.name, "colliderMat", "fail-soft collider material.name stays authored");
});

test("packaged ingest pins leftover Mesh name to the empty string and keeps reserved names", () => {
  const { root, groups, fastener } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  shared.name = "dccWood";
  const wrongMesh = boxMesh("dccWall", shared);
  wrongMesh.userData.part = "body";
  const meshBag = wrongMesh.userData;
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  mapped.name = "mappedMat";
  const mappedMesh = boxMesh("mappedHero", mapped);
  groups[0][0].add(wrongMesh, mappedMesh);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.name = "collider_grab";
  fastener.material.name = "brassStandIn";
  fastener.userData.kept = "fastener-mesh";

  ingestPackagedRoot(root, sidecar);

  assert.equal(wrongMesh.name, "", "ingest clears a non-reserved color-only mesh.name");
  assert.equal(wrongMesh.material, shared, "ingest does not replace the color-only material");
  assert.equal(shared.name, "", "v1.2.0 material-name pin still clears leftover material.name");
  assert.notEqual(wrongMesh.userData, meshBag, "v1.4.0 mesh-userData pin replaces leftover mesh userData");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "v1.4.0 mesh-userData pin clears leftover mesh userData");
  assert.equal(mappedMesh.name, "mappedHero", "mapped mesh.name stays authored");
  assert.equal(mapped.name, "mappedMat", "mapped material.name stays authored");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh stays named");
  assert.equal(fastener.material.name, "", "fastener material.name is still pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "v1.4.0 mesh-userData pin clears leftover fastener mesh userData");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh name stays");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
  assert.equal(groups[0][0].name, "lod0", "lod group name stays");
});

test("packaged ingest without lod groups clears non-reserved mesh names and keeps lidMesh, latchMesh, and fastenerMesh", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const lidMesh = visualMeshes(lid)[0];
  const latchMesh = visualMeshes(latch)[0];
  const toolMesh = visualMeshes(tool)[0];
  bodyMesh.material.name = "bodyMat";
  bodyMesh.userData.kept = "body";
  toolMesh.material.name = "toolMat";
  const colliderGrab = root.getObjectByName("collider_grab");
  ingestPackagedRoot(root, sidecar);
  assert.equal(bodyMesh.name, "", "fail-soft bodyMesh name is pinned");
  assert.equal(bodyMesh.material.name, "", "fail-soft body material.name is still pinned");
  assert.equal(meshUserDataEmpty(bodyMesh), true, "v1.4.0 fail-soft mesh-userData pin clears leftover body mesh userData");
  assert.equal(toolMesh.name, "", "fail-soft toolMesh name is pinned");
  assert.equal(toolMesh.material.name, "", "fail-soft tool material.name is still pinned");
  assert.equal(lidMesh.name, "lidMesh", "fail-soft lidMesh stays named");
  assert.equal(latchMesh.name, "latchMesh", "fail-soft latchMesh stays named");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(colliderGrab.name, "collider_grab", "fail-soft collider name stays");
  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
});

test("packaged ingest pins leftover Mesh userData to an empty plain object and leaves studio metadata", () => {
  const { root, groups, tool, fastener } = makePackagedFixture();
  const rootBag = root.userData;
  tool.userData.restLocal = new THREE.Vector3(0.1, 0.2, 0.3);
  tool.userData.feedbackEntity = root;
  tool.userData.heldBy = "left";
  tool.userData.extracted = true;
  tool.userData.velocity = new THREE.Vector3(1, 0, 0);
  const toolBag = tool.userData;
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  shared.name = "dccWood";
  const wrongMesh = boxMesh("dccWall", shared);
  const extras = { targetNames: ["body"], exporter: "dcc" };
  wrongMesh.userData = extras;
  wrongMesh.geometry.name = "Mesh.001";
  const geoExtras = { primitive: "body" };
  wrongMesh.geometry.userData = geoExtras;
  const matExtras = { material: "wood" };
  shared.userData = matExtras;
  const emptyMesh = boxMesh("alreadyEmpty", new THREE.MeshBasicMaterial({ color: 0xbe7e31 }));
  const emptyBag = emptyMesh.userData;
  emptyMesh.name = "lidMesh";
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  const mappedExtras = { mapped: true };
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.userData = mappedExtras;
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  const sharedGeoVisual = new THREE.Mesh(mappedMesh.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  sharedGeoVisual.userData.fastener = true;
  groups[0][0].add(wrongMesh, emptyMesh, mappedMesh, sharedGeoVisual);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.userData.size = { x: 1, y: 2, z: 3 };
  colliderGrab.userData.layer = "grab";
  colliderGrab.userData.part = "body";
  colliderGrab.userData.pickable = true;
  fastener.userData.kept = "fastener-mesh";
  fastener.name = "fastenerMesh";

  ingestPackagedRoot(root, sidecar);

  assert.equal(root.userData, rootBag, "ingest does not replace root userData");
  assert.equal(root.userData.kind, "entity", "root kind stays");
  assert.equal(root.userData.studio.objectId, "crate-toolbox", "root studio metadata stays");
  assert.equal(root.userData.parts.tool, tool, "root parts stay");
  assert.equal(root.userData.fastener.mesh, fastener, "root fastener metadata stays");
  assert.equal(tool.userData, toolBag, "tool Group userData stays");
  assert.equal(tool.userData.restLocal.y, 0.2, "tool Group restLocal stays");
  assert.equal(tool.userData.feedbackEntity, root, "tool Group feedbackEntity stays");
  assert.equal(tool.userData.heldBy, "left", "tool Group heldBy stays");
  assert.equal(tool.userData.extracted, true, "tool Group extracted stays");
  assert.equal(tool.userData.velocity.x, 1, "tool Group velocity stays");
  assert.equal(wrongMesh.name, "", "v1.3.0 mesh-name pin still clears a non-reserved name");
  assert.notEqual(wrongMesh.userData, extras, "leftover mesh.userData is replaced");
  assert.deepEqual(extras, { targetNames: ["body"], exporter: "dcc" }, "ingest does not mutate the detached extras");
  assert.equal(meshUserDataEmpty(wrongMesh), true, "leftover mesh.userData is pinned");
  assert.equal(shared.name, "", "material.name pin still holds");
  assert.equal(materialUserDataEmpty(shared), true, "material.userData pin still holds");
  assert.notEqual(shared.userData, matExtras, "material.userData pin replaces leftover material extras");
  assert.equal(wrongMesh.geometry.name, "", "geometry.name pin still holds");
  assert.equal(geometryUserDataEmpty(wrongMesh.geometry), true, "geometry.userData pin still holds");
  assert.equal(emptyMesh.userData, emptyBag, "already-empty mesh.userData stays the same object");
  assert.equal(emptyMesh.name, "lidMesh", "reserved lidMesh name stays");
  assert.equal(meshUserDataEmpty(emptyMesh), true, "already-empty lidMesh userData stays empty");
  assert.equal(mappedMesh.userData, mappedExtras, "mapped mesh.userData stays authored");
  assert.equal(mappedMesh.name, "mappedHero", "mapped mesh.name stays authored");
  assert.equal(sharedGeoVisual.userData.fastener, true, "geometry shared with a mapped mesh keeps mesh userData");
  assert.equal(sharedGeoVisual.name, "sharedGeoBody", "shared-geometry visual mesh name stays");
  assert.equal(meshUserDataEmpty(fastener), true, "fastener leftover mesh.userData is pinned");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh name stays");
  assert.equal(colliderGrab.userData.collider, true, "collider flag stays");
  assert.equal(colliderGrab.userData.size.y, 2, "collider size stays");
  assert.equal(colliderGrab.userData.layer, "grab", "collider layer stays");
  assert.equal(colliderGrab.userData.part, "body", "collider part stays");
  assert.equal(colliderGrab.userData.pickable, true, "collider pickable stays");
  assert.equal(colliderGrab.name, "collider_grab", "collider name stays");
});

test("packaged ingest without lod groups still pins leftover Mesh userData and keeps tool Group metadata", () => {
  const { root, body, lid, latch, tool, fastener } = makePackagedFixture({ withLod: false });
  const rootBag = root.userData;
  tool.userData.restLocal = new THREE.Vector3(0, 1, 0);
  tool.userData.feedbackEntity = root;
  tool.userData.heldBy = null;
  tool.userData.extracted = false;
  const toolBag = tool.userData;
  const bodyMesh = visualMeshes(body)[0];
  const bodyBag = { body: true };
  bodyMesh.userData = bodyBag;
  bodyMesh.name = "bodyMesh";
  const lidMesh = visualMeshes(lid)[0];
  const lidBag = lidMesh.userData;
  assert.equal(meshUserDataEmpty(lidMesh), true, "fixture lid starts with empty mesh.userData");
  const latchMesh = visualMeshes(latch)[0];
  const latchExtras = { latch: true };
  latchMesh.userData = latchExtras;
  const toolMesh = visualMeshes(tool)[0];
  toolMesh.userData = { tool: true };
  toolMesh.name = "toolMesh";
  fastener.userData = { fastener: true };
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.userData.size = { x: 4, y: 5, z: 6 };
  ingestPackagedRoot(root, sidecar);
  assert.equal(root.userData, rootBag, "fail-soft does not replace root userData");
  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
  assert.equal(root.userData.parts.fastener, fastener, "fail-soft entity fastener metadata stays");
  assert.equal(tool.userData, toolBag, "fail-soft tool Group userData stays");
  assert.equal(tool.userData.restLocal.y, 1, "fail-soft tool Group restLocal stays");
  assert.equal(tool.userData.feedbackEntity, root, "fail-soft tool Group feedbackEntity stays");
  assert.notEqual(bodyMesh.userData, bodyBag, "fail-soft body mesh.userData is replaced");
  assert.equal(meshUserDataEmpty(bodyMesh), true, "fail-soft body mesh.userData is pinned");
  assert.equal(bodyMesh.name, "", "fail-soft bodyMesh name is still pinned");
  assert.equal(lidMesh.userData, lidBag, "fail-soft already-empty lid mesh.userData stays the same object");
  assert.equal(lidMesh.name, "lidMesh", "fail-soft lidMesh stays named");
  assert.notEqual(latchMesh.userData, latchExtras, "fail-soft latch mesh.userData is replaced");
  assert.equal(meshUserDataEmpty(latchMesh), true, "fail-soft latch mesh.userData is pinned");
  assert.equal(latchMesh.name, "latchMesh", "fail-soft latchMesh stays named");
  assert.equal(meshUserDataEmpty(toolMesh), true, "fail-soft tool visual mesh.userData is pinned");
  assert.equal(toolMesh.name, "", "fail-soft toolMesh name is still pinned");
  assert.equal(meshUserDataEmpty(fastener), true, "fail-soft fastener mesh.userData is pinned");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(colliderGrab.userData.collider, true, "fail-soft collider flag stays");
  assert.equal(colliderGrab.userData.size.z, 6, "fail-soft collider size stays");
});


test("packaged ingest pins leftover Material version to 0 on color-only visuals and the fastener", () => {
  const { root, groups, fastener } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  shared.name = "dccWood";
  shared.version = 9;
  const matExtras = { material: "wood" };
  shared.userData = matExtras;
  const first = boxMesh("dccWall", shared);
  const second = boxMesh("dccWallB", shared);
  first.userData = { exporter: "dcc" };
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  mapped.version = 3;
  mapped.name = "mappedMat";
  const mappedMesh = boxMesh("mappedHero", mapped);
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  sharedGeoMat.version = 6;
  const sharedGeoVisual = new THREE.Mesh(mappedMesh.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  const interleavedGeo = new THREE.BufferGeometry();
  const interleavedBuffer = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 1, 0, 0]), 3);
  interleavedGeo.setAttribute("position", new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0));
  interleavedGeo.setIndex([0, 1, 2]);
  const interleavedMat = new THREE.MeshBasicMaterial({ color: 0x633318 });
  interleavedMat.version = 4;
  const interleaved = new THREE.Mesh(interleavedGeo, interleavedMat);
  interleaved.name = "interleavedMesh";
  const lit = boxMesh("litMesh", new THREE.MeshStandardMaterial());
  lit.material.version = 5;
  groups[0][0].add(first, mappedMesh, sharedGeoVisual, interleaved, lit);
  groups[1][0].add(second);
  fastener.material = new THREE.MeshBasicMaterial({ color: 0xbe7e31 });
  fastener.material.version = 11;
  fastener.material.name = "brassStandIn";
  const fastenerMat = fastener.material;
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.material.version = 8;
  const already = boxMesh("alreadyZero", new THREE.MeshBasicMaterial({ color: 0xbe7e31 }));
  assert.equal(already.material.version, 0);
  const alreadyMat = already.material;
  groups[0][0].add(already);

  ingestPackagedRoot(root, sidecar);

  assert.equal(first.material, shared, "ingest does not replace the shared color-only material");
  assert.equal(second.material, shared, "shared material stays one instance");
  assert.equal(shared.version, 0, "leftover shared material.version is pinned once to 0");
  assert.equal(shared.name, "", "v1.2.0 material-name pin still clears leftover material.name");
  assert.equal(materialUserDataEmpty(shared), true, "v1.1.0 material-userData pin still clears leftover material.userData");
  assert.notEqual(shared.userData, matExtras, "material.userData pin replaces leftover material extras");
  assert.equal(meshUserDataEmpty(first), true, "v1.4.0 mesh-userData pin still clears leftover mesh userData");
  assert.equal(first.name, "", "v1.3.0 mesh-name pin still clears a non-reserved name");
  assert.equal(fastener.material, fastenerMat, "ingest does not replace the fastener material");
  assert.equal(fastener.material.version, 0, "fastener material.version is pinned to 0");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh stays named");
  assert.equal(mapped.version, 3, "mapped material.version stays authored");
  assert.equal(mapped.name, "mappedMat", "mapped material.name stays authored");
  assert.equal(sharedGeoMat.version, 6, "geometry shared with a mapped mesh keeps material.version");
  assert.equal(interleaved.material.version, 4, "interleaved material.version stays authored");
  assert.equal(lit.material.version, 5, "MeshStandard material.version stays authored");
  assert.equal(colliderGrab.material.version, 8, "collider material.version stays authored");
  assert.equal(already.material, alreadyMat, "already-zero material stays the same instance");
  assert.equal(already.material.version, 0, "already-zero material.version stays 0");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
});

test("packaged ingest without lod groups still pins leftover Material version", () => {
  const { root, body, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  bodyMesh.material.version = 5;
  bodyMesh.material.name = "bodyMat";
  const bodyMat = bodyMesh.material;
  fastener.material.version = 6;
  const fastenerMat = fastener.material;
  const mapped = boxMesh("mappedHero", new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } }));
  mapped.material.version = 2;
  body.add(mapped);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.material.version = 7;
  ingestPackagedRoot(root, sidecar);
  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.equal(bodyMesh.material.version, 0, "fail-soft body material.version is pinned");
  assert.equal(bodyMesh.material.name, "", "fail-soft body material.name is still pinned");
  assert.equal(fastener.material, fastenerMat, "fail-soft does not replace the fastener material");
  assert.equal(fastener.material.version, 0, "fail-soft fastener material.version is pinned");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(mapped.material.version, 2, "fail-soft mapped material.version stays authored");
  assert.equal(colliderGrab.material.version, 7, "fail-soft collider material.version stays");
});

test("packaged ingest pins leftover matrixWorldNeedsUpdate false on color-only visuals and the fastener", () => {
  const { root, groups, fastener } = makePackagedFixture();
  let worldUpdates = 0;
  root.updateMatrixWorld = () => {
    worldUpdates += 1;
  };
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  shared.name = "dccWood";
  shared.version = 9;
  const matExtras = { material: "wood" };
  shared.userData = matExtras;
  const first = boxMesh("dccWall", shared);
  const second = boxMesh("dccWallB", shared);
  first.matrixWorldNeedsUpdate = true;
  second.matrixWorldNeedsUpdate = true;
  first.matrixAutoUpdate = true;
  first.matrixWorldAutoUpdate = true;
  first.userData = { exporter: "dcc" };
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  mapped.version = 3;
  mapped.name = "mappedMat";
  const mappedMesh = boxMesh("mappedHero", mapped);
  mappedMesh.matrixWorldNeedsUpdate = true;
  mappedMesh.matrixWorldAutoUpdate = false;
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  sharedGeoMat.version = 6;
  const sharedGeoVisual = new THREE.Mesh(mappedMesh.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  sharedGeoVisual.matrixWorldNeedsUpdate = true;
  const interleavedGeo = new THREE.BufferGeometry();
  const interleavedBuffer = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 1, 0, 0]), 3);
  interleavedGeo.setAttribute("position", new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0));
  interleavedGeo.setIndex([0, 1, 2]);
  const interleavedMat = new THREE.MeshBasicMaterial({ color: 0x633318 });
  interleavedMat.version = 4;
  const interleaved = new THREE.Mesh(interleavedGeo, interleavedMat);
  interleaved.name = "interleavedMesh";
  interleaved.matrixWorldNeedsUpdate = true;
  const lit = boxMesh("litMesh", new THREE.MeshStandardMaterial());
  lit.material.version = 5;
  lit.matrixWorldNeedsUpdate = true;
  groups[0][0].add(first, mappedMesh, sharedGeoVisual, interleaved, lit);
  groups[1][0].add(second);
  fastener.material = new THREE.MeshBasicMaterial({ color: 0xbe7e31 });
  fastener.material.version = 11;
  fastener.material.name = "brassStandIn";
  fastener.matrixWorldNeedsUpdate = true;
  fastener.matrixAutoUpdate = true;
  const fastenerMat = fastener.material;
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.material.version = 8;
  colliderGrab.matrixWorldNeedsUpdate = true;
  const colliderBag = colliderGrab.userData;
  const already = boxMesh("alreadyZero", new THREE.MeshBasicMaterial({ color: 0xbe7e31 }));
  assert.equal(already.matrixWorldNeedsUpdate, false);
  const alreadyMat = already.material;
  groups[0][0].add(already);

  ingestPackagedRoot(root, sidecar);

  assert.equal(worldUpdates, 1, "freeze calls root.updateMatrixWorld once; the pin does not call it again");
  assert.equal(first.material, shared, "ingest does not replace the shared color-only material");
  assert.equal(second.material, shared, "shared material stays one instance");
  assert.equal(first.matrixWorldNeedsUpdate, false, "leftover color-only matrixWorldNeedsUpdate is pinned to false");
  assert.equal(second.matrixWorldNeedsUpdate, false, "second shared-material mesh flag is pinned to false");
  assert.equal(first.matrixAutoUpdate, false, "v0.45 still freezes a static body LOD leaf");
  assert.equal(first.matrixWorldAutoUpdate, true, "v0.69 matrixWorldAutoUpdate stays true");
  assert.equal(shared.version, 0, "v1.5.0 material.version pin still clears leftover version");
  assert.equal(shared.name, "", "v1.2.0 material-name pin still clears leftover material.name");
  assert.equal(materialUserDataEmpty(shared), true, "v1.1.0 material-userData pin still clears leftover material.userData");
  assert.notEqual(shared.userData, matExtras, "material.userData pin replaces leftover material extras");
  assert.equal(meshUserDataEmpty(first), true, "v1.4.0 mesh-userData pin still clears leftover mesh userData");
  assert.equal(first.name, "", "v1.3.0 mesh-name pin still clears a non-reserved name");
  assert.equal(fastener.material, fastenerMat, "ingest does not replace the fastener material");
  assert.equal(fastener.matrixWorldNeedsUpdate, false, "fastener matrixWorldNeedsUpdate is pinned to false");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener matrixAutoUpdate stays live");
  assert.equal(fastener.material.version, 0, "fastener material.version is still pinned to 0");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh stays named");
  assert.equal(mappedMesh.matrixWorldNeedsUpdate, true, "mapped matrixWorldNeedsUpdate stays authored");
  assert.equal(mappedMesh.matrixWorldAutoUpdate, false, "mapped matrixWorldAutoUpdate stays authored");
  assert.equal(mapped.version, 3, "mapped material.version stays authored");
  assert.equal(sharedGeoVisual.matrixWorldNeedsUpdate, true, "geometry shared with a mapped mesh keeps matrixWorldNeedsUpdate");
  assert.equal(sharedGeoMat.version, 6, "geometry shared with a mapped mesh keeps material.version");
  assert.equal(interleaved.matrixWorldNeedsUpdate, true, "interleaved matrixWorldNeedsUpdate stays authored");
  assert.equal(lit.matrixWorldNeedsUpdate, true, "MeshStandard matrixWorldNeedsUpdate stays authored");
  assert.equal(colliderGrab.matrixWorldNeedsUpdate, true, "collider matrixWorldNeedsUpdate stays authored");
  assert.equal(colliderGrab.userData, colliderBag, "collider userData stays");
  assert.equal(colliderGrab.material.version, 8, "collider material.version stays authored");
  assert.equal(already.material, alreadyMat, "already-false material stays the same instance");
  assert.equal(already.matrixWorldNeedsUpdate, false, "already-false matrixWorldNeedsUpdate stays false");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
});

test("packaged ingest without lod groups still pins leftover matrixWorldNeedsUpdate", () => {
  const { root, body, fastener } = makePackagedFixture({ withLod: false });
  root.updateMatrixWorld = () => {};
  const bodyMesh = visualMeshes(body)[0];
  bodyMesh.matrixWorldNeedsUpdate = true;
  bodyMesh.material.version = 5;
  bodyMesh.material.name = "bodyMat";
  bodyMesh.matrixAutoUpdate = true;
  const bodyMat = bodyMesh.material;
  fastener.matrixWorldNeedsUpdate = true;
  fastener.material.version = 6;
  const fastenerMat = fastener.material;
  const mapped = boxMesh("mappedHero", new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } }));
  mapped.matrixWorldNeedsUpdate = true;
  mapped.material.version = 2;
  body.add(mapped);
  const colliderGrab = root.getObjectByName("collider_grab");
  colliderGrab.matrixWorldNeedsUpdate = true;
  colliderGrab.material.version = 7;
  ingestPackagedRoot(root, sidecar);
  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.equal(bodyMesh.matrixWorldNeedsUpdate, false, "fail-soft body matrixWorldNeedsUpdate is pinned");
  assert.equal(bodyMesh.matrixAutoUpdate, false, "fail-soft v0.45 still freezes the static body mesh");
  assert.equal(bodyMesh.material.version, 0, "fail-soft body material.version is still pinned");
  assert.equal(bodyMesh.material.name, "", "fail-soft body material.name is still pinned");
  assert.equal(fastener.material, fastenerMat, "fail-soft does not replace the fastener material");
  assert.equal(fastener.matrixWorldNeedsUpdate, false, "fail-soft fastener matrixWorldNeedsUpdate is pinned");
  assert.equal(fastener.material.version, 0, "fail-soft fastener material.version is still pinned");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(mapped.matrixWorldNeedsUpdate, true, "fail-soft mapped matrixWorldNeedsUpdate stays authored");
  assert.equal(mapped.material.version, 2, "fail-soft mapped material.version stays authored");
  assert.equal(colliderGrab.matrixWorldNeedsUpdate, true, "fail-soft collider matrixWorldNeedsUpdate stays");
  assert.equal(colliderGrab.material.version, 7, "fail-soft collider material.version stays");
});

function colorAttributeAbsent(geometry) {
  return geometry?.getAttribute?.("color") == null && geometry?.hasAttribute?.("color") === false;
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

/** Float32 color. itemSize 3: count * 12 bytes. itemSize 4: count * 16 bytes. */
function attachLeftoverColorAttribute(geometry, itemSize = 3) {
  const count = geometry.getAttribute("position").count;
  const color = new THREE.Float32BufferAttribute(count * itemSize, itemSize);
  for (let i = 0; i < count; i++) {
    if (itemSize === 4) color.setXYZW(i, 0.2, 0.4, 0.6, 1);
    else color.setXYZ(i, 0.2, 0.4, 0.6);
  }
  geometry.setAttribute("color", color);
  return { color, colorBytes: color.array.byteLength, count, itemSize };
}

test("packaged ingest strips leftover color on color-only visuals and the fastener", () => {
  const { root, groups, fastener } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  shared.name = "dccWood";
  shared.version = 9;
  const matExtras = { material: "wood" };
  shared.userData = matExtras;
  const first = boxMesh("dccWall", shared);
  const firstColor = attachLeftoverColorAttribute(first.geometry, 3);
  assert.equal(firstColor.count, 24, "BoxGeometry color fixture has 24 vertices");
  assert.equal(firstColor.colorBytes, 288, "24 verts × Float32 color itemSize 3 × 4 B = 288");
  const second = boxMesh("dccWallB", shared);
  attachLeftoverColorAttribute(second.geometry, 3);
  first.matrixWorldNeedsUpdate = false;
  first.userData = { exporter: "dcc" };
  const firstPosition = first.geometry.getAttribute("position");
  const firstIndex = first.geometry.index;
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  mapped.version = 3;
  mapped.name = "mappedMat";
  const mappedMesh = boxMesh("mappedHero", mapped);
  const mappedColor = attachLeftoverColorAttribute(mappedMesh.geometry, 3);
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  sharedGeoMat.version = 6;
  const sharedGeoVisual = new THREE.Mesh(mappedMesh.geometry, sharedGeoMat);
  // Outside the lod group so merge/pack does not strip the shared
  // geometry. The pin's shared-geometry skip is what keeps `color`.
  sharedGeoVisual.name = "sharedGeoBody";
  sharedGeoVisual.matrixWorldNeedsUpdate = false;
  const interleavedGeo = new THREE.BufferGeometry();
  const interleavedBuffer = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 1, 0, 0]), 3);
  interleavedGeo.setAttribute("position", new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0));
  interleavedGeo.setIndex([0, 1, 2]);
  const interleavedColor = new THREE.Float32BufferAttribute(6, 3);
  interleavedGeo.setAttribute("color", interleavedColor);
  const interleavedMat = new THREE.MeshBasicMaterial({ color: 0x633318 });
  interleavedMat.version = 4;
  const interleaved = new THREE.Mesh(interleavedGeo, interleavedMat);
  interleaved.name = "interleavedMesh";
  const lit = boxMesh("litMesh", new THREE.MeshStandardMaterial());
  const litColor = attachLeftoverColorAttribute(lit.geometry, 4);
  assert.equal(litColor.colorBytes, 384, "24 verts × Float32 color itemSize 4 × 4 B = 384");
  lit.material.version = 5;
  groups[0][0].add(first, mappedMesh, interleaved, lit);
  groups[1][0].add(second);
  root.add(sharedGeoVisual);
  const fastenerColor = attachLeftoverColorAttribute(fastener.geometry, 3);
  fastener.material = new THREE.MeshBasicMaterial({ color: 0xbe7e31 });
  fastener.material.version = 11;
  fastener.material.name = "brassStandIn";
  fastener.matrixWorldNeedsUpdate = false;
  const fastenerMat = fastener.material;
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderColor = attachLeftoverColorAttribute(colliderGrab.geometry, 3);
  colliderGrab.material.version = 8;
  const colliderBag = colliderGrab.userData;
  const already = boxMesh("alreadyAbsent", new THREE.MeshBasicMaterial({ color: 0xbe7e31 }));
  assert.equal(colorAttributeAbsent(already.geometry), true);
  groups[0][0].add(already);

  ingestPackagedRoot(root, sidecar);

  assert.equal(colorAttributeAbsent(first.geometry), true, "leftover color-only color is deleted");
  assert.equal(colorAttributeAbsent(second.geometry), true, "second shared-material geometry color is deleted");
  assert.equal(first.material, shared, "ingest does not replace the shared color-only material");
  assert.equal(second.material, shared, "shared material stays one instance");
  assert.equal(shared.vertexColors, false, "v0.57 vertexColors stays false");
  assert.equal(shared.version, 0, "v1.5.0 material.version pin still clears leftover version");
  assert.equal(shared.name, "", "v1.2.0 material-name pin still clears leftover material.name");
  assert.equal(materialUserDataEmpty(shared), true, "v1.1.0 material-userData pin still clears leftover material.userData");
  assert.notEqual(shared.userData, matExtras, "material.userData pin replaces leftover material extras");
  assert.equal(meshUserDataEmpty(first), true, "v1.4.0 mesh-userData pin still clears leftover mesh userData");
  assert.equal(first.name, "", "v1.3.0 mesh-name pin still clears a non-reserved name");
  assert.equal(first.matrixWorldNeedsUpdate, false, "v1.6.0 matrixWorldNeedsUpdate stays false");
  assert.ok(first.geometry.getAttribute("position"), "color strip does not delete position");
  assert.ok(first.geometry.index, "color strip does not delete the index");
  assert.equal(first.geometry.index === firstIndex || first.geometry.index.array instanceof Uint16Array, true, "index stays or is the pack Uint16 compact");
  assert.equal(colorAttributeAbsent(fastener.geometry), true, "fastener color is deleted");
  assert.equal(fastenerColor.colorBytes, 288, "fastener fixture carried 288 leftover color bytes");
  assert.equal(fastener.material, fastenerMat, "ingest does not replace the fastener material");
  assert.equal(fastener.material.vertexColors, false, "fastener vertexColors stays false");
  assert.equal(fastener.matrixWorldNeedsUpdate, false, "fastener matrixWorldNeedsUpdate stays false");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh stays named");
  assert.equal(mappedMesh.geometry.getAttribute("color"), mappedColor.color, "mapped color stays authored");
  assert.equal(sharedGeoVisual.geometry.getAttribute("color"), mappedColor.color, "geometry shared with a mapped mesh keeps color");
  assert.equal(sharedGeoVisual.name, "sharedGeoBody", "shared-geometry mesh name stays");
  assert.equal(sharedGeoVisual.matrixWorldNeedsUpdate, false, "shared-geometry matrixWorldNeedsUpdate stays");
  assert.equal(sharedGeoMat.version, 6, "geometry shared with a mapped mesh keeps material.version");
  assert.equal(interleaved.geometry.getAttribute("color"), interleavedColor, "interleaved color stays authored");
  assert.equal(lit.geometry.getAttribute("color"), litColor.color, "MeshStandard color stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("color"), colliderColor.color, "collider color stays authored");
  assert.equal(colliderGrab.userData, colliderBag, "collider userData stays");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
  assert.equal(colorAttributeAbsent(already.geometry), true, "already-absent color stays absent");
  assert.equal(firstPosition.count, 24, "position count stays 24");
});

test("packaged ingest without lod groups still strips leftover color and drops the color attrBytes", () => {
  const { root, body, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  const bodyColor = attachLeftoverColorAttribute(bodyMesh.geometry, 3);
  const bodyBefore = cpuAttrBytes(bodyMesh.geometry);
  const bodyPosition = bodyMesh.geometry.getAttribute("position");
  const bodyIndex = bodyMesh.geometry.index;
  const bodyMat = bodyMesh.material;
  bodyMesh.material.version = 5;
  bodyMesh.material.name = "bodyMat";
  bodyMesh.matrixWorldNeedsUpdate = false;
  bodyMesh.name = "lidMesh";
  const bodyBag = bodyMesh.userData;
  const alphaMesh = boxMesh("alphaBody", new THREE.MeshBasicMaterial({ color: 0x633318 }));
  const alphaColor = attachLeftoverColorAttribute(alphaMesh.geometry, 4);
  const alphaBefore = cpuAttrBytes(alphaMesh.geometry);
  const alphaPosition = alphaMesh.geometry.getAttribute("position");
  body.add(alphaMesh);
  const fastenerColor = attachLeftoverColorAttribute(fastener.geometry, 3);
  fastener.material.version = 6;
  fastener.matrixWorldNeedsUpdate = false;
  const fastenerMat = fastener.material;
  const mapped = boxMesh("mappedHero", new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } }));
  const mappedColor = attachLeftoverColorAttribute(mapped.geometry, 3);
  mapped.material.version = 2;
  body.add(mapped);
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  sharedGeoMat.version = 6;
  const sharedGeoVisual = new THREE.Mesh(mapped.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  sharedGeoVisual.matrixWorldNeedsUpdate = false;
  body.add(sharedGeoVisual);
  const colliderGrab = root.getObjectByName("collider_grab");
  const colliderColor = attachLeftoverColorAttribute(colliderGrab.geometry, 3);
  colliderGrab.material.version = 7;
  ingestPackagedRoot(root, sidecar);
  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.equal(colorAttributeAbsent(bodyMesh.geometry), true, "fail-soft body color is deleted");
  assert.equal(bodyColor.colorBytes, 288, "fail-soft body fixture is 24 × 3 × 4 = 288 color bytes");
  assert.equal(cpuAttrBytes(bodyMesh.geometry), bodyBefore - bodyColor.colorBytes, "fail-soft body pre-upload attrBytes drop by the leftover color bytes");
  assert.equal(bodyMesh.geometry.getAttribute("position"), bodyPosition, "fail-soft body position stays");
  assert.equal(bodyMesh.geometry.index, bodyIndex, "fail-soft body index stays");
  assert.equal(bodyMesh.material.vertexColors, false, "fail-soft body vertexColors stays false");
  assert.equal(bodyMesh.material.version, 0, "fail-soft body material.version is still pinned");
  assert.equal(bodyMesh.name, "lidMesh", "fail-soft reserved lidMesh name stays");
  assert.equal(bodyMesh.matrixWorldNeedsUpdate, false, "fail-soft matrixWorldNeedsUpdate stays false");
  assert.equal(bodyMesh.userData, bodyBag, "fail-soft does not replace an already-empty mesh userData object when it was replaced before ingest");
  assert.equal(colorAttributeAbsent(alphaMesh.geometry), true, "fail-soft itemSize-4 color is deleted");
  assert.equal(alphaColor.colorBytes, 384, "fail-soft itemSize-4 fixture is 24 × 4 × 4 = 384 color bytes");
  assert.equal(cpuAttrBytes(alphaMesh.geometry), alphaBefore - alphaColor.colorBytes, "fail-soft itemSize-4 attrBytes drop by 384");
  assert.equal(alphaMesh.geometry.getAttribute("position"), alphaPosition, "fail-soft itemSize-4 position stays");
  assert.equal(colorAttributeAbsent(fastener.geometry), true, "fail-soft fastener color is deleted");
  assert.equal(fastenerColor.colorBytes, 288, "fail-soft fastener fixture carried 288 color bytes");
  assert.equal(fastener.material, fastenerMat, "fail-soft does not replace the fastener material");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(fastener.matrixWorldNeedsUpdate, false, "fail-soft fastener matrixWorldNeedsUpdate stays false");
  assert.equal(mapped.geometry.getAttribute("color"), mappedColor.color, "fail-soft mapped color stays authored");
  assert.equal(sharedGeoVisual.geometry.getAttribute("color"), mappedColor.color, "fail-soft geometry shared with a mapped mesh keeps color");
  assert.equal(sharedGeoVisual.name, "sharedGeoBody", "fail-soft shared-geometry mesh name stays");
  assert.equal(sharedGeoMat.version, 6, "fail-soft shared-geometry material.version stays authored");
  assert.equal(mapped.material.version, 2, "fail-soft mapped material.version stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("color"), colliderColor.color, "fail-soft collider color stays");
  assert.equal(colliderGrab.material.version, 7, "fail-soft collider material.version stays");
});


function geometryOnUploadRelease(geometry) {
  if (!geometry) return false;
  const position = geometry.getAttribute?.("position");
  if (!isCpuArrayReleaseOnUpload(position?.onUploadCallback, geometry)) return false;
  const index = geometry.index;
  if (index && !isCpuArrayReleaseOnUpload(index.onUploadCallback, geometry)) return false;
  return true;
}

test("packaged ingest pins the release onUpload hook on color-only visuals and the fastener", () => {
  const { root, groups, fastener } = makePackagedFixture();
  const shared = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const first = boxMesh("dccWall", shared);
  function firstRogue() {}
  first.geometry.getAttribute("position").onUpload(firstRogue);
  first.geometry.index.onUpload(firstRogue);
  const firstArray = first.geometry.getAttribute("position").array;
  const second = boxMesh("dccWallB", shared);
  function secondRogue() {}
  second.geometry.getAttribute("position").onUpload(secondRogue);
  const mapped = new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } });
  const mappedMesh = boxMesh("mappedHero", mapped);
  function mappedRogue() {}
  mappedMesh.geometry.getAttribute("position").onUpload(mappedRogue);
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  const sharedGeoVisual = new THREE.Mesh(mappedMesh.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  const interleavedGeo = new THREE.BufferGeometry();
  const interleavedBuffer = new THREE.InterleavedBuffer(new Float32Array([0, 0, 0, 1, 0, 0]), 3);
  interleavedGeo.setAttribute("position", new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0));
  interleavedGeo.setIndex([0, 1, 2]);
  function interleavedRogue() {}
  interleavedGeo.index.onUpload(interleavedRogue);
  const interleaved = new THREE.Mesh(interleavedGeo, new THREE.MeshBasicMaterial({ color: 0x633318 }));
  interleaved.name = "interleavedMesh";
  const lit = boxMesh("litMesh", new THREE.MeshStandardMaterial());
  function litRogue() {}
  lit.geometry.getAttribute("position").onUpload(litRogue);
  groups[0][0].add(first, mappedMesh, interleaved, lit);
  groups[1][0].add(second);
  root.add(sharedGeoVisual);
  function fastenerRogue() {}
  fastener.geometry.getAttribute("position").onUpload(fastenerRogue);
  fastener.geometry.index.onUpload(fastenerRogue);
  fastener.material = new THREE.MeshBasicMaterial({ color: 0xbe7e31 });
  const fastenerMat = fastener.material;
  const fastenerArray = fastener.geometry.getAttribute("position").array;
  const colliderGrab = root.getObjectByName("collider_grab");
  function colliderRogue() {}
  colliderGrab.geometry.getAttribute("position").onUpload(colliderRogue);
  const colliderBag = colliderGrab.userData;

  ingestPackagedRoot(root, sidecar);

  assert.equal(geometryOnUploadRelease(fastener.geometry), true, "fastener position and index use the release hook");
  assert.notEqual(fastener.geometry.getAttribute("position").onUploadCallback, fastenerRogue, "fastener rogue hook is replaced");
  assert.ok(fastener.geometry.getAttribute("position").array, "ingest does not null fastener CPU arrays");
  assert.equal(fastener.material, fastenerMat, "ingest does not replace the fastener material");
  assert.equal(fastener.name, "fastenerMesh", "fastenerMesh stays named");
  assert.equal(fastener.matrixAutoUpdate, true, "fastener matrixAutoUpdate stays live");
  assert.equal(mappedMesh.geometry.getAttribute("position").onUploadCallback, mappedRogue, "mapped onUploadCallback stays authored");
  assert.equal(sharedGeoVisual.geometry.getAttribute("position").onUploadCallback, mappedRogue, "geometry shared with a mapped mesh keeps onUploadCallback");
  assert.equal(sharedGeoVisual.name, "sharedGeoBody", "shared-geometry mesh name stays");
  assert.equal(interleaved.geometry.index.onUploadCallback, interleavedRogue, "interleaved onUploadCallback stays authored");
  assert.equal(lit.geometry.getAttribute("position").onUploadCallback, litRogue, "MeshStandard onUploadCallback stays authored");
  assert.equal(colliderGrab.geometry.getAttribute("position").onUploadCallback, colliderRogue, "collider onUploadCallback stays authored");
  assert.equal(colliderGrab.userData, colliderBag, "collider userData stays");
  assert.equal(colliderGrab.name, "collider_grab", "collider mesh name stays");
  // Merge/pack builds a new geometry for same-material siblings, so the
  // pre-ingest rogue closure is not the survivor. The survivor still
  // has the release hook and still holds its CPU arrays.
  const survivors = groups[0][0].children.filter((o) => o.isMesh && o.material === shared);
  assert.ok(survivors.length >= 1, "color-only lod mesh survives ingest");
  for (const mesh of survivors) {
    assert.equal(geometryOnUploadRelease(mesh.geometry), true, "packed color-only survivor uses the release hook");
    assert.ok(mesh.geometry.getAttribute("position").array, "packed survivor CPU array stays until upload");
    assert.equal(mesh.geometry.boundingBox, null, "bounds pin still leaves boundingBox null");
    assert.equal(mesh.visible, true, "mesh.visible is not pinned");
  }
  assert.ok(firstArray, "pre-ingest position array was present");
  assert.ok(fastenerArray, "pre-ingest fastener array was present");
});

test("packaged ingest without lod groups still pins the release onUpload hook", () => {
  const { root, body, fastener } = makePackagedFixture({ withLod: false });
  const bodyMesh = visualMeshes(body)[0];
  function bodyRogue() {}
  bodyMesh.geometry.getAttribute("position").onUpload(bodyRogue);
  bodyMesh.geometry.index.onUpload(bodyRogue);
  bodyMesh.geometry.boundingBox = null;
  bodyMesh.geometry.boundingSphere = null;
  const bodyArray = bodyMesh.geometry.getAttribute("position").array;
  const bodyIndexArray = bodyMesh.geometry.index.array;
  const bodyMat = bodyMesh.material;
  bodyMesh.name = "lidMesh";
  bodyMesh.matrixWorldNeedsUpdate = false;
  bodyMesh.material.version = 5;
  const alphaMesh = boxMesh("alphaBody", new THREE.MeshBasicMaterial({ color: 0x633318 }));
  function alphaRogue() {}
  alphaMesh.geometry.getAttribute("position").onUpload(alphaRogue);
  alphaMesh.geometry.index.onUpload(alphaRogue);
  const alphaArray = alphaMesh.geometry.getAttribute("position").array;
  body.add(alphaMesh);
  function fastenerRogue() {}
  fastener.geometry.getAttribute("position").onUpload(fastenerRogue);
  const fastenerMat = fastener.material;
  const mapped = boxMesh("mappedHero", new THREE.MeshBasicMaterial({ color: 0xffffff, map: { isTexture: true } }));
  function mappedRogue() {}
  mapped.geometry.getAttribute("position").onUpload(mappedRogue);
  body.add(mapped);
  const sharedGeoMat = new THREE.MeshBasicMaterial({ color: 0xc1c3c9 });
  const sharedGeoVisual = new THREE.Mesh(mapped.geometry, sharedGeoMat);
  sharedGeoVisual.name = "sharedGeoBody";
  body.add(sharedGeoVisual);
  const colliderGrab = root.getObjectByName("collider_grab");
  function colliderRogue() {}
  colliderGrab.geometry.getAttribute("position").onUpload(colliderRogue);

  ingestPackagedRoot(root, sidecar);

  assert.equal(root.userData.lod, undefined, "fail-soft still does not invent lod groups");
  assert.equal(bodyMesh.material, bodyMat, "fail-soft does not replace the body material");
  assert.notEqual(bodyMesh.geometry.getAttribute("position").onUploadCallback, bodyRogue, "fail-soft body rogue hook is replaced");
  assert.equal(geometryOnUploadRelease(bodyMesh.geometry), true, "fail-soft body position and index use the release hook");
  assert.equal(bodyMesh.geometry.getAttribute("position").array, bodyArray, "fail-soft pin does not null the body position array");
  assert.equal(bodyMesh.geometry.index.array, bodyIndexArray, "fail-soft pin does not null the body index array");
  assert.equal(bodyMesh.geometry.boundingBox, null, "fail-soft pin does not recompute boundingBox");
  assert.equal(bodyMesh.geometry.boundingSphere, null, "fail-soft pin does not recompute boundingSphere");
  assert.equal(bodyMesh.name, "lidMesh", "fail-soft reserved lidMesh name stays");
  assert.equal(bodyMesh.matrixWorldNeedsUpdate, false, "fail-soft matrixWorldNeedsUpdate stays false");
  assert.equal(bodyMesh.material.version, 0, "fail-soft material.version pin still runs");
  assert.equal(bodyMesh.matrixAutoUpdate, false, "fail-soft v0.45 still freezes the static body mesh");
  assert.equal(geometryOnUploadRelease(alphaMesh.geometry), true, "fail-soft second color-only mesh uses the release hook");
  assert.equal(alphaMesh.geometry.getAttribute("position").array, alphaArray, "fail-soft second mesh CPU array stays");
  assert.notEqual(alphaMesh.geometry.getAttribute("position").onUploadCallback, alphaRogue, "fail-soft second rogue hook is replaced");
  assert.equal(geometryOnUploadRelease(fastener.geometry), true, "fail-soft fastener uses the release hook");
  assert.notEqual(fastener.geometry.getAttribute("position").onUploadCallback, fastenerRogue, "fail-soft fastener rogue hook is replaced");
  assert.ok(fastener.geometry.getAttribute("position").array, "fail-soft fastener CPU array stays");
  assert.equal(fastener.material, fastenerMat, "fail-soft does not replace the fastener material");
  assert.equal(fastener.name, "fastenerMesh", "fail-soft fastenerMesh stays named");
  assert.equal(mapped.geometry.getAttribute("position").onUploadCallback, mappedRogue, "fail-soft mapped onUploadCallback stays authored");
  assert.equal(sharedGeoVisual.geometry.getAttribute("position").onUploadCallback, mappedRogue, "fail-soft geometry shared with a mapped mesh keeps onUploadCallback");
  assert.equal(sharedGeoVisual.name, "sharedGeoBody", "fail-soft shared-geometry mesh name stays");
  assert.equal(colliderGrab.geometry.getAttribute("position").onUploadCallback, colliderRogue, "fail-soft collider onUploadCallback stays");
});

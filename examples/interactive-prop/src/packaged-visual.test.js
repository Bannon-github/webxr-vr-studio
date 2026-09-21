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
  assert.ok(afterBody[0].name, "merged mesh keeps a non-empty name from an input");
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

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
}

function assertQuestSafeUnlitShadowFlags(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.castShadow, false, `${label} pins castShadow false`);
  assert.equal(mesh.receiveShadow, false, `${label} pins receiveShadow false`);
}

function assertQuestSafeUnlitFrustumCulled(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.frustumCulled, true, `${label} pins frustumCulled true`);
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

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

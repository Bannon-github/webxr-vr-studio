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
  collectCrateVisualMaterials,
  collectLodVisualMaterials,
  compactIndexToUint16,
  createToolbox,
  getToolboxLodStats,
  isColorOnlyUnlitBasic,
  setToolboxLod,
  shareColorOnlyUnlitBasic,
  stripUnusedColorOnlyAttributes,
  weldCoincidentVertices,
} = await import("./toolbox.js");

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
  // no-op on these LODs — weld already wrote Uint16 — so attrBytes
  // stay at the v0.40 envelope. Tris stay index-length/3.
  assert.deepEqual(stats[0], { tris: 240, draws: 6, verts: 230, attrBytes: 4200 });
  assert.deepEqual(stats[1], { tris: 96, draws: 4, verts: 100, attrBytes: 1776 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2, verts: 48, attrBytes: 720 });
  assert.ok(stats[0].attrBytes < 8800, "LOD0 attrBytes drop vs v0.39 weld-with-uv-normal");
  assert.ok(stats[1].attrBytes < 3776, "LOD1 attrBytes drop vs v0.39 weld-with-uv-normal");
  assert.ok(stats[2].attrBytes < 1680, "LOD2 attrBytes drop vs BoxGeometry uv+normal");
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
  assert.ok(visualMeshes(bodyL0)[0].geometry.getAttribute("position"), "position stays");
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
  assert.ok(fastenerMesh.geometry.getAttribute("position"), "fastener keeps position");
  assert.ok(fastenerMesh.geometry.index, "fastener keeps its index");
  assert.equal(fastenerMesh.geometry.index.array.BYTES_PER_ELEMENT, 2, "fastener index is Uint16");
  const fastenerAttrBytes =
    fastenerMesh.geometry.getAttribute("position").array.byteLength + fastenerMesh.geometry.index.array.byteLength;
  assert.equal(fastenerAttrBytes, 360, "fastener BoxGeometry 24×12 B position + 72 B Uint16 index (was 840 with uv+normal)");
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

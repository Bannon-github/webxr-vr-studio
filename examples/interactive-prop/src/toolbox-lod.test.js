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
  pinColorOnlyUnlitBasicFlags,
  pinColorOnlyUnlitBasicFrustumCulled,
  pinColorOnlyUnlitBasicShadowFlags,
  pinColorOnlyVisualFrustumCulled,
  pinColorOnlyVisualMaterialFlags,
  pinColorOnlyVisualShadowFlags,
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

function assertQuestSafeUnlitFlags(mat, label = "color-only MeshBasic") {
  assert.equal(mat.fog, false, `${label} pins fog false`);
  assert.equal(mat.toneMapped, false, `${label} pins toneMapped false`);
  assert.equal(mat.transparent, false, `${label} pins transparent false`);
  assert.equal(mat.opacity, 1, `${label} pins opacity 1`);
  assert.equal(mat.depthWrite, true, `${label} pins depthWrite true`);
  assert.equal(mat.depthTest, true, `${label} pins depthTest true`);
  assert.equal(mat.side, THREE.FrontSide, `${label} pins FrontSide`);
}

function assertQuestSafeUnlitShadowFlags(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.castShadow, false, `${label} pins castShadow false`);
  assert.equal(mesh.receiveShadow, false, `${label} pins receiveShadow false`);
}

function assertQuestSafeUnlitFrustumCulled(mesh, label = "color-only MeshBasic mesh") {
  assert.equal(mesh.frustumCulled, true, `${label} pins frustumCulled true`);
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

test("v0.48 pins fog/toneMapped false and opaque FrontSide on unique color-only MeshBasics; envelope stays v0.47", () => {
  const fresh = new THREE.MeshBasicMaterial();
  assert.equal(fresh.fog, true, "r170 MeshBasicMaterial defaults fog true");
  assert.equal(fresh.toneMapped, true, "r170 MeshBasicMaterial defaults toneMapped true");
  assertR170MeshBasicOpaqueFrontSideDefaults(fresh);

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

  const wrong = new THREE.MeshBasicMaterial({
    color: 0x633318,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  assert.equal(isColorOnlyUnlitBasic(wrong), true, "transparent DoubleSide color-only still passes the gate");
  assert.equal(wrong.transparent, true);
  assert.equal(wrong.opacity, 0.5);
  assert.equal(wrong.depthWrite, false);
  assert.equal(wrong.depthTest, false);
  assert.equal(wrong.side, THREE.DoubleSide);
  pinColorOnlyUnlitBasicFlags(wrong);
  assertQuestSafeUnlitFlags(wrong, "deliberately wrong color-only MeshBasic");
});

test("pinColorOnlyUnlitBasicFlags / pinColorOnlyVisualMaterialFlags skip mapped, lit, morph, colliders, shared blocked", () => {
  const colorOnly = new THREE.MeshBasicMaterial({ color: 0x633318 });
  const mapped = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: { isTexture: true },
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const std = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5, side: THREE.DoubleSide });
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
  assert.equal(std.fog, true, "MeshStandard stays r170 fog default");
  assert.equal(std.toneMapped, true, "MeshStandard stays r170 toneMapped default");
  assert.equal(std.transparent, true, "MeshStandard stays authored transparent");
  assert.equal(std.side, THREE.DoubleSide, "MeshStandard stays authored DoubleSide");

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
  const sharedBlocked = new THREE.MeshBasicMaterial({ color: 0x8d5a23 });
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
  assert.equal(morph.material.fog, true, "morph color-only MeshBasic is skipped");
  assert.equal(morph.material.toneMapped, true);
  assert.equal(morph.material.transparent, false, "morph color-only MeshBasic keeps r170 transparent default");
  assert.equal(morph.material.side, THREE.FrontSide, "morph color-only MeshBasic keeps r170 FrontSide default");
  assert.equal(collider.material.fog, true, "collider MeshBasic stays default");
  assert.equal(collider.material.toneMapped, true);
  assert.equal(sharedVisual.material.fog, true, "shared collider material stays default");
  assert.equal(sharedVisual.material.toneMapped, true, "shared collider material stays default");
  assert.equal(sharedVisual.material.transparent, false, "shared collider material stays unpinned");
  assert.equal(sharedVisual.material.side, THREE.FrontSide, "shared collider material stays unpinned FrontSide");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  L2_NORMAL_SCALE,
  L2_TEXTURE_SIZE,
  L3_LOD_ALBEDO_SIZE,
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
  collectLodVisualMaterials,
  createToolbox,
  getToolboxLodStats,
  setToolboxLod,
} = await import("./toolbox.js");

function scaleXY(mat) {
  return [mat.normalScale?.x, mat.normalScale?.y];
}

function mapWH(tex) {
  const img = tex?.image;
  return [img?.width, img?.height];
}

test("LOD0 512² MeshStandard; LOD1 256² MeshBasic; LOD2 256² MeshBasic", () => {
  const crate = createToolbox();
  assert.equal(L3_LOD_ALBEDO_SIZE, 256);
  assert.equal(L3_LOD_ALBEDO_SIZE * 2, L2_TEXTURE_SIZE);
  assert.equal(crate.userData.l2.lodNormalScaleMul[0], 1);
  assert.equal(crate.userData.l2.lodNormalScaleMul[1], 0);
  assert.equal(crate.userData.l2.lodNormalScaleMul[2], 0);
  assert.equal(crate.userData.l2.textureSize, L2_TEXTURE_SIZE);
  assert.equal(crate.userData.l2.lodAlbedoSize, L3_LOD_ALBEDO_SIZE);
  assert.equal(crate.userData.l2.uniqueTextures, 11);
  assert.deepEqual(crate.userData.l2.lodAlbedoMaps, { 0: 512, 1: 256, 2: 256 });

  setToolboxLod(crate, 0);
  assert.equal(crate.userData.lod.current, 0);
  const lod0 = collectLodVisualMaterials(crate, 0);
  assert.ok(lod0.length > 0);
  for (const mat of lod0) {
    assert.equal(mat.isMeshStandardMaterial, true, "LOD0 stays MeshStandard");
    assert.ok(mat.normalMap, "LOD0 must keep v0.12 normalMap");
    assert.ok(mat.roughnessMap, "LOD0 must keep ORM");
    assert.ok(mat.metalnessMap, "LOD0 must keep ORM");
    assert.deepEqual(mapWH(mat.map), [512, 512], "LOD0 albedo stays 512²");
    assert.deepEqual(mapWH(mat.roughnessMap), [512, 512], "LOD0 ORM stays 512²");
    assert.deepEqual(mapWH(mat.normalMap), [512, 512], "LOD0 normal stays 512²");
    const [nx, ny] = scaleXY(mat);
    assert.ok(nx > 0 && ny > 0);
    const expected = Object.values(L2_NORMAL_SCALE).find(([sx]) => sx === nx);
    assert.ok(expected, `LOD0 normalScale ${nx} must match L2_NORMAL_SCALE`);
    assert.equal(ny, expected[1]);
  }

  const lod1 = collectLodVisualMaterials(crate, 1);
  assert.ok(lod1.length > 0);
  const lod1Named = crate.userData.materials.lod1;
  assert.equal(lod1Named.wood.isMeshBasicMaterial, true, "LOD1 wood is MeshBasic");
  assert.equal(lod1Named.wood.map, lod1Named.woodDark.map, "LOD1 wood variants share 256² albedo");
  assert.equal(lod1Named.handleMat.map, lod1Named.wood.map);
  assert.notEqual(lod1Named.brass.map, lod1Named.wood.map, "LOD1 brass uses its own 256² albedo");
  for (const mat of lod1) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD1 is MeshBasicMaterial (unlit)");
    assert.ok(!mat.isMeshStandardMaterial, "LOD1 is not MeshStandard");
    assert.ok(mat.map, "LOD1 keeps albedo");
    assert.ok(!mat.normalMap, "LOD1 has no normalMap");
    assert.ok(!mat.roughnessMap, "LOD1 has no ORM roughnessMap");
    assert.ok(!mat.metalnessMap, "LOD1 has no ORM metalnessMap");
    assert.equal(mat.roughness, undefined, "LOD1 MeshBasic has no roughness");
    assert.equal(mat.metalness, undefined, "LOD1 MeshBasic has no metalness");
    assert.deepEqual(mapWH(mat.map), [256, 256], "LOD1 albedo is 256²");
    const reused = lod0.find((m) => m.map === mat.map);
    assert.equal(reused, undefined, "LOD1 must not bind the shared 512² L2 albedo");
  }

  setToolboxLod(crate, 2);
  assert.equal(crate.userData.lod.current, 2);
  const lod2 = collectLodVisualMaterials(crate, 2);
  assert.ok(lod2.length > 0);
  for (const mat of lod2) {
    assert.equal(mat.isMeshBasicMaterial, true, "LOD2 is MeshBasicMaterial (unlit)");
    assert.ok(!mat.isMeshStandardMaterial, "LOD2 is not MeshStandard");
    assert.ok(mat.map, "LOD2 keeps albedo");
    assert.ok(!mat.normalMap, "LOD2 has no normalMap");
    assert.ok(!mat.roughnessMap, "LOD2 has no ORM roughnessMap");
    assert.ok(!mat.metalnessMap, "LOD2 has no ORM metalnessMap");
    assert.equal(mat.roughness, undefined, "LOD2 MeshBasic has no roughness");
    assert.equal(mat.metalness, undefined, "LOD2 MeshBasic has no metalness");
    assert.deepEqual(mapWH(mat.map), [256, 256], "LOD2 albedo is 256²");
    const reused = lod0.find((m) => m.map === mat.map);
    assert.equal(reused, undefined, "LOD2 must not bind the shared 512² L2 albedo");
    assert.equal(mat.map, lod1Named.wood.map, "LOD2 shares the 256² wood albedo with LOD1");
  }
  for (const mat of lod0) {
    assert.ok(mat.normalMap, "LOD0 keeps normalMap after LOD2 collect");
    assert.ok(mat.roughnessMap, "LOD0 keeps ORM");
    assert.deepEqual(mapWH(mat.map), [512, 512], "LOD0 albedo stays 512² after LOD2 collect");
  }
  assert.equal(crate.userData.l2.lodNormalMaps[0], true);
  assert.equal(crate.userData.l2.lodNormalMaps[1], false);
  assert.equal(crate.userData.l2.lodNormalMaps[2], false);
  assert.equal(crate.userData.l2.lodOrmMaps[0], true);
  assert.equal(crate.userData.l2.lodOrmMaps[1], false);
  assert.equal(crate.userData.l2.lodOrmMaps[2], false);
  assert.equal(crate.userData.l2.lod1Constants, undefined, "LOD1 drops roughness/metalness constants");
  assert.equal(crate.userData.l2.lod2Constants, undefined, "LOD2 drops roughness/metalness constants");
  assert.deepEqual(crate.userData.l2.lodMaterialClass, {
    0: "MeshStandardMaterial",
    1: "MeshBasicMaterial",
    2: "MeshBasicMaterial",
  });

  const fastener = crate.userData.fastener.mesh;
  assert.equal(fastener.material, crate.userData.materials.lod0.brass);
  assert.equal(fastener.material.isMeshStandardMaterial, true, "fastener stays MeshStandard");
  assert.ok(fastener.material.normalMap, "fastener stays on shared LOD0 brass (keeps normalMap)");
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

test("LOD draws and tris stay at the v0.13 envelope", () => {
  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 14 });
  assert.deepEqual(stats[1], { tris: 96, draws: 8 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2 });
});

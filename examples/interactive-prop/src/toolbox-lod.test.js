import assert from "node:assert/strict";
import { test } from "node:test";
import {
  L2_NORMAL_SCALE,
  L3_LOD1_BRASS_METALNESS,
  L3_LOD1_BRASS_ROUGHNESS,
  L3_LOD1_WOOD_METALNESS,
  L3_LOD1_WOOD_ROUGHNESS,
  L3_LOD2_WOOD_METALNESS,
  L3_LOD2_WOOD_ROUGHNESS,
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

test("LOD0 full normalScale + normalMap + ORM; LOD1 and LOD2 albedo-only", () => {
  const crate = createToolbox();
  assert.equal(crate.userData.l2.lodNormalScaleMul[0], 1);
  assert.equal(crate.userData.l2.lodNormalScaleMul[1], 0);
  assert.equal(crate.userData.l2.lodNormalScaleMul[2], 0);
  assert.equal(crate.userData.l2.uniqueTextures, 9);

  setToolboxLod(crate, 0);
  assert.equal(crate.userData.lod.current, 0);
  const lod0 = collectLodVisualMaterials(crate, 0);
  assert.ok(lod0.length > 0);
  for (const mat of lod0) {
    assert.ok(mat.normalMap, "LOD0 must keep v0.12 normalMap");
    const [nx, ny] = scaleXY(mat);
    assert.ok(nx > 0 && ny > 0);
    const expected = Object.values(L2_NORMAL_SCALE).find(([sx]) => sx === nx);
    assert.ok(expected, `LOD0 normalScale ${nx} must match L2_NORMAL_SCALE`);
    assert.equal(ny, expected[1]);
  }

  const lod1 = collectLodVisualMaterials(crate, 1);
  assert.ok(lod1.length > 0);
  const lod1Named = crate.userData.materials.lod1;
  assert.equal(lod1Named.wood.roughness, L3_LOD1_WOOD_ROUGHNESS);
  assert.equal(lod1Named.wood.metalness, L3_LOD1_WOOD_METALNESS);
  assert.equal(lod1Named.woodDark.roughness, L3_LOD1_WOOD_ROUGHNESS);
  assert.equal(lod1Named.handleMat.roughness, L3_LOD1_WOOD_ROUGHNESS);
  assert.equal(lod1Named.brass.roughness, L3_LOD1_BRASS_ROUGHNESS);
  assert.equal(lod1Named.brass.metalness, L3_LOD1_BRASS_METALNESS);
  for (const mat of lod1) {
    assert.equal(mat.normalMap, null, "LOD1 drops normalMap");
    assert.ok(mat.map, "LOD1 keeps albedo");
    assert.equal(mat.roughnessMap, null, "LOD1 drops ORM roughnessMap");
    assert.equal(mat.metalnessMap, null, "LOD1 drops ORM metalnessMap");
    const peer = lod0.find((m) => m.map === mat.map);
    assert.ok(peer, "LOD1 must reuse a LOD0 albedo canvas (no extra unique maps)");
    assert.notEqual(mat, peer, "LOD1 uses a separate material instance");
    assert.ok(peer.normalMap, "LOD0 peer still has normalMap");
    assert.ok(peer.roughnessMap, "LOD0 peer still has ORM");
  }

  setToolboxLod(crate, 2);
  assert.equal(crate.userData.lod.current, 2);
  const lod2 = collectLodVisualMaterials(crate, 2);
  assert.ok(lod2.length > 0);
  for (const mat of lod2) {
    assert.equal(mat.normalMap, null);
    assert.ok(mat.map, "LOD2 keeps albedo");
    assert.equal(mat.roughnessMap, null, "LOD2 drops ORM roughnessMap");
    assert.equal(mat.metalnessMap, null, "LOD2 drops ORM metalnessMap");
    assert.equal(mat.roughness, L3_LOD2_WOOD_ROUGHNESS);
    assert.equal(mat.metalness, L3_LOD2_WOOD_METALNESS);
  }
  for (const mat of lod0) {
    assert.ok(mat.normalMap, "LOD0 keeps normalMap after LOD2 collect");
    assert.ok(mat.roughnessMap, "LOD0 keeps ORM");
  }
  assert.equal(crate.userData.l2.lodNormalMaps[0], true);
  assert.equal(crate.userData.l2.lodNormalMaps[1], false);
  assert.equal(crate.userData.l2.lodNormalMaps[2], false);
  assert.equal(crate.userData.l2.lodOrmMaps[0], true);
  assert.equal(crate.userData.l2.lodOrmMaps[1], false);
  assert.equal(crate.userData.l2.lodOrmMaps[2], false);
  assert.equal(crate.userData.l2.lod1Constants.wood.roughness, L3_LOD1_WOOD_ROUGHNESS);
  assert.equal(crate.userData.l2.lod1Constants.wood.metalness, L3_LOD1_WOOD_METALNESS);
  assert.equal(crate.userData.l2.lod1Constants.brass.roughness, L3_LOD1_BRASS_ROUGHNESS);
  assert.equal(crate.userData.l2.lod1Constants.brass.metalness, L3_LOD1_BRASS_METALNESS);
  assert.equal(crate.userData.l2.lod2Constants.roughness, L3_LOD2_WOOD_ROUGHNESS);
  assert.equal(crate.userData.l2.lod2Constants.metalness, L3_LOD2_WOOD_METALNESS);

  const fastener = crate.userData.fastener.mesh;
  assert.equal(fastener.material, crate.userData.materials.lod0.brass);
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

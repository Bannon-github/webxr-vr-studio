import assert from "node:assert/strict";
import { test } from "node:test";

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

test("LOD2 visual materials omit normalMap; LOD0 keeps v0.12 normals", () => {
  const crate = createToolbox();
  setToolboxLod(crate, 2);
  assert.equal(crate.userData.lod.current, 2);
  const lod2 = collectLodVisualMaterials(crate, 2);
  assert.ok(lod2.length > 0);
  for (const mat of lod2) {
    assert.equal(mat.normalMap, null);
    assert.ok(mat.map);
    assert.ok(mat.roughnessMap);
  }

  setToolboxLod(crate, 0);
  assert.equal(crate.userData.lod.current, 0);
  const lod0 = collectLodVisualMaterials(crate, 0);
  assert.ok(lod0.length > 0);
  for (const mat of lod0) {
    assert.ok(mat.normalMap, "LOD0 must keep v0.12 normalMap");
    assert.notEqual(mat.normalMap, lod2[0]?.normalMap);
  }
  assert.equal(crate.userData.l2.lodNormalMaps[1], true);
  assert.equal(crate.userData.l2.lodNormalMaps[2], false);

  const lod1 = collectLodVisualMaterials(crate, 1);
  for (const mat of lod1) {
    assert.ok(mat.normalMap, "LOD1 keeps shared v0.12 normals (simpler Quest-safe choice)");
  }
});

test("LOD draws and tris stay at the v0.12 envelope", () => {
  const crate = createToolbox();
  const stats = getToolboxLodStats(crate);
  assert.deepEqual(stats[0], { tris: 240, draws: 14 });
  assert.deepEqual(stats[1], { tris: 96, draws: 8 });
  assert.deepEqual(stats[2], { tris: 24, draws: 2 });
});

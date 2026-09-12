import assert from "node:assert/strict";
import { test } from "node:test";
import {
  L2_NORMAL_SCALE,
  L2_NORMAL_STRENGTH,
  L2_TEXTURE_SIZE,
  L3_LOD_ALBEDO_SIZE,
  L3_LOD1_BRASS_METALNESS,
  L3_LOD1_BRASS_ROUGHNESS,
  L3_LOD1_NORMAL_SCALE_MUL,
  L3_LOD1_WOOD_METALNESS,
  L3_LOD1_WOOD_ROUGHNESS,
  L3_LOD2_WOOD_METALNESS,
  L3_LOD2_WOOD_ROUGHNESS,
  brassHeight,
  heightToNormalRgb,
  mappedStandard,
  steelHeight,
  woodHeight,
} from "./pbr-maps.js";

test("L2 authoring caps stay 512² with three normal slots", () => {
  assert.equal(L2_TEXTURE_SIZE, 512);
  assert.equal(L3_LOD_ALBEDO_SIZE, 256);
  assert.equal(L3_LOD_ALBEDO_SIZE * 2, L2_TEXTURE_SIZE);
  assert.equal(Object.keys(L2_NORMAL_STRENGTH).join(","), "wood,brass,steel");
  assert.equal(Object.keys(L2_NORMAL_SCALE).join(","), "wood,brass,steel");
  for (const pair of Object.values(L2_NORMAL_SCALE)) {
    assert.equal(pair.length, 2);
    assert.ok(pair[0] > 0 && pair[0] <= 1);
    assert.equal(pair[0], pair[1]);
  }
});

test("heightToNormalRgb encodes OpenGL +Y (flat is mid-blue)", () => {
  const [r, g, b] = heightToNormalRgb(0.5, 0.5, 0.5, 0.5, 2.5);
  assert.equal(r, 128);
  assert.equal(g, 128);
  assert.equal(b, 255);
});

test("higher height to the right tilts the normal left (R < 128)", () => {
  const [r, g, b] = heightToNormalRgb(0, 1, 0.5, 0.5, 2.5);
  assert.ok(r < 128);
  assert.equal(g, 128);
  assert.ok(b > 128);
});

test("higher height toward canvas y-1 (image top) raises G (> 128)", () => {
  const [r, g, b] = heightToNormalRgb(0.5, 0.5, 1, 0, 2.5);
  assert.equal(r, 128);
  assert.ok(g > 128);
  assert.ok(b > 128);
});

test("mappedStandard binds normalMap unless opted out", () => {
  const maps = { albedo: { id: "alb" }, orm: { id: "orm" }, normal: { id: "nrm" }, normalScale: [0.5, 0.5] };
  const withN = mappedStandard(0xffffff, maps);
  const without = mappedStandard(0xffffff, maps, { normalMap: false });
  const midScale = mappedStandard(0xffffff, maps, { normalScaleMul: L3_LOD1_NORMAL_SCALE_MUL });
  assert.equal(withN.normalMap, maps.normal);
  assert.equal(without.normalMap, null);
  assert.equal(midScale.normalMap, maps.normal);
  assert.equal(withN.map, maps.albedo);
  assert.equal(without.map, maps.albedo);
  assert.equal(withN.roughnessMap, maps.orm);
  assert.equal(without.roughnessMap, maps.orm);
  assert.equal(withN.normalScale.x, 0.5);
  assert.equal(midScale.normalScale.x, 0.5 * L3_LOD1_NORMAL_SCALE_MUL);
  assert.equal(midScale.normalScale.y, 0.5 * L3_LOD1_NORMAL_SCALE_MUL);
  assert.equal(L3_LOD1_NORMAL_SCALE_MUL, 0.5);
});

test("mappedStandard LOD1-style omits normalMap and ORM (albedo-only)", () => {
  const maps = { albedo: { id: "alb" }, orm: { id: "orm" }, normal: { id: "nrm" }, normalScale: [0.5, 0.5] };
  const mid = mappedStandard(0xffffff, maps, { normalMap: false, ormMap: false });
  const brassMid = mappedStandard(0xffffff, maps, {
    normalMap: false,
    ormMap: false,
    roughness: L3_LOD1_BRASS_ROUGHNESS,
    metalness: L3_LOD1_BRASS_METALNESS,
  });
  assert.equal(mid.normalMap, null);
  assert.equal(mid.map, maps.albedo);
  assert.equal(mid.roughnessMap, null);
  assert.equal(mid.metalnessMap, null);
  assert.equal(mid.roughness, L3_LOD1_WOOD_ROUGHNESS);
  assert.equal(mid.metalness, L3_LOD1_WOOD_METALNESS);
  assert.equal(brassMid.normalMap, null);
  assert.equal(brassMid.roughnessMap, null);
  assert.equal(brassMid.metalnessMap, null);
  assert.equal(brassMid.roughness, L3_LOD1_BRASS_ROUGHNESS);
  assert.equal(brassMid.metalness, L3_LOD1_BRASS_METALNESS);
  assert.equal(L3_LOD1_WOOD_ROUGHNESS, L3_LOD2_WOOD_ROUGHNESS);
  assert.equal(L3_LOD1_WOOD_METALNESS, L3_LOD2_WOOD_METALNESS);
  assert.equal(L3_LOD1_BRASS_ROUGHNESS, 95 / 255);
  assert.equal(L3_LOD1_BRASS_METALNESS, 230 / 255);
});

test("mappedStandard omits ORM maps when opted out and uses wood midtone constants", () => {
  const maps = { albedo: { id: "alb" }, orm: { id: "orm" }, normal: { id: "nrm" }, normalScale: [0.5, 0.5] };
  const noOrm = mappedStandard(0xffffff, maps, { ormMap: false });
  const far = mappedStandard(0xffffff, maps, { normalMap: false, ormMap: false });
  assert.equal(noOrm.normalMap, maps.normal);
  assert.equal(noOrm.map, maps.albedo);
  assert.equal(noOrm.roughnessMap, null);
  assert.equal(noOrm.metalnessMap, null);
  assert.equal(noOrm.roughness, L3_LOD2_WOOD_ROUGHNESS);
  assert.equal(noOrm.metalness, L3_LOD2_WOOD_METALNESS);
  assert.equal(far.normalMap, null);
  assert.equal(far.roughnessMap, null);
  assert.equal(far.metalnessMap, null);
  assert.equal(far.roughness, L3_LOD2_WOOD_ROUGHNESS);
  assert.equal(far.metalness, L3_LOD2_WOOD_METALNESS);
  assert.equal(L3_LOD2_WOOD_ROUGHNESS, 220 / 255);
  assert.equal(L3_LOD2_WOOD_METALNESS, 8 / 255);
});

test("wood / brass / steel height fields are not flat", () => {
  const pairs = [
    [woodHeight, [0.1, 0.1], [0.62, 0.28]],
    [brassHeight, [0.15, 0.2], [0.7, 0.55]],
    [steelHeight, [0.2, 0.1], [0.2, 0.6]],
  ];
  for (const [fn, a, b] of pairs) {
    assert.notEqual(fn(a[0], a[1]), fn(b[0], b[1]));
  }
});

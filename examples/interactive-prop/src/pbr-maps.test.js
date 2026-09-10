import assert from "node:assert/strict";
import { test } from "node:test";
import {
  L2_NORMAL_SCALE,
  L2_NORMAL_STRENGTH,
  L2_TEXTURE_SIZE,
  brassHeight,
  heightToNormalRgb,
  steelHeight,
  woodHeight,
} from "./pbr-maps.js";

test("L2 authoring caps stay 512² with three normal slots", () => {
  assert.equal(L2_TEXTURE_SIZE, 512);
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

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DESKTOP_PIXEL_RATIO_CAP,
  QUEST3_XR_PIXEL_RATIO,
  applyPresentPixelRatioClamp,
  readRendererPixelRatio,
  resolveDesktopPixelRatio,
  resolveQuest3PresentPixelRatio,
  restorePresentPixelRatio,
} from "./present-pixel-ratio.js";

function fakeRenderer(initialRatio = 2) {
  let pixelRatio = initialRatio;
  const sizes = [];
  return {
    getPixelRatio() {
      return pixelRatio;
    },
    setPixelRatio(next) {
      pixelRatio = next;
    },
    setSize(width, height) {
      sizes.push({ width, height });
    },
    sizes,
  };
}

test("QUEST3_XR_PIXEL_RATIO is 1", () => {
  assert.equal(QUEST3_XR_PIXEL_RATIO, 1);
});

test("resolveQuest3PresentPixelRatio always returns 1", () => {
  assert.equal(resolveQuest3PresentPixelRatio(1), 1);
  assert.equal(resolveQuest3PresentPixelRatio(1.25), 1);
  assert.equal(resolveQuest3PresentPixelRatio(2), 1);
  assert.equal(resolveQuest3PresentPixelRatio(3), 1);
  assert.equal(resolveQuest3PresentPixelRatio(undefined), 1);
  assert.equal(resolveQuest3PresentPixelRatio(0), 1);
  assert.equal(resolveQuest3PresentPixelRatio(Number.NaN), 1);
});

test("resolveDesktopPixelRatio caps at 2 and treats junk as 1", () => {
  assert.equal(DESKTOP_PIXEL_RATIO_CAP, 2);
  assert.equal(resolveDesktopPixelRatio(1), 1);
  assert.equal(resolveDesktopPixelRatio(1.5), 1.5);
  assert.equal(resolveDesktopPixelRatio(2), 2);
  assert.equal(resolveDesktopPixelRatio(3), 2);
  assert.equal(resolveDesktopPixelRatio(undefined), 1);
  assert.equal(resolveDesktopPixelRatio(0), 1);
  assert.equal(resolveDesktopPixelRatio(-2), 1);
  assert.equal(resolveDesktopPixelRatio(Number.NaN), 1);
});

test("readRendererPixelRatio uses getPixelRatio when present", () => {
  assert.equal(readRendererPixelRatio(fakeRenderer(1.75)), 1.75);
  assert.equal(readRendererPixelRatio(null), 1);
  assert.equal(readRendererPixelRatio({ getPixelRatio: () => 0 }), 1);
});

test("applyPresentPixelRatioClamp presenting saves current ratio and sets 1", () => {
  const renderer = fakeRenderer(2);
  const result = applyPresentPixelRatioClamp(renderer, { presenting: true });
  assert.deepEqual(result, { presenting: true, savedRatio: 2, ratio: 1 });
  assert.equal(renderer.getPixelRatio(), 1);
  assert.equal(renderer.sizes.length, 0);
});

test("applyPresentPixelRatioClamp presenting keeps a provided savedRatio", () => {
  const renderer = fakeRenderer(1);
  const result = applyPresentPixelRatioClamp(renderer, { presenting: true, savedRatio: 1.5 });
  assert.equal(result.savedRatio, 1.5);
  assert.equal(result.ratio, 1);
  assert.equal(renderer.getPixelRatio(), 1);
});

test("restorePresentPixelRatio writes saved ratio and window size", () => {
  const renderer = fakeRenderer(1);
  const result = restorePresentPixelRatio(renderer, {
    savedRatio: 2,
    windowSize: { width: 1280, height: 720 },
  });
  assert.deepEqual(result, { presenting: false, savedRatio: 2, ratio: 2 });
  assert.equal(renderer.getPixelRatio(), 2);
  assert.deepEqual(renderer.sizes, [{ width: 1280, height: 720 }]);
});

test("applyPresentPixelRatioClamp presenting false restores via the same helper", () => {
  const renderer = fakeRenderer(1);
  const result = applyPresentPixelRatioClamp(renderer, {
    presenting: false,
    savedRatio: 1.25,
    windowSize: { width: 800, height: 600 },
  });
  assert.deepEqual(result, { presenting: false, savedRatio: 1.25, ratio: 1.25 });
  assert.equal(renderer.getPixelRatio(), 1.25);
  assert.deepEqual(renderer.sizes, [{ width: 800, height: 600 }]);
});

test("restorePresentPixelRatio skips setSize without a positive windowSize", () => {
  const renderer = fakeRenderer(1);
  restorePresentPixelRatio(renderer, { savedRatio: 2 });
  restorePresentPixelRatio(renderer, { savedRatio: 2, windowSize: { width: 0, height: 600 } });
  restorePresentPixelRatio(renderer, { savedRatio: 2, windowSize: { width: 800, height: -1 } });
  assert.equal(renderer.getPixelRatio(), 2);
  assert.equal(renderer.sizes.length, 0);
});

test("restorePresentPixelRatio falls back to 1 when savedRatio is missing", () => {
  const renderer = fakeRenderer(2);
  const result = restorePresentPixelRatio(renderer, {});
  assert.equal(result.savedRatio, 1);
  assert.equal(renderer.getPixelRatio(), 1);
});

test("helpers do not throw without a renderer", () => {
  assert.deepEqual(applyPresentPixelRatioClamp(null, { presenting: true }), {
    presenting: true,
    savedRatio: 1,
    ratio: 1,
  });
  assert.deepEqual(
    applyPresentPixelRatioClamp(null, {
      presenting: false,
      savedRatio: 2,
      windowSize: { width: 100, height: 100 },
    }),
    { presenting: false, savedRatio: 2, ratio: 2 }
  );
});

test("sessionstart then sessionend restores desktop lookdev", () => {
  const renderer = fakeRenderer(resolveDesktopPixelRatio(3));
  assert.equal(renderer.getPixelRatio(), 2);
  const start = applyPresentPixelRatioClamp(renderer, { presenting: true });
  assert.equal(start.savedRatio, 2);
  assert.equal(renderer.getPixelRatio(), 1);
  applyPresentPixelRatioClamp(renderer, {
    presenting: false,
    savedRatio: start.savedRatio,
    windowSize: { width: 1920, height: 1080 },
  });
  assert.equal(renderer.getPixelRatio(), 2);
  assert.deepEqual(renderer.sizes, [{ width: 1920, height: 1080 }]);
});

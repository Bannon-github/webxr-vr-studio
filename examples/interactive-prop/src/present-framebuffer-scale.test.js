import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE,
  QUEST3_XR_FRAMEBUFFER_SCALE,
  applyPresentFramebufferScale,
  normalizeFramebufferScale,
  readRendererFramebufferScale,
  resolveDesktopLookdevFramebufferScale,
  resolveQuest3PresentFramebufferScale,
  restorePresentFramebufferScale,
} from "./present-framebuffer-scale.js";

/** r170-shaped fake: setter + isPresenting, no getter. */
function fakeXr(initialScale = 1, { presenting = false, withGetter = false } = {}) {
  let scale = initialScale;
  const xr = {
    isPresenting: presenting,
    setFramebufferScaleFactor(next) {
      scale = next;
    },
    current() {
      return scale;
    },
  };
  if (withGetter) {
    xr.getFramebufferScaleFactor = () => scale;
  }
  return xr;
}

function fakeRenderer(xr) {
  return { xr };
}

test("QUEST3_XR_FRAMEBUFFER_SCALE is 1", () => {
  assert.equal(QUEST3_XR_FRAMEBUFFER_SCALE, 1);
});

test("DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE is 1 (r170 private default)", () => {
  assert.equal(DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE, 1);
});

test("resolveQuest3PresentFramebufferScale always returns 1", () => {
  assert.equal(resolveQuest3PresentFramebufferScale(), 1);
  assert.equal(resolveQuest3PresentFramebufferScale(1.5), 1);
  assert.equal(resolveQuest3PresentFramebufferScale(2), 1);
  assert.equal(resolveQuest3PresentFramebufferScale(undefined), 1);
});

test("resolveDesktopLookdevFramebufferScale is 1", () => {
  assert.equal(resolveDesktopLookdevFramebufferScale(), 1);
});

test("normalizeFramebufferScale accepts finite values > 0", () => {
  assert.equal(normalizeFramebufferScale(1), 1);
  assert.equal(normalizeFramebufferScale(0.75), 0.75);
  assert.equal(normalizeFramebufferScale(1.5), 1.5);
  assert.equal(normalizeFramebufferScale(0), null);
  assert.equal(normalizeFramebufferScale(-1), null);
  assert.equal(normalizeFramebufferScale(Number.NaN), null);
  assert.equal(normalizeFramebufferScale("1"), null);
  assert.equal(normalizeFramebufferScale(undefined), null);
});

test("readRendererFramebufferScale uses getFramebufferScaleFactor when present", () => {
  const xr = fakeXr(1.25, { withGetter: true });
  assert.equal(readRendererFramebufferScale(fakeRenderer(xr)), 1.25);
});

test("readRendererFramebufferScale falls back when r170 has no getter", () => {
  const xr = fakeXr(1.5);
  assert.equal(typeof xr.getFramebufferScaleFactor, "undefined");
  assert.equal(readRendererFramebufferScale(fakeRenderer(xr)), 1);
  assert.equal(readRendererFramebufferScale(fakeRenderer(xr), 1.5), 1.5);
  assert.equal(readRendererFramebufferScale(null), 1);
  assert.equal(readRendererFramebufferScale({}), 1);
});

test("applyPresentFramebufferScale presenting saves current / last-set and sets 1", () => {
  const xr = fakeXr(1.5);
  const result = applyPresentFramebufferScale(fakeRenderer(xr), {
    presenting: true,
    lastSetScale: 1.5,
  });
  assert.deepEqual(result, {
    presenting: true,
    savedScale: 1.5,
    scale: 1,
    applied: true,
    presentingLocked: false,
    getterAvailable: false,
  });
  assert.equal(xr.current(), 1);
});

test("applyPresentFramebufferScale presenting keeps a provided savedScale", () => {
  const xr = fakeXr(1);
  const result = applyPresentFramebufferScale(fakeRenderer(xr), {
    presenting: true,
    savedScale: 1.25,
  });
  assert.equal(result.savedScale, 1.25);
  assert.equal(result.scale, 1);
  assert.equal(xr.current(), 1);
});

test("applyPresentFramebufferScale presentingLocked when already presenting", () => {
  const xr = fakeXr(1.5, { presenting: true });
  const result = applyPresentFramebufferScale(fakeRenderer(xr), {
    presenting: true,
    lastSetScale: 1.5,
  });
  assert.equal(result.presentingLocked, true);
  assert.equal(result.applied, true);
  assert.equal(result.scale, 1);
  assert.equal(xr.current(), 1);
});

test("restorePresentFramebufferScale writes saved lookdev scale", () => {
  const xr = fakeXr(1);
  const result = restorePresentFramebufferScale(fakeRenderer(xr), { savedScale: 1.5 });
  assert.deepEqual(result, {
    presenting: false,
    savedScale: 1.5,
    scale: 1.5,
    applied: true,
    presentingLocked: false,
    getterAvailable: false,
  });
  assert.equal(xr.current(), 1.5);
});

test("applyPresentFramebufferScale presenting false restores via the same helper", () => {
  const xr = fakeXr(1.5);
  const start = applyPresentFramebufferScale(fakeRenderer(xr), {
    presenting: true,
    lastSetScale: 1.5,
  });
  const end = applyPresentFramebufferScale(fakeRenderer(xr), {
    presenting: false,
    savedScale: start.savedScale,
  });
  assert.equal(end.presenting, false);
  assert.equal(xr.current(), 1.5);
});

test("restorePresentFramebufferScale falls back to lookdev 1 when savedScale is missing", () => {
  const xr = fakeXr(2);
  const result = restorePresentFramebufferScale(fakeRenderer(xr), {});
  assert.equal(result.savedScale, 1);
  assert.equal(xr.current(), 1);
});

test("helpers do not throw without a renderer", () => {
  assert.deepEqual(applyPresentFramebufferScale(null, { presenting: true }), {
    presenting: true,
    savedScale: 1,
    scale: 1,
    applied: false,
    presentingLocked: false,
    getterAvailable: false,
  });
  assert.deepEqual(
    applyPresentFramebufferScale(null, { presenting: false, savedScale: 1.5 }),
    {
      presenting: false,
      savedScale: 1.5,
      scale: 1.5,
      applied: false,
      presentingLocked: false,
      getterAvailable: false,
    }
  );
});

test("sessionstart then sessionend restores lookdev scale (r170-shaped xr)", () => {
  const xr = fakeXr(1);
  const renderer = fakeRenderer(xr);
  const start = applyPresentFramebufferScale(renderer, { presenting: true });
  assert.equal(start.savedScale, 1);
  assert.equal(xr.current(), 1);
  applyPresentFramebufferScale(renderer, {
    presenting: false,
    savedScale: start.savedScale,
  });
  assert.equal(xr.current(), 1);
});

test("sessionstart after lookdev raised scale still clamps to 1 and restores", () => {
  const xr = fakeXr(1.25, { withGetter: true });
  const renderer = fakeRenderer(xr);
  const start = applyPresentFramebufferScale(renderer, { presenting: true });
  assert.equal(start.savedScale, 1.25);
  assert.equal(start.getterAvailable, true);
  assert.equal(xr.current(), 1);
  applyPresentFramebufferScale(renderer, {
    presenting: false,
    savedScale: start.savedScale,
  });
  assert.equal(xr.current(), 1.25);
});

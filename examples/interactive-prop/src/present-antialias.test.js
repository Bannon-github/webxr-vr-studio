import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DESKTOP_LOOKDEV_ANTIALIAS,
  QUEST3_XR_ANTIALIAS,
  applyPresentAntialias,
  readRendererAntialias,
  resolveDesktopLookdevAntialias,
  resolveQuest3PresentAntialias,
  resolveWebGLRendererAntialias,
  restorePresentAntialias,
} from "./present-antialias.js";

function fakeRenderer(antialias = false) {
  return {
    getContext() {
      return {
        getContextAttributes() {
          return { antialias };
        },
      };
    },
  };
}

test("QUEST3_XR_ANTIALIAS is false", () => {
  assert.equal(QUEST3_XR_ANTIALIAS, false);
});

test("DESKTOP_LOOKDEV_ANTIALIAS is true", () => {
  assert.equal(DESKTOP_LOOKDEV_ANTIALIAS, true);
});

test("resolveQuest3PresentAntialias always returns false", () => {
  assert.equal(resolveQuest3PresentAntialias(), false);
});

test("resolveDesktopLookdevAntialias always returns true", () => {
  assert.equal(resolveDesktopLookdevAntialias(), true);
});

test("resolveWebGLRendererAntialias is false while presenting, true for lookdev", () => {
  assert.equal(resolveWebGLRendererAntialias({ presenting: true }), false);
  assert.equal(resolveWebGLRendererAntialias({ presenting: false }), true);
  assert.equal(resolveWebGLRendererAntialias({}), true);
});

test("readRendererAntialias uses getContextAttributes when present", () => {
  assert.equal(readRendererAntialias(fakeRenderer(false)), false);
  assert.equal(readRendererAntialias(fakeRenderer(true)), true);
  assert.equal(readRendererAntialias(null), false);
  assert.equal(readRendererAntialias({}), false);
  assert.equal(readRendererAntialias({ getContext: () => null }), false);
  assert.equal(
    readRendererAntialias({
      getContext: () => ({ getContextAttributes: () => ({}) }),
    }),
    false
  );
});

test("applyPresentAntialias presenting records lookdev policy and requires false", () => {
  const renderer = fakeRenderer(false);
  const result = applyPresentAntialias(renderer, { presenting: true });
  assert.deepEqual(result, {
    presenting: true,
    savedAntialias: true,
    antialias: false,
    applied: true,
    contextImmutable: true,
  });
  assert.equal(readRendererAntialias(renderer), false);
});

test("applyPresentAntialias presenting keeps a provided savedAntialias", () => {
  const result = applyPresentAntialias(fakeRenderer(false), {
    presenting: true,
    savedAntialias: false,
  });
  assert.equal(result.savedAntialias, false);
  assert.equal(result.antialias, false);
  assert.equal(result.applied, true);
});

test("applyPresentAntialias presenting reports applied false if context still has MSAA", () => {
  const result = applyPresentAntialias(fakeRenderer(true), { presenting: true });
  assert.equal(result.antialias, false);
  assert.equal(result.applied, false);
  assert.equal(result.contextImmutable, true);
  assert.equal(readRendererAntialias(fakeRenderer(true)), true);
});

test("restorePresentAntialias returns the saved lookdev policy without flipping context", () => {
  const renderer = fakeRenderer(false);
  const result = restorePresentAntialias(renderer, { savedAntialias: true });
  assert.deepEqual(result, {
    presenting: false,
    savedAntialias: true,
    antialias: true,
    applied: false,
    contextImmutable: true,
  });
  assert.equal(readRendererAntialias(renderer), false);
});

test("applyPresentAntialias presenting false restores via the same helper", () => {
  const result = applyPresentAntialias(fakeRenderer(false), {
    presenting: false,
    savedAntialias: true,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedAntialias: true,
    antialias: true,
    applied: false,
    contextImmutable: true,
  });
});

test("restorePresentAntialias falls back to lookdev true when savedAntialias is missing", () => {
  const result = restorePresentAntialias(fakeRenderer(false), {});
  assert.equal(result.savedAntialias, true);
  assert.equal(result.antialias, true);
  assert.equal(result.applied, false);
});

test("helpers do not throw without a renderer", () => {
  assert.deepEqual(applyPresentAntialias(null, { presenting: true }), {
    presenting: true,
    savedAntialias: true,
    antialias: false,
    applied: true,
    contextImmutable: true,
  });
  assert.deepEqual(applyPresentAntialias(null, { presenting: false, savedAntialias: true }), {
    presenting: false,
    savedAntialias: true,
    antialias: true,
    applied: false,
    contextImmutable: true,
  });
});

test("sessionstart then sessionend restores lookdev policy, not a live context flip", () => {
  const renderer = fakeRenderer(false);
  const start = applyPresentAntialias(renderer, { presenting: true });
  assert.equal(start.savedAntialias, true);
  assert.equal(start.antialias, false);
  assert.equal(start.applied, true);
  const end = applyPresentAntialias(renderer, {
    presenting: false,
    savedAntialias: start.savedAntialias,
  });
  assert.equal(end.presenting, false);
  assert.equal(end.savedAntialias, true);
  assert.equal(end.antialias, true);
  assert.equal(end.applied, false);
  assert.equal(end.contextImmutable, true);
  assert.equal(readRendererAntialias(renderer), false);
});

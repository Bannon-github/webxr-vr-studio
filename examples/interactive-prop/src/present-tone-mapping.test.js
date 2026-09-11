import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DESKTOP_LOOKDEV_TONE_MAPPING,
  DESKTOP_LOOKDEV_TONE_MAPPING_EXPOSURE,
  QUEST3_XR_TONE_MAPPING,
  QUEST3_XR_TONE_MAPPING_EXPOSURE,
  applyPresentToneMapping,
  readRendererToneMapping,
  readRendererToneMappingExposure,
  resolveDesktopLookdevToneMapping,
  resolveDesktopLookdevToneMappingExposure,
  resolveQuest3PresentToneMapping,
  resolveQuest3PresentToneMappingExposure,
  restorePresentToneMapping,
} from "./present-tone-mapping.js";

function fakeRenderer(toneMapping = DESKTOP_LOOKDEV_TONE_MAPPING, toneMappingExposure = DESKTOP_LOOKDEV_TONE_MAPPING_EXPOSURE) {
  return { toneMapping, toneMappingExposure };
}

test("QUEST3_XR_TONE_MAPPING is Three r170 NoToneMapping (0)", () => {
  assert.equal(QUEST3_XR_TONE_MAPPING, 0);
});

test("DESKTOP_LOOKDEV_TONE_MAPPING is Three r170 ACESFilmicToneMapping (4)", () => {
  assert.equal(DESKTOP_LOOKDEV_TONE_MAPPING, 4);
});

test("lookdev exposure is 1.05; present-path exposure is identity 1", () => {
  assert.equal(DESKTOP_LOOKDEV_TONE_MAPPING_EXPOSURE, 1.05);
  assert.equal(QUEST3_XR_TONE_MAPPING_EXPOSURE, 1);
});

test("resolveQuest3PresentToneMapping always returns NoToneMapping", () => {
  assert.equal(resolveQuest3PresentToneMapping(), 0);
});

test("resolveQuest3PresentToneMappingExposure always returns 1", () => {
  assert.equal(resolveQuest3PresentToneMappingExposure(), 1);
});

test("resolveDesktopLookdevToneMapping / exposure are ACES + 1.05", () => {
  assert.equal(resolveDesktopLookdevToneMapping(), 4);
  assert.equal(resolveDesktopLookdevToneMappingExposure(), 1.05);
});

test("readRendererToneMapping uses renderer.toneMapping when present", () => {
  assert.equal(readRendererToneMapping(fakeRenderer(4, 1.05)), 4);
  assert.equal(readRendererToneMapping(fakeRenderer(0, 1)), 0);
  assert.equal(readRendererToneMapping(null), 0);
  assert.equal(readRendererToneMapping({}), 0);
  assert.equal(readRendererToneMapping({ toneMapping: -1 }), 0);
  assert.equal(readRendererToneMapping({ toneMapping: Number.NaN }), 0);
});

test("readRendererToneMappingExposure uses renderer.toneMappingExposure when present", () => {
  assert.equal(readRendererToneMappingExposure(fakeRenderer(4, 1.05)), 1.05);
  assert.equal(readRendererToneMappingExposure(null), 1);
  assert.equal(readRendererToneMappingExposure({}), 1);
  assert.equal(readRendererToneMappingExposure({ toneMappingExposure: 0 }), 1);
  assert.equal(readRendererToneMappingExposure({ toneMappingExposure: -0.5 }), 1);
  assert.equal(readRendererToneMappingExposure({ toneMappingExposure: Number.NaN }), 1);
});

test("applyPresentToneMapping presenting saves current ACES+exposure and sets NoToneMapping + 1", () => {
  const renderer = fakeRenderer(4, 1.05);
  const result = applyPresentToneMapping(renderer, { presenting: true });
  assert.deepEqual(result, {
    presenting: true,
    savedToneMapping: 4,
    savedExposure: 1.05,
    toneMapping: 0,
    exposure: 1,
  });
  assert.equal(renderer.toneMapping, 0);
  assert.equal(renderer.toneMappingExposure, 1);
});

test("applyPresentToneMapping presenting keeps a provided saved operator and exposure", () => {
  const renderer = fakeRenderer(0, 1);
  const result = applyPresentToneMapping(renderer, {
    presenting: true,
    savedToneMapping: 4,
    savedExposure: 1.05,
  });
  assert.equal(result.savedToneMapping, 4);
  assert.equal(result.savedExposure, 1.05);
  assert.equal(result.toneMapping, 0);
  assert.equal(result.exposure, 1);
  assert.equal(renderer.toneMapping, 0);
  assert.equal(renderer.toneMappingExposure, 1);
});

test("restorePresentToneMapping writes saved ACES + exposure", () => {
  const renderer = fakeRenderer(0, 1);
  const result = restorePresentToneMapping(renderer, {
    savedToneMapping: 4,
    savedExposure: 1.05,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedToneMapping: 4,
    savedExposure: 1.05,
    toneMapping: 4,
    exposure: 1.05,
  });
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.toneMappingExposure, 1.05);
});

test("applyPresentToneMapping presenting false restores via the same helper", () => {
  const renderer = fakeRenderer(0, 1);
  const result = applyPresentToneMapping(renderer, {
    presenting: false,
    savedToneMapping: 4,
    savedExposure: 1.05,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedToneMapping: 4,
    savedExposure: 1.05,
    toneMapping: 4,
    exposure: 1.05,
  });
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.toneMappingExposure, 1.05);
});

test("restorePresentToneMapping falls back to lookdev ACES + 1.05 when saved is missing", () => {
  const renderer = fakeRenderer(0, 1);
  const result = restorePresentToneMapping(renderer, {});
  assert.equal(result.savedToneMapping, 4);
  assert.equal(result.savedExposure, 1.05);
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.toneMappingExposure, 1.05);
});

test("helpers do not throw without a renderer", () => {
  assert.deepEqual(applyPresentToneMapping(null, { presenting: true }), {
    presenting: true,
    savedToneMapping: 0,
    savedExposure: 1,
    toneMapping: 0,
    exposure: 1,
  });
  assert.deepEqual(
    applyPresentToneMapping(null, {
      presenting: false,
      savedToneMapping: 4,
      savedExposure: 1.05,
    }),
    {
      presenting: false,
      savedToneMapping: 4,
      savedExposure: 1.05,
      toneMapping: 4,
      exposure: 1.05,
    }
  );
});

test("sessionstart then sessionend restores desktop lookdev ACES + exposure", () => {
  const renderer = fakeRenderer(4, 1.05);
  const start = applyPresentToneMapping(renderer, { presenting: true });
  assert.equal(start.savedToneMapping, 4);
  assert.equal(start.savedExposure, 1.05);
  assert.equal(renderer.toneMapping, 0);
  assert.equal(renderer.toneMappingExposure, 1);
  applyPresentToneMapping(renderer, {
    presenting: false,
    savedToneMapping: start.savedToneMapping,
    savedExposure: start.savedExposure,
  });
  assert.equal(renderer.toneMapping, 4);
  assert.equal(renderer.toneMappingExposure, 1.05);
});

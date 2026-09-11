import assert from "node:assert/strict";
import { test } from "node:test";
import { DirectionalLight, HemisphereLight } from "three";
import {
  DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY,
  DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE,
  QUEST3_XR_DIRECTIONAL_INTENSITY,
  QUEST3_XR_DIRECTIONAL_INTENSITY_SKIPS_PUNCTUAL,
  QUEST3_XR_DIRECTIONAL_VISIBLE,
  applyPresentDirectionalLight,
  readLightIntensity,
  readLightVisible,
  resolveDesktopLookdevDirectionalIntensity,
  resolveDesktopLookdevDirectionalVisible,
  resolveQuest3PresentDirectionalIntensity,
  resolveQuest3PresentDirectionalVisible,
  restorePresentDirectionalLight,
} from "./present-directional-light.js";

function fakeLight(visible = DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE, intensity = DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY) {
  return { visible, intensity };
}

test("QUEST3_XR_DIRECTIONAL_VISIBLE is false", () => {
  assert.equal(QUEST3_XR_DIRECTIONAL_VISIBLE, false);
});

test("QUEST3_XR_DIRECTIONAL_INTENSITY is 0", () => {
  assert.equal(QUEST3_XR_DIRECTIONAL_INTENSITY, 0);
});

test("lookdev directional is visible with intensity 0.9 (example sun)", () => {
  assert.equal(DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE, true);
  assert.equal(DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY, 0.9);
  const sun = new DirectionalLight(0xfff4e0, 0.9);
  assert.equal(sun.visible, true);
  assert.equal(sun.intensity, 0.9);
});

test("Three r170 DirectionalLight default intensity is 1, not the example sun", () => {
  const light = new DirectionalLight();
  assert.equal(light.intensity, 1);
  assert.equal(light.visible, true);
});

test("r170 intensity 0 does not skip punctual evaluation", () => {
  assert.equal(QUEST3_XR_DIRECTIONAL_INTENSITY_SKIPS_PUNCTUAL, false);
});

test("resolveQuest3PresentDirectionalVisible always returns false", () => {
  assert.equal(resolveQuest3PresentDirectionalVisible(), false);
});

test("resolveQuest3PresentDirectionalIntensity always returns 0", () => {
  assert.equal(resolveQuest3PresentDirectionalIntensity(), 0);
});

test("resolveDesktopLookdevDirectionalVisible / intensity are true + 0.9", () => {
  assert.equal(resolveDesktopLookdevDirectionalVisible(), true);
  assert.equal(resolveDesktopLookdevDirectionalIntensity(), 0.9);
});

test("readLightVisible uses light.visible when boolean", () => {
  assert.equal(readLightVisible(fakeLight(true, 0.9)), true);
  assert.equal(readLightVisible(fakeLight(false, 0)), false);
  assert.equal(readLightVisible(null), true);
  assert.equal(readLightVisible({}), true);
  assert.equal(readLightVisible({ visible: "yes" }), true);
});

test("readLightIntensity uses light.intensity when present", () => {
  assert.equal(readLightIntensity(fakeLight(true, 0.9)), 0.9);
  assert.equal(readLightIntensity(fakeLight(true, 0)), 0);
  assert.equal(readLightIntensity(null), 0.9);
  assert.equal(readLightIntensity({}), 0.9);
  assert.equal(readLightIntensity({ intensity: -1 }), 0.9);
  assert.equal(readLightIntensity({ intensity: Number.NaN }), 0.9);
});

test("applyPresentDirectionalLight presenting saves visible+intensity and gates the sun", () => {
  const light = fakeLight(true, 0.9);
  const result = applyPresentDirectionalLight(light, { presenting: true });
  assert.deepEqual(result, {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.9,
    visible: false,
    intensity: 0,
  });
  assert.equal(light.visible, false);
  assert.equal(light.intensity, 0);
});

test("applyPresentDirectionalLight presenting keeps a provided saved visible and intensity", () => {
  const light = fakeLight(false, 0);
  const result = applyPresentDirectionalLight(light, {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.9,
  });
  assert.equal(result.savedVisible, true);
  assert.equal(result.savedIntensity, 0.9);
  assert.equal(result.visible, false);
  assert.equal(result.intensity, 0);
  assert.equal(light.visible, false);
  assert.equal(light.intensity, 0);
});

test("restorePresentDirectionalLight writes saved visible + intensity", () => {
  const light = fakeLight(false, 0);
  const result = restorePresentDirectionalLight(light, {
    savedVisible: true,
    savedIntensity: 0.9,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedVisible: true,
    savedIntensity: 0.9,
    visible: true,
    intensity: 0.9,
  });
  assert.equal(light.visible, true);
  assert.equal(light.intensity, 0.9);
});

test("applyPresentDirectionalLight presenting false restores via the same helper", () => {
  const light = fakeLight(false, 0);
  const result = applyPresentDirectionalLight(light, {
    presenting: false,
    savedVisible: true,
    savedIntensity: 0.9,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedVisible: true,
    savedIntensity: 0.9,
    visible: true,
    intensity: 0.9,
  });
  assert.equal(light.visible, true);
  assert.equal(light.intensity, 0.9);
});

test("restorePresentDirectionalLight falls back to lookdev visible + 0.9 when saved is missing", () => {
  const light = fakeLight(false, 0);
  const result = restorePresentDirectionalLight(light, {});
  assert.equal(result.savedVisible, true);
  assert.equal(result.savedIntensity, 0.9);
  assert.equal(light.visible, true);
  assert.equal(light.intensity, 0.9);
});

test("helpers do not throw without a light", () => {
  assert.deepEqual(applyPresentDirectionalLight(null, { presenting: true }), {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.9,
    visible: false,
    intensity: 0,
  });
  assert.deepEqual(
    applyPresentDirectionalLight(null, {
      presenting: false,
      savedVisible: true,
      savedIntensity: 0.9,
    }),
    {
      presenting: false,
      savedVisible: true,
      savedIntensity: 0.9,
      visible: true,
      intensity: 0.9,
    }
  );
});

test("sessionstart then sessionend restores lookdev directional without touching hemisphere", () => {
  const sun = new DirectionalLight(0xfff4e0, 0.9);
  const hemi = new HemisphereLight(0xf0e6d4, 0x2a1c12, 0.55);
  const hemiVisible = hemi.visible;
  const hemiIntensity = hemi.intensity;
  const start = applyPresentDirectionalLight(sun, { presenting: true });
  assert.equal(start.savedVisible, true);
  assert.equal(start.savedIntensity, 0.9);
  assert.equal(sun.visible, false);
  assert.equal(sun.intensity, 0);
  assert.equal(hemi.visible, hemiVisible);
  assert.equal(hemi.intensity, hemiIntensity);
  applyPresentDirectionalLight(sun, {
    presenting: false,
    savedVisible: start.savedVisible,
    savedIntensity: start.savedIntensity,
  });
  assert.equal(sun.visible, true);
  assert.equal(sun.intensity, 0.9);
  assert.equal(hemi.visible, hemiVisible);
  assert.equal(hemi.intensity, hemiIntensity);
});

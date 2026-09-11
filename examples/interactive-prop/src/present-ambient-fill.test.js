import assert from "node:assert/strict";
import { test } from "node:test";
import { AmbientLight, DirectionalLight, HemisphereLight } from "three";
import {
  DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY,
  DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE,
  QUEST3_XR_AMBIENT_COLOR,
  QUEST3_XR_AMBIENT_INTENSITY,
  QUEST3_XR_AMBIENT_RESTORED_INTENSITY,
  QUEST3_XR_AMBIENT_RESTORED_VISIBLE,
  QUEST3_XR_AMBIENT_VISIBLE,
  QUEST3_XR_HEMISPHERE_INTENSITY,
  QUEST3_XR_HEMISPHERE_INTENSITY_SKIPS_HEMI,
  QUEST3_XR_HEMISPHERE_VISIBLE,
  applyPresentAmbientFill,
  attachPresentAmbient,
  detachPresentAmbient,
  ensurePresentAmbient,
  readLightIntensity,
  readLightVisible,
  resolveDesktopLookdevHemisphereIntensity,
  resolveDesktopLookdevHemisphereVisible,
  resolveQuest3PresentAmbientIntensity,
  resolveQuest3PresentAmbientVisible,
  resolveQuest3PresentHemisphereIntensity,
  resolveQuest3PresentHemisphereVisible,
  restorePresentAmbientFill,
} from "./present-ambient-fill.js";

function fakeLight(
  visible = DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE,
  intensity = DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY
) {
  return { visible, intensity, parent: null };
}

function fakeScene() {
  const scene = {
    children: [],
    add(obj) {
      if (!this.children.includes(obj)) this.children.push(obj);
      obj.parent = this;
    },
    remove(obj) {
      const i = this.children.indexOf(obj);
      if (i >= 0) this.children.splice(i, 1);
      if (obj.parent === this) obj.parent = null;
    },
  };
  return scene;
}

test("QUEST3_XR_HEMISPHERE_VISIBLE is false", () => {
  assert.equal(QUEST3_XR_HEMISPHERE_VISIBLE, false);
});

test("QUEST3_XR_HEMISPHERE_INTENSITY is 0", () => {
  assert.equal(QUEST3_XR_HEMISPHERE_INTENSITY, 0);
});

test("lookdev hemisphere is visible with intensity 0.55", () => {
  assert.equal(DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE, true);
  assert.equal(DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY, 0.55);
  const hemi = new HemisphereLight(0xf0e6d4, 0x2a1c12, 0.55);
  assert.equal(hemi.visible, true);
  assert.equal(hemi.intensity, 0.55);
});

test("Three r170 HemisphereLight default intensity is 1, not the example hemi", () => {
  const light = new HemisphereLight();
  assert.equal(light.intensity, 1);
  assert.equal(light.visible, true);
});

test("r170 intensity 0 does not skip hemisphere evaluation", () => {
  assert.equal(QUEST3_XR_HEMISPHERE_INTENSITY_SKIPS_HEMI, false);
});

test("present-path AmbientLight intensity is 0.4 (readable fill, not lookdev match)", () => {
  assert.equal(QUEST3_XR_AMBIENT_INTENSITY, 0.4);
  assert.equal(QUEST3_XR_AMBIENT_VISIBLE, true);
  assert.equal(QUEST3_XR_AMBIENT_COLOR, 0xf0e6d4);
  assert.equal(QUEST3_XR_AMBIENT_RESTORED_VISIBLE, false);
  assert.equal(QUEST3_XR_AMBIENT_RESTORED_INTENSITY, 0);
  const ambient = new AmbientLight(QUEST3_XR_AMBIENT_COLOR, QUEST3_XR_AMBIENT_INTENSITY);
  assert.equal(ambient.intensity, 0.4);
  assert.equal(ambient.color.getHex(), 0xf0e6d4);
});

test("Three r170 AmbientLight default intensity is 1, not the present-path fill", () => {
  const light = new AmbientLight();
  assert.equal(light.intensity, 1);
  assert.equal(light.visible, true);
});

test("resolveQuest3PresentHemisphereVisible always returns false", () => {
  assert.equal(resolveQuest3PresentHemisphereVisible(), false);
});

test("resolveQuest3PresentHemisphereIntensity always returns 0", () => {
  assert.equal(resolveQuest3PresentHemisphereIntensity(), 0);
});

test("resolveDesktopLookdevHemisphereVisible / intensity are true + 0.55", () => {
  assert.equal(resolveDesktopLookdevHemisphereVisible(), true);
  assert.equal(resolveDesktopLookdevHemisphereIntensity(), 0.55);
});

test("resolveQuest3PresentAmbientVisible / intensity are true + 0.4", () => {
  assert.equal(resolveQuest3PresentAmbientVisible(), true);
  assert.equal(resolveQuest3PresentAmbientIntensity(), 0.4);
});

test("readLightVisible uses light.visible when boolean", () => {
  assert.equal(readLightVisible(fakeLight(true, 0.55)), true);
  assert.equal(readLightVisible(fakeLight(false, 0)), false);
  assert.equal(readLightVisible(null), true);
  assert.equal(readLightVisible({}), true);
  assert.equal(readLightVisible({ visible: "yes" }), true);
});

test("readLightIntensity uses light.intensity when present", () => {
  assert.equal(readLightIntensity(fakeLight(true, 0.55)), 0.55);
  assert.equal(readLightIntensity(fakeLight(true, 0)), 0);
  assert.equal(readLightIntensity(null), 0.55);
  assert.equal(readLightIntensity({}), 0.55);
  assert.equal(readLightIntensity({ intensity: -1 }), 0.55);
  assert.equal(readLightIntensity({ intensity: Number.NaN }), 0.55);
});

test("ensurePresentAmbient reuses a provided light and does not call the factory", () => {
  const existing = fakeLight(false, 0);
  let created = 0;
  const result = ensurePresentAmbient(existing, {
    createAmbient: () => {
      created += 1;
      return fakeLight(true, 0.4);
    },
  });
  assert.equal(result, existing);
  assert.equal(created, 0);
});

test("ensurePresentAmbient creates once when ambient is missing", () => {
  const created = fakeLight(true, 0.4);
  let calls = 0;
  const result = ensurePresentAmbient(null, {
    createAmbient: () => {
      calls += 1;
      return created;
    },
  });
  assert.equal(result, created);
  assert.equal(calls, 1);
  assert.equal(ensurePresentAmbient(null, {}), null);
});

test("applyPresentAmbientFill presenting saves hemi visible+intensity and enables ambient", () => {
  const hemi = fakeLight(true, 0.55);
  const ambient = fakeLight(false, 0);
  const scene = fakeScene();
  const result = applyPresentAmbientFill(hemi, ambient, { presenting: true, scene });
  assert.deepEqual(result, {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.55,
    hemiVisible: false,
    hemiIntensity: 0,
    ambient,
    ambientVisible: true,
    ambientIntensity: 0.4,
    attached: true,
  });
  assert.equal(hemi.visible, false);
  assert.equal(hemi.intensity, 0);
  assert.equal(ambient.visible, true);
  assert.equal(ambient.intensity, 0.4);
  assert.equal(scene.children.includes(ambient), true);
});

test("applyPresentAmbientFill presenting keeps a provided saved visible and intensity", () => {
  const hemi = fakeLight(false, 0);
  const ambient = fakeLight(false, 0);
  const result = applyPresentAmbientFill(hemi, ambient, {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.55,
  });
  assert.equal(result.savedVisible, true);
  assert.equal(result.savedIntensity, 0.55);
  assert.equal(result.hemiVisible, false);
  assert.equal(result.hemiIntensity, 0);
  assert.equal(hemi.visible, false);
  assert.equal(hemi.intensity, 0);
});

test("applyPresentAmbientFill presenting creates ambient once via factory", () => {
  const hemi = fakeLight(true, 0.55);
  const created = fakeLight(false, 0);
  let calls = 0;
  const first = applyPresentAmbientFill(hemi, null, {
    presenting: true,
    createAmbient: () => {
      calls += 1;
      return created;
    },
  });
  assert.equal(first.ambient, created);
  assert.equal(created.visible, true);
  assert.equal(created.intensity, 0.4);
  const second = applyPresentAmbientFill(hemi, first.ambient, {
    presenting: true,
    createAmbient: () => {
      calls += 1;
      return fakeLight(true, 0.4);
    },
  });
  assert.equal(second.ambient, created);
  assert.equal(calls, 1);
});

test("restorePresentAmbientFill writes saved hemi and disables ambient", () => {
  const hemi = fakeLight(false, 0);
  const ambient = fakeLight(true, 0.4);
  const scene = fakeScene();
  scene.add(ambient);
  const result = restorePresentAmbientFill(hemi, ambient, {
    savedVisible: true,
    savedIntensity: 0.55,
    scene,
  });
  assert.deepEqual(result, {
    presenting: false,
    savedVisible: true,
    savedIntensity: 0.55,
    hemiVisible: true,
    hemiIntensity: 0.55,
    ambient,
    ambientVisible: false,
    ambientIntensity: 0,
    detached: true,
  });
  assert.equal(hemi.visible, true);
  assert.equal(hemi.intensity, 0.55);
  assert.equal(ambient.visible, false);
  assert.equal(ambient.intensity, 0);
  assert.equal(scene.children.includes(ambient), false);
});

test("applyPresentAmbientFill presenting false restores via the same helper", () => {
  const hemi = fakeLight(false, 0);
  const ambient = fakeLight(true, 0.4);
  const result = applyPresentAmbientFill(hemi, ambient, {
    presenting: false,
    savedVisible: true,
    savedIntensity: 0.55,
  });
  assert.equal(result.presenting, false);
  assert.equal(result.hemiVisible, true);
  assert.equal(result.hemiIntensity, 0.55);
  assert.equal(result.ambientVisible, false);
  assert.equal(result.ambientIntensity, 0);
  assert.equal(hemi.visible, true);
  assert.equal(hemi.intensity, 0.55);
  assert.equal(ambient.visible, false);
  assert.equal(ambient.intensity, 0);
});

test("restorePresentAmbientFill falls back to lookdev hemi visible + 0.55 when saved is missing", () => {
  const hemi = fakeLight(false, 0);
  const result = restorePresentAmbientFill(hemi, null, {});
  assert.equal(result.savedVisible, true);
  assert.equal(result.savedIntensity, 0.55);
  assert.equal(hemi.visible, true);
  assert.equal(hemi.intensity, 0.55);
  assert.equal(result.ambient, null);
});

test("helpers do not throw without lights", () => {
  assert.deepEqual(applyPresentAmbientFill(null, null, { presenting: true }), {
    presenting: true,
    savedVisible: true,
    savedIntensity: 0.55,
    hemiVisible: false,
    hemiIntensity: 0,
    ambient: null,
    ambientVisible: false,
    ambientIntensity: 0,
    attached: false,
  });
  assert.deepEqual(
    applyPresentAmbientFill(null, null, {
      presenting: false,
      savedVisible: true,
      savedIntensity: 0.55,
    }),
    {
      presenting: false,
      savedVisible: true,
      savedIntensity: 0.55,
      hemiVisible: true,
      hemiIntensity: 0.55,
      ambient: null,
      ambientVisible: false,
      ambientIntensity: 0,
      detached: false,
    }
  );
});

test("attachPresentAmbient is a no-op when already a child", () => {
  const scene = fakeScene();
  const ambient = fakeLight(true, 0.4);
  assert.equal(attachPresentAmbient(scene, ambient), true);
  assert.equal(attachPresentAmbient(scene, ambient), false);
  assert.equal(scene.children.length, 1);
  assert.equal(detachPresentAmbient(scene, ambient), true);
  assert.equal(detachPresentAmbient(scene, ambient), false);
  assert.equal(scene.children.length, 0);
});

test("sessionstart then sessionend restores lookdev hemi without leaking ambient or touching sun", () => {
  const hemi = new HemisphereLight(0xf0e6d4, 0x2a1c12, 0.55);
  const sun = new DirectionalLight(0xfff4e0, 0.9);
  const scene = fakeScene();
  scene.add(hemi);
  scene.add(sun);
  let created = 0;
  const start = applyPresentAmbientFill(hemi, null, {
    presenting: true,
    scene,
    createAmbient: () => {
      created += 1;
      return new AmbientLight(QUEST3_XR_AMBIENT_COLOR, QUEST3_XR_AMBIENT_INTENSITY);
    },
  });
  assert.equal(start.savedVisible, true);
  assert.equal(start.savedIntensity, 0.55);
  assert.equal(hemi.visible, false);
  assert.equal(hemi.intensity, 0);
  assert.equal(start.ambient.visible, true);
  assert.equal(start.ambient.intensity, 0.4);
  assert.equal(scene.children.includes(start.ambient), true);
  assert.equal(sun.visible, true);
  assert.equal(sun.intensity, 0.9);
  assert.equal(created, 1);
  applyPresentAmbientFill(hemi, start.ambient, {
    presenting: false,
    savedVisible: start.savedVisible,
    savedIntensity: start.savedIntensity,
    scene,
  });
  assert.equal(hemi.visible, true);
  assert.equal(hemi.intensity, 0.55);
  assert.equal(start.ambient.visible, false);
  assert.equal(start.ambient.intensity, 0);
  assert.equal(scene.children.includes(start.ambient), false);
  assert.equal(sun.visible, true);
  assert.equal(sun.intensity, 0.9);
  const again = applyPresentAmbientFill(hemi, start.ambient, {
    presenting: true,
    scene,
    createAmbient: () => {
      created += 1;
      return new AmbientLight(QUEST3_XR_AMBIENT_COLOR, QUEST3_XR_AMBIENT_INTENSITY);
    },
  });
  assert.equal(again.ambient, start.ambient);
  assert.equal(created, 1);
});

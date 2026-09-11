import assert from "node:assert/strict";
import { test } from "node:test";
import { Scene } from "three";
import {
  DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY,
  QUEST3_XR_ENVIRONMENT_INTENSITY,
  QUEST3_XR_ENVIRONMENT_INTENSITY_SKIPS_SAMPLING,
  applyPresentEnvironment,
  readSceneEnvironment,
  readSceneEnvironmentIntensity,
  resolveDesktopLookdevEnvironmentIntensity,
  resolveQuest3PresentEnvironment,
  resolveQuest3PresentEnvironmentIntensity,
  restorePresentEnvironment,
  sceneHasEnvironmentIntensity,
} from "./present-environment.js";

function fakePmrem(id = "pmrem") {
  let disposed = false;
  return {
    id,
    get disposed() {
      return disposed;
    },
    dispose() {
      disposed = true;
    },
  };
}

function fakeScene(environment = fakePmrem(), environmentIntensity = DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY) {
  return { environment, environmentIntensity };
}

test("QUEST3_XR_ENVIRONMENT_INTENSITY is 0", () => {
  assert.equal(QUEST3_XR_ENVIRONMENT_INTENSITY, 0);
});

test("DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY is Three r170 Scene default (1)", () => {
  assert.equal(DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY, 1);
  const scene = new Scene();
  assert.equal(scene.environmentIntensity, 1);
  assert.equal(scene.environment, null);
});

test("r170 environmentIntensity does not skip IBL sampling", () => {
  assert.equal(QUEST3_XR_ENVIRONMENT_INTENSITY_SKIPS_SAMPLING, false);
});

test("resolveQuest3PresentEnvironmentIntensity always returns 0", () => {
  assert.equal(resolveQuest3PresentEnvironmentIntensity(), 0);
});

test("resolveDesktopLookdevEnvironmentIntensity always returns 1", () => {
  assert.equal(resolveDesktopLookdevEnvironmentIntensity(), 1);
});

test("resolveQuest3PresentEnvironment always returns null", () => {
  assert.equal(resolveQuest3PresentEnvironment(), null);
});

test("readSceneEnvironmentIntensity uses scene.environmentIntensity when present", () => {
  assert.equal(readSceneEnvironmentIntensity(fakeScene(null, 1)), 1);
  assert.equal(readSceneEnvironmentIntensity(fakeScene(null, 0)), 0);
  assert.equal(readSceneEnvironmentIntensity(null), 1);
  assert.equal(readSceneEnvironmentIntensity({}), 1);
  assert.equal(readSceneEnvironmentIntensity({ environmentIntensity: -1 }), 1);
  assert.equal(readSceneEnvironmentIntensity({ environmentIntensity: Number.NaN }), 1);
});

test("readSceneEnvironment uses scene.environment when present", () => {
  const env = fakePmrem("lookdev");
  assert.equal(readSceneEnvironment(fakeScene(env)), env);
  assert.equal(readSceneEnvironment(fakeScene(null)), null);
  assert.equal(readSceneEnvironment(null), null);
  assert.equal(readSceneEnvironment({}), null);
});

test("sceneHasEnvironmentIntensity is true only for a numeric property", () => {
  assert.equal(sceneHasEnvironmentIntensity(fakeScene()), true);
  assert.equal(sceneHasEnvironmentIntensity(new Scene()), true);
  assert.equal(sceneHasEnvironmentIntensity({ environment: null }), false);
  assert.equal(sceneHasEnvironmentIntensity(null), false);
});

test("applyPresentEnvironment presenting saves env+intensity and nulls environment", () => {
  const env = fakePmrem();
  const scene = fakeScene(env, 1);
  const result = applyPresentEnvironment(scene, { presenting: true });
  assert.deepEqual(
    { ...result, savedEnvironment: result.savedEnvironment === env },
    {
      presenting: true,
      savedEnvironment: true,
      savedIntensity: 1,
      environment: null,
      intensity: 0,
      envMapCleared: true,
    }
  );
  assert.equal(result.savedEnvironment, env);
  assert.equal(scene.environment, null);
  assert.equal(scene.environmentIntensity, 0);
  assert.equal(env.disposed, false);
});

test("applyPresentEnvironment presenting keeps a provided saved env and intensity", () => {
  const lookdev = fakePmrem("lookdev");
  const scene = fakeScene(null, 0);
  const result = applyPresentEnvironment(scene, {
    presenting: true,
    savedEnvironment: lookdev,
    savedIntensity: 1,
  });
  assert.equal(result.savedEnvironment, lookdev);
  assert.equal(result.savedIntensity, 1);
  assert.equal(result.environment, null);
  assert.equal(result.intensity, 0);
  assert.equal(scene.environment, null);
  assert.equal(scene.environmentIntensity, 0);
  assert.equal(lookdev.disposed, false);
});

test("restorePresentEnvironment writes saved env + intensity and does not dispose", () => {
  const env = fakePmrem();
  const scene = fakeScene(null, 0);
  const result = restorePresentEnvironment(scene, {
    savedEnvironment: env,
    savedIntensity: 1,
  });
  assert.equal(result.presenting, false);
  assert.equal(result.savedEnvironment, env);
  assert.equal(result.savedIntensity, 1);
  assert.equal(result.environment, env);
  assert.equal(result.intensity, 1);
  assert.equal(result.envMapCleared, false);
  assert.equal(scene.environment, env);
  assert.equal(scene.environmentIntensity, 1);
  assert.equal(env.disposed, false);
});

test("applyPresentEnvironment presenting false restores via the same helper", () => {
  const env = fakePmrem();
  const scene = fakeScene(null, 0);
  const result = applyPresentEnvironment(scene, {
    presenting: false,
    savedEnvironment: env,
    savedIntensity: 1,
  });
  assert.equal(result.presenting, false);
  assert.equal(scene.environment, env);
  assert.equal(scene.environmentIntensity, 1);
  assert.equal(env.disposed, false);
});

test("restorePresentEnvironment falls back to lookdev intensity 1 when saved is missing", () => {
  const scene = fakeScene(null, 0);
  const result = restorePresentEnvironment(scene, {});
  assert.equal(result.savedIntensity, 1);
  assert.equal(result.savedEnvironment, null);
  assert.equal(scene.environment, null);
  assert.equal(scene.environmentIntensity, 1);
});

test("helpers do not throw without a scene", () => {
  const env = fakePmrem();
  assert.deepEqual(applyPresentEnvironment(null, { presenting: true }), {
    presenting: true,
    savedEnvironment: null,
    savedIntensity: 1,
    environment: null,
    intensity: 0,
    envMapCleared: true,
  });
  assert.deepEqual(
    applyPresentEnvironment(null, {
      presenting: false,
      savedEnvironment: env,
      savedIntensity: 1,
    }),
    {
      presenting: false,
      savedEnvironment: env,
      savedIntensity: 1,
      environment: env,
      intensity: 1,
      envMapCleared: false,
    }
  );
  assert.equal(env.disposed, false);
});

test("scenes without environmentIntensity still null and restore the env map", () => {
  const env = fakePmrem();
  const scene = { environment: env };
  const start = applyPresentEnvironment(scene, { presenting: true });
  assert.equal(start.savedEnvironment, env);
  assert.equal(start.savedIntensity, 1);
  assert.equal(scene.environment, null);
  assert.equal("environmentIntensity" in scene, false);
  applyPresentEnvironment(scene, {
    presenting: false,
    savedEnvironment: start.savedEnvironment,
    savedIntensity: start.savedIntensity,
  });
  assert.equal(scene.environment, env);
  assert.equal("environmentIntensity" in scene, false);
  assert.equal(env.disposed, false);
});

test("sessionstart then sessionend restores lookdev IBL without disposing PMREM", () => {
  const env = fakePmrem();
  const scene = fakeScene(env, 1);
  const start = applyPresentEnvironment(scene, { presenting: true });
  assert.equal(start.savedEnvironment, env);
  assert.equal(start.savedIntensity, 1);
  assert.equal(scene.environment, null);
  assert.equal(scene.environmentIntensity, 0);
  applyPresentEnvironment(scene, {
    presenting: false,
    savedEnvironment: start.savedEnvironment,
    savedIntensity: start.savedIntensity,
  });
  assert.equal(scene.environment, env);
  assert.equal(scene.environmentIntensity, 1);
  assert.equal(env.disposed, false);
});

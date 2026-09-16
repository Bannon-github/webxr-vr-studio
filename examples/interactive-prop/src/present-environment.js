/**
 * Quest 3 present-path IBL / scene.environment.
 *
 * Desktop lookdev builds a PMREM from RoomEnvironment and assigns
 * `scene.environment` (Three r170 `environmentIntensity` default 1).
 * MeshStandardMaterials sample that IBL every fragment when `USE_ENVMAP`
 * is set — real TBDR cost on Quest 3, complementary to v0.15–v0.17.
 *
 * r170 `scene.environmentIntensity` is a post-sample uniform multiply
 * (`envMapIntensity` in `envmap_physical_pars_fragment` after
 * `textureCubeUV`). Setting it to 0 still keeps `USE_ENVMAP` while
 * `scene.environment` is assigned (`WebGLPrograms` `HAS_ENVMAP` is
 * `!!(material.envMap || scene.environment)`). Unreliable for skipping
 * IBL sampling.
 *
 * Present-path policy: save `scene.environment` (+ intensity if present),
 * set `environment = null` so `USE_ENVMAP` drops, and write intensity 0
 * when the property exists. On `sessionend` restore the saved texture
 * reference + lookdev intensity. Do **not** dispose the PMREM texture.
 * Do not reconstruct the renderer.
 *
 * Session events only — never call from the XR animation loop.
 * Numeric constants match Three r170; no THREE / WebXR types. Safe in Node.
 */

/** Present-path intensity while IBL is gated (r170 default scale is 1). */
export const QUEST3_XR_ENVIRONMENT_INTENSITY = 0;
/** Three r170 `Scene.environmentIntensity` default / lookdev scale. */
export const DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY = 1;
/**
 * r170 intensity is a post-sample multiply. Intensity 0 does not drop
 * `USE_ENVMAP`. Nulling `scene.environment` is what skips sampling.
 */
export const QUEST3_XR_ENVIRONMENT_INTENSITY_SKIPS_SAMPLING = false;

/** Always `QUEST3_XR_ENVIRONMENT_INTENSITY` (0). */
export function resolveQuest3PresentEnvironmentIntensity() {
  return QUEST3_XR_ENVIRONMENT_INTENSITY;
}

/** Desired non-XR lookdev intensity (1). */
export function resolveDesktopLookdevEnvironmentIntensity() {
  return DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY;
}

/** Present-path environment map: always `null` so `USE_ENVMAP` drops. */
export function resolveQuest3PresentEnvironment() {
  return null;
}

export function sceneHasEnvironmentIntensity(scene) {
  return scene != null && typeof scene.environmentIntensity === "number";
}

export function readSceneEnvironmentIntensity(scene) {
  const v = scene?.environmentIntensity;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return DESKTOP_LOOKDEV_ENVIRONMENT_INTENSITY;
}

export function readSceneEnvironment(scene) {
  return scene?.environment ?? null;
}

function normalizeSavedIntensity(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

function resolveSavedEnvironment(scene, opts) {
  return Object.prototype.hasOwnProperty.call(opts, "savedEnvironment")
    ? opts.savedEnvironment
    : readSceneEnvironment(scene);
}

/**
 * Apply or restore the present-path IBL / environment policy.
 *
 * `{ presenting: true }` — remember current (or provided) environment +
 * intensity, then null `scene.environment` and write intensity 0 when
 * the property exists. Does not dispose the saved texture.
 * `{ presenting: false }` — restore saved lookdev values (no dispose).
 *
 * Returns `{ presenting, savedEnvironment, savedIntensity, environment, intensity, envMapCleared }`.
 */
export function applyPresentEnvironment(scene, opts = {}) {
  if (opts.presenting) {
    const savedEnvironment = resolveSavedEnvironment(scene, opts);
    const savedIntensity =
      normalizeSavedIntensity(opts.savedIntensity) ?? readSceneEnvironmentIntensity(scene);
    const environment = resolveQuest3PresentEnvironment();
    const intensity = resolveQuest3PresentEnvironmentIntensity();
    if (scene) {
      scene.environment = environment;
      if (sceneHasEnvironmentIntensity(scene)) {
        scene.environmentIntensity = intensity;
      }
    }
    return {
      presenting: true,
      savedEnvironment,
      savedIntensity,
      environment,
      intensity,
      envMapCleared: true,
    };
  }
  return restorePresentEnvironment(scene, opts);
}

export function restorePresentEnvironment(scene, opts = {}) {
  const savedEnvironment = resolveSavedEnvironment(scene, opts);
  const savedIntensity =
    normalizeSavedIntensity(opts.savedIntensity) ?? resolveDesktopLookdevEnvironmentIntensity();
  if (scene) {
    scene.environment = savedEnvironment;
    if (sceneHasEnvironmentIntensity(scene)) {
      scene.environmentIntensity = savedIntensity;
    }
  }
  return {
    presenting: false,
    savedEnvironment,
    savedIntensity,
    environment: savedEnvironment,
    intensity: savedIntensity,
    envMapCleared: false,
  };
}

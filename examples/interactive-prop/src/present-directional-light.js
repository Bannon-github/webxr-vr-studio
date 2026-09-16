/**
 * Quest 3 present-path directional / punctual light.
 *
 * Desktop lookdev uses HemisphereLight (ambient fill) plus a DirectionalLight
 * (`sun`, intensity 0.9). After v0.18 nulls `scene.environment`,
 * MeshStandardMaterial still evaluates punctual lights every fragment
 * (`NUM_DIR_LIGHTS`). Meta WebXR perf guidance: minimize lights; meshes
 * already have castShadow/receiveShadow false.
 *
 * r170 still counts a *visible* DirectionalLight with intensity 0 toward
 * `NUM_DIR_LIGHTS` (WebGLRenderer.projectObject pushes lights that are
 * visible). Intensity 0 does not drop the punctual loop. Setting
 * `visible = false` is what excludes the light from the render-state list.
 *
 * Present-path policy: save `visible` + `intensity`, then write
 * `visible = false` and `intensity = 0`. Keep HemisphereLight on for cheap
 * ambient fill. On `sessionend` restore the saved visible + lookdev
 * intensity. Do **not** remove the light from the graph or dispose it.
 *
 * Session events only — never call from the XR animation loop.
 * No THREE / WebXR types. Safe in Node.
 */

/** Present-path visibility — false drops the light from NUM_DIR_LIGHTS. */
export const QUEST3_XR_DIRECTIONAL_VISIBLE = false;
/** Present-path intensity while the directional is gated. */
export const QUEST3_XR_DIRECTIONAL_INTENSITY = 0;
/** Lookdev DirectionalLight.visible (Object3D default). */
export const DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE = true;
/** Lookdev sun intensity in examples/interactive-prop (not Three's default 1). */
export const DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY = 0.9;
/**
 * r170 intensity 0 on a visible DirectionalLight still increments
 * NUM_DIR_LIGHTS. Visibility false is what skips the punctual loop.
 */
export const QUEST3_XR_DIRECTIONAL_INTENSITY_SKIPS_PUNCTUAL = false;

/** Always `QUEST3_XR_DIRECTIONAL_VISIBLE` (false). */
export function resolveQuest3PresentDirectionalVisible() {
  return QUEST3_XR_DIRECTIONAL_VISIBLE;
}

/** Always `QUEST3_XR_DIRECTIONAL_INTENSITY` (0). */
export function resolveQuest3PresentDirectionalIntensity() {
  return QUEST3_XR_DIRECTIONAL_INTENSITY;
}

/** Desired non-XR lookdev visibility (true). */
export function resolveDesktopLookdevDirectionalVisible() {
  return DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE;
}

/** Desired non-XR lookdev sun intensity (0.9). */
export function resolveDesktopLookdevDirectionalIntensity() {
  return DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY;
}

export function readLightVisible(light) {
  if (typeof light?.visible === "boolean") return light.visible;
  return DESKTOP_LOOKDEV_DIRECTIONAL_VISIBLE;
}

export function readLightIntensity(light) {
  const v = light?.intensity;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return DESKTOP_LOOKDEV_DIRECTIONAL_INTENSITY;
}

function normalizeSavedVisible(value) {
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeSavedIntensity(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

/**
 * Apply or restore the present-path directional-light policy.
 *
 * `{ presenting: true }` — remember current (or provided) visible +
 * intensity, then hide the light and write intensity 0.
 * `{ presenting: false }` — restore saved lookdev values.
 *
 * Mutates only the light passed in (the directional sun). Does not
 * touch HemisphereLight or the scene graph.
 *
 * Returns `{ presenting, savedVisible, savedIntensity, visible, intensity }`.
 */
export function applyPresentDirectionalLight(light, opts = {}) {
  if (opts.presenting) {
    const savedVisible = normalizeSavedVisible(opts.savedVisible) ?? readLightVisible(light);
    const savedIntensity =
      normalizeSavedIntensity(opts.savedIntensity) ?? readLightIntensity(light);
    const visible = resolveQuest3PresentDirectionalVisible();
    const intensity = resolveQuest3PresentDirectionalIntensity();
    if (light) {
      light.visible = visible;
      light.intensity = intensity;
    }
    return { presenting: true, savedVisible, savedIntensity, visible, intensity };
  }
  return restorePresentDirectionalLight(light, opts);
}

export function restorePresentDirectionalLight(light, opts = {}) {
  const savedVisible =
    normalizeSavedVisible(opts.savedVisible) ?? resolveDesktopLookdevDirectionalVisible();
  const savedIntensity =
    normalizeSavedIntensity(opts.savedIntensity) ?? resolveDesktopLookdevDirectionalIntensity();
  if (light) {
    light.visible = savedVisible;
    light.intensity = savedIntensity;
  }
  return {
    presenting: false,
    savedVisible,
    savedIntensity,
    visible: savedVisible,
    intensity: savedIntensity,
  };
}

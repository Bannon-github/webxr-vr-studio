/**
 * Quest 3 present-path ambient-only fill.
 *
 * After v0.19, lookdev still has HemisphereLight + a hidden DirectionalLight
 * while presenting. Hemisphere interpolates sky/ground per fragment
 * (`NUM_HEMI_LIGHTS`) — more work than a single AmbientLight once punctual
 * lights are gone and IBL is nulled. Meta WebXR guidance: minimize lights.
 *
 * r170 still counts a *visible* HemisphereLight with intensity 0 toward
 * `NUM_HEMI_LIGHTS` (WebGLRenderer.projectObject pushes lights that are
 * visible). Intensity 0 does not drop the hemi loop. Setting
 * `visible = false` is what excludes the light from the render-state list.
 *
 * Present-path policy: save HemisphereLight `visible` + `intensity`, then
 * write `visible = false` and `intensity = 0`. Ensure one cheap
 * AmbientLight is active at `QUEST3_XR_AMBIENT_INTENSITY` (0.4) — create
 * once or reuse (do not allocate a new light every session). On
 * `sessionend` restore the saved hemisphere visible + lookdev intensity
 * and disable the present-only ambient (`visible = false`, intensity 0).
 * Detach it from the scene when a scene is provided so it does not leak
 * into desktop lookdev. Do **not** dispose the reused ambient.
 *
 * Intensity 0.4: readable MeshStandardMaterial fill after IBL / directional
 * / hemisphere are gated. Not a match for desktop lookdev (hemi 0.55 +
 * sun 0.9). Color `0xf0e6d4` matches the lookdev hemi sky so wood/brass
 * stay warm without inventing a new palette.
 *
 * Session events only — never call from the XR animation loop.
 * No THREE / WebXR types. Safe in Node.
 */

/** Present-path hemisphere visibility — false drops NUM_HEMI_LIGHTS. */
export const QUEST3_XR_HEMISPHERE_VISIBLE = false;
/** Present-path intensity while the hemisphere is gated. */
export const QUEST3_XR_HEMISPHERE_INTENSITY = 0;
/** Lookdev HemisphereLight.visible (Object3D default). */
export const DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE = true;
/** Lookdev hemisphere intensity in examples/interactive-prop (not Three's default 1). */
export const DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY = 0.55;
/**
 * r170 intensity 0 on a visible HemisphereLight still increments
 * NUM_HEMI_LIGHTS. Visibility false is what skips the hemi loop.
 */
export const QUEST3_XR_HEMISPHERE_INTENSITY_SKIPS_HEMI = false;

/** Present-path AmbientLight visibility while filling. */
export const QUEST3_XR_AMBIENT_VISIBLE = true;
/**
 * Present-path AmbientLight intensity. Readable fill after IBL / sun /
 * hemisphere are gated — not a desktop lookdev match (hemi 0.55 + sun 0.9).
 */
export const QUEST3_XR_AMBIENT_INTENSITY = 0.4;
/** Present-path AmbientLight color — lookdev hemi sky (warm wood/brass). */
export const QUEST3_XR_AMBIENT_COLOR = 0xf0e6d4;
/** Desktop / sessionend: present-only ambient is hidden. */
export const QUEST3_XR_AMBIENT_RESTORED_VISIBLE = false;
/** Desktop / sessionend: present-only ambient intensity. */
export const QUEST3_XR_AMBIENT_RESTORED_INTENSITY = 0;

/** Always `QUEST3_XR_HEMISPHERE_VISIBLE` (false). */
export function resolveQuest3PresentHemisphereVisible() {
  return QUEST3_XR_HEMISPHERE_VISIBLE;
}

/** Always `QUEST3_XR_HEMISPHERE_INTENSITY` (0). */
export function resolveQuest3PresentHemisphereIntensity() {
  return QUEST3_XR_HEMISPHERE_INTENSITY;
}

/** Desired non-XR lookdev hemisphere visibility (true). */
export function resolveDesktopLookdevHemisphereVisible() {
  return DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE;
}

/** Desired non-XR lookdev hemisphere intensity (0.55). */
export function resolveDesktopLookdevHemisphereIntensity() {
  return DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY;
}

/** Always `QUEST3_XR_AMBIENT_INTENSITY` (0.4). */
export function resolveQuest3PresentAmbientIntensity() {
  return QUEST3_XR_AMBIENT_INTENSITY;
}

/** Always `QUEST3_XR_AMBIENT_VISIBLE` (true). */
export function resolveQuest3PresentAmbientVisible() {
  return QUEST3_XR_AMBIENT_VISIBLE;
}

export function readLightVisible(light, fallback = DESKTOP_LOOKDEV_HEMISPHERE_VISIBLE) {
  if (typeof light?.visible === "boolean") return light.visible;
  return fallback;
}

export function readLightIntensity(light, fallback = DESKTOP_LOOKDEV_HEMISPHERE_INTENSITY) {
  const v = light?.intensity;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return fallback;
}

function normalizeSavedVisible(value) {
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeSavedIntensity(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

function isSceneChild(scene, light) {
  if (!scene || !light) return false;
  if (light.parent === scene) return true;
  if (Array.isArray(scene.children) && scene.children.includes(light)) return true;
  return false;
}

export function attachPresentAmbient(scene, ambient) {
  if (!scene || !ambient || typeof scene.add !== "function") return false;
  if (isSceneChild(scene, ambient)) return false;
  scene.add(ambient);
  return true;
}

export function detachPresentAmbient(scene, ambient) {
  if (!scene || !ambient || typeof scene.remove !== "function") return false;
  if (!isSceneChild(scene, ambient)) return false;
  scene.remove(ambient);
  return true;
}

/**
 * Reuse `ambient` when provided. Otherwise call `opts.createAmbient` once.
 * Never constructs a light itself (no THREE types).
 */
export function ensurePresentAmbient(ambient, opts = {}) {
  if (ambient) return ambient;
  if (typeof opts.createAmbient === "function") return opts.createAmbient();
  return null;
}

function applyPresentAmbientLight(ambient, scene) {
  if (!ambient) return { ambient: null, ambientVisible: false, ambientIntensity: 0, attached: false };
  ambient.visible = resolveQuest3PresentAmbientVisible();
  ambient.intensity = resolveQuest3PresentAmbientIntensity();
  const attached = attachPresentAmbient(scene, ambient);
  return {
    ambient,
    ambientVisible: ambient.visible,
    ambientIntensity: ambient.intensity,
    attached,
  };
}

function disablePresentAmbientLight(ambient, scene) {
  if (!ambient) {
    return {
      ambient: null,
      ambientVisible: QUEST3_XR_AMBIENT_RESTORED_VISIBLE,
      ambientIntensity: QUEST3_XR_AMBIENT_RESTORED_INTENSITY,
      detached: false,
    };
  }
  ambient.visible = QUEST3_XR_AMBIENT_RESTORED_VISIBLE;
  ambient.intensity = QUEST3_XR_AMBIENT_RESTORED_INTENSITY;
  const detached = detachPresentAmbient(scene, ambient);
  return {
    ambient,
    ambientVisible: ambient.visible,
    ambientIntensity: ambient.intensity,
    detached,
  };
}

/**
 * Apply or restore the present-path ambient-only fill policy.
 *
 * `{ presenting: true }` — remember hemisphere visible + intensity, hide
 * the hemisphere, then enable one AmbientLight (create once or reuse).
 * `{ presenting: false }` — restore saved lookdev hemisphere; disable and
 * detach the present-only ambient so it does not leak across sessions.
 *
 * Mutates the lights passed in. Does not touch DirectionalLight.
 *
 * Returns `{ presenting, savedVisible, savedIntensity, hemiVisible,
 * hemiIntensity, ambient, ambientVisible, ambientIntensity, attached?,
 * detached? }`.
 */
export function applyPresentAmbientFill(hemi, ambient, opts = {}) {
  if (opts.presenting) {
    const savedVisible = normalizeSavedVisible(opts.savedVisible) ?? readLightVisible(hemi);
    const savedIntensity =
      normalizeSavedIntensity(opts.savedIntensity) ?? readLightIntensity(hemi);
    const hemiVisible = resolveQuest3PresentHemisphereVisible();
    const hemiIntensity = resolveQuest3PresentHemisphereIntensity();
    if (hemi) {
      hemi.visible = hemiVisible;
      hemi.intensity = hemiIntensity;
    }
    const resolved = ensurePresentAmbient(ambient, opts);
    const fill = applyPresentAmbientLight(resolved, opts.scene);
    return {
      presenting: true,
      savedVisible,
      savedIntensity,
      hemiVisible,
      hemiIntensity,
      ambient: fill.ambient,
      ambientVisible: fill.ambientVisible,
      ambientIntensity: fill.ambientIntensity,
      attached: fill.attached,
    };
  }
  return restorePresentAmbientFill(hemi, ambient, opts);
}

export function restorePresentAmbientFill(hemi, ambient, opts = {}) {
  const savedVisible =
    normalizeSavedVisible(opts.savedVisible) ?? resolveDesktopLookdevHemisphereVisible();
  const savedIntensity =
    normalizeSavedIntensity(opts.savedIntensity) ?? resolveDesktopLookdevHemisphereIntensity();
  if (hemi) {
    hemi.visible = savedVisible;
    hemi.intensity = savedIntensity;
  }
  const disabled = disablePresentAmbientLight(ambient, opts.scene);
  return {
    presenting: false,
    savedVisible,
    savedIntensity,
    hemiVisible: savedVisible,
    hemiIntensity: savedIntensity,
    ambient: disabled.ambient,
    ambientVisible: disabled.ambientVisible,
    ambientIntensity: disabled.ambientIntensity,
    detached: disabled.detached,
  };
}

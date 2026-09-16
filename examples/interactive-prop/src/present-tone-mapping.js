/**
 * Quest 3 present-path tone mapping.
 *
 * Desktop lookdev uses ACESFilmic (Three r170 `ACESFilmicToneMapping` = 4)
 * plus `toneMappingExposure` 1.05. Three applies `renderer.toneMapping` in
 * the output fragment (`TONE_MAPPING` define). ACESFilmic is extra ALU on
 * every fragment — a real cost on Quest 3's TBDR present path.
 *
 * While an immersive XR session is presenting: `NoToneMapping` (0) so Three
 * skips that shader path. Exposure policy while presenting is identity (1):
 * r170 does not apply `toneMappingExposure` when `TONE_MAPPING` is unset;
 * still write 1 so the renderer property matches identity if a later Three
 * applies exposure independently. On `sessionend`, restore the saved lookdev
 * operator + the prior exposure.
 *
 * Session events only — never call from the XR animation loop.
 * Numeric constants match Three r170; no THREE / WebXR types. Safe in Node.
 */

/** THREE.NoToneMapping — Three r170. */
export const QUEST3_XR_TONE_MAPPING = 0;
/** THREE.ACESFilmicToneMapping — Three r170. */
export const DESKTOP_LOOKDEV_TONE_MAPPING = 4;
export const DESKTOP_LOOKDEV_TONE_MAPPING_EXPOSURE = 1.05;
/** Identity while `NoToneMapping` is active (see module doc). */
export const QUEST3_XR_TONE_MAPPING_EXPOSURE = 1;

/** Always `QUEST3_XR_TONE_MAPPING` (NoToneMapping). */
export function resolveQuest3PresentToneMapping() {
  return QUEST3_XR_TONE_MAPPING;
}

/** Always `QUEST3_XR_TONE_MAPPING_EXPOSURE` (identity). */
export function resolveQuest3PresentToneMappingExposure() {
  return QUEST3_XR_TONE_MAPPING_EXPOSURE;
}

/** Desired non-XR lookdev operator (ACESFilmic). */
export function resolveDesktopLookdevToneMapping() {
  return DESKTOP_LOOKDEV_TONE_MAPPING;
}

/** Desired non-XR lookdev exposure. */
export function resolveDesktopLookdevToneMappingExposure() {
  return DESKTOP_LOOKDEV_TONE_MAPPING_EXPOSURE;
}

export function readRendererToneMapping(renderer) {
  const v = renderer?.toneMapping;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return QUEST3_XR_TONE_MAPPING;
}

export function readRendererToneMappingExposure(renderer) {
  const v = renderer?.toneMappingExposure;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return QUEST3_XR_TONE_MAPPING_EXPOSURE;
}

function normalizeSavedToneMapping(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  return null;
}

function normalizeSavedExposure(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

/**
 * Apply or restore the present-path tone-mapping policy.
 *
 * `{ presenting: true }` — remember current (or provided) operator + exposure,
 * then set `NoToneMapping` and identity exposure.
 * `{ presenting: false }` — restore saved lookdev values.
 *
 * Returns `{ presenting, savedToneMapping, savedExposure, toneMapping, exposure }`.
 */
export function applyPresentToneMapping(renderer, opts = {}) {
  if (opts.presenting) {
    const savedToneMapping =
      normalizeSavedToneMapping(opts.savedToneMapping) ?? readRendererToneMapping(renderer);
    const savedExposure =
      normalizeSavedExposure(opts.savedExposure) ?? readRendererToneMappingExposure(renderer);
    const toneMapping = resolveQuest3PresentToneMapping();
    const exposure = resolveQuest3PresentToneMappingExposure();
    if (renderer) {
      renderer.toneMapping = toneMapping;
      renderer.toneMappingExposure = exposure;
    }
    return { presenting: true, savedToneMapping, savedExposure, toneMapping, exposure };
  }
  return restorePresentToneMapping(renderer, opts);
}

export function restorePresentToneMapping(renderer, opts = {}) {
  const savedToneMapping =
    normalizeSavedToneMapping(opts.savedToneMapping) ?? resolveDesktopLookdevToneMapping();
  const savedExposure =
    normalizeSavedExposure(opts.savedExposure) ?? resolveDesktopLookdevToneMappingExposure();
  if (renderer) {
    renderer.toneMapping = savedToneMapping;
    renderer.toneMappingExposure = savedExposure;
  }
  return {
    presenting: false,
    savedToneMapping,
    savedExposure,
    toneMapping: savedToneMapping,
    exposure: savedExposure,
  };
}

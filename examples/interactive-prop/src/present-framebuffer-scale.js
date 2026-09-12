/**
 * Quest 3 present-path XR framebuffer scale factor clamp.
 *
 * `renderer.setPixelRatio(1)` (v0.15) and `renderer.xr.setFramebufferScaleFactor`
 * are different knobs. Three r170 `WebXRManager` framebuffer scale controls
 * the XR eye-buffer resolution relative to the runtime’s recommended size.
 * The private default is `1.0`. Lookdev or future HUD code can raise it
 * (sharper text) and blow Quest 3 fill. Studio policy while presenting:
 * clamp to **1**. Raising above 1 is stretch-only and must be measured
 * on-device. Pair with existing FFR 0.75 + pixel-ratio 1.
 *
 * Three r170 exposes `setFramebufferScaleFactor(value)` only — there is
 * **no** `getFramebufferScaleFactor`. Calling the setter while
 * `isPresenting === true` still writes the private factor but warns and
 * does **not** rebuild the current `XRWebGLLayer` / projection layer
 * (`setSession` snapshots the factor, then sets `isPresenting` and
 * dispatches `sessionstart`). Helpers still apply on `sessionstart` so
 * the next layer inherits 1. The example also sets 1 at renderer setup
 * (before VRButton / `setSession`) so the *current* session inherits
 * the clamp. Restore on `sessionend` (r170 already cleared
 * `isPresenting`) writes the saved lookdev/desktop scale back.
 *
 * Save path when there is no getter: provided `savedScale`, else the
 * last value we set (`lastSetScale`), else the documented lookdev
 * default (`DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE` = 1). If a later Three
 * adds `getFramebufferScaleFactor`, `readRendererFramebufferScale`
 * uses it.
 *
 * Session events only — never call from the XR animation loop.
 * No WebXR types; safe to unit-test in Node.
 */

/** Present-path XR eye-buffer scale vs the runtime recommended size. */
export const QUEST3_XR_FRAMEBUFFER_SCALE = 1;
/** Documented lookdev / desktop default (Three r170 private default). */
export const DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE = 1;

/** Always `QUEST3_XR_FRAMEBUFFER_SCALE` (1). `requested` is ignored. */
export function resolveQuest3PresentFramebufferScale(_requested) {
  return QUEST3_XR_FRAMEBUFFER_SCALE;
}

/** Desired non-XR / lookdev scale (1 unless a caller raised it). */
export function resolveDesktopLookdevFramebufferScale() {
  return DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE;
}

export function normalizeFramebufferScale(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

/**
 * Read the current factor. r170 has no getter — prefer
 * `getFramebufferScaleFactor` when a later Three adds it, else
 * `fallback` / the documented lookdev default.
 */
export function readRendererFramebufferScale(renderer, fallback = DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE) {
  const xr = renderer?.xr;
  if (xr && typeof xr.getFramebufferScaleFactor === "function") {
    const n = normalizeFramebufferScale(xr.getFramebufferScaleFactor());
    if (n != null) return n;
  }
  return normalizeFramebufferScale(fallback) ?? DESKTOP_LOOKDEV_FRAMEBUFFER_SCALE;
}

function xrOf(renderer) {
  return renderer && renderer.xr && typeof renderer.xr === "object" ? renderer.xr : null;
}

function writeFramebufferScale(xr, scale) {
  if (xr && typeof xr.setFramebufferScaleFactor === "function") {
    xr.setFramebufferScaleFactor(scale);
    return true;
  }
  return false;
}

/**
 * Apply or restore the present-path framebuffer-scale clamp.
 *
 * `{ presenting: true }` — remember the current (or provided / last-set)
 * scale, then `setFramebufferScaleFactor(QUEST3_XR_FRAMEBUFFER_SCALE)`.
 * `{ presenting: false }` — restore `savedScale`.
 *
 * Returns `{ presenting, savedScale, scale, applied, presentingLocked,
 * getterAvailable }`.
 */
export function applyPresentFramebufferScale(renderer, opts = {}) {
  if (opts.presenting) {
    const savedScale =
      normalizeFramebufferScale(opts.savedScale) ??
      readRendererFramebufferScale(renderer, opts.lastSetScale);
    const scale = resolveQuest3PresentFramebufferScale(opts.scale);
    const xr = xrOf(renderer);
    const presentingLocked = xr?.isPresenting === true;
    const applied = writeFramebufferScale(xr, scale);
    return {
      presenting: true,
      savedScale,
      scale,
      applied,
      presentingLocked,
      getterAvailable: typeof xr?.getFramebufferScaleFactor === "function",
    };
  }
  return restorePresentFramebufferScale(renderer, opts);
}

export function restorePresentFramebufferScale(renderer, opts = {}) {
  const savedScale =
    normalizeFramebufferScale(opts.savedScale) ?? resolveDesktopLookdevFramebufferScale();
  const xr = xrOf(renderer);
  const presentingLocked = xr?.isPresenting === true;
  const applied = writeFramebufferScale(xr, savedScale);
  return {
    presenting: false,
    savedScale,
    scale: savedScale,
    applied,
    presentingLocked,
    getterAvailable: typeof xr?.getFramebufferScaleFactor === "function",
  };
}

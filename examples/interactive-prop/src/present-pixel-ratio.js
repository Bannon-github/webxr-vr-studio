/**
 * Quest 3 present-path WebGL pixel-ratio clamp.
 *
 * Desktop lookdev may use min(devicePixelRatio, 2). On Quest Browser that
 * startup cap can leave a higher-than-needed canvas backbuffer while
 * presenting and burns GPU / thermal budget. Clamp to 1 on sessionstart
 * (after 90/72 + FFR defaults). Restore the saved 2D ratio + window size
 * on sessionend so lookdev is unchanged.
 *
 * Session events only — never call from the XR animation loop.
 * No WebXR types; safe to unit-test in Node.
 */

export const QUEST3_XR_PIXEL_RATIO = 1;
export const DESKTOP_PIXEL_RATIO_CAP = 2;

/** Always 1. `devicePixelRatio` is accepted so callers can pass UA DPR; it is ignored. */
export function resolveQuest3PresentPixelRatio(_devicePixelRatio) {
  return QUEST3_XR_PIXEL_RATIO;
}

export function resolveDesktopPixelRatio(devicePixelRatio, cap = DESKTOP_PIXEL_RATIO_CAP) {
  const dpr = Number(devicePixelRatio);
  const n = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const limit = Number.isFinite(cap) && cap > 0 ? cap : DESKTOP_PIXEL_RATIO_CAP;
  return Math.min(n, limit);
}

export function readRendererPixelRatio(renderer) {
  if (renderer && typeof renderer.getPixelRatio === "function") {
    const r = renderer.getPixelRatio();
    if (typeof r === "number" && Number.isFinite(r) && r > 0) return r;
  }
  return QUEST3_XR_PIXEL_RATIO;
}

function normalizeSavedRatio(savedRatio) {
  if (typeof savedRatio === "number" && Number.isFinite(savedRatio) && savedRatio > 0) {
    return savedRatio;
  }
  return null;
}

/**
 * Apply or restore the present-path clamp.
 *
 * `{ presenting: true }` — remember the current (or provided) ratio, then
 * `setPixelRatio(QUEST3_XR_PIXEL_RATIO)`. Does not touch `setSize`.
 * `{ presenting: false }` — restore `savedRatio` and `setSize(windowSize)`.
 *
 * Returns `{ presenting, savedRatio, ratio }` (no renderer required).
 */
export function applyPresentPixelRatioClamp(renderer, opts = {}) {
  if (opts.presenting) {
    const savedRatio = normalizeSavedRatio(opts.savedRatio) ?? readRendererPixelRatio(renderer);
    const ratio = resolveQuest3PresentPixelRatio(opts.devicePixelRatio);
    if (renderer && typeof renderer.setPixelRatio === "function") {
      renderer.setPixelRatio(ratio);
    }
    return { presenting: true, savedRatio, ratio };
  }
  return restorePresentPixelRatio(renderer, opts);
}

export function restorePresentPixelRatio(renderer, opts = {}) {
  const savedRatio = normalizeSavedRatio(opts.savedRatio) ?? QUEST3_XR_PIXEL_RATIO;
  if (renderer && typeof renderer.setPixelRatio === "function") {
    renderer.setPixelRatio(savedRatio);
  }
  const size = opts.windowSize;
  const width = size?.width;
  const height = size?.height;
  if (
    renderer &&
    typeof renderer.setSize === "function" &&
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    renderer.setSize(width, height);
  }
  return { presenting: false, savedRatio, ratio: savedRatio };
}

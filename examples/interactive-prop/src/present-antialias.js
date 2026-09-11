/**
 * Quest 3 present-path WebGL antialias / MSAA off.
 *
 * Meta WebXR mobile guidance treats MSAA as expensive fill. The example used
 * to construct `THREE.WebGLRenderer({ antialias: true })` once at startup.
 * Three.js r170 `WebXRManager` snapshots `gl.getContextAttributes()` in its
 * constructor and copies `antialias` into `new XRWebGLLayer(..., { antialias })`
 * (or projection-layer `samples: 4|0`). There is no `renderer.setAntialias`.
 * WebGL context attributes are immutable after `getContext`. Recreating the
 * renderer/canvas to flip the flag would drop PMREM, GPU uploads, and XR
 * bindings — not done here.
 *
 * Supported pattern: start the one long-lived renderer on the Quest present
 * path (`antialias: QUEST3_XR_ANTIALIAS` === false) so the XR layer inherits
 * MSAA off. Sessionstart / sessionend still run these helpers (after 90/72,
 * FFR, and the v0.15 pixel-ratio clamp) to record and verify policy. They
 * never allocate in the XR animation loop.
 *
 * Desktop 2D lookdev in this slice shares that context, so it also has MSAA
 * off. That is the documented trade-off so the headset path is correct.
 * `savedAntialias` is the *desired* lookdev policy (true), not a live flip.
 *
 * No WebXR types; safe to unit-test in Node.
 */

export const QUEST3_XR_ANTIALIAS = false;
export const DESKTOP_LOOKDEV_ANTIALIAS = true;

/** Always false. Present-path MSAA stays off. */
export function resolveQuest3PresentAntialias() {
  return QUEST3_XR_ANTIALIAS;
}

/** Desired non-XR lookdev policy. Cannot be applied to a live WebGL context. */
export function resolveDesktopLookdevAntialias() {
  return DESKTOP_LOOKDEV_ANTIALIAS;
}

/**
 * Constructor / session policy.
 * `{ presenting: true }` → false (Quest XR layer).
 * otherwise → true (desired lookdev; only honored if a new context is created).
 */
export function resolveWebGLRendererAntialias(opts = {}) {
  return opts.presenting ? QUEST3_XR_ANTIALIAS : DESKTOP_LOOKDEV_ANTIALIAS;
}

export function readRendererAntialias(renderer) {
  const gl = renderer && typeof renderer.getContext === "function" ? renderer.getContext() : null;
  const attrs = gl && typeof gl.getContextAttributes === "function" ? gl.getContextAttributes() : null;
  if (attrs && typeof attrs.antialias === "boolean") return attrs.antialias;
  return QUEST3_XR_ANTIALIAS;
}

function normalizeSavedAntialias(value) {
  return typeof value === "boolean" ? value : null;
}

/**
 * Apply or restore the present-path antialias policy.
 *
 * `{ presenting: true }` — remember the desired lookdev flag, require
 * present-path `false`. Does not mutate the WebGL context (immutable).
 * `{ presenting: false }` — restore the saved *policy* value for callers.
 *
 * Returns `{ presenting, savedAntialias, antialias, applied, contextImmutable }`.
 */
export function applyPresentAntialias(renderer, opts = {}) {
  if (opts.presenting) {
    const savedAntialias =
      normalizeSavedAntialias(opts.savedAntialias) ?? resolveDesktopLookdevAntialias();
    const antialias = resolveQuest3PresentAntialias();
    const actual = readRendererAntialias(renderer);
    return {
      presenting: true,
      savedAntialias,
      antialias,
      applied: actual === antialias,
      contextImmutable: true,
    };
  }
  return restorePresentAntialias(renderer, opts);
}

export function restorePresentAntialias(renderer, opts = {}) {
  const savedAntialias =
    normalizeSavedAntialias(opts.savedAntialias) ?? resolveDesktopLookdevAntialias();
  const actual = readRendererAntialias(renderer);
  return {
    presenting: false,
    savedAntialias,
    antialias: savedAntialias,
    applied: actual === savedAntialias,
    contextImmutable: true,
  };
}

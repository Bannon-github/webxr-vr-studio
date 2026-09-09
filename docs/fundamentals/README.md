# WebXR fundamentals

Studio mental model for the WebXR Device API. Facts cross-checked against MDN and Immersive Web docs (2026). Support is **not Baseline** — always verify on target devices.

## Contents

1. [Sessions](sessions.md) — modes, feature lists, lifecycle
2. [Reference spaces](reference-spaces.md) — viewer, local, local-floor, bounded-floor, unbounded
3. [Frames and rendering](frames.md) — XRFrame, viewer pose, XRWebGLLayer
4. [Input sources](input-sources.md) — targetRaySpace, gripSpace, select/squeeze
5. [Layers and FFR](layers-and-ffr.md) — composition layers, fixedFoveation

## One-line pipeline

secure context → navigator.xr → isSessionSupported(mode) → user activation → requestSession → requestReferenceSpace → updateRenderState(baseLayer) → requestAnimationFrame loop → getViewerPose → draw per view → submit via compositor

## Security gates (MDN)

- Secure context: HTTPS or localhost
- Immersive sessions need a focused document and user gesture
- Permissions Policy: xr-spatial-tracking (especially in iframes)
- Check isSessionSupported before enabling Enter VR UI

Primary refs: MDN WebXR Device API; Immersive Web explainer.

# Layers and fixed foveated rendering (FFR)

## Base layer vs composition layers

- **XRWebGLLayer** (baseLayer): classic single eye-buffer path; simplest and most widely used.
- **WebXR Layers API**: projection / quad / cylinder / equirect / cube layers composed by the XR compositor. Useful for high-quality panels, video, and reducing distortion cost. Create via XRWebGLBinding when the layers feature is available.

Projection layers can set fixedFoveation similarly to XRWebGLLayer (MDN XRProjectionLayer.fixedFoveation; W3C WebXR Layers API Level 1).

## Fixed foveation (FFR)

XRWebGLLayer.fixedFoveation (MDN): number in [0, 1]

- 0 = minimum foveation (full resolution)
- 1 = maximum foveation (edges at lower resolution)
- null = device/UA does not support FFR; setting is a no-op

Effect applies on the next XRFrame. Best for low-contrast periphery; reduce foveation when rendering sharp text or UI at the edges.

Some runtimes also accept optional session feature hints for foveation levels; prefer the portable fixedFoveation property when available and measure.

## Studio guidance

1. Start with XRWebGLLayer + Three.js/Babylon WebXR helpers.
2. Enable FFR when GPU-bound on standalone HMDs; A/B at 0.5 vs 1.0.
3. Adopt composition layers for video / large HUD quads when targeting runtimes with solid Layers support.
4. Never invent vendor-only APIs in shared docs — link vendor notes separately.

Refs: MDN XRWebGLLayer.fixedFoveation; W3C webxrlayers-1.

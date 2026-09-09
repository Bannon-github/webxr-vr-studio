# ADR 0001 — Default framework / engine

- Status: Accepted
- Date: 2026-09-08

## Context

We need a default stack for WebXR immersive-vr products that balances control, ecosystem, hiring, and headset reliability. Candidates: Three.js, Babylon.js, A-Frame, React Three Fiber, raw WebGL.

## Decision

1. **Default product stack:** Vite + **Three.js** with WebGL2, using Three's WebXRManager for session/presentation wiring.
2. **React orgs:** R3F allowed when the wider product is React; isolate per-frame mutations outside React state.
3. **Babylon.js:** allowed when the team wants built-in WebXR experience helpers / GUI and accepts bundle weight.
4. **A-Frame:** spikes, education, and HTML-first prototypes only — promote to Three/Babylon before production complexity grows.
5. **WebGPU:** not required for XR presentation in v1; revisit when target HMDs document stable WebGPU XR paths.

## Consequences

- Shared samples and the examples/webxr-starter follow Three.js.
- Engine-specific code stays behind a thin session/input boundary.
- Superseding this ADR requires a spike with on-device frame time comparison.

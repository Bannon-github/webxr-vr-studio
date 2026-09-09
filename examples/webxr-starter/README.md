# webxr-starter

Vite + Three.js demo for an immersive-vr session. Companion to the WebXR VR Studio knowledge base.

## Run

1. cd into this directory
2. Install Node dependencies (see package.json)
3. Start Vite with the dev script
4. Open the printed HTTPS URL on desktop or Quest Browser
5. Accept the self-signed certificate warning in development
6. Click Enter VR (requires a user gesture)
7. Point a controller ray at a cube and press the trigger to recolor it

Vite uses HTTPS and host binding so a headset on LAN gets a secure context. Desktop localhost is also a secure context.

### Desktop without a headset

Use the WebXR API Emulator browser extension, enable a device, then Enter VR.

### Production preview

Use the build and preview scripts in package.json.

## What it demonstrates

- renderer.xr.enabled and Three VRButton (WebXR session setup)
- Controller grips via XRControllerModelFactory
- Rays aligned with targetRaySpace semantics
- selectstart / selectend interaction
- Runtime support check via navigator.xr.isSessionSupported

## Notes

- Prefer local-floor on device; Three WebXRManager negotiates available spaces.
- Product comfort defaults: studio/adr/0002-locomotion.md (this starter has no artificial locomotion).
- Next example: [interactive-prop](../interactive-prop/) — hover, grab, and a multi-state openable crate (ADR 0004).

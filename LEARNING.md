# Learning path — WebXR VR Studio

A pragmatic path from “can I enter VR?” to “can we ship a comfortable product?”

## 1. Platform literacy (1–2 days)

1. Read [MDN: WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API).
2. Skim the [Immersive Web explainer](https://immersive-web.github.io/webxr/explainer.html).
3. Internalize: secure context → `navigator.xr` → `isSessionSupported` → user gesture → `requestSession` → reference space → `requestAnimationFrame` → `getViewerPose` → render to `XRWebGLLayer`.
4. Work through [`docs/fundamentals/`](docs/fundamentals/).

## 2. Hands-on (1–3 days)

1. Run [`examples/webxr-starter`](examples/webxr-starter/) on desktop with the WebXR API Emulator, then on a Quest headset over HTTPS / LAN.
2. Trace `select` / `squeezestart` events and `XRInputSource.targetRaySpace` / `gripSpace`.
3. Change reference space from `local` to `local-floor` and observe floor alignment.

## 3. Engine choice (half day)

1. Read [`docs/stack/`](docs/stack/) and [ADR 0001](studio/adr/0001-framework.md).
2. Prototype the same scene in your shortlisted engine; do **not** debate without a frame-time sample.

## 4. Comfort & interaction (ongoing)

1. [`docs/design/`](docs/design/) — especially locomotion and FOV vignette patterns.
2. [ADR 0002](studio/adr/0002-locomotion.md) and [ADR 0003](studio/adr/0003-interaction.md).
3. Pair with someone who gets VR-sick easily for every locomotion change.

## 5. Photoreal interactive assets

1. Read [asset-to-interaction-workflow](studio/asset-to-interaction-workflow.md) and [ADR 0004](studio/adr/0004-asset-interaction-architecture.md).
2. Run [`examples/interactive-prop`](examples/interactive-prop/) — latch (cancel by latching again), open, grab the tool, drive the front fastener four times. `C` = colliders; `1`/`2`/`3` = L3 LODs; `P` = Quest 3 diag overlay. Same `crate-toolbox` id.
3. Pair with [interactive-objects](docs/design/interactive-objects.md) (affordances) and [photoreal-realtime](docs/performance/photoreal-realtime.md) (budgets). v0.6 L2 maps are 512² procedural albedo+ORM; v0.12 adds matching 512² normals; v0.13 drops `normalMap` on LOD2; v0.14 halves LOD1 `normalScale` (same maps); v0.23 drops ORM on LOD2 (albedo-only; constant wood-ORM-midtone roughness/metalness); v0.24 drops `normalMap` on LOD1 (albedo+ORM only); v0.25 drops ORM on LOD1 (albedo-only; constant wood-ORM-midtone roughness/metalness on wood/handle, brass-ORM-midtone on latch); v0.26 binds 256² albedo on LOD1/LOD2 (LOD0 stays 512²); v0.27 switches LOD2 far wood to unlit `MeshBasicMaterial` (same 256² albedo; no roughness/metalness); v0.28 switches LOD1 mid body / lid / latch / tool stub to unlit `MeshBasicMaterial` (same 256² wood / brass albedos; no roughness/metalness); v0.29 drops the LOD2 albedo `map` (color-only unlit MeshBasic at wood midtone `0x633318`; LOD1 still 256² MeshBasic; unique canvases stay 11); v0.30 drops the LOD1 albedo `map` (color-only unlit MeshBasic at wood midtone `0x633318` / brass midtone `0xBE7E31`; unique canvases 11 → 9). v0.7 probes a KTX2 GLB when you drop one in ([ktx2-quest3-packaging](docs/performance/ktx2-quest3-packaging.md)). v0.8 scrubs per-frame allocations on the XR loop (overlay off). v0.9: hand hover before pinch. v0.10: tracking-loss / null-pose `endGrab`. v0.11: visibility-loss `endGrab` (no auto-regrab). v0.15: clamp WebGL pixel ratio to 1 while presenting (restore on `sessionend`). v0.16: present-path antialias/MSAA off (constructor `antialias: false`; Three copies it into `XRWebGLLayer` — no live flip). v0.17: present-path `NoToneMapping` while immersive; restore lookdev ACES + exposure on `sessionend`. v0.18: present-path IBL off while immersive (null `scene.environment`; r170 intensity does not skip sampling); restore the saved PMREM + lookdev intensity on `sessionend`. v0.19: present-path directional / punctual off while immersive (hemisphere-only; `sun.visible = false` + intensity 0 — r170 intensity 0 does not drop `NUM_DIR_LIGHTS`); restore lookdev visible + intensity on `sessionend`. v0.20: present-path ambient-only fill while immersive (HemisphereLight off + one `AmbientLight` at intensity 0.4; r170 intensity 0 does not drop `NUM_HEMI_LIGHTS`); restore lookdev hemi and disable/detach the present-only ambient on `sessionend`. v0.21: present-path texture anisotropy clamp to 1 while immersive (lookdev / packaged GLB may use GPU max); restore saved lookdev anisotropy on `sessionend`. v0.22: present-path XR framebuffer scale factor clamp to 1 while immersive (`setFramebufferScaleFactor`; r170 has no getter and cannot rebuild the current layer while presenting — also set 1 at renderer setup); restore saved lookdev scale on `sessionend`.
4. Do not ship a generator or scan mesh as a grab target without retopo, UVs, and a collider split.

## 6. Ship discipline

1. [`docs/performance/`](docs/performance/) checklist before feature freeze.
2. [`docs/shipping/`](docs/shipping/) matrix filled for the release. Quest 3 Browser timings: [quest-3-on-device-qa](docs/shipping/quest-3-on-device-qa.md) (blank until a headset run).
3. [`docs/testing/`](docs/testing/) headset + emulator pass.
4. Meet [`studio/quality-bar.md`](studio/quality-bar.md).

## Canonical external references

| Topic | Source |
| --- | --- |
| Core API | [MDN WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) |
| Sessions | [XRSystem.requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession) |
| Spaces | [XRSession.requestReferenceSpace](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace) |
| Input | [Inputs and input sources](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs) |
| Startup / security | [Starting up and shutting down](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Startup_and_shutdown) |
| FFR | [XRWebGLLayer.fixedFoveation](https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/fixedFoveation) |
| Layers | [WebXR Layers API Level 1](https://www.w3.org/TR/webxrlayers-1/) |
| Samples | [immersive-web/webxr-samples](https://github.com/immersive-web/webxr-samples) |

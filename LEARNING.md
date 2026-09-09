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
3. Pair with [interactive-objects](docs/design/interactive-objects.md) (affordances) and [photoreal-realtime](docs/performance/photoreal-realtime.md) (budgets). v0.6 L2 maps are 512² procedural albedo+ORM — KTX2 comes with a DCC GLB.
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

# Gate device: Meta Quest 3

**Primary hardware target:** Meta Quest 3, **immersive-vr** in **Meta Quest Browser**. All additive L2/L3 work, the [quality bar](../../studio/quality-bar.md), and hero-scene sign-off gate here — not a desktop dGPU.

Quest 3S shares the same GPU class; treat it as in-family. Quest 2 remains a useful soak if you still ship it, but it is **not** the studio default. Do **not** require 207/240 Hz extended modes.

## Frame rate

| Mode | Role | Budget |
| --- | --- | --- |
| **90 Hz** | Default ship target | ≈11.1 ms |
| **72 Hz** | Fallback if 90 cannot hold (thermal, heavy scene) | ≈13.9 ms |
| **120 Hz** | Stretch only — never a ship gate | ≈8.3 ms |
| 207 / 240 Hz | Out of scope | — |

Meta documents that Quest Browser sessions run at a high native rate (90 Hz on Quest 2-class Browser; 72 Hz on some Quest devices) and that missing the redraw forces the compositor to invent frames (stutter / side black bars). Browser 16.4+ exposes WebXR frame-rate control: `XRSession.supportedFrameRates` and `XRSession.updateTargetFrameRate` ([Meta: WebXR frame rate](https://developers.meta.com/horizon/documentation/web/webxr-frames/), [MDN `updateTargetFrameRate`](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/updateTargetFrameRate)).

Studio request order on `sessionstart`: **90 if listed, else 72, else the UA default.** Do not call `updateTargetFrameRate(120)` as a requirement. **TODO:** confirm Quest 3 Browser’s advertised `supportedFrameRates` on the current OS/Browser pair for this product (rates vary by runtime).

Leave ~70–80% of the 11.1 ms budget for the app (browser + compositor eat the rest). Author and profile **on the headset**.

## GPU and thermals

Quest 3 is a **mobile tile-based deferred (TBDR)** GPU with a tight thermal envelope. Large triangles that span many tiles, heavy overdraw, and real-time shadow maps are disproportionately expensive ([Meta: WebXR performance best practices](https://developers.meta.com/horizon/documentation/web/webxr-perf-bp/), [workflow](https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/)).

Desktop assumptions that do **not** apply:

- “The GPU can take 2M unique materials if draw calls are instanced”
- Uncapped MSAA + 4K albedos + cascaded shadows
- Path tracing / desktop post stacks
- Ignoring a 10-minute soak because the first minute was green

## Studio checklist (defaults)

These are **studio defaults** for WebXR on Quest 3 — conservative versus Meta’s *native Unity* Quest 3 tables (those quote higher draw-call and triangle bands because they are not the Browser). Meta’s own WebXR pages treat numbers as recommendations, not guarantees; measure.

| Budget | Studio default | Notes |
| --- | --- | --- |
| Draw calls (hero view) | **&lt; ~100** | Merge, instance, fewer materials. Each call has CPU/driver cost independent of triangle count ([Meta workflow](https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/)). |
| Triangles (whole view, per eye) | **&lt; ~750k soft ceiling** | Prefer far lower. Interactive **prop** LOD0: see [photoreal-realtime](../performance/photoreal-realtime.md) (5–20k hero). |
| Textures | **≤ 2048² max; prefer ≤ 1024²** on props | Power-of-two. **KTX2 / Basis** (`KHR_texture_basisu`). **Mipmaps on.** No 4K handheld props. Recipe: [ktx2-quest3-packaging](../performance/ktx2-quest3-packaging.md). |
| FFR | **Medium–high** when available | `XRWebGLLayer.fixedFoveation` in (0, 1]; studio start **0.5–1.0** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/fixedFoveation), [Meta FFR](https://developers.meta.com/horizon/documentation/web/webxr-ffr/)). Three.js: `renderer.xr.setFoveation`. |
| CPU / GC | **No allocations in the XR frame loop** | **Frame-loop allocation scrub:** hoist scratch vectors; no `new THREE.*`, per-frame pick arrays, or `intersectObjects` garbage on the present path. Overlay off must stay one boolean. See `crate-toolbox` v0.8. |
| Present pixel ratio | **1** while XR presenting | Desktop lookdev may use `min(devicePixelRatio, 2)`. Clamp on `sessionstart`; restore + `setSize` on `sessionend`. Not per-frame. See `crate-toolbox` v0.15. |
| Present antialias / MSAA | **Off** while XR presenting | Meta treats MSAA as expensive fill. Three r170 copies constructor `antialias` into `XRWebGLLayer` (immutable context attribute). Start the present-path renderer with `antialias: false`. See `crate-toolbox` v0.16. |
| Present tone mapping | **`NoToneMapping`** while XR presenting | Three r170 applies `renderer.toneMapping` on the output fragment. ACESFilmic is extra ALU on Quest 3 TBDR. Save lookdev ACES + exposure on `sessionstart`; restore on `sessionend`. Not per-frame. See `crate-toolbox` v0.17. |
| Present IBL / environment | **Off** while XR presenting | MeshStandardMaterials sample `scene.environment` every fragment (`USE_ENVMAP`). r170 `environmentIntensity` is a post-sample multiply — intensity 0 does not skip `textureCubeUV`. Null `scene.environment` on `sessionstart`; restore the saved PMREM (do not dispose) on `sessionend`. Not per-frame. See `crate-toolbox` v0.18. |
| Collision | **Simple hulls, not the hero mesh** | [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md) |

**TODO:** confirm draw-call and triangle ceilings on-device for *this* product’s hero scene (Browser version + scene). The 100 / 750k figures are the gate we author to until a measured override is written on the release matrix.

Photoreal **look** at L2/L3 is baked maps + LODs, not raw scan density.

## Session wiring (real APIs)

```js
// After requestSession / Three VRButton sessionstart:
const session = renderer.xr.getSession();
const rates = session.supportedFrameRates ? Array.from(session.supportedFrameRates) : [];
const hz = rates.includes(90) ? 90 : rates.includes(72) ? 72 : null;
if (hz && session.updateTargetFrameRate) {
  session.updateTargetFrameRate(hz); // Promise; ignore rejection
}
if (renderer.xr.setFoveation) renderer.xr.setFoveation(0.75);
renderer.setPixelRatio(1); // v0.15 present-path clamp; restore on sessionend
// v0.16: construct WebGLRenderer({ antialias: false }) so XRWebGLLayer inherits MSAA off.
// Cannot flip antialias on a live context (no setAntialias).
renderer.toneMapping = 0; // v0.17 NoToneMapping while presenting; restore ACES + exposure on sessionend
scene.environment = null; // v0.18 IBL off while presenting; restore saved PMREM + intensity on sessionend
```

`supportedFrameRates` / `updateTargetFrameRate` may be missing on desktop emulators — skip, do not shim fake rates.

## QA

Gate: [quality-bar](../../studio/quality-bar.md) Performance + Interactive assets on **Quest 3 @ 90 Hz** (72 Hz fallback noted, not the happy path). Soak ≥10 minutes. FFR on (medium/high). See [testing](../testing/README.md).

**On-device recording:** [quest-3-on-device-qa](quest-3-on-device-qa.md) — how to read `supportedFrameRates` / `updateTargetFrameRate`, confirm FFR, run the 10 min soak, and fill the blank results table. Numbers stay empty until a human on Quest 3 + Quest Browser writes them. `examples/interactive-prop` **`P`** overlay is the in-page capture (no fabricated rates).

Runnable slice: [`examples/interactive-prop`](../../examples/interactive-prop/) applies the session defaults above.

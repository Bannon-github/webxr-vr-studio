# WebXR VR Studio

A professional knowledge base and playbook for building, shipping, and operating immersive WebXR / VR experiences—emulating the working practices of a productive VR app studio.

This repository is intentionally documentation-first: mental models, stack choices, comfort and presence design, performance budgets, shipping checklists, QA playbooks, and Architecture Decision Records (ADRs). Runnable Vite + Three.js slices live under `examples/` so concepts map to code: a session starter and an interactive photoreal-prop activity.

Agents asked to ship a **Meta Horizon Store** title plug in here first: [interrogation](studio/app-interrogation.md) → [app brief](studio/briefs/_template/) → [store-gate](docs/shipping/horizon-store/) ([ADR 0006](studio/adr/0006-store-gate-before-build.md)). That layer does **not** replace the WebXR playbook; it decides whether the title is hosted WebXR, a WebXR Store PWA, or native Unity/Unreal *before* anyone generates a scaffold. A passed gate is not Meta approval.

> **Maturity:** early / living playbook. Core WebXR Device API guidance is aligned with [MDN WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) and the [Immersive Web](https://immersive-web.github.io/) specs. Treat browser support as non-Baseline and verify on target headsets before shipping.

## Positioning

| Audience | How to use this repo |
| --- | --- |
| Engineers new to WebXR | Start with [fundamentals](docs/fundamentals/), then the [starter](examples/webxr-starter/) |
| Tech leads / staff | [Stack](docs/stack/), [ADRs](studio/adr/), [quality bar](studio/quality-bar.md) |
| Designers / UX | [Design](docs/design/) — comfort, locomotion, spatial UI, a11y, audio, haptics, interactive objects |
| Release / QA | [Shipping](docs/shipping/), [Testing](docs/testing/), [playbook](studio/playbook.md) |
| Agents / new titles | [Interrogation](studio/app-interrogation.md), [briefs](studio/briefs/), [Horizon Store gate](docs/shipping/horizon-store/), [WebXR vs native](docs/shipping/horizon-store/webxr-vs-native.md) |

**What this is not:** a full production engine, a framework fork, a marketplace of assets, or a substitute for [Meta’s live VRC / policy pages](https://developers.meta.com/horizon/resources/publish-quest-req/). Prefer thin, accurate references over encyclopedic fluff.

## Navigation

- docs/fundamentals/ — sessions, spaces, frames, input, layers/FFR
- docs/stack/ — Three.js, Babylon, A-Frame, R3F, WebGPU
- docs/design/ — comfort, locomotion, spatial UI, a11y, audio, haptics, interactive objects
- docs/performance/ — frame budgets, draw calls, textures, foveation, photoreal realtime, [KTX2/Quest 3 packaging](docs/performance/ktx2-quest3-packaging.md)
- docs/shipping/ — device/browser matrix, [Quest 3 gate](docs/shipping/quest-3-target.md), [on-device QA](docs/shipping/quest-3-on-device-qa.md), HTTPS, permissions, [Horizon Store gate](docs/shipping/horizon-store/)
- docs/testing/ — headset + emulator QA
- studio/playbook.md, quality-bar.md, content-pipeline.md, [app-interrogation.md](studio/app-interrogation.md), [briefs](studio/briefs/), [asset-to-interaction-workflow.md](studio/asset-to-interaction-workflow.md), [additive-object-iteration.md](studio/additive-object-iteration.md), adr/
- examples/webxr-starter/ — Vite + Three.js immersive-vr demo
- examples/interactive-prop/ — hover + grab + multi-state PBR crate (visual ≠ collider ≠ behavior)
- assets/objects/ — additive object catalog (`crate-toolbox` seed)
- LEARNING.md, CHANGELOG.md

## Quick start (starter demo)

See examples/webxr-starter/README.md for run steps (install deps, start Vite dev server).

Interactive assets (hover, grab, multi-step activity): [examples/interactive-prop](examples/interactive-prop/) and the [asset-to-interaction workflow](studio/asset-to-interaction-workflow.md). Grow shipped objects additively ([catalog](assets/objects/), [iteration](studio/additive-object-iteration.md)) instead of replacing them.

Use a headset browser or the WebXR API Emulator. Needs HTTPS or localhost and a user gesture to enter immersive VR.

## Principles

1. Comfort over spectacle.
2. Budget the frame (often 72/90 Hz).
3. Real APIs only (MDN / Immersive Web).
4. Ship a named device/browser matrix.
5. Record framework/locomotion/interaction defaults in ADRs.

## License

MIT (see LICENSE) — Copyright Matthew James Bannon

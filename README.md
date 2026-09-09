# WebXR VR Studio

A professional knowledge base and playbook for building, shipping, and operating immersive WebXR / VR experiences—emulating the working practices of a productive VR app studio.

This repository is intentionally documentation-first: mental models, stack choices, comfort and presence design, performance budgets, shipping checklists, QA playbooks, and Architecture Decision Records (ADRs). A small Vite + Three.js immersive-vr starter lives under examples/webxr-starter so concepts map to runnable code.

> **Maturity:** early / living playbook. Core WebXR Device API guidance is aligned with [MDN WebXR](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) and the [Immersive Web](https://immersive-web.github.io/) specs. Treat browser support as non-Baseline and verify on target headsets before shipping.

## Positioning

| Audience | How to use this repo |
| --- | --- |
| Engineers new to WebXR | Start with [fundamentals](docs/fundamentals/), then the [starter](examples/webxr-starter/) |
| Tech leads / staff | [Stack](docs/stack/), [ADRs](studio/adr/), [quality bar](studio/quality-bar.md) |
| Designers / UX | [Design](docs/design/) — comfort, locomotion, spatial UI, a11y, audio, haptics |
| Release / QA | [Shipping](docs/shipping/), [Testing](docs/testing/), [playbook](studio/playbook.md) |

**What this is not:** a full production engine, a framework fork, or a marketplace of assets. Prefer thin, accurate references over encyclopedic fluff.

## Navigation

- docs/fundamentals/ — sessions, spaces, frames, input, layers/FFR
- docs/stack/ — Three.js, Babylon, A-Frame, R3F, WebGPU
- docs/design/ — comfort, locomotion, spatial UI, a11y, audio, haptics
- docs/performance/ — frame budgets, draw calls, textures, foveation
- docs/shipping/ — device/browser matrix, HTTPS, permissions
- docs/testing/ — headset + emulator QA
- studio/playbook.md, quality-bar.md, content-pipeline.md, adr/
- examples/webxr-starter/ — Vite + Three.js immersive-vr demo
- LEARNING.md, CHANGELOG.md

## Quick start (starter demo)

See examples/webxr-starter/README.md for run steps (install deps, start Vite dev server).

Use a headset browser or the WebXR API Emulator. Needs HTTPS or localhost and a user gesture to enter immersive VR.

## Principles

1. Comfort over spectacle.
2. Budget the frame (often 72/90 Hz).
3. Real APIs only (MDN / Immersive Web).
4. Ship a named device/browser matrix.
5. Record framework/locomotion/interaction defaults in ADRs.

## License

MIT (see LICENSE) — Copyright Matthew James Bannon

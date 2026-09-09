# Changelog

All notable changes to this knowledge base are documented here.

## [0.2.0] — 2026-09-09

### Added

- End-to-end [asset-to-interaction workflow](studio/asset-to-interaction-workflow.md): brief, generation paths (scan / AI / DCC), cleanup, glTF packaging, interaction layer, WebXR binding, QA gates
- [ADR 0004](studio/adr/0004-asset-interaction-architecture.md) — glTF 2.0 + `extras.studio` / sidecar behavior metadata, ECS-ish components, visual ≠ collider ≠ behavior
- Design patterns: [interactive-objects.md](docs/design/interactive-objects.md)
- Performance: [photoreal-realtime.md](docs/performance/photoreal-realtime.md)
- [examples/interactive-prop](examples/interactive-prop/) — PBR crate with hover, grab/throw, latch→lid activity, optional hand pinch
- Quality-bar **Interactive assets** section; content-pipeline now points at the full workflow

### Changed

- README, LEARNING, playbook, design/performance indexes, ADR index, content-pipeline budgets aligned with the interactive-prop path

## [0.1.0] — 2026-09-08

### Added

- Initial WebXR / VR studio knowledge base structure
- Fundamentals: sessions, input sources, reference spaces, frames, layers / FFR
- Stack guidance: Three.js, Babylon.js, A-Frame, React Three Fiber, WebGPU
- Design: comfort, locomotion, spatial UI, accessibility, audio, haptics, presence
- Performance budgets and profiling checklist
- Shipping matrix, HTTPS / permissions, distribution notes
- Headset + emulator testing playbook
- Studio playbook, quality bar, content pipeline
- ADRs 0001-0003 (framework, locomotion, interaction)
- examples/webxr-starter Vite + Three.js immersive-vr demo
- LEARNING.md, MIT license, Node/Vite .gitignore

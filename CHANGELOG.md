# Changelog

All notable changes to this knowledge base are documented here.

## [0.12.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.10.0** Quest 3 shipping/a11y gate: tracking-loss / null-pose safe release in `examples/interactive-prop` (held crate or tool `endGrab` on null grip/ray/joint pose or removed input source). Same L0–L5. v0.8 allocation scrub and v0.9 hand hover kept. Headset ms / FFR still unmeasured.

## [0.11.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.9.0** Quest 3 shipping/input-parity gate: bare-hand hover before pinch in `examples/interactive-prop` (controllers still win on a ray hit). Same L0–L5. v0.8 allocation scrub kept. Headset ms / FFR still unmeasured.

## [0.10.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.8.0** Quest 3 shipping/perf gate: XR frame-loop allocation scrub in `examples/interactive-prop` (reused pick list, AABB first-hit, pose-history ring). Same L0–L5. Draws unchanged. Headset ms / FFR still unmeasured.

## [0.9.0] — 2026-09-09

### Added

- [Quest 3 KTX2/Basis packaging](docs/performance/ktx2-quest3-packaging.md) — `gltf-transform` recipe (cap ≤1024², UASTC/ETC1S, meshopt). `crate-toolbox` **v0.7.0** probes `/packaged/crate-toolbox.glb` and falls back to procedural canvases. No invented GLB or headset ms.

## [0.8.0] — 2026-09-09

### Changed

- `crate-toolbox` **v0.6.0** L2 quality UPGRADE: shared procedural 512² albedo + ORM (wood / brass / steel). Same draws as v0.5.0. KTX2/Basis deferred until a DCC GLB. Headset ms still unmeasured.

## [0.7.0] — 2026-09-09

### Added

- [Quest 3 on-device QA](docs/shipping/quest-3-on-device-qa.md) — checklist + blank results table for Browser / firmware / SHA / Hz / FFR / soak. `examples/interactive-prop` **P** overlay. `crate-toolbox` **v0.5.0** (same L0–L5; headset ms still unmeasured).

## [0.6.0] — 2026-09-09

### Added

- `crate-toolbox` **v0.4.0** L5: re-latch cancel, tool grab only when open, drive front fastener (4 turns), snap-return, `feedback` → `hapticActuators.pulse` when present. LOD set unchanged. Quest 3 frame time still TODO.

## [0.5.0] — 2026-09-09

### Added

- `crate-toolbox` **v0.3.0** L3 pulse: procedural LOD1/LOD2 (96/24 tris) beside LOD0 (240); distance + key switch in `examples/interactive-prop`. Geometry counts only — Quest 3 frame time still TODO.

## [0.4.0] — 2026-09-09

### Added

- [Quest 3 gate](docs/shipping/quest-3-target.md) — 90 Hz ship / 72 Hz fallback / 120 Hz stretch; TBDR + thermal; studio draw/tri/texture/FFR checklist (Meta WebXR + MDN cites; TODOs for on-device confirm)
- Manifest `targetDevice` + `perf` on the catalog template and `crate-toolbox` v0.2.1
- `examples/interactive-prop` requests 90 Hz and FFR 0.75 on `sessionstart` when the UA exposes the APIs

### Changed

- Quality bar, additive L2/L3, asset workflow, content-pipeline, photoreal-realtime, shipping matrix, and testing soak now gate on Quest 3 @ 90 Hz (not a desktop GPU). 207/240 Hz out of scope.

## [0.3.0] — 2026-09-09

### Added

- [Additive object iteration](studio/additive-object-iteration.md) — stable `objectId`, UPGRADE / variant / NEW tree, L0–L5 stack, revision retention, two-hour pulse
- [ADR 0005](studio/adr/0005-additive-object-evolution.md) — layered manifests + keep prior revisions
- Object catalog [`assets/objects/`](assets/objects/) with `_template/` and seed [`crate-toolbox`](assets/objects/crate-toolbox/) (v0.1 → v0.2 additive notes)

### Changed

- Workflow, content-pipeline, playbook, and README point at the catalog instead of one-off replace-in-place folders

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

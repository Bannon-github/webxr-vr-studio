# Changelog

All notable changes to this knowledge base are documented here.

## [0.32.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.30.0** L3 packaging/perf UPGRADE: LOD1 mid body / lid / latch / tool stub drop the albedo `map` and use color-only unlit `MeshBasicMaterial` (wood midtone `0x633318`, brass midtone `0xBE7E31`). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD2 stays color-only MeshBasic (v0.29). Unique canvases 11 → 9. Same draws / tris as v0.29. Headset ms / FFR still unmeasured.

## [0.31.0] — 2026-09-13

### Changed

- `crate-toolbox` **v0.29.0** L3 packaging/perf UPGRADE: LOD2 far body + lid drop the albedo `map` and use color-only unlit `MeshBasicMaterial` (wood midtone `0x633318`). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD1 stays 256² MeshBasic (v0.28). Unique canvases stay 11. Same draws / tris as v0.28. Headset ms / FFR still unmeasured.

## [0.30.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.28.0** L3 packaging/perf UPGRADE: LOD1 body / lid / latch / tool stub switch from albedo-only `MeshStandardMaterial` to unlit `MeshBasicMaterial` with the same 256² wood / brass albedos (no roughness/metalness uniforms). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD2 stays 256² MeshBasic (v0.27). Unique canvases stay 11. Same draws / tris as v0.27. Headset ms / FFR still unmeasured.

## [0.29.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.27.0** L3 packaging/perf UPGRADE: LOD2 far body + lid switch from albedo-only `MeshStandardMaterial` to unlit `MeshBasicMaterial` with the same 256² wood albedo (no roughness/metalness uniforms). LOD0 stays 512² albedo+ORM+normal MeshStandard; LOD1 stays 256² albedo-only MeshStandard (v0.26). Unique canvases stay 11. Same draws / tris as v0.26. Headset ms / FFR still unmeasured.

## [0.28.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.26.0** L3 packaging/perf UPGRADE: LOD1 and LOD2 procedural materials bind half-resolution (256²) albedo maps instead of the shared 512² L2 albedos. LOD0 stays 512² albedo+ORM+normal at full modest `normalScale`; mid/far stay albedo-only (v0.25 constants). Unique canvases 9 → 11 (extra 256² wood/brass albedos). Same draws / tris as v0.25. Headset ms / FFR still unmeasured.

## [0.27.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.25.0** L3 packaging/perf UPGRADE: LOD1 visual materials omit packed ORM (`roughnessMap`/`metalnessMap`) and use constant wood-ORM-midtone roughness 220/255 + metalness 8/255 (wood/handle) and brass-ORM-midtone roughness 95/255 + metalness 230/255 (latch). LOD0 stays albedo+ORM+normal at full modest `normalScale`; LOD2 stays albedo-only (v0.23). Same draws / tris / 9 canvases as v0.24. Headset ms / FFR still unmeasured.

## [0.26.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.24.0** L3 packaging/perf UPGRADE: LOD1 visual materials omit `normalMap` (keep albedo + packed ORM). LOD0 stays albedo+ORM+normal at full modest `normalScale`; LOD2 stays albedo-only (v0.23). Same draws / tris / 9 canvases as v0.23. Headset ms / FFR still unmeasured.

## [0.25.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.23.0** L3 packaging/perf UPGRADE: LOD2 visual materials omit packed ORM (`roughnessMap`/`metalnessMap`) and use constant wood-ORM-midtone roughness 220/255 + metalness 8/255 (albedo-only far crate + lid). LOD0/1 keep albedo+ORM+normal (LOD1 half `normalScale`). Same draws / tris / 9 canvases as v0.22. Headset ms / FFR still unmeasured.

## [0.24.0] — 2026-09-12

### Changed

- `crate-toolbox` **v0.22.0** Quest 3 shipping/perf gate: present-path XR framebuffer scale factor clamp to 1 in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off + v0.20 ambient-only fill + v0.21 anisotropy clamp; save last-set / lookdev default, `setFramebufferScaleFactor(1)`; r170 has no getter and cannot rebuild the current layer while presenting — also set 1 at renderer setup; restore lookdev scale on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.23.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.21.0** Quest 3 shipping/perf gate: present-path texture anisotropy clamp to 1 in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off + v0.20 ambient-only fill; walk toolbox / scene maps, save `.anisotropy`, write 1; restore lookdev anisotropy on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.22.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.20.0** Quest 3 shipping/perf gate: present-path ambient-only fill (HemisphereLight off + one `AmbientLight` at intensity 0.4) in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off; hemi `visible = false` + intensity 0; restore lookdev hemi and disable/detach the present-only ambient on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.21.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.19.0** Quest 3 shipping/perf gate: present-path directional / punctual light off (hemisphere-only) in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off; `sun.visible = false` + intensity 0; restore lookdev visible + intensity on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.20.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.18.0** Quest 3 shipping/perf gate: present-path IBL / `scene.environment` off in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify + v0.17 NoToneMapping; null `scene.environment` + intensity 0; restore the saved PMREM + lookdev intensity on `sessionend`, do not dispose). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.19.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.17.0** Quest 3 shipping/perf gate: present-path `NoToneMapping` in `examples/interactive-prop` (`sessionstart` after 90/72 + FFR + v0.15 pixel-ratio clamp + v0.16 MSAA-off verify; restore lookdev `ACESFilmicToneMapping` + prior `toneMappingExposure` on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.18.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.16.0** Quest 3 shipping/perf gate: present-path WebGL antialias / MSAA off in `examples/interactive-prop` (constructor `antialias: false` so Three r170 `XRWebGLLayer` inherits MSAA off; session helpers verify after 90/72 + FFR + v0.15 pixel-ratio clamp). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.17.0] — 2026-09-11

### Changed

- `crate-toolbox` **v0.15.0** Quest 3 shipping/perf gate: present-path WebGL pixel-ratio clamp in `examples/interactive-prop` (`setPixelRatio(1)` on `sessionstart` after 90/72 + FFR 0.75; restore saved desktop ratio + `setSize` on `sessionend`). Same L0–L5. Draws / tris unchanged. Headset ms / FFR still unmeasured.

## [0.16.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.14.0** L3 packaging/perf UPGRADE: LOD1 visual materials keep `normalMap` at half LOD0 `normalScale` (`L3_LOD1_NORMAL_SCALE_MUL` = 0.5). LOD0 stays full v0.12 scale; LOD2 still omits `normalMap`. Same draws / tris / 9 canvases as v0.13. Headset ms / FFR still unmeasured.

## [0.15.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.13.0** L3 packaging/perf UPGRADE: LOD2 visual materials omit `normalMap` (cheaper far fragments after the v0.12 normal pass). LOD0/1 keep shared v0.12 normals. Same draws / tris as v0.12. Headset ms / FFR still unmeasured.

## [0.14.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.12.0** L2 quality UPGRADE: shared procedural 512² normal maps (wood / brass / steel) on `MeshStandardMaterial.normalMap`. Same draws / tris as v0.11. 9 unique canvases (albedo + ORM + normal). Headset ms / FFR still unmeasured.

## [0.13.0] — 2026-09-10

### Changed

- `crate-toolbox` **v0.11.0** Quest 3 shipping/a11y gate: visibility-loss safe release in `examples/interactive-prop` (held crate or tool `endGrab` when `XRSession.visibilityState` is `hidden` / `visible-blurred`, or `document.hidden` while presenting; no auto-regrab on restore). Same L0–L5. v0.8 allocation scrub, v0.9 hand hover, and v0.10 tracking-loss kept. Headset ms / FFR still unmeasured.

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

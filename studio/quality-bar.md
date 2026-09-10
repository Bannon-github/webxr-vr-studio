# Quality bar — definition of done

An immersive feature or release is **done** only when all applicable boxes pass.

**Gate device:** Meta Quest 3 + Meta Quest Browser @ **90 Hz** (72 Hz fallback). Details and studio budgets: [quest-3-target](../docs/shipping/quest-3-target.md). Desktop/emulator is smoke, not the gate. 120 Hz is stretch; 207/240 Hz is out of scope.

## XR correctness

- [ ] Secure context verified on headset URL
- [ ] isSessionSupported gates the Enter VR CTA
- [ ] requestSession only on user gesture
- [ ] Tracking loss handled (null poses) (`crate-toolbox` v0.10: held crate/tool `endGrab` on null grip/ray/joint pose or removed input source)
- [ ] Session end restores 2D UI; re-entry works
- [ ] Controllers: rays, select, squeeze as designed
- [ ] Reference space fallback chain works

## Comfort

- [ ] Default locomotion is Tier A (or justified ADR exception)
- [ ] Settings expose turn and loco preferences
- [ ] Comfort-sensitive tester signed off
- [ ] No forced artificial pitch

## Performance

- [ ] Quest 3 holds **90 Hz** in the hero scene (≈11.1 ms); 72 Hz is a recorded fallback, not the happy path ([quest-3-target](../docs/shipping/quest-3-target.md))
- [ ] Thermal soak 10+ minutes on Quest 3 without collapse
- [ ] Hero view: draw calls ≲100; triangles ≲750k/eye soft ceiling; props prefer ≤1024² (max 2048²); KTX2 + mipmaps ([ktx2-quest3-packaging](../docs/performance/ktx2-quest3-packaging.md))
- [ ] FFR medium/high (`fixedFoveation` ≈0.5–1) when the UA exposes it
- [ ] No allocations / `new` in the XR frame loop (**frame-loop allocation scrub**: hoist scratch vectors; no per-frame arrays or `new THREE.*` on the present path when diagnostics are off — `crate-toolbox` v0.8)
- [ ] Texture/draw/tri budgets written on the object manifest `perf` block
- [ ] On-device matrix filled per [quest-3-on-device-qa](../docs/shipping/quest-3-on-device-qa.md) (Browser, firmware, SHA, requested Hz, FFR, method). Leave cells blank until a headset run — do not invent ms.

## Interactive assets

Applies when the user hovers, grabs, or drives a multi-step activity. Full path: [asset-to-interaction-workflow.md](asset-to-interaction-workflow.md). Architecture: [ADR 0004](adr/0004-asset-interaction-architecture.md).

- [ ] Visual mesh is not the grab/ray target (separate `collider_*` hulls)
- [ ] Hover / pressed / disabled / grabbed affordances readable under FFR
- [ ] Activity states named; illegal transitions nack; drop does not soft-lock
- [ ] Controllers: `select` = use, `squeeze` = grab; core loop works without hands
- [ ] Hand path (if advertised) is optional; pinch maps to the same intents; hover-before-pinch matches controller emissive (`crate-toolbox` v0.9)
- [ ] Texture / LOD / triangle class meets [photoreal-realtime](../docs/performance/photoreal-realtime.md) **on Quest 3** (L2/L3 inside [quest-3-target](../docs/shipping/quest-3-target.md); baked maps + LODs, not scan density)
- [ ] Scale 1 unit = 1 m; seated reach or ray-use for every required step
- [ ] Throw / physics never applies impulse to the camera rig
- [ ] State change is visual + audio and/or haptic; not audio-only
- [ ] Sidecar or `extras.studio` ingest validated (glTF Validator + behavior sanity)

## A11y / UX

- [ ] Seated mode viable
- [ ] Critical info not audio-only
- [ ] Recenter / height adjustment available

## Shipping

- [ ] Device/browser matrix updated
- [ ] CHANGELOG entry
- [ ] Known issues listed in release notes

# Quality bar — definition of done

An immersive feature or release is **done** only when all applicable boxes pass.

## XR correctness

- [ ] Secure context verified on headset URL
- [ ] isSessionSupported gates the Enter VR CTA
- [ ] requestSession only on user gesture
- [ ] Tracking loss handled (null poses)
- [ ] Session end restores 2D UI; re-entry works
- [ ] Controllers: rays, select, squeeze as designed
- [ ] Reference space fallback chain works

## Comfort

- [ ] Default locomotion is Tier A (or justified ADR exception)
- [ ] Settings expose turn and loco preferences
- [ ] Comfort-sensitive tester signed off
- [ ] No forced artificial pitch

## Performance

- [ ] Holds target Hz on lowest tier device in hero scene
- [ ] Thermal soak 10+ minutes without collapse
- [ ] Texture/draw budgets documented

## Interactive assets

Applies when the user hovers, grabs, or drives a multi-step activity. Full path: [asset-to-interaction-workflow.md](asset-to-interaction-workflow.md). Architecture: [ADR 0004](adr/0004-asset-interaction-architecture.md).

- [ ] Visual mesh is not the grab/ray target (separate `collider_*` hulls)
- [ ] Hover / pressed / disabled / grabbed affordances readable under FFR
- [ ] Activity states named; illegal transitions nack; drop does not soft-lock
- [ ] Controllers: `select` = use, `squeeze` = grab; core loop works without hands
- [ ] Hand path (if advertised) is optional; pinch maps to the same intents
- [ ] Texture / LOD / triangle class meets [photoreal-realtime](../docs/performance/photoreal-realtime.md) on the lowest-tier device
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

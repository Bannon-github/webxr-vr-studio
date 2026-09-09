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

## A11y / UX

- [ ] Seated mode viable
- [ ] Critical info not audio-only
- [ ] Recenter / height adjustment available

## Shipping

- [ ] Device/browser matrix updated
- [ ] CHANGELOG entry
- [ ] Known issues listed in release notes

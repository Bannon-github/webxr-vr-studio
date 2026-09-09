# Design for comfort, presence, and accessibility

Immersive VR fails if users feel sick, lost, or excluded. This section is mandatory reading before locomotion or camera work ships.

## Contents

- comfort.md — VOR, acceleration, FOV effects, comfort tiers
- locomotion.md — teleport, dash, continuous; studio defaults
- spatial-ui.md — readable panels, diegetic vs HUD, laser UI
- accessibility.md — seated mode, IPD/height, captions, alternatives
- audio-haptics-presence.md — spatial audio, haptics, presence cues

## Non-negotiables

1. Never move the camera unexpectedly without a comfort affordance.
2. Provide a seated / static locomotion mode.
3. Keep critical text in a readable angular size; avoid peripheral-only instructions.
4. Respect personal space; snap or fade rather than collide the camera through geometry.
5. Test with comfort-sensitive users before release.

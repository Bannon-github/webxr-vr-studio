# Audio, haptics, and presence

## Spatial audio

- Use HRTF / PannerNode or engine spatial audio attached to objects.
- Footsteps and ambient beds stabilize presence; duck SFX under dialogue.
- Do not put critical information in audio only — pair with visuals/captions.

## Haptics

- Pulse on select / squeeze / collisions via gamepad haptic actuators when available.
- Keep patterns short; avoid sustained buzz.
- Degrade gracefully when actuators are missing.

## Presence cues

- Accurate 1:1 head and hand tracking representation
- Soft contact shadows / grounding
- Consistent lighting and scale (1 unit = 1 meter)
- Avoid uncanny idle animations on avatars in social contexts
- Smooth controller model transitions on inputsourceschange

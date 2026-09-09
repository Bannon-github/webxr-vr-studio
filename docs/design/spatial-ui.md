# Spatial UI

## Principles

- Prefer world-anchored or hand-anchored panels over head-locked HUDs (head-locked causes strain).
- Angular size matters more than pixel size — keep body text roughly readable at ~0.5–1 m virtual distance.
- High contrast; avoid thin fonts; test with FFR enabled (edges get softer).
- Laser + cursor from targetRaySpace; provide sphere-cast fallback for grab.
- Diegetic controls (physical-feeling buttons) when they improve presence and discoverability.

## Interaction targets

- Minimum comfortable target angular size; leave gaps between buttons.
- Affordance states: idle / hover / pressed / disabled with visual + audio + haptic when possible.
- Confirm destructive actions with a second gesture, not a tiny checkbox.

## Menus

- Follow the user lazily (leash) rather than hard head-lock.
- Pause world simulation when system menus open if gameplay requires it.

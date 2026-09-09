# Comfort

## Vestibular mismatch

Visual motion without matching vestibular input causes sickness. Highest risk: artificial rotational acceleration, bobbing cameras, horizon tilt, unexpected teleports without fade.

## Comfort tiers (studio)

| Tier | Allowed |
| --- | --- |
| A (default) | Blink/fade teleport, snap turn (15–45 deg), static seated, vignette on move |
| B | Smooth turn at user-selected slow rate; short dash with vignette |
| C (opt-in) | Continuous locomotion + smooth turn; require explicit comfort disclaimer |

Users pick a tier on first run; store preference.

## Mitigations

- FOV vignette during non-1:1 motion
- Fixed reference objects (cockpit, nose, horizon line) when thematically OK
- Avoid simultaneous pitch + yaw artificial motion
- Cap acceleration; prefer constant velocity then hard stop with fade
- Maintain stable world horizon

## Frame rate

Dropped frames amplify sickness. Comfort depends on performance budgets (docs/performance).

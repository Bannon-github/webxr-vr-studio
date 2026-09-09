# ADR 0002 — Default locomotion

- Status: Accepted
- Date: 2026-09-08

## Context

Artificial locomotion is the top comfort risk. We need a default that ships safely while allowing power-user options.

## Decision

1. **Default (Comfort Tier A):** blink/fade teleport + snap turn (30° default, user selectable 15–45°).
2. **Optional Tier B:** dash + slow smooth turn.
3. **Opt-in Tier C:** continuous thumbstick locomotion + smooth turn, disabled until the user enables it in settings with a short comfort note.
4. Player rig offset is applied in reference space; camera remains viewer pose from WebXR.
5. Recenter control always available.

## Consequences

- All templates implement teleport before smooth loco.
- QA comfort sign-off required to change defaults.
- Bounded spaces use boundsGeometry when present.

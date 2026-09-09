# Locomotion

See also ADR 0002.

## Patterns

1. **Teleport / blink** — arc or point select; brief fade; move player rig. Highest comfort.
2. **Dash** — short continuous burst along a path with vignette.
3. **Continuous (smooth loco)** — thumbstick translate in horizontal plane; optional head or controller oriented.
4. **Room-scale** — trust tracking; artificial loco only beyond guardian/bounds.
5. **Vehicle / cockpit** — user is seated; world moves relative to a rig with strong frame of reference.

## Implementation notes

- Separate **camera (viewer)** from **player rig** offset in the reference space.
- Apply locomotion to the rig, not by rewriting projection matrices.
- Recenter: reset yaw/position offset via an in-app control and/or runtime recenter.
- Respect XRBoundedReferenceSpace.boundsGeometry when present.

## Defaults

Tier A: teleport + snap turn. Continuous loco is opt-in Tier C.

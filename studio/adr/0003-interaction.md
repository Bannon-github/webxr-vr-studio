# ADR 0003 — Default interaction model

- Status: Accepted
- Date: 2026-09-08

## Context

Controllers, hands, and UX metaphors vary by device. We need a predictable interaction contract.

## Decision

1. **Primary:** tracked-pointer rays from XRInputSource.targetRaySpace with a visible laser + reticle.
2. **Activate:** XRSession select events for primary press; squeeze for grab when available.
3. **Near grab:** when gripSpace is near a grabbable collider, prefer direct grab over ray (hybrid).
4. **Hands:** optional enhancement when hand-tracking feature granted; do not require hands for core loops.
5. **Fallback:** gaze + select (or screen mode) only for accessibility / non-pointer devices.
6. Prefer profiles[] to pick controller meshes; generic model otherwise.
7. Every interactive target exposes hover / pressed / disabled visuals plus optional audio/haptic pulse.

## Consequences

- Shared input module normalizes select/squeeze and gamepad axes.
- UI kits assume ray + reticle; diegetic widgets still implement the same state machine.
- Hand-only demos are labeled experimental until matrix coverage exists.

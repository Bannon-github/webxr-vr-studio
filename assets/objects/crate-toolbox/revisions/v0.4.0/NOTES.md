# crate-toolbox v0.4.0

L5 on the same `objectId`. No GLB.

- Cancel: `unlatched` + `collider_latch` → `closed` (lid never opened).
- Tool grab only when `open` (`collider_tool.pickable`).
- Drive: `collider_fastener` while tool held/out; 4 turns then seated. Visual is one brass box (+12 tris).
- Return: snap if released within 0.2 m of the rest slot and crate is `open`. Desktop `T` force-returns from any distance.
- Feedback table drives `hapticActuators.pulse` when the XR gamepad exposes it.

LOD switch and hull names are the v0.3.0 set.

# Brief — crate-toolbox

- **Photoreal target:** Worn wooden crate, brass latch, steel screwdriver; arm’s-length product shot. Runtime is a PBR stand-in: **512² procedural albedo + ORM** (wood / brass / steel) + IBL. Not a DCC bake. **KTX2 / Basis** is the next packaging step when a GLB lands.
- **Affordance class:** Open-latch (multi-stage). Grab the body; use latch then lid.
- **Named states:** `closed` → `unlatched` → `open` (unlatched + latch cancels). Fastener progress is L5, not a fourth box state.
- **Grab vs use parts:** `collider_grab` (body), `collider_latch` / `collider_lid` (use), `collider_tool` (grab, only when `open`), `collider_fastener` (use while tool held/out)
- **layerTarget:** L5 (physics hull + throw already kinematic in the example; hands optional)
- **Gate:** Quest 3 @ 90 Hz ([quest-3-target](../../docs/shipping/quest-3-target.md)); `perf` on the manifest. L3 LODs: 240 / 96 / 24 tris (geometry counts). Headset frame time / FFR still unmeasured — fill [quest-3-on-device-qa](../../docs/shipping/quest-3-on-device-qa.md).
- **NEW vs UPGRADE:** Seed object. Further cycles UPGRADE this id unless topology or affordance class changes.

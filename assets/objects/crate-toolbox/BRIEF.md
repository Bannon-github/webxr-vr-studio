# Brief — crate-toolbox

- **Photoreal target:** Worn wooden crate, brass latch, steel screwdriver; arm’s-length product shot. Runtime is a PBR stand-in: **512² procedural albedo + ORM** + IBL, unless a packaged GLB is present at the probed URL. Packaging recipe: [ktx2-quest3-packaging](../../docs/performance/ktx2-quest3-packaging.md).
- **Affordance class:** Open-latch (multi-stage). Grab the body; use latch then lid.
- **Named states:** `closed` → `unlatched` → `open` (unlatched + latch cancels). Fastener progress is L5, not a fourth box state.
- **Grab vs use parts:** `collider_grab` (body), `collider_latch` / `collider_lid` (use), `collider_tool` (grab, only when `open`), `collider_fastener` (use while tool held/out)
- **layerTarget:** L5 (physics hull + throw already kinematic in the example; hands optional)
- **Gate:** Quest 3 @ 90 Hz ([quest-3-target](../../docs/shipping/quest-3-target.md)); `perf` on the manifest. L3 LODs: 240 / 96 / 24 tris (geometry counts). v0.8: frame-loop allocation scrub (no per-frame `new` on the XR path when `P` is off). v0.9: hand hover-before-pinch (controllers win on a ray hit). v0.10: tracking-loss / null-pose `endGrab` (crate or tool). Headset frame time / FFR still unmeasured — fill [quest-3-on-device-qa](../../docs/shipping/quest-3-on-device-qa.md).
- **NEW vs UPGRADE:** Seed object. Further cycles UPGRADE this id unless topology or affordance class changes.

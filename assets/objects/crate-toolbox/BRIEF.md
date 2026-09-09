# Brief — crate-toolbox

- **Photoreal target:** Worn wooden crate, brass latch, steel screwdriver; arm’s-length product shot. Runtime is a PBR stand-in (IBL + `MeshStandardMaterial`) until a DCC GLB lands.
- **Affordance class:** Open-latch (multi-stage). Grab the body; use latch then lid.
- **Named states:** `closed` → `unlatched` → `open`
- **Grab vs use parts:** `collider_grab` (body), `collider_latch` / `collider_lid` (use), `collider_tool` (grab, only when `open`)
- **layerTarget:** L5 (physics hull + throw already kinematic in the example; hands optional)
- **NEW vs UPGRADE:** Seed object. Further cycles UPGRADE this id unless topology or affordance class changes.

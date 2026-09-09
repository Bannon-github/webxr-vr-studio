# interactive-prop

Vite + Three.js demo of a **photoreal-looking PBR crate** with hover, grab/throw, and a multi-state open activity. Companion to the WebXR VR Studio playbook — specifically [asset-to-interaction-workflow](../../studio/asset-to-interaction-workflow.md), [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md), and [interactive-objects](../../docs/design/interactive-objects.md).

Meshes here are **procedural stand-ins** (wood / brass / steel + IBL) for catalog object [`crate-toolbox`](../../assets/objects/crate-toolbox/) (v0.3.0, `targetDevice: quest3`). LOD0/1/2 are additive visual sets (only one draws). Later DCC GLBs UPGRADE that id ([additive iteration](../../studio/additive-object-iteration.md)); they do not replace it with a new folder. Visual mesh ≠ collider ≠ behavior.

## Run

1. `cd` into this directory
2. Install Node dependencies (see package.json)
3. Start Vite with the `dev` script (HTTPS on port **5174**)
4. Open the printed HTTPS URL on desktop or Quest Browser
5. Accept the self-signed certificate warning in development
6. Click Enter VR (user gesture) or use the desktop pointer path below

Vite uses HTTPS and host binding so a headset on LAN gets a secure context. Desktop localhost is also a secure context.

### Desktop without a headset

Use the WebXR API Emulator, **or** stay in inline view:

- Mouse hover highlights the part under the ray (collider, not the hero mesh)
- Click the **latch** then the **lid** to drive `closed` → `unlatched` → `open`
- Drag the crate (grab hull) to move it on the table
- Click the dark **reset** plate, or press `R`
- Press `C` to draw collider wireframes
- Press `0` for auto LOD (distance); `1` / `2` / `3` force LOD0 / LOD1 / LOD2 — HUD shows tris/draws. Latch/lid/tool still use the same hulls.

### Production preview

Use the `build` and `preview` scripts in package.json.

## What it demonstrates

| Concern | Implementation |
| --- | --- |
| Photoreal-ish look | `MeshStandardMaterial` + `RoomEnvironment` PMREM, `SRGBColorSpace`, ACES tone mapping |
| Visual vs collider | `collider_grab` / `collider_latch` / `collider_lid` / `collider_tool` — raycasts hit these only |
| Behavior metadata | [`src/behavior.json`](src/behavior.json) matches ADR 0004; cloned onto `userData.studio` |
| Hover | Local emissive on the *part*, not an unlit hero tint |
| Use | WebXR `select` (Three `selectstart` on the target-ray controller) |
| Grab / throw | WebXR `squeeze` attaches to `getControllerGrip` (`gripSpace`); release samples recent poses and applies a clamped kinematic velocity — **not** to the camera |
| Multi-state activity | `closed` --use latch--> `unlatched` --use lid--> `open`; illegal transitions nack |
| Contents gating | Tool collider is unpickable until `open` |
| Hands (optional) | `requestSession` `optionalFeatures: ["hand-tracking"]`; pinch measured on `XRHand` joints `thumb-tip` / `index-finger-tip`. Core loop does not require hands. |
| Feedback | Short Web Audio ticks + `gamepad.hapticActuators.pulse` when the source exposes it |
| Quest 3 session | On `sessionstart`: `updateTargetFrameRate(90)` if listed, else 72; `renderer.xr.setFoveation(0.75)`. No 120/207/240 requirement. |
| L3 LODs | LOD0 240 tris / 14 draws; LOD1 96 / 8; LOD2 24 / 2 (Three.js index counts). Auto switch 2.4 m / 4.5 m. Colliders are not LOD meshes. |

## Activity table

Copied from the sidecar (intents, not buttons):

| From | Intent | Collider | To |
| --- | --- | --- | --- |
| closed | use | collider_latch | unlatched |
| unlatched | use | collider_lid or collider_latch | open |
| open | use | collider_lid | closed |

Grab uses `collider_grab` (crate) or `collider_tool` (screwdriver, only when open).

## Notes

- Prefer `local-floor` on device; Three `WebXRManager` negotiates available spaces. `hand-tracking` is optional and must not gate the activity ([ADR 0003](../../studio/adr/0003-interaction.md)).
- Physics in this demo is a tiny kinematic integrator so the example has no WASM engine. Products should bind the `physics` component to a real hull solver ([ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md)).
- Comfort defaults: [ADR 0002](../../studio/adr/0002-locomotion.md) (this demo has no artificial locomotion).
- QA checklist: [quality-bar](../../studio/quality-bar.md) on [Quest 3](../../docs/shipping/quest-3-target.md) @ 90 Hz.
- **TODO:** confirm `supportedFrameRates` and FFR readability on a physical Quest 3 (this cloud environment has no headset).

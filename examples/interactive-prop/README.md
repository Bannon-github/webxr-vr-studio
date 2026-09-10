# interactive-prop

Vite + Three.js demo of a **photoreal-looking PBR crate** with hover, grab/throw, and a multi-state open activity. Companion to the WebXR VR Studio playbook — specifically [asset-to-interaction-workflow](../../studio/asset-to-interaction-workflow.md), [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md), and [interactive-objects](../../docs/design/interactive-objects.md).

Meshes here are **procedural stand-ins** (512² albedo + ORM + normal for wood / brass / steel + IBL) for catalog object [`crate-toolbox`](../../assets/objects/crate-toolbox/) (v0.14.0, `targetDevice: quest3`). Drop a KTX2/meshopt GLB at [`public/packaged/crate-toolbox.glb`](public/packaged/) (or `?packaged=`) and the loader prefers it; 404 keeps canvases. Recipe: [ktx2-quest3-packaging](../../docs/performance/ktx2-quest3-packaging.md). LOD0/1/2 are additive visual sets (only one draws). L5 adds tool-drive + re-latch cancel. Visual mesh ≠ collider ≠ behavior. v0.8 scrubs per-frame allocations on the XR animation path (overlay off). v0.9 adds bare-hand hover before pinch. v0.10 releases a held crate or tool via `endGrab` when the grip/ray/wrist pose is null or the holding input source is removed. v0.11 releases the same way when the XR session or page loses visibility (`hidden` / `visible-blurred`, or `document.hidden` while presenting); restore does not auto-regrab. v0.12 adds shared 512² normal maps on the procedural materials (no extra draws). v0.13: LOD2 drops `normalMap`. v0.14: LOD1 keeps `normalMap` at half LOD0 `normalScale` (`L3_LOD1_NORMAL_SCALE_MUL` = 0.5); LOD0 stays full scale.

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
- Click the **latch** (`unlatched`); click latch again to **cancel** back to `closed`, or click the **lid** to `open`
- Drag the **tool** out (only when open; the tool hull wins over the body grab). Desktop `E` extracts to the table. Click the front **fastener** (4 turns → seated). Drop near the crate or press `T` to return
- Drag the crate (grab hull) to move it on the table
- Click the dark **reset** plate, or press `R`
- Press `C` to draw collider wireframes
- Press `P` (or the HUD button) for the Quest 3 diagnostics overlay: supported/requested Hz and FFR when the UA exposes them; approximate rAF Δ (not headset compositor). Overlay off does not sample. [On-device QA](../../docs/shipping/quest-3-on-device-qa.md) — matrix still blank.
- Press `0` for auto LOD (distance); `1` / `2` / `3` force LOD0 / LOD1 / LOD2 — HUD shows tris/draws. Latch/lid/tool still use the same hulls.

### Production preview

Use the `build` and `preview` scripts in package.json.

## What it demonstrates

| Concern | Implementation |
| --- | --- |
| Photoreal-ish look | Shared `MeshStandardMaterial`s + 512² procedural albedo/ORM/normal + IBL on LOD0 (full `normalScale`); LOD1 uses the same maps at half `normalScale`; LOD2 uses albedo+ORM only. Or a probed KTX2 GLB when present. Not 4K. |
| Visual vs collider | `collider_grab` / `collider_latch` / `collider_lid` / `collider_tool` / `collider_fastener` — raycasts hit these only |
| Behavior metadata | [`src/behavior.json`](src/behavior.json) matches ADR 0004; cloned onto `userData.studio` |
| Hover | Local emissive on the *part*, not an unlit hero tint |
| Use | WebXR `select` (Three `selectstart` on the target-ray controller) |
| Grab / throw | WebXR `squeeze` attaches to `getControllerGrip` (`gripSpace`); release samples recent poses and applies a clamped kinematic velocity — **not** to the camera. v0.10: null `getPose` / removed source uses the same `endGrab`. v0.11: session/page visibility loss uses the same `endGrab`; no auto-regrab |
| Multi-state activity | `closed` --latch--> `unlatched` --lid--> `open`; **unlatched --latch--> closed** (cancel). Illegal use nacks |
| L5 tool use | Grab tool when `open`; use `collider_fastener` while tool is held/out (4 turns). Snap-return on release near slot |
| Contents gating | Tool collider is unpickable until `open` |
| Hands (optional) | `requestSession` `optionalFeatures: ["hand-tracking"]`; pinch measured on `XRHand` joints `thumb-tip` / `index-finger-tip`. v0.9: index-tip near-collider (then hand ray) hovers like a controller when no controller ray hit. Pinch still use/grab/drive. v0.10: missing wrist / invisible hand mid-hold calls `endGrab`. v0.11: visibility loss releases a hand hold the same way. Core loop does not require hands. |
| Feedback | Short Web Audio ticks + `gamepad.hapticActuators.pulse` when the source exposes it |
| Quest 3 session | On `sessionstart`: `updateTargetFrameRate(90)` if listed, else 72; `renderer.xr.setFoveation(0.75)`. No 120/207/240 requirement. **`P`** overlay shows captured rates / FFR / rAF Δ (off = no sample). v0.8: no per-frame `new` / pick-array alloc on the animation path when overlay is off. v0.10: `inputsourceschange` + per-frame null-pose check before hover/hands. v0.11: `visibilitychange` + `document.visibilitychange` (and a cheap `visibilityState` read while presenting) release holds; desktop `__qa.simulateVisibilityHidden()` / `simulateVisibilityRestore()` / `simulateDocumentHidden()`. |
| L3 LODs | LOD0 240 tris / 14 draws; LOD1 96 / 8; LOD2 24 / 2 (Three.js index counts). Auto switch 2.4 m / 4.5 m. LOD1 materials keep `normalMap` at half LOD0 `normalScale`. LOD2 materials omit `normalMap`. Colliders are not LOD meshes. |

## Activity table

Copied from the sidecar (intents, not buttons):

| From | Intent | Collider | To |
| --- | --- | --- | --- |
| closed | use | collider_latch | unlatched |
| unlatched | use | collider_lid | open |
| unlatched | use | collider_latch | closed (cancel) |
| open | use | collider_lid | closed |

Grab: `collider_grab` (crate) or `collider_tool` (only when open). Drive: `collider_fastener` while the tool is held/out (progress on the plaque, not a fourth box state).

## Notes

- Prefer `local-floor` on device; Three `WebXRManager` negotiates available spaces. `hand-tracking` is optional and must not gate the activity ([ADR 0003](../../studio/adr/0003-interaction.md)).
- Physics in this demo is a tiny kinematic integrator so the example has no WASM engine. Products should bind the `physics` component to a real hull solver ([ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md)).
- Comfort defaults: [ADR 0002](../../studio/adr/0002-locomotion.md) (this demo has no artificial locomotion).
- QA checklist: [quality-bar](../../studio/quality-bar.md) on [Quest 3](../../docs/shipping/quest-3-target.md) @ 90 Hz. Record numbers with [quest-3-on-device-qa](../../docs/shipping/quest-3-on-device-qa.md).
- **TODO:** fill that table on a physical Quest 3 (this cloud environment has no headset). Do not invent `supportedFrameRates` or frame ms.

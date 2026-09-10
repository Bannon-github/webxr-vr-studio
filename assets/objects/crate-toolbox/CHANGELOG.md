# crate-toolbox

## 0.12.0 — 2026-09-10

- **Delta (additive, L2 quality UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Shared procedural **512² normal maps** (wood / brass / steel) wired through `MeshStandardMaterial.normalMap` + modest `normalScale`. Height fields follow the v0.6 albedo grain / wear so lighting matches color. Still 5 shared materials; unique canvases 6 → 9 (albedo + ORM + normal). LOD0–2 geometry, hull names, and L4/L5 activity unchanged. Draw estimates unchanged (14 / 8 / 2 + fastener 1). v0.11 visibility-loss, v0.10 tracking-loss, v0.9 hand hover, and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. This revisits already-claimed L2 (same pattern as v0.6 maps instead of plastic colors).
- **Quest 3:** `texturePref` 512, `textureMax` 1024. No 4K. Draws / tris must not worsen. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.12.0/`

## 0.11.0 — 2026-09-10

- **Delta (additive, shipping/a11y UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **visibility-loss safe release** in `examples/interactive-prop`: if the XR session or page loses visibility (`XRSession.visibilityState` `hidden` / `visible-blurred` via `visibilitychange`, or `document.hidden` while presenting) while holding the crate or screwdriver, the prop is released via the existing `endGrab` path (same return-tool / throw / table logic as squeezeend / tracking loss). Returning to `visible` does **not** auto-regrab. v0.10 tracking-loss, v0.9 hover-before-pinch, and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.5 / v0.8 / v0.9 / v0.10), not a new layer.
- **Quest 3:** Props detach when the user lifts the headset, the immersive session blurs, or Quest Browser hides the tab. Draws / tris / textures unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.11.0/`

## 0.10.0 — 2026-09-10

- **Delta (additive, shipping/a11y UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **tracking-loss / null-pose safe release** in `examples/interactive-prop`: if a controller or hand loses tracking (null `getPose` / `getJointPose` on grip, targetRay, or wrist) while holding the crate or screwdriver, or the holding `XRInputSource` disappears mid-grab (`inputsourceschange` removed / Three `disconnected`), the prop is released via the existing `endGrab` path (same return-tool / throw / table logic as squeezeend). Does not leave a prop frozen on a dead grip or wrist. v0.9 hover-before-pinch and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.5 / v0.8 / v0.9), not a new layer.
- **Quest 3:** Props detach when the holding pose goes null. Draws / tris / textures unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.10.0/`

## 0.9.0 — 2026-09-10

- **Delta (additive, shipping/input-parity UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **hand-tracking hover** in `examples/interactive-prop`: when presenting, if no controller ray hit this frame, index-finger-tip near-collider (then a tip-origin ray) drives the same `setHover` / `hoverEnter` emissive path. Pinch still use/grab/drive only. Controllers win on a ray hit. v0.8 allocation scrub kept (shared pick list, no per-frame `new` when `P` is off).
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.5 / v0.8), not a new layer.
- **Quest 3:** Hover-before-pinch for bare hands. Draws / tris / textures unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.9.0/`

## 0.8.0 — 2026-09-10

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **frame-loop allocation scrub** in `examples/interactive-prop`: reused pick list, AABB first-hit (no `intersectObjects` garbage), hoisted grip/nearest vectors, pose-history ring, cached tool collider + controller ray, hover without `Object.entries`. Overlay off stays one boolean. L5 activity and LOD draws unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.5 / v0.7), not a new layer.
- **Quest 3:** Removes per-frame `new THREE.Vector3` / array construction on the present + non-present animation path. Draw / tri / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.8.0/`

## 0.7.0 — 2026-09-09

- **Delta (additive, L3 packaging UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Documented Quest 3 `gltf-transform` KTX2/Basis recipe (≤1024², prefer 512; UASTC on ORM/normal; ETC1S on albedo; meshopt). Example **probes** `/packaged/crate-toolbox.glb` and loads it with `KTX2Loader` when present; otherwise keeps v0.6 procedural canvases. No binary GLB/KTX2 checked in.
- **Layers:** still L0–L5. This revisits already-claimed L3 (packaging / GPU-ready textures), not a new layer.
- **Quest 3:** Draws and texture caps unchanged vs v0.6.0. 90 Hz / 72 fallback. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.7.0/`

## 0.6.0 — 2026-09-09

- **Delta (additive, L2 quality UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Flat color-only PBR replaced by **shared procedural 512² albedo + ORM** for wood / brass / steel (6 unique canvases, mipmapped). Dark wood and tool grip tint the wood maps. LOD0–2 geometry, hull names, and L4/L5 activity unchanged. Draw estimates unchanged (14 / 8 / 2 + fastener 1).
- **Layers:** still L0–L5. This revisits already-claimed L2 (maps instead of plastic colors).
- **Quest 3:** `texturePref` 512, `textureMax` 1024. No 4K. Draws must not worsen. 90 Hz / 72 fallback. Headset ms / FFR still **TODO**. Next packaging step for a DCC GLB: **KTX2 / Basis** — not blocking this pulse.
- **Revision:** `revisions/v0.6.0/`

## 0.5.0 — 2026-09-09

- **Delta (additive, shipping/perf gate):** Same L0–L5 activity. `perf.notes` now points at [quest-3-on-device-qa](../../../docs/shipping/quest-3-on-device-qa.md). Example **`P`** overlay captures supported/requested Hz, FFR, and approximate rAF Δ (off = ~zero cost). **No headset numbers added** — the results table stays blank until a Quest 3 + Quest Browser run.
- **Layers:** unchanged (L0–L5). Not a new layer claim.
- **Quest 3:** Authoring caps unchanged. Frame time / FFR on headset still **TODO**.
- **Revision:** `revisions/v0.5.0/`

## 0.4.0 — 2026-09-09

- **Delta (additive, L5):** Re-latch cancel (`unlatched` + latch → `closed`). Tool remains unpickable while closed. After `open`, grab the screwdriver (`collider_tool` wins over the body grab hull); use `collider_fastener` (4 turns, plaque `DRIVE n/4` → `SEATED`). Release near the slot (or `T`) returns the tool. Desktop `E` extracts. Declared `feedback` keys pulse `gamepad.hapticActuators` when present. LOD0–2 and L4 hull names unchanged; fastener is +12 tris / +1 draw.
- **Layers:** L5 complete. `layerTarget` met.
- **Quest 3:** Still ≪750k tris / ≪100 draws. Frame time / FFR on headset still **TODO**.
- **Revision:** `revisions/v0.4.0/`

## 0.3.0 — 2026-09-09

- **Delta (additive, L3):** Procedural LOD1 (96 tris / 8 draws) and LOD2 (24 / 2) sit beside unchanged LOD0 (240 / 14). Distance switch 2.4 m / 4.5 m with hysteresis; `1`/`2`/`3` force a level, `0` auto. Same part names and L4 hulls (`collider_grab` / latch / lid / tool); activity still `closed` → `unlatched` → `open`.
- **Layers:** L3 now complete (real cheaper visuals + one-level-at-a-time draw). L5 still not claimed.
- **Quest 3:** Authoring stays under studio caps (≪750k tris, ≪100 draws, no 4K maps). Frame time / FFR on headset still **TODO** (not measured).
- **Revision:** `revisions/v0.3.0/` (NOTES + manifest; no GLB)

## 0.2.1 — 2026-09-09

- **Delta (additive):** Manifest `targetDevice: quest3` + `perf` envelope (90 Hz / 72 fallback, ~1.2k LOD0 tris, ≤1024², ~14 draws, box colliders). No mesh change.
- **Layers:** unchanged (L3 still pending a GLB).
- **Revision:** current files (metadata only)

## 0.2.0 — 2026-09-09

- **Delta (additive):** Hollow L1/L2 body so L4 contents are visible; use-colliders win over the grab hull (8 cm near-hit bias); grab box shrunk to the body. Same `objectId`, same states, same sidecar contract.
- **Layers:** L0–L2, L4 still; L3 unset (no LOD set / no GLB). L5 not claimed (kinematic throw only).
- **Revision:** `revisions/v0.2.0/` (procedural — NOTES only; no GLB)

## 0.1.0 — 2026-09-09

- **Delta:** L0–L2 stand-in + L4 latch/lid activity (`closed` / `unlatched` / `open`). Solid body mesh hid the nested tool; grab hull swallowed lid hits.
- **Layers:** L0, L1, L2, L4
- **Revision:** `revisions/v0.1.0/`

# crate-toolbox

## 0.26.0 — 2026-09-12

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After v0.25 made LOD1 albedo-only (and v0.23 did the same for LOD2), **procedural LOD1 and LOD2 bind half-resolution (256²) albedo** instead of the shared 512² L2 albedos. LOD0 keeps the five shared v0.12 materials (512² albedo + ORM + `normalMap`, full modest `normalScale`). LOD1 body / lid / latch / tool stub and LOD2 body + lid stay `{ normalMap: false, ormMap: false }` with the same constant roughness/metalness classes (wood/handle **220/255** / **8/255**; brass latch **95/255** / **230/255**). LOD1 wood variants + LOD2 `woodFar` share one 256² wood albedo; LOD1 brass has its own 256² brass albedo. Fastener is not an LOD mesh and stays on shared LOD0 brass. `setToolboxLod` is still visibility-only. Unique canvases **9 → 11** (extra 256² wood/brass albedos). Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub kept. Runtime prefers a packaged GLB when present and does not strip or downsample maps; author LOD1/LOD2 albedo at ≤256² (and omit `normalTexture` + ORM) per the KTX2 recipe.
- **Layers:** still L0–L5. This revisits already-claimed L3 (mid/far texture bandwidth / footprint), not a new layer.
- **Quest 3:** Cheaper LOD1/LOD2 albedo samples at 2.4 m+ (256² vs 512²). Draws / tris unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.26.0/`

## 0.25.0 — 2026-09-12

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After v0.24 dropped LOD1 `normalMap` and v0.23 dropped LOD2 ORM, **procedural LOD1 no longer samples packed ORM**. LOD0 keeps the five shared v0.12 materials (512² albedo + ORM + `normalMap`, full modest `normalScale`). LOD1 body / lid / latch / tool stub use **separate** materials with the same 512² albedo and `{ normalMap: false, ormMap: false }` — `normalMap = null`, no `roughnessMap` / `metalnessMap`. Wood / woodDark / handle mid use constant roughness **220/255** and metalness **8/255** (same wood ORM midtones as LOD2). Brass latch mid uses constant roughness **95/255** and metalness **230/255** (`brassOrm` G = 70 + n×50 + tarnish×90 at n 0.5 / tarnish 0; B = 230 − tarnish×80) so `MeshStandardMaterial` stays lit under the present-path ambient fill. LOD2 stays v0.23 albedo-only (`woodFar`: no `normalMap`, no ORM; wood-ORM-midtone constants). Fastener is not an LOD mesh and stays on shared LOD0 brass. `setToolboxLod` is still visibility-only. Unique canvases still 9. Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub kept. Runtime prefers a packaged GLB when present and does not strip maps; author LOD1 without `normalTexture` and without ORM/occlusion-roughness-metallic (albedo only) per the KTX2 recipe.
- **Layers:** still L0–L5. This revisits already-claimed L3 (mid-LOD fragment / texture-sample cost), not a new layer.
- **Quest 3:** Cheaper LOD1 fragments at 2.4–4.5 m (no packed-ORM sample; albedo-only). Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.25.0/`

## 0.24.0 — 2026-09-12

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After v0.13 dropped LOD2 `normalMap`, v0.14 halved LOD1 `normalScale`, and v0.23 dropped LOD2 ORM, **procedural LOD1 no longer samples tangent-space normals**. LOD0 keeps the five shared v0.12 materials (512² albedo + ORM + `normalMap`, full modest `normalScale`). LOD1 body / lid / latch / tool stub use **separate** materials with the same 512² albedo + packed ORM and `{ normalMap: false }` — `normalMap = null`. LOD2 stays v0.23 albedo-only (`woodFar`: no `normalMap`, no ORM; constant roughness **220/255** and metalness **8/255**). Fastener is not an LOD mesh and stays on shared LOD0 brass. `setToolboxLod` is still visibility-only. Unique canvases still 9. Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub kept. Runtime prefers a packaged GLB when present and does not strip maps; author LOD1 without `normalTexture` (keep packed ORM) per the KTX2 recipe.
- **Layers:** still L0–L5. This revisits already-claimed L3 (mid-LOD fragment / texture-sample cost), not a new layer.
- **Quest 3:** Cheaper LOD1 fragments at 2.4–4.5 m (no tangent-space normal sample). Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.24.0/`

## 0.23.0 — 2026-09-12

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After v0.13 dropped LOD2 `normalMap` and v0.14 halved LOD1 `normalScale`, **LOD2 no longer samples packed ORM**. LOD0 keeps the five shared v0.12 materials (512² albedo + ORM + `normalMap`, full modest `normalScale`). LOD1 keeps albedo + ORM + `normalMap` at half scale. LOD2 body + lid still share one far wood material (`woodFar`) with the same 512² albedo, `normalMap = null`, and now `{ ormMap: false }` — no `roughnessMap` / `metalnessMap`. Constant roughness **220/255** and metalness **8/255** match wood ORM midtones (`woodOrm` G = 200 + stripe×40 at stripe 0.5; B is authored 8) so `MeshStandardMaterial` stays lit under the present-path ambient fill. Fastener is not an LOD mesh and stays on shared LOD0 brass. `setToolboxLod` is still visibility-only. Unique canvases still 9. Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. This revisits already-claimed L3 (far-LOD fragment / texture-sample cost), not a new layer.
- **Quest 3:** Cheaper LOD2 fragments at distance (no packed-ORM sample; albedo-only). Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.23.0/`

## 0.22.0 — 2026-09-12

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path XR framebuffer scale factor clamp to 1** in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, v0.17’s NoToneMapping, v0.18’s IBL/`scene.environment` off, v0.19’s directional / punctual off, v0.20’s ambient-only fill, and v0.21’s texture anisotropy clamp. `renderer.setPixelRatio(1)` and `renderer.xr.setFramebufferScaleFactor` are different knobs — the latter scales the XR eye buffer vs the runtime recommended size. Default is often 1, but lookdev or future HUD code can raise it and blow Quest 3 fill. Three r170 exposes `setFramebufferScaleFactor` only (no getter; private default `1.0`) and snapshots the factor in `setSession` (`sessionstart` fires after `isPresenting = true`); a set while presenting does not rebuild the current `XRWebGLLayer`. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15–v0.21) helpers in `present-framebuffer-scale.js` save the last-set / documented lookdev default (1) and write **1**. The example also sets 1 at renderer setup so the current session inherits the clamp. On `sessionend` restore the saved lookdev/desktop scale first (reverse-safe). Raising above 1 is stretch-only and must be measured on-device. Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16 / v0.17 / v0.18 / v0.19 / v0.20 / v0.21), not a new layer.
- **Quest 3:** Cheaper / safer present-path eye-buffer fill vs accidental supersampling while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.22.0/`

## 0.21.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path texture anisotropy clamp to 1** in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, v0.17’s NoToneMapping, v0.18’s IBL/`scene.environment` off, v0.19’s directional / punctual off, and v0.20’s ambient-only fill. After those gates, Three.js / WebGL can still request high anisotropic filtering (lookdev or a packaged GLB may use GPU max, often 16). On Quest 3 TBDR that is extra texture bandwidth for little gain at present-path pixel ratio 1 + FFR. Studio docs: mipmaps on; do not assume 16× anisotropy. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15–v0.20) helpers in `present-anisotropy.js` walk toolbox / scene material maps (`map`, `normalMap`, ORM `roughnessMap`/`metalnessMap`, plus packaged GLB slots), dedupe by texture identity, save each `.anisotropy`, and write **1**. On `sessionend` restore saved lookdev values (do not re-upload or dispose). Procedural 512² canvases already author at 1. Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16 / v0.17 / v0.18 / v0.19 / v0.20), not a new layer.
- **Quest 3:** Cheaper present-path texture filtering / bandwidth while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.21.0/`

## 0.20.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path ambient-only fill** (HemisphereLight off + one `AmbientLight`) in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, v0.17’s NoToneMapping, v0.18’s IBL/`scene.environment` off, and v0.19’s directional / punctual off. Desktop lookdev still uses `HemisphereLight` (0.55) + `DirectionalLight` `sun` (intensity 0.9). Three r170 still counts a visible HemisphereLight with intensity 0 toward `NUM_HEMI_LIGHTS` — intensity 0 does **not** drop the hemi loop. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off + v0.19 directional off) save hemisphere visible + intensity, set `visible = false` and intensity 0, and enable one reused `AmbientLight` at intensity **0.4** (color `0xf0e6d4`; readable fill, not a lookdev match). On `sessionend` restore lookdev hemisphere and disable/detach the present-only ambient (do not leak lights across sessions). Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16 / v0.17 / v0.18 / v0.19), not a new layer.
- **Quest 3:** Cheaper present-path hemisphere / fragment cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.20.0/`

## 0.19.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path directional / punctual light off** (hemisphere-only) in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, v0.17’s NoToneMapping, and v0.18’s IBL/`scene.environment` off. Desktop lookdev still uses `HemisphereLight` + `DirectionalLight` `sun` (intensity 0.9). Three r170 still counts a visible DirectionalLight with intensity 0 toward `NUM_DIR_LIGHTS` — intensity 0 does **not** drop the punctual loop. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 MSAA-off verify + v0.17 NoToneMapping + v0.18 IBL off) save visible + intensity, set `visible = false` and intensity 0. On `sessionend` restore lookdev visible + intensity. HemisphereLight stays on. Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16 / v0.17 / v0.18), not a new layer.
- **Quest 3:** Cheaper present-path punctual / fragment cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.19.0/`

## 0.18.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path IBL / scene.environment off** in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp, v0.16’s antialias/MSAA off, and v0.17’s NoToneMapping. Desktop lookdev still assigns a PMREM from `RoomEnvironment` to `scene.environment` (`environmentIntensity` default 1). Three r170 `environmentIntensity` is a post-sample multiply after `textureCubeUV` — intensity 0 does **not** drop `USE_ENVMAP`. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 MSAA-off verify + v0.17 NoToneMapping) save the texture reference + intensity, null `scene.environment`, and write intensity 0 when the property exists. On `sessionend` restore the saved PMREM (do not dispose) + lookdev intensity. Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16 / v0.17), not a new layer.
- **Quest 3:** Cheaper present-path IBL / fragment cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.18.0/`

## 0.17.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path NoToneMapping** in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp and v0.16’s antialias/MSAA off. Desktop lookdev still uses `ACESFilmicToneMapping` + `toneMappingExposure` 1.05 at startup. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)` + v0.16 MSAA-off verify) save the current operator + exposure and set `THREE.NoToneMapping` with identity exposure (1). Three r170 applies `renderer.toneMapping` on the output fragment; ACESFilmic is extra ALU on Quest 3 TBDR. On `sessionend` restore saved ACESFilmic + the prior exposure. Session events only — not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15 / v0.16), not a new layer.
- **Quest 3:** Cheaper present-path tone mapping / fragment cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.17.0/`

## 0.16.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path WebGL antialias / MSAA off** in `examples/interactive-prop`, complementary to v0.15’s pixel-ratio clamp. Three.js r170 snapshots `getContextAttributes().antialias` into `XRWebGLLayer` (or projection-layer `samples`); the attribute cannot be flipped on a live context, and recreating the renderer would drop PMREM / GPU uploads / XR bindings. The example therefore **starts** the one renderer with `antialias: QUEST3_XR_ANTIALIAS` (**false**) so the XR layer inherits MSAA off. On `sessionstart` (after 90/72 + FFR 0.75 + v0.15 `setPixelRatio(1)`) helpers in `present-antialias.js` verify the policy; on `sessionend` they restore the *desired* lookdev policy value (true) without inventing a setter. Desktop 2D lookdev shares that context (also MSAA off) — documented trade-off. Not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11 / v0.15), not a new layer.
- **Quest 3:** Lower present-path MSAA / fill cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.16.0/`

## 0.15.0 — 2026-09-11

- **Delta (additive, shipping/perf gate UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. Quest 3 **present-path WebGL pixel-ratio clamp** in `examples/interactive-prop`: on `sessionstart` (after 90/72 + FFR 0.75) save the current ratio and `setPixelRatio(QUEST3_XR_PIXEL_RATIO)` (**1**); on `sessionend` restore the saved desktop/2D ratio (`min(devicePixelRatio, 2)`) and `setSize` to the current window so lookdev is unchanged. Helpers in `present-pixel-ratio.js` are unit-tested without WebXR. Not per-frame (v0.8 allocation scrub kept). L4/L5 activity and LOD draws/tris unchanged.
- **Layers:** still L0–L5. Quality / shipping-gate revisit (like v0.8 / v0.10 / v0.11), not a new layer.
- **Quest 3:** Lower XR fragment fill / backbuffer cost while presenting. Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.15.0/`

## 0.14.0 — 2026-09-10

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After v0.13 dropped LOD2 normals, **LOD1 no longer uses full-strength tangent-space `normalScale`**. LOD0 keeps the five shared v0.12 materials (`normalMap` + modest full `normalScale`: wood 0.62, brass 0.30, steel 0.38). LOD1 body / lid / latch / tool stub use **separate** materials with the same 512² albedo + ORM + normal canvases and `normalScale × L3_LOD1_NORMAL_SCALE_MUL` (**0.5**). LOD2 stays v0.13 (`normalMap = null` on its separate wood). Fastener is not an LOD mesh and stays on shared LOD0 brass (no extra draw). `setToolboxLod` is still visibility-only (no per-switch material swap). Unique canvases still 9. Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). v0.13 LOD2 no-normals, v0.12 normals, v0.11 visibility-loss, v0.10 tracking-loss, v0.9 hand hover, and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. This revisits already-claimed L3 (mid-LOD fragment / lighting-slope cost), not a new layer.
- **Quest 3:** Softer mid-distance normals at 2.4–4.5 m (half LOD0 `normalScale`). Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.14.0/`

## 0.13.0 — 2026-09-10

- **Delta (additive, L3 packaging/perf UPGRADE):** Same `objectId`, same L0–L5 claim — not a new layer and not NEW. After the v0.12 normal pass, **LOD2 no longer samples normal maps**. The five shared LOD0/LOD1 materials keep v0.12 `normalMap` + modest `normalScale`. LOD2 body + lid use a separate wood material with the same 512² albedo + ORM and `normalMap = null` (visibility-only `setToolboxLod`; no extra draws). LOD1 keeps the shared normals (simpler Quest-safe choice vs a second material split). Fastener is not an LOD mesh and stays on shared brass. Draw / tri counts unchanged (14 / 8 / 2 + fastener 1). v0.12 normals, v0.11 visibility-loss, v0.10 tracking-loss, v0.9 hand hover, and v0.8 allocation scrub kept.
- **Layers:** still L0–L5. This revisits already-claimed L3 (far-LOD fragment cost), not a new layer.
- **Quest 3:** Cheaper LOD2 fragments at distance (no tangent-space normal sample). Draws / tris / texture caps unchanged. 90 Hz / 72 fallback **requested**, not measured. Headset ms / FFR still **TODO**.
- **Revision:** `revisions/v0.13.0/`

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

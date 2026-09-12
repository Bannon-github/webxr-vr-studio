# Photoreal look inside the frame budget

How to keep a photographed-looking prop without missing v-sync on a standalone HMD.

**Gate:** [Quest 3](../shipping/quest-3-target.md) @ **90 Hz** (≈11.1 ms). 72 Hz fallback; 120 Hz stretch; no 207/240 Hz. This page is the **asset** half: triangles, textures, materials, lighting, LODs. Interaction CPU stays cheap if you pick **colliders**, not hero meshes — [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md).

Quest 3 is a mobile **TBDR** GPU. Author to ~70–80% of 11.1 ms **on the headset**, not a desktop dGPU. L2 (PBR) and L3 (LODs) must stay inside the Quest 3 checklist — photoreal via **baked maps + LODs**, not raw scan density.

## What “photoreal” means here

In headset it is **plausible materials + correct scale + stable lighting + readable wear**, not offline path tracing. Users hold the object at 40–70 cm. That is a product shot, not a cathedral.

Spend budget on:

- Accurate roughness/metalness and a decent normal (baked from high poly)
- Consistent IBL and one or two real-time lights
- Silhouette and edge wear that survive FFR

Do not spend budget on:

- 4K albedos on a 20 cm prop
- Many dynamic lights or real-time shadows per prop
- Transmission/refraction stacks on every bottle
- Path tracing, SSAO cascades, or desktop-only post that you cannot run at 90 Hz

## Starting class budgets (template)

Tune per product; fail QA if the hero scene misses target Hz. Numbers assume Quest-class standalone, metallic-roughness glTF, KTX2 textures, one hero in view plus dress.

| Class | Tris (LOD0) | Albedo | Normal | ORM / packed | Draw notes |
| --- | --- | --- | --- | --- | --- |
| Hero interactive prop | 5–20 k | **1024** (2048 max) | 1024 | 512–1024 | One material if possible; 2–3 parts max |
| Held tool | 2–8 k | 512–1024 | 512–1024 | 512 | Tip extra material only if needed |
| Set dressing (in reach) | 1–5 k | 512–1024 | 512 | 512 | Atlas shared among variants |
| Background / far | LOD2 or card | 256–512 | none / 256 | none | Merge; instance repeats |
| Collision hulls | 12–200 tris each | — | — | — | Hidden; convex pieces |

Whole-view soft ceiling (Quest 3 WebXR studio default): **≲750k tris/eye**, **≲100 draw calls**. Props must sit far under that. Texture memory: treat **256–512 MB** resident as caution; prefer KTX2/Basis. **TODO:** confirm ceilings on-device for the product hero scene.

LODs: switch ~2–3 m → LOD1 (≈30–50% tris, half res), farther → impostor or 512 flake. Do not keep LOD0 behind the user.

## Materials (PBR that stays cheap)

- **glTF metallic-roughness** is the studio default. `KHR_materials_clearcoat`, `transmission`, `volume`, `ior`, `specular` are opt-in per prop and need a measured ms cost.
- One `MeshStandardMaterial` (Three.js) / equivalent per part. Unique materials shatter batching.
- Packed ORM (occlusion, roughness, metalness) beats three 2K textures.
- `baseColor` is sRGB and **unlit by the photographer** — baked shadows fight IBL and look pasted when the user moves.
- Normal maps: OpenGL +Y for Three.js; document the convention on the content revision. 1K often beats 2K once mipmapped and foveated.
- Emissive is for emitters. Hover sheen is a small emissive *pulse* or roughness tweak, not a second 2K map.
- Avoid creating materials in the XR `requestAnimationFrame` (GC + compile). Clone at load; mutate uniforms.

Three.js lookdev (examples follow this): `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, a `PMREM` from `RoomEnvironment` or a authored cubemap. That is IBL, not a new renderer. `crate-toolbox` v0.17 switches to `NoToneMapping` while an immersive XR session is presenting (cheaper Quest 3 fragment path) and restores ACES + the prior `toneMappingExposure` on `sessionend`. `crate-toolbox` v0.18 nulls `scene.environment` while presenting (r170 `environmentIntensity` does not skip IBL sampling) and restores the saved PMREM + lookdev intensity on `sessionend` without disposing the texture. `crate-toolbox` v0.19 hides the lookdev `DirectionalLight` while presenting (r170 intensity 0 does not drop `NUM_DIR_LIGHTS`) and restores lookdev visible + intensity on `sessionend`. `crate-toolbox` v0.20 hides the lookdev `HemisphereLight` while presenting (r170 intensity 0 does not drop `NUM_HEMI_LIGHTS`) and enables one reused `AmbientLight` at intensity 0.4; restore lookdev hemi and disable/detach ambient on `sessionend`. `crate-toolbox` v0.21 clamps bound texture `.anisotropy` to 1 while presenting (lookdev / packaged GLB may use GPU max) and restores saved lookdev anisotropy on `sessionend`. `crate-toolbox` v0.22 clamps `renderer.xr.setFramebufferScaleFactor` to 1 while presenting (distinct from v0.15 `setPixelRatio`; r170 has no getter and cannot rebuild the current layer while presenting — also set 1 at renderer setup) and restores the saved lookdev/desktop scale on `sessionend`.

`crate-toolbox` L2 is a **procedural canvas stand-in** (512² albedo + packed ORM + OpenGL normal). LOD0 uses the five shared materials at full modest `normalScale`. v0.14 L3: LOD1 binds the same maps on separate materials with `normalScale × 0.5` (`L3_LOD1_NORMAL_SCALE_MUL`). v0.13 L3: LOD2 dropped `normalMap`. v0.23 L3: LOD2 is **albedo-only** (`normalMap` and ORM `roughnessMap`/`metalnessMap` omitted) with constant wood-ORM-midtone roughness (220/255) and metalness (8/255) so `MeshStandardMaterial` stays lit under the present-path ambient fill. v0.24 L3: on the **procedural** path, LOD1 drops `normalMap` (albedo + packed ORM only). v0.25 L3: LOD1 is **albedo-only** (`normalMap` and ORM `roughnessMap`/`metalnessMap` omitted) with constant wood-ORM-midtone roughness (220/255) and metalness (8/255) on wood/handle and brass-ORM-midtone roughness (95/255) and metalness (230/255) on the latch so `MeshStandardMaterial` stays lit under the present-path ambient fill. v0.26 L3: LOD1 and LOD2 bind **256² albedo** (`L3_LOD_ALBEDO_SIZE`) instead of the shared 512² L2 albedos (unique canvases 9 → 11). Far and mid fragments skip tangent-space and packed-ORM sampling and sample a cheaper albedo. v0.27 L3: LOD2 body + lid use **`MeshBasicMaterial`** (unlit / card-like) with that same 256² wood albedo — no roughness/metalness uniforms (they do not apply). MeshStandard still runs PBR lighting math on far fragments; MeshBasic skips that after the v0.20 ambient-only present path. L3 packaging: the example **probes** `/packaged/crate-toolbox.glb` and loads KTX2/meshopt when present (no map strip, downsample, or material rewrite at ingest); otherwise it keeps the canvases. A packaged GLB must author LOD1 albedo at ≤256² without `normalTexture` and without ORM, and author LOD2 as unlit/basic (or `KHR_materials_unlit`) with ≤256² albedo and no normal/ORM. Do not ship raw 4K PNG/JPEG on Quest 3. See [ktx2-quest3-packaging](ktx2-quest3-packaging.md).

## Lighting

- **One IBL** for the space. Swap probes between rooms, not per prop.
- **0–2** punctual lights that are actually in the set (window, lamp). Contact shadows: blob / decal / baked AO. Cascaded shadows on every grabbable are how you miss 90 Hz. On the Quest 3 present path, `crate-toolbox` v0.19 disables the lookdev directional sun and v0.20 replaces hemisphere with one `AmbientLight` (intensity 0.4), restoring both on `sessionend` — same “minimize lights / no real-time shadows” guidance.
- When the user grabs an object, do not add a new light “to make it pretty.”
- Keep exposure stable; HDR ping-pong causes flicker that reads as sickness.

## Geometry and animation

- Hinges are **node rotations**, not 20-blendshape lids.
- Skinned mesh only if the brief needs squash; each skinned mesh is a draw + compute cost.
- Merge static dress; instance repeated bolts/bottles (`InstancedMesh` / `EXT_mesh_gpu_instancing`).
- Morph targets: budget like extra attributes. Prefer a lid node.
- Colliders are boxes/capsules/convex husks. Raycasts against 20 k tris will show up as CPU frame spikes during “interaction storms” (see [performance README](README.md) checklist item 8).

## Compression and load (not free)

| Tool | When | Cost |
| --- | --- | --- |
| meshopt (`EXT_meshopt_compression`) | Default runtime meshes | Fast decode; still decode **off** the XR frame |
| Draco (`KHR_draco_mesh_compression`) | Download-bound hero | Heavier decode; load before session or in a plaza |
| KTX2 ETC1S | Albedo, ORM, emissive | Tiny; watch block artifacts on text/labels |
| KTX2 UASTC | Normals | Larger; better high-frequency |

Do not Draco + meshopt + giant PNG “just in case.” Validate with the glTF Validator and an on-device memory readout.

**Recipe (Quest 3 props):** [ktx2-quest3-packaging.md](ktx2-quest3-packaging.md) — `gltf-transform` resize ≤1024² (prefer 512 on LOD0; author LOD1 albedo at ≤256; author LOD2 as unlit/basic or `KHR_materials_unlit` with ≤256 albedo), UASTC on normal/ORM, ETC1S on albedo, then meshopt. Keep LOD nodes and `collider_*` off the hero mesh.

## Foveation and mipmaps

Fixed foveation ([layers-and-ffr](../fundamentals/layers-and-ffr.md)) will soften the periphery — where your 2K label lives if you placed it wrong.

- Put usable text and latch micro-contrast **near where the user looks** (the use-target).
- Mipmaps on every color/normal map. Anisotropic filtering if the GPU budget allows; do not assume 16x. On the Quest 3 present path, `crate-toolbox` v0.21 clamps texture anisotropy to **1** while immersive (restore lookdev values on `sessionend`) — AF is extra TBDR bandwidth at pixel ratio 1 + FFR.
- Prefer `framebufferScaleFactor` / renderScale knobs over unchecked supersampling. On the Quest 3 present path, `crate-toolbox` v0.22 clamps XR framebuffer scale to **1** while immersive (restore lookdev scale on `sessionend`). Raising above 1 is stretch-only and must be measured on-device.
- Test `fixedFoveation` at 0 / 0.5 / 1 with the prop at arm’s length **and** on a table in the periphery.
- Do not render the prop to a full-res offscreen then blit (you lose FFR).

## CPU next to the GPU

Photoreal often dies on **JavaScript**, not triangles:

- No `new` materials, geometries, or large arrays per frame
- Raycast a short collider list, not `scene.children`
- One state-machine tick per prop that is hovered/grabbed, not a full-scene scan
- Audio: start one-shots; do not construct an `AudioContext` per click

## What we do not do on-device

- Path tracing / full ray-traced GI in the immersive session
- Desktop UE-cinematic post stacks (heavy bloom, TAA + motion blur + grain) as a default
- WebGPU-only presentation as a ship gate ([stack](../stack/README.md))

Bake in DCC or a desktop prepass. Ship GLB + IBL.

## Profiling (asset-focused)

1. On-device frame time with the prop grabbed (worst-case fill + your hands in view)
2. Triangle and draw count: idle table vs two heroes held
3. Texture memory before/after the revision
4. Disable IBL / extra lights; note ms — if you gain 3 ms, the look is lighting, not mesh
5. Thermal soak 10+ minutes with the activity looping
6. Interaction storm: hover + grab + throw spam — watch GC and raycast cost

Fail the content revision if **Quest 3** cannot hold **90 Hz** in the hero scene ([quality-bar](../../studio/quality-bar.md), [quest-3-target](../shipping/quest-3-target.md)).

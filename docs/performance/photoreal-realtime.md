# Photoreal look inside the frame budget

How to keep a photographed-looking prop without missing v-sync on a standalone HMD.

Read with the global budgets in [README](README.md) (72 Hz ≈ 13.9 ms, 90 Hz ≈ 11.1 ms). This page is the **asset** half: triangles, textures, materials, lighting, LODs. Interaction CPU (raycasts, state) stays cheap if you pick **colliders**, not hero meshes — [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md).

Leave headroom for the browser and compositor. Author to ~70–80% of the frame on the **lowest-tier** device in the shipping matrix, not a desktop dGPU.

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
| Hero interactive prop | 5–20 k | 1–2K | 1–2K | 1K | One material if possible; 2–3 parts max |
| Held tool | 2–8 k | 1K | 1K | 512–1K | Tip extra material only if needed |
| Set dressing (in reach) | 1–5 k | 512–1K | 512–1K | 512 | Atlas shared among variants |
| Background / far | LOD2 or card | 256–512 | none / 256 | none | Merge; instance repeats |
| Collision hulls | 12–200 tris each | — | — | — | Hidden; convex pieces |

Scene texture memory: treat **256–512 MB** of decoded/resident textures as a caution band on Quest 2-class hardware. Prefer Basis/KTX2 so GPU footprints stay compressed.

LODs: switch ~2–3 m → LOD1 (≈30–50% tris, half res), farther → impostor or 512 flake. Do not keep LOD0 behind the user.

## Materials (PBR that stays cheap)

- **glTF metallic-roughness** is the studio default. `KHR_materials_clearcoat`, `transmission`, `volume`, `ior`, `specular` are opt-in per prop and need a measured ms cost.
- One `MeshStandardMaterial` (Three.js) / equivalent per part. Unique materials shatter batching.
- Packed ORM (occlusion, roughness, metalness) beats three 2K textures.
- `baseColor` is sRGB and **unlit by the photographer** — baked shadows fight IBL and look pasted when the user moves.
- Normal maps: OpenGL +Y for Three.js; document the convention on the content revision. 1K often beats 2K once mipmapped and foveated.
- Emissive is for emitters. Hover sheen is a small emissive *pulse* or roughness tweak, not a second 2K map.
- Avoid creating materials in the XR `requestAnimationFrame` (GC + compile). Clone at load; mutate uniforms.

Three.js lookdev (examples follow this): `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmicToneMapping`, a `PMREM` from `RoomEnvironment` or a authored cubemap. That is IBL, not a new renderer.

## Lighting

- **One IBL** for the space. Swap probes between rooms, not per prop.
- **0–2** punctual lights that are actually in the set (window, lamp). Contact shadows: blob / decal / baked AO. Cascaded shadows on every grabbable are how you miss 90 Hz.
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

## Foveation and mipmaps

Fixed foveation ([layers-and-ffr](../fundamentals/layers-and-ffr.md)) will soften the periphery — where your 2K label lives if you placed it wrong.

- Put usable text and latch micro-contrast **near where the user looks** (the use-target).
- Mipmaps on every color/normal map. Anisotropic filtering if the GPU budget allows; do not assume 16x.
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

Fail the content revision if the lowest-tier device cannot hold target Hz in the hero scene ([quality-bar](../../studio/quality-bar.md)).

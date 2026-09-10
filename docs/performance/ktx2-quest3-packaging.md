# Quest 3 KTX2 / Basis packaging

Concrete recipe for turning a DCC **glTF 2.0 GLB** into a Quest 3–safe package. Gate: [quest-3-target](../shipping/quest-3-target.md) — **90 Hz** ship / **72 Hz** fallback; never require 207/240 Hz. Soft caps: ≲100 draws, ≲750k tris/eye. Props: textures **≤1024²** (prefer **512²** when the maps already are). **No 4K.**

This page is the missing “how.” Policy lives in [photoreal-realtime](photoreal-realtime.md) and [content-pipeline](../../studio/content-pipeline.md) step 5. Identity stays on the same `objectId` ([additive-object-iteration](../../studio/additive-object-iteration.md)).

`crate-toolbox` today still **renders procedural 512² canvases**. Drop a packaged GLB at the URL the example probes (`/packaged/crate-toolbox.glb`) and the runtime prefers it. Do not invent headset ms after packaging — fill [quest-3-on-device-qa](../shipping/quest-3-on-device-qa.md) on a headset.

## Before you run a compressor

1. Export **one GLB** (y-up, 1 unit = 1 m). Visual meshes and `collider_*` hulls are **different nodes**. Do not merge the grab hull into the hero batch.
2. Keep **LOD0 / LOD1 / LOD2** groups if they already exist. Packaging must not flatten LODs into a single draw soup. Mid LOD primitives may keep `normalTexture` but should use a reduced `normalTexture.scale` (crate-toolbox v0.14 procedural path uses `L3_LOD1_NORMAL_SCALE_MUL` = 0.5 vs LOD0). Far LOD primitives should omit `normalTexture` (v0.13 already drops `normalMap` on LOD2).
3. `gltf-transform inspect in.glb` — list texture slots and pixel sizes. If anything is >1024 on a handheld prop, resize **down**. Never upscale 512 → 1024 “for quality.”
4. Albedo is sRGB and unlit (no baked scene shadows). ORM / metallicRoughness is linear.

## Recipe (`gltf-transform` CLI)

Studio default: **npx** so the repo does not pin a global. Node LTS. Commands match [@gltf-transform/cli](https://gltf-transform.dev/) (`uastc`, `etc1s`, `resize`, `meshopt`).

```bash
# 0. Inspect (slot names + dimensions). Fail if a prop map is 4K.
npx --yes @gltf-transform/cli inspect authored.glb

# 1. Cap prop maps. Prefer 512 if authored maps are already 512.
#    Skip this pass when every color/ORM/normal is already ≤ the cap.
npx --yes @gltf-transform/cli resize authored.glb resized.glb --width 1024 --height 1024

# 2. UASTC + zstd on normals and packed ORM (uncorrelated RGB — ETC1S blocks badly).
npx --yes @gltf-transform/cli uastc resized.glb step-uastc.glb \
  --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" \
  --level 4 --rdo --rdo-lambda 4 --zstd 18

# 3. ETC1S on remaining color-like maps (albedo, emissive). Already-KTX2 slots are skipped.
npx --yes @gltf-transform/cli etc1s step-uastc.glb step-ktx2.glb --quality 200

# 4. Runtime mesh compression (decode off the XR frame — plaza / load, not rAF).
npx --yes @gltf-transform/cli meshopt step-ktx2.glb crate-toolbox.glb

# 5. Validate
npx --yes @gltf-transform/cli inspect crate-toolbox.glb
# plus https://github.khronos.org/glTF-Validator/ — fail CI on errors
```

If the inspect pass shows **no** normal/ORM slots (canvas-bake stand-in exported as albedo-only), step 2 no-ops; step 3 still wraps albedo in ETC1S. That is fine.

**Do not** also run Draco on the same mesh “just in case.” meshopt is the default decode. Draco (`gltf-transform draco`) is optional when **download** size dominates and you can decode before `requestSession`. Measure; do not stack both.

## What must stay in the GLB

| Keep | Drop / never |
| --- | --- |
| `lod0` / `lod1` / `lod2` (or equivalent), only one level drawn at runtime | 4K PNG/JPEG, mipmaps-off |
| `collider_grab` / `collider_latch` / `collider_lid` / `collider_tool` / `collider_fastener` as **separate** nodes | Using the hero mesh as the pick target |
| Sidecar `behavior.json` next to the GLB (ADR 0004) | Baking latch state into `KHR_materials_variants` |
| Power-of-two KTX2 with mips (`KHR_texture_basisu`) | Desktop-only WebP/PNG “it looks finer in Chrome” |

Copy the result to `assets/objects/<objectId>/current.glb` **and** `revisions/<semver>/` (Git LFS). The interactive-prop drop folder is `examples/interactive-prop/public/packaged/` (see README there).

## Runtime (Three.js)

`GLTFLoader` + `KTX2Loader` (Basis transcoder) + optional `MeshoptDecoder`. After load: hide `collider_*`, attach the sidecar, do not raycast hero meshes. The example implements this in `packaged-visual.js`: **probe URL → load if present → else procedural canvases.**

## Quest 3 sign-off

Packaging is not a 90 Hz pass. After a real GLB lands, run [quest-3-on-device-qa](../shipping/quest-3-on-device-qa.md). Leave the results table blank until a headset run. Do not copy desktop rAF into that table.

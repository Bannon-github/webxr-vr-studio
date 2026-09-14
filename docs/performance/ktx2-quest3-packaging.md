# Quest 3 KTX2 / Basis packaging

Concrete recipe for turning a DCC **glTF 2.0 GLB** into a Quest 3–safe package. Gate: [quest-3-target](../shipping/quest-3-target.md) — **90 Hz** ship / **72 Hz** fallback; never require 207/240 Hz. Soft caps: ≲100 draws, ≲750k tris/eye. Props: textures **≤1024²** (LOD0 / LOD1 / LOD2 may be **unlit/basic** or `KHR_materials_unlit` **without** a `baseColorTexture`, or a tiny 1×1 / vertex color — no `normalTexture`, no ORM texture). **No 4K.**

This page is the missing “how.” Policy lives in [photoreal-realtime](photoreal-realtime.md) and [content-pipeline](../../studio/content-pipeline.md) step 5. Identity stays on the same `objectId` ([additive-object-iteration](../../studio/additive-object-iteration.md)).

`crate-toolbox` today still **renders procedural color-only MeshBasic** (no albedo canvases; LOD0 / LOD1 / LOD2 unlit, no `normalMap`, no ORM). Drop a packaged GLB at the URL the example probes (`/packaged/crate-toolbox.glb`) and the runtime prefers it. The loader does **not** strip, downsample, or rewrite materials at ingest — author LOD0, LOD1, and LOD2 as unlit/basic (or `KHR_materials_unlit`) **without** a `baseColorTexture` (or a tiny 1×1 / vertex color). Do not invent headset ms after packaging — fill [quest-3-on-device-qa](../shipping/quest-3-on-device-qa.md) on a headset.

## Before you run a compressor

1. Export **one GLB** (y-up, 1 unit = 1 m). Visual meshes and `collider_*` hulls are **different nodes**. Do not merge the grab hull into the hero batch.
2. Keep **LOD0 / LOD1 / LOD2** groups if they already exist. Packaging must not flatten LODs into a single draw soup. Name those groups **`lod0` / `lod1` / `lod2`** (case-insensitive; `lod_0` / `lod-0` also match) or tag `userData.lodLevel` 0/1/2 — the same convention procedural `lodGroup()` uses. crate-toolbox **v0.36** wires those nodes into `userData.lod` and shows only one level; if none exist, ingest fails soft (all authored visuals stay visible — do not invent fake LODs). Keep `collider_*` and `fastener` / `fastenerMesh` **outside** LOD groups. Within each `lod*` group, merge **static** meshes that share a material (crate-toolbox **v0.37** does this on the procedural path: LOD0 14 → 6 draws, LOD1 8 → 4; tris unchanged). Do **not** merge across lid / latch / tool pivots. LOD0 may be **unlit/basic** (`KHR_materials_unlit` / Three `MeshBasicMaterial`) **without** a `baseColorTexture` (or tiny 1×1 / vertex color) — crate-toolbox v0.35 extends the v0.29/v0.30 Quest-far/mid color-only pattern to hero LOD. Mid and far LOD primitives should be **unlit** the same way — crate-toolbox v0.30 LOD1 and v0.29 LOD2. The runtime prefers a packaged GLB when present and does **not** strip, downsample, rewrite materials, or merge meshes at ingest — author the GLB to this recipe.
3. `gltf-transform inspect in.glb` — list texture slots and pixel sizes. If anything is >1024 on a handheld prop, resize **down**. Never upscale 256 → 512/1024 “for quality.” crate-toolbox v0.35 authors LOD0 as color-only unlit/basic (no `baseColorTexture`); do not smash a *larger* authored hero on another object with a global 256 resize if that object still ships 512. Author LOD0, LOD1, and LOD2 without a baseColorTexture before this pass.
4. Albedo is sRGB and unlit (no baked scene shadows). ORM / metallicRoughness is linear.

## Recipe (`gltf-transform` CLI)

Studio default: **npx** so the repo does not pin a global. Node LTS. Commands match [@gltf-transform/cli](https://gltf-transform.dev/) (`uastc`, `etc1s`, `resize`, `meshopt`).

```bash
# 0. Inspect (slot names + dimensions). Fail if a prop map is 4K.
npx --yes @gltf-transform/cli inspect authored.glb

# 1. Cap prop maps. crate-toolbox LOD0 / LOD1 / LOD2 may be
#    unlit/basic without a baseColorTexture (or a 1×1). Do not
#    use a global resize to smash a larger authored hero if that
#    object still ships 512; crate-toolbox v0.35 authors LOD0
#    color-only unlit/basic. Skip when every remaining
#    color/ORM/normal is already ≤ the cap.
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
| `lod0` / `lod1` / `lod2` (or `userData.lodLevel` 0/1/2). Runtime (`crate-toolbox` v0.36) wires these into `userData.lod` and draws only one level. Missing names = all visuals stay visible. Prefer one mesh per material inside each lod group (v0.37 procedural: LOD0 6 draws, LOD1 4) | 4K PNG/JPEG, mipmaps-off; parenting `collider_*` or fastener under an LOD group; merging lid/latch/tool into the body batch |
| `collider_grab` / `collider_latch` / `collider_lid` / `collider_tool` / `collider_fastener` as **separate** nodes | Using the hero mesh as the pick target |
| Sidecar `behavior.json` next to the GLB (ADR 0004) | Baking latch state into `KHR_materials_variants` |
| Power-of-two KTX2 with mips (`KHR_texture_basisu`) | Desktop-only WebP/PNG “it looks finer in Chrome” |

Copy the result to `assets/objects/<objectId>/current.glb` **and** `revisions/<semver>/` (Git LFS). The interactive-prop drop folder is `examples/interactive-prop/public/packaged/` (see README there).

## Runtime (Three.js)

`GLTFLoader` + `KTX2Loader` (Basis transcoder) + optional `MeshoptDecoder`. After load: hide `collider_*`, attach the sidecar, do not raycast hero meshes. Discover `lod0` / `lod1` / `lod2` (or `userData.lodLevel`) and attach the same `userData.lod` shape as the procedural crate, then `setToolboxLod(..., 0)`. The example implements this in `packaged-visual.js`: **probe URL → load if present → wire LOD visibility if named groups exist → else procedural color-only MeshBasic.** Missing LOD names do not crash and do not invent groups.

## Quest 3 sign-off

Packaging is not a 90 Hz pass. After a real GLB lands, run [quest-3-on-device-qa](../shipping/quest-3-on-device-qa.md). Leave the results table blank until a headset run. Do not copy desktop rAF into that table.

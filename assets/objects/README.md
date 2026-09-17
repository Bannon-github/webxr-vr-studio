# Object catalog

Authoritative **identity** for studio 3D objects. Iteration rules: [additive-object-iteration](../../studio/additive-object-iteration.md). Decision: [ADR 0005](../../studio/adr/0005-additive-object-evolution.md). Runtime behavior files still follow [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md).

Ship snapshots stay under `content/<project>/<revision>/` ([content-pipeline](../../studio/content-pipeline.md)). This tree is where an object keeps its id, layer stack, and prior revisions.

## Layout

```
assets/objects/
  README.md                 # this file
  _template/                # copy to start an object
  <objectId>/
    manifest.json
    CHANGELOG.md
    BRIEF.md
    behavior.json           # optional until L4
    current.glb             # optional if source.kind is procedural
    revisions/
      vX.Y.Z/               # immutable copies
```

`objectId` is kebab-case `[a-z0-9]+(-[a-z0-9]+)*`. Folder name **is** the id.

## `manifest.json` schema

Required:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Same as folder name |
| `version` | string | Current object semver (`0.2.0`) |
| `layersComplete` | string[] | Subset of `L0`…`L5`, lowest-to-highest. Prefer no gaps; a skipped layer needs a CHANGELOG reason (seed `crate-toolbox` skips L3 until a GLB/LOD set exists) |
| `interactions` | string[] | Affordance tags (`hover`, `grab`, `use-latch`, …). Empty before L4 |
| `deps` | string[] | Repo-relative paths or other `objectId`s this object needs |
| `targetDevice` | string | Studio default: `quest3` ([quest-3-target](../../docs/shipping/quest-3-target.md)) |
| `perf` | object | `lod0Tris`, `textureMax`, `texturePref`, `drawCallsEstimate`, notes. L2/L3 must fit Quest 3 budgets |

Common optional fields: `layerTarget`, `displayName`, `variants`, `deprecatedBy`, `source` (`kind`: `gltf` \| `procedural`, plus pointers). `perf.frameHz` defaults to 90 if omitted.

Unknown fields are ignored. Do not mint a `KHR_` name for this file.

Copy [`_template/`](_template/) to `assets/objects/<objectId>/` and replace placeholders.

## Git LFS / storage

- Track `assets/objects/**/*.glb`, `*.ktx2`, and large authored textures with **Git LFS** (`git lfs track` those patterns in `.gitattributes` when the first binary lands).
- If a revision is too large or cannot live in git: keep `revisions/<semver>/POINTER.md` with an immutable URL. The folder must still exist.
- Never gitignore `revisions/`.

## Catalog

| objectId | Version | Layers | Notes |
| --- | --- | --- | --- |
| [crate-toolbox](crate-toolbox/) | 0.55.0 | L0–L5 | Seed; Quest 3; L2 color-only MeshBasic unlit (no albedo canvases; wood `0x633318` / brass `0xBE7E31` / steel `0xC1C3C9`, v0.35) + L3 LOD1 color-only unlit MeshBasic (v0.30; wood midtone `0x633318` / brass midtone `0xBE7E31`, no map) / LOD2 color-only unlit MeshBasic (v0.29; wood midtone `0x633318`, no map); unique canvases 0 + KTX2 probe (no GLB); v0.55 pin remaining r170 Material boolean GPU-state defaults (`alphaHash = false` / `forceSinglePass = false`) on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.54 pin r170 Material clipping defaults (`clippingPlanes = null` / `clipIntersection = false` / `clipShadows = false`) on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.53 pin r170 Material stencil defaults (`stencilWrite = false` / `AlwaysStencilFunc` / Keep ops) on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.52 pin `wireframe = false` / `colorWrite = true` / `depthFunc = LessEqualDepth` / `polygonOffset = false` on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.51 pin `blending = NormalBlending` / `premultipliedAlpha = false` / `alphaTest = 0` on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.50 pin `frustumCulled = true` on packed color-only MeshBasic visual meshes (13 frustumCulled-on; mapped/lit/colliders stay authored / r170 Mesh defaults); v0.49 pin `castShadow = false` / `receiveShadow = false` on packed color-only MeshBasic visual meshes (13 shadow-off; mapped/lit/colliders stay authored / r170 Mesh defaults); v0.48 pin opaque FrontSide draw-state (`transparent = false` / `opacity = 1` / `depthWrite = true` / `depthTest = true` / `side = FrontSide`) on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay authored / r170 defaults); v0.47 pin `fog = false` / `toneMapped = false` on packed color-only MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay r170 defaults); v0.46 disable `Mesh.raycast` on packed color-only MeshBasic visuals (body + lid/latch/tool + fastener; 13 raycast-off; colliders keep default; pick path stays AABB); v0.45 freeze `matrixAutoUpdate` on static color-only MeshBasic body LOD leaves after one `updateMatrixWorld(true)` (3 frozen / 10 live; lid/latch/tool/fastener stay live); v0.44 Float16 position quantize on color-only MeshBasic after Uint16 compact (pre-upload attrBytes 4200 → 2820 / 1776 → 1176 / 720 → 432; fastener 360 → 216); v0.43 post-GPU-upload CPU-array release on color-only MeshBasic LOD/fastener geos (pre-upload attrBytes stay 4200 / 1776 / 720 + fastener 360; post-upload CPU attrBytes → 0; colliders keep arrays); v0.42 share identical color-only MeshBasic instances across LODs when midtone hex matches (unique MeshBasic 6 → 3; draws 6 / 4 / 2 and tris 240 / 96 / 24 unchanged; packaged hex-dedupe skipped); v0.41 Uint16 index compact after unused-attr strip (LOD attrBytes stay 4200 / 1776 / 720 — already Uint16; fastener 840 → 360; stays outside LOD merge); v0.40 unused uv/normal strip on color-only MeshBasic after weld (attrBytes 8800 → 4200 / 3776 → 1776 / 1680 → 720; draws 6 / 4 / 2 and tris 240 / 96 / 24 unchanged); v0.39 coincident-vertex weld after same-material concat (unique verts 440 → 230 / 192 → 100); v0.38 packaged ingest same-material merge within each lod* group (unit/mock 3→1); v0.37 procedural same-material mesh merge (LOD0 14 → 6 draws, LOD1 8 → 4; tris unchanged); v0.36 packaged `lod0`/`lod1`/`lod2` visibility wiring (fail soft if unnamed); v0.8 allocation scrub; v0.9 hand hover-before-pinch; v0.10 tracking-loss `endGrab`; v0.11 visibility-loss `endGrab`; v0.15 present-path pixel-ratio clamp; v0.16 present-path antialias/MSAA off; v0.17 present-path NoToneMapping (ACES restored on `sessionend`); v0.18 present-path IBL off (`scene.environment` nulled; PMREM restored on `sessionend`); v0.19 present-path directional off (lookdev sun restored on `sessionend`); v0.20 present-path ambient-only fill (hemi off + `AmbientLight` 0.4; lookdev hemi restored on `sessionend`); v0.21 present-path anisotropy clamp to 1 (lookdev AF restored on `sessionend`); v0.22 present-path XR framebuffer scale clamp to 1 (lookdev scale restored on `sessionend`); v0.23 LOD2 albedo-only (ORM off; constant wood-ORM-midtone roughness/metalness); v0.24 LOD1 no-normals (albedo+ORM); v0.25 LOD1 albedo-only (ORM off; wood + brass ORM-midtone constants); v0.26 LOD1/LOD2 256² albedo; v0.27 LOD2 MeshBasic unlit; v0.28 LOD1 MeshBasic unlit; v0.29 LOD2 color-only MeshBasic; v0.30 LOD1 color-only MeshBasic; v0.31 LOD0 half-res 256²; v0.32 LOD0 no-normals (albedo+ORM); v0.33 LOD0 albedo-only (ORM drop); v0.34 LOD0 MeshBasic unlit (256² albedo kept); v0.35 LOD0 color-only MeshBasic (no map; unique canvases 3 → 0); L5 activity; headset ms still unmeasured; [examples/interactive-prop](../../examples/interactive-prop/) |

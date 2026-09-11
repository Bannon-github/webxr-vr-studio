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
| [crate-toolbox](crate-toolbox/) | 0.15.0 | L0–L5 | Seed; Quest 3; L2 canvases (albedo+ORM+normal) + L3 LOD1 half `normalScale` / LOD2 drops `normalMap` + KTX2 probe (no GLB); v0.8 allocation scrub; v0.9 hand hover-before-pinch; v0.10 tracking-loss `endGrab`; v0.11 visibility-loss `endGrab`; v0.15 present-path pixel-ratio clamp; L5 activity; headset ms still unmeasured; [examples/interactive-prop](../../examples/interactive-prop/) |

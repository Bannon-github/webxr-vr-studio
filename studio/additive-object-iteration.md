# Additive object iteration

Continual improvement **grows** a 3D object. It does not replace it from scratch.

A cycle that throws away the last readable mesh, collider split, or named states is a reset, not an iteration — unless the [decision tree](#decision-tree) says **NEW object** and the old `objectId` stays in the catalog as retired.

This page is the process. Identity and retention: [ADR 0005](adr/0005-additive-object-evolution.md). How a hero becomes interactive: [asset-to-interaction-workflow](asset-to-interaction-workflow.md). Catalog layout: [`assets/objects/`](../assets/objects/README.md).

## Object identity

| Field | Rule |
| --- | --- |
| `objectId` | Stable kebab-case (`crate-toolbox`). Assigned at L0. **Never reused.** Rename = new id + `deprecatedBy` on the old manifest. |
| Semantic version | Per object, not the repo. Patch = same node/collider contract. Minor = new layer or new legal state. Major = breaking contract — prefer **NEW** instead of a major bump. |
| Changelog | `assets/objects/<objectId>/CHANGELOG.md`. Every shipped cycle gets one dated entry with the measurable delta. |

Runtime and CDN still pin a **folder revision** ([content-pipeline](content-pipeline.md)). The catalog is what tells you that `content/…/r004/crate-toolbox.glb` is the same object as `r003`, not a different prop that happens to look similar.

## Decision tree

Ask in this order. Default is **UPGRADE**.

```
Does the user operate it the same way
(same affordance class: open-latch, pour, tool-tip, socket-snap)?
  NO  → NEW object (new objectId, L0). Keep the old id in the catalog.
  YES → Will the existing node / collider / pivot contract still hold
        after the change (same part names, same hinge, same grab hull role)?
          NO  → incompatible topology → NEW object.
                Record why the old revision is retained, not deleted.
          YES → Is this a look or locale swap only
                (paint, wear, language label, KHR_materials_variants)?
                  YES → ADD sibling variant on the same objectId
                        (`variants[]` in the manifest). Do not fork a new id.
                  NO  → UPGRADE the existing object
                        (materials, LOD, collider, new interaction state).
```

**UPGRADE** examples: tighter grab hull, ORM bake, LOD1, add `unlatched` to an already-opening lid.

**ADD sibling** examples: clean / dusty / locale sticker. Same `behavior.json` contract.

**NEW** (only when required): a crate that becomes a pour vessel; a lid hinge replaced by a drawer slide; a prop whose grab root moves to a child you cannot alias.

If you are unsure, UPGRADE and keep a revision. You can always mint a new id later. You cannot un-delete a discarded L1 mesh.

## Iteration layers (stack, do not replace)

Layers complete **upward**. A higher layer may refine a lower one; it may not silently drop it.

| Layer | Meaning | “Below target” looks like |
| --- | --- | --- |
| **L0** Blockout | Scale, origin, part empties, 1 unit = 1 m | Guessed size; no `objectId` |
| **L1** Readable mesh | Silhouette + separate moving parts; collider stubs | One merged sculpt; rays hit the hero |
| **L2** PBR photoreal | Metallic-roughness, no baked lighting in albedo | Plastic gray or photo-lit texture |
| **L3** LODs / perf | LOD1+, texture class, holds target Hz | LOD0 only; 4K handheld; misses v-sync |
| **L4** Interaction states | Hover / grab / use; named `Activity` states | Pretty sculpture; no latch/lid contract |
| **L5** Complex activity | Multi-step, physics hull, audio/haptics, hands optional | States exist; drop soft-locks; no nack |

`layersComplete` in the manifest is the stack you will not discard. `layerTarget` is the product bar for this object (a background flake may target L3; a hero toolbox targets L5).

**Never discard a lower layer** without a recorded reason on the object CHANGELOG (and keep the GLB that still had it under `revisions/`). “We remade it in a generator” is not a reason; “L1 topology could not hinge; see NEW `crate-toolbox-slide`” is.

## Revision retention

```
assets/objects/<objectId>/
  manifest.json          # current identity
  CHANGELOG.md
  BRIEF.md
  behavior.json          # current sidecar (ADR 0004)
  current.glb            # current visual (or omit if procedural — say so in manifest)
  revisions/
    v0.1.0/              # immutable snapshot of what shipped as 0.1.0
      manifest.json
      NOTES.md
      *.glb              # when a binary existed
```

- **In-repo default:** keep prior GLBs under `revisions/<semver>/`. Track `*.glb` / KTX2 with **Git LFS** (see [catalog](../assets/objects/README.md)).
- **Large or legal-sensitive binaries:** same folder names on object storage, pointer file in git (`revisions/<semver>/POINTER.md` → immutable URL). Do not leave a hole with no pointer.
- **Ship path:** copy the current files into `content/<project>/<revision>/` — do not point the runtime at a mutable `current.glb` on main.

Deleting `revisions/` to “clean up” is a process bug.

## Additive done (one cycle)

A cycle is done when **all** of these are true:

1. **One measurable delta** — named in the CHANGELOG (new state, LOD0 triangle cut, grab volume fix, variant added). Not “general polish.”
2. **Same `objectId`.** NEW objects are a different cycle with a new L0.
3. **Prior revision retained** (folder or pointer) if a binary or behavior file changed.
4. **Manifest** `version` + `layersComplete` updated if a layer newly holds.
5. Applicable [quality-bar](quality-bar.md) interactive-asset boxes still pass (do not regress L4 to get L2).

If you changed three layers, you ran three cycles or you scope-crept. Split the notes anyway.

## Two-hour improvement pulse

When the studio pulse touches objects (see [playbook](playbook.md) cadence):

1. Open the catalog. Skip anything already at `layerTarget`.
2. Pick the object whose **lowest incomplete layer** is weakest vs target (a hero stuck on L1 beats polishing L2 wear on a dress piece).
3. Improve **only that layer**. One delta.
4. Write the object CHANGELOG line. Bump the object semver. Stop.

Do not start a NEW object in a pulse unless the tree said NEW **and** the delta is “create L0 identity + BRIEF.” Do not spend the pulse re-exporting a full hero “while we are in Blender.”

## Related

| Doc | Role |
| --- | --- |
| [ADR 0005](adr/0005-additive-object-evolution.md) | IDs, manifests, retention |
| [assets/objects/](../assets/objects/README.md) | Catalog + template |
| [asset-to-interaction-workflow](asset-to-interaction-workflow.md) | First-time hero path (feeds L0–L5) |
| [content-pipeline](content-pipeline.md) | Export / CDN snapshot |

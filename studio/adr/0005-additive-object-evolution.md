# ADR 0005 — Additive object evolution

- Status: Accepted
- Date: 2026-09-09

## Context

Photoreal interactive props are expensive to start and easy to accidentally restart. Generator dumps, “new folder for the new look,” and overwriting a GLB in place all break the [asset-to-interaction](../asset-to-interaction-workflow.md) contract: visual, collider, and behavior stop lining up, and we lose the last version that actually worked in headset.

We need a default for **how objects grow** that does not fight [ADR 0004](0004-asset-interaction-architecture.md) (glTF + sidecar) or the CDN snapshot path in [content-pipeline](../content-pipeline.md).

## Decision

1. **Stable `objectId`.** Assigned at L0. Kebab-case. Immutable. Never recycled. Catalog path: `assets/objects/<objectId>/`.

2. **Layered manifest.** Each object has `manifest.json` with at least `id`, `version` (semver), `layersComplete` (L0–L5), `interactions[]`, `deps[]`. Optional `layerTarget`, `variants[]`, `deprecatedBy`, `source`. The manifest is the index; `behavior.json` remains the ADR 0004 sidecar.

3. **Revision retention.** Every shipped object version that changed a binary or behavior file is copied to `assets/objects/<objectId>/revisions/<semver>/` (or a POINTER.md to immutable storage). Git LFS for GLB/KTX2. Overwriting `current.glb` without a revision copy is not allowed.

4. **Prefer UPGRADE / variant over NEW.** New `objectId` only for a new affordance class or incompatible topology ([iteration process](../additive-object-iteration.md)). Variants stay on the same id.

5. **CDN is a snapshot, not the identity.** `content/<project>/<revision>/` pins files for a release. Apps depend on `objectId` + object semver, not on a filename that got replaced.

## Consequences

- Improvement pulses have a legal target (weakest layer below `layerTarget`) and a done check (one CHANGELOG delta).
- Seed object: [`assets/objects/crate-toolbox`](../../assets/objects/crate-toolbox/) — same crate as [`examples/interactive-prop`](../../examples/interactive-prop/).
- Supersede this ADR if a future Khronos or studio package format owns identity; do not invent `KHR_studio_object`.

# Content pipeline

Asset path from DCC to headset. This page is the **export and ingest checklist**.

For generation choices (scan vs AI vs DCC), cleanup, interaction metadata, WebXR binding, and QA gates, use the full **[asset-to-interaction workflow](asset-to-interaction-workflow.md)**. Architecture: [ADR 0004](adr/0004-asset-interaction-architecture.md). Growing an existing object (not replacing it): [additive-object-iteration](additive-object-iteration.md), [ADR 0005](adr/0005-additive-object-evolution.md), catalog [`assets/objects/`](../assets/objects/README.md). Frame-budget photoreal: [photoreal-realtime](../docs/performance/photoreal-realtime.md).

## Flow

1. **Brief** — Photoreal refs + named activity states + grab vs use parts ([workflow §1](asset-to-interaction-workflow.md))
2. **Author** — Blender/Maya/etc. real-world scale (1 unit = 1 meter). Moving parts are separate nodes; colliders are `collider_*` meshes, not the hero
3. **Export** — GLB (glTF 2.0); y-up as engine expects; apply transforms
4. **Metadata** — `*.behavior.json` sidecar (source of truth) and/or `extras.studio` on the root ([ADR 0004](adr/0004-asset-interaction-architecture.md))
5. **Optimize** — meshopt / Draco as needed; generate KTX2/Basis mipmapped textures; atlas where useful; build LODs. **How:** [ktx2-quest3-packaging](../docs/performance/ktx2-quest3-packaging.md)
6. **Validate** — glTF validator; triangle/texture class vs [photoreal-realtime](../docs/performance/photoreal-realtime.md) and [quest-3-target](../docs/shipping/quest-3-target.md); sidecar + `targetDevice`/`perf` sanity
7. **Integrate** — versioned URL or app assets folder; loading screen with progress; ingest attaches components and **hides colliders**
8. **Verify on Quest 3** — 90 Hz, FFR medium/high, lighting, scale, hover/grab/activity ([quality-bar](quality-bar.md))

Steps 2–3 and 5–8 are the original DCC → headset path. Steps 1, 4, and the interaction half of 8 are required for any prop the user operates.

## Budgets (template — tune per product)

Gate: [Quest 3](../docs/shipping/quest-3-target.md) @ 90 Hz. Scene soft caps: ≲100 draw calls, ≲750k tris/eye. Details: [photoreal-realtime](../docs/performance/photoreal-realtime.md).

| Class | Triangles (LOD0) | Texture |
| --- | --- | --- |
| Hero interactive prop | 5–20 k | **≤1024²** preferred (2048² max) + packed ORM |
| Held tool | 2–8 k | 512–1024 |
| Set dressing (in reach) | 1–5 k | 512–1024 |
| Background / far | LOD2 or card | 256–512 |
| Collision hull | 12–200 | none (hidden) |

Avatar class remains product-specific (TBD per title).

## Naming

**Identity:** `assets/objects/<objectId>/` — stable id, `manifest.json`, object CHANGELOG, retained `revisions/<semver>/` ([catalog](../assets/objects/README.md)).

**Ship snapshot:** `content/<project>/<revision>/` — immutable CDN folder copied from the object’s current files (plus `objectId` + object semver in the snapshot notes). Do not treat a replaced filename on CDN as a new object.

Typical snapshot contents:

- `prop.glb` (from `current.glb` when `source.kind` is `gltf`)
- `prop.behavior.json`
- `BRIEF.md`
- baked sources / lofted only if the revision needs a rebuild (optional)

## Reviews

- **Art lead** — scale, silhouette, PBR (no baked lighting in albedo), texel density
- **Eng** — memory, draw cost, collider split, sidecar ingest
- **Design** — readability at distance, named states, grab vs use targets ([interactive-objects](../docs/design/interactive-objects.md))
- **QA** — [quality-bar](quality-bar.md) interactive assets + headset FFR

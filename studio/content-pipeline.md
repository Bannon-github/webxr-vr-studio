# Content pipeline

Asset path from DCC to headset. This page is the **export and ingest checklist**.

For generation choices (scan vs AI vs DCC), cleanup, interaction metadata, WebXR binding, and QA gates, use the full **[asset-to-interaction workflow](asset-to-interaction-workflow.md)**. Architecture: [ADR 0004](adr/0004-asset-interaction-architecture.md). Frame-budget photoreal: [photoreal-realtime](../docs/performance/photoreal-realtime.md).

## Flow

1. **Brief** — Photoreal refs + named activity states + grab vs use parts ([workflow §1](asset-to-interaction-workflow.md))
2. **Author** — Blender/Maya/etc. real-world scale (1 unit = 1 meter). Moving parts are separate nodes; colliders are `collider_*` meshes, not the hero
3. **Export** — GLB (glTF 2.0); y-up as engine expects; apply transforms
4. **Metadata** — `*.behavior.json` sidecar (source of truth) and/or `extras.studio` on the root ([ADR 0004](adr/0004-asset-interaction-architecture.md))
5. **Optimize** — meshopt / Draco as needed; generate KTX2/Basis mipmapped textures; atlas where useful; build LODs
6. **Validate** — glTF validator; triangle/texture class vs [photoreal-realtime](../docs/performance/photoreal-realtime.md); sidecar schema sanity
7. **Integrate** — versioned URL or app assets folder; loading screen with progress; ingest attaches components and **hides colliders**
8. **Verify on device** — lighting, scale, material proxies, FFR readability, hover/grab/activity ([quality-bar](quality-bar.md) interactive assets)

Steps 2–3 and 5–8 are the original DCC → headset path. Steps 1, 4, and the interaction half of 8 are required for any prop the user operates.

## Budgets (template — tune per product)

Starting numbers for Quest-class standalone. Override in the project brief if measured otherwise. Details: [photoreal-realtime](../docs/performance/photoreal-realtime.md).

| Class | Triangles (LOD0) | Texture |
| --- | --- | --- |
| Hero interactive prop | 5–20 k | 1–2K albedo + 1–2K normal + 1K ORM |
| Held tool | 2–8 k | 1K set |
| Set dressing (in reach) | 1–5 k | 512–1K |
| Background / far | LOD2 or card | 256–512 |
| Collision hull | 12–200 | none (hidden) |

Avatar class remains product-specific (TBD per title).

## Naming

`content/<project>/<revision>/` with immutable revision folders for CDN.

Typical revision contents:

- `prop.glb`
- `prop.behavior.json`
- `BRIEF.md`
- baked sources / lofted only if the revision needs a rebuild (optional)

## Reviews

- **Art lead** — scale, silhouette, PBR (no baked lighting in albedo), texel density
- **Eng** — memory, draw cost, collider split, sidecar ingest
- **Design** — readability at distance, named states, grab vs use targets ([interactive-objects](../docs/design/interactive-objects.md))
- **QA** — [quality-bar](quality-bar.md) interactive assets + headset FFR

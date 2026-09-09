# Content pipeline

Asset path from DCC to headset.

## Flow

1. **Author** — Blender/Maya/etc. real-world scale (1 unit = 1 meter)
2. **Export** — GLB (glTF 2.0); y-up as engine expects; apply transforms
3. **Optimize** — meshopt / Draco as needed; generate KTX2/Basis mipmapped textures; atlas where useful
4. **Validate** — glTF validator; triangle/texture budgets vs docs/performance
5. **Integrate** — versioned URL or app assets folder; loading screen with progress
6. **Verify on device** — lighting, scale, material proxies, FFR readability

## Budgets (template — tune per product)

| Class | Triangles | Texture |
| --- | --- | --- |
| Hero prop | TBD | TBD |
| Background set | TBD | TBD |
| Avatar | TBD | TBD |

## Naming

content/<project>/<revision>/... with immutable revision folders for CDN.

## Reviews

Art lead checks scale and silhouette; eng checks memory and draw cost; design checks readability at distance.

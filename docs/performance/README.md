# Performance

Standalone HMDs are thermally and GPU constrained. Comfort collapses when you miss v-sync.

**Gate device:** [Quest 3](../shipping/quest-3-target.md) @ 90 Hz. Do not author against a desktop GPU and “see if Quest holds.”

## Frame budgets

| Refresh | Budget (approx) |
| --- | --- |
| 72 Hz | 13.9 ms |
| 90 Hz | 11.1 ms |
| 120 Hz | 8.3 ms |

Leave headroom for browser + compositor. Target ~70–80% of budget on device, not on a desktop GPU.

## Draw calls and CPU

- Merge static meshes; use instancing for repeats
- Avoid per-frame GC (no new materials/arrays in the XR rAF)
- Keep JS work under ~2–3 ms when possible
- Prefer fewer unique materials / shaders

## Geometry and textures

- Budget triangles per scene for the lowest target device
- Power-of-two textures; ASTC/ETC2/Basis/KTX2 where supported — Quest 3 prop recipe: [ktx2-quest3-packaging.md](ktx2-quest3-packaging.md)
- Mipmaps on; avoid 4K textures on props
- Atlas UI when practical

## Foveation and resolution

- Use XRWebGLLayer.fixedFoveation when supported (see fundamentals/layers-and-ffr.md)
- Prefer runtime framebufferScaleFactor / renderScale knobs over unchecked supersampling. `crate-toolbox` v0.15 clamps `renderer.setPixelRatio(1)` on `sessionstart` and restores the desktop cap on `sessionend` (not per-frame).
- Present-path MSAA off: construct `WebGLRenderer({ antialias: false })` so Three r170 copies that into `XRWebGLLayer`. There is no live `setAntialias`. `crate-toolbox` v0.16.
- Present-path tone mapping: `NoToneMapping` while XR presenting (skip ACESFilmic output ALU). Restore lookdev `ACESFilmicToneMapping` + prior `toneMappingExposure` on `sessionend`. `crate-toolbox` v0.17. Not per-frame.
- Present-path IBL: null `scene.environment` while XR presenting (skip MeshStandardMaterial `USE_ENVMAP` / `textureCubeUV`). r170 `environmentIntensity` is a post-sample multiply and does not skip sampling. Restore the saved PMREM + lookdev intensity on `sessionend` (do not dispose). `crate-toolbox` v0.18. Not per-frame.
- Do not render to an intermediate full-res buffer then blit if you want FFR benefits (FFR applies to the eye buffer path)

## Profiling checklist

1. Record on-device frame time (browser perf HUD / Meta metrics / Spector.js / engine instrumentation)
2. Identify CPU vs GPU bound
3. Count draw calls and triangles in a representative scene
4. Check texture memory
5. Disable postprocess; re-measure
6. Test thermal soak (10+ minutes)
7. Retest with FFR 0 / 0.5 / 1
8. Verify no GC spikes on interaction storms

Fail the build if **Quest 3** cannot hold **90 Hz** in the hero scene ([quest-3-target](../shipping/quest-3-target.md); 72 Hz is fallback only).

## Photoreal props

Interactive hero assets have their own class budgets, IBL rules, and “do not path-trace on-device” constraints: [photoreal-realtime.md](photoreal-realtime.md). Pair with [asset-to-interaction-workflow](../../studio/asset-to-interaction-workflow.md) so optimization does not strip colliders or bake lighting into albedo.

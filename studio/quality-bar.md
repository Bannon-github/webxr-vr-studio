# Quality bar — definition of done

An immersive feature or release is **done** only when all applicable boxes pass.

**Gate device:** Meta Quest 3 + Meta Quest Browser @ **90 Hz** (72 Hz fallback). Details and studio budgets: [quest-3-target](../docs/shipping/quest-3-target.md). Desktop/emulator is smoke, not the gate. 120 Hz is stretch; 207/240 Hz is out of scope.

## XR correctness

- [ ] Secure context verified on headset URL
- [ ] isSessionSupported gates the Enter VR CTA
- [ ] requestSession only on user gesture
- [ ] Tracking loss handled (null poses) (`crate-toolbox` v0.10: held crate/tool `endGrab` on null grip/ray/joint pose or removed input source)
- [ ] Visibility loss handled (session `hidden` / `visible-blurred`, or `document.hidden` while presenting) (`crate-toolbox` v0.11: same `endGrab`; no auto-regrab on restore)
- [ ] Session end restores 2D UI; re-entry works
- [ ] Controllers: rays, select, squeeze as designed
- [ ] Reference space fallback chain works

## Comfort

- [ ] Default locomotion is Tier A (or justified ADR exception)
- [ ] Settings expose turn and loco preferences
- [ ] Comfort-sensitive tester signed off
- [ ] No forced artificial pitch

## Performance

- [ ] Quest 3 holds **90 Hz** in the hero scene (≈11.1 ms); 72 Hz is a recorded fallback, not the happy path ([quest-3-target](../docs/shipping/quest-3-target.md))
- [ ] Thermal soak 10+ minutes on Quest 3 without collapse
- [ ] Hero view: draw calls ≲100; triangles ≲750k/eye soft ceiling; props prefer ≤1024² (max 2048²); KTX2 + mipmaps ([ktx2-quest3-packaging](../docs/performance/ktx2-quest3-packaging.md))
- [ ] FFR medium/high (`fixedFoveation` ≈0.5–1) when the UA exposes it
- [ ] No allocations / `new` in the XR frame loop (**frame-loop allocation scrub**: hoist scratch vectors; no per-frame arrays or `new THREE.*` on the present path when diagnostics are off — `crate-toolbox` v0.8)
- [ ] Present-path pixel ratio clamped to 1 while XR presenting; restore desktop ratio + `setSize` on session end (`crate-toolbox` v0.15)
- [ ] Present-path antialias / MSAA off while XR presenting (`crate-toolbox` v0.16: constructor `antialias: false` so Three’s `XRWebGLLayer` inherits it; WebGL attribute is immutable — do not invent a live flip)
- [ ] Present-path `NoToneMapping` while XR presenting; restore lookdev `ACESFilmicToneMapping` + prior `toneMappingExposure` on session end (`crate-toolbox` v0.17)
- [ ] Present-path IBL / `scene.environment` off while XR presenting; restore the saved PMREM + lookdev `environmentIntensity` on session end without disposing (`crate-toolbox` v0.18)
- [ ] Present-path directional / punctual off while XR presenting; restore lookdev `DirectionalLight` visible + intensity on session end (`crate-toolbox` v0.19)
- [ ] Present-path ambient-only fill while XR presenting (HemisphereLight off + one `AmbientLight` at intensity 0.4); restore lookdev hemi and disable/detach the present-only ambient on session end (`crate-toolbox` v0.20)
- [ ] Present-path texture anisotropy clamped to 1 while XR presenting; restore lookdev `.anisotropy` on session end (`crate-toolbox` v0.21)
- [ ] Present-path XR framebuffer scale factor clamped to 1 while XR presenting; restore lookdev/desktop scale on session end (`crate-toolbox` v0.22; Three r170 `setFramebufferScaleFactor` only — no getter; set while presenting does not rebuild the current layer)
- [ ] Texture/draw/tri budgets written on the object manifest `perf` block
- [ ] On-device matrix filled per [quest-3-on-device-qa](../docs/shipping/quest-3-on-device-qa.md) (Browser, firmware, SHA, requested Hz, FFR, method). Leave cells blank until a headset run — do not invent ms.

## Interactive assets

Applies when the user hovers, grabs, or drives a multi-step activity. Full path: [asset-to-interaction-workflow.md](asset-to-interaction-workflow.md). Architecture: [ADR 0004](adr/0004-asset-interaction-architecture.md).

- [ ] Visual mesh is not the grab/ray target (separate `collider_*` hulls)
- [ ] Hover / pressed / disabled / grabbed affordances readable under FFR
- [ ] Activity states named; illegal transitions nack; drop does not soft-lock
- [ ] Controllers: `select` = use, `squeeze` = grab; core loop works without hands
- [ ] Hand path (if advertised) is optional; pinch maps to the same intents; hover-before-pinch matches controller emissive (`crate-toolbox` v0.9)
- [ ] Texture / LOD / triangle class meets [photoreal-realtime](../docs/performance/photoreal-realtime.md) **on Quest 3** (L2/L3 inside [quest-3-target](../docs/shipping/quest-3-target.md); baked maps + LODs, not scan density)
- [ ] LOD2 far materials are unlit `MeshBasicMaterial` (or glTF `KHR_materials_unlit`) **without** a `baseColorTexture` (color-only, or tiny 1×1 / vertex color) — no `normalMap`, no ORM, no roughness/metalness uniforms (`crate-toolbox` v0.29; loader does not rewrite materials)
- [ ] LOD1 mid materials are unlit `MeshBasicMaterial` (or glTF `KHR_materials_unlit`) **without** a `baseColorTexture` (color-only, or tiny 1×1 / vertex color) — no `normalMap`, no ORM, no roughness/metalness uniforms (`crate-toolbox` v0.30; loader does not rewrite materials)
- [ ] LOD0 hero materials may be unlit/basic (or `KHR_materials_unlit`) **without** a `baseColorTexture` (color-only, or tiny 1×1 / vertex color) — no `normalMap`, no ORM, no roughness/metalness uniforms (`crate-toolbox` v0.35; loader does not rewrite materials)
- [ ] Packaged GLB ingest wires conventional `lod0` / `lod1` / `lod2` (or `userData.lodLevel`) into `userData.lod` and shows only one level; missing names fail soft without inventing fake LODs; colliders and fastener stay out of LOD groups (`crate-toolbox` v0.36; visibility-only switch)
- [ ] Procedural LOD0/LOD1 merge same-material meshes within each static lodGroup (do not merge across body / lid / latch / tool); duplicate same-color MeshBasics share one instance (`crate-toolbox` v0.37; measured LOD0 14 → 6 draws, LOD1 8 → 4; tris unchanged)
- [ ] Packaged GLB ingest merges same-material meshes within each discovered `lod0` / `lod1` / `lod2` group (same helper as procedural v0.37; direct mesh children; skip colliders / fastener / multi-material; do not merge across LOD levels); missing names still fail soft (`crate-toolbox` v0.38; unit/mock 3→1 draws, tris unchanged; no material rewrite)
- [ ] After same-material concat, weld coincident vertices (position hash 1e-4 m; keep UV/normal channels). Prefer DCC pre-weld; runtime weld is a safety net (`crate-toolbox` v0.39; unique verts 440 → 230 / 192 → 100; tris and draws unchanged; unit/mock 72 → 8)
- [ ] After weld, strip unused `uv` / `normal` (and other unused channels) from color-only unlit MeshBasic (no map / no lighting). Prefer omitting them in DCC; runtime strip is a safety net (`crate-toolbox` v0.40; attrBytes 8800 → 4200 / 3776 → 1776 / 1680 → 720; draws / tris / unique verts unchanged)
- [ ] After unused-attr strip, compact a lingering Uint32 index to Uint16 when `position.count` ≤ 65535 (concat always builds Uint32; weld only rewrites Uint16 when verts drop). Fastener stays outside LOD merge but gets the same strip + compact (`crate-toolbox` v0.41; LOD attrBytes stay 4200 / 1776 / 720; fastener 840 → 360)
- [ ] Procedural color-only unlit MeshBasic instances are shared across LOD levels when the midtone hex matches (one wood for LOD0/1/2, one brass for LOD0/1 + fastener, one steel). Packaged ingest does not hex-dedupe (`crate-toolbox` v0.42; unique MeshBasic 6 → 3; draws / tris / verts / attrBytes unchanged vs v0.41)
- [ ] After that pack, color-only unlit MeshBasic LOD/fastener geometries set `StaticDrawUsage` and Three r170 `onUpload` so the first GPU upload releases CPU `.array`. Colliders keep CPU arrays. Pre-upload attrBytes stay at the v0.42 envelope; post-upload CPU attrBytes → 0 (`crate-toolbox` v0.43)
- [ ] After Uint16 compact and before that `onUpload` hook, quantize Float32 `position` to Three r170 `Float16BufferAttribute` (WebGL2 `HALF_FLOAT`) on color-only unlit MeshBasic LOD/fastener geometries. Colliders stay Float32. Pre-upload attrBytes 4200 → 2820 / 1776 → 1176 / 720 → 432; fastener 360 → 216; post-upload CPU attrBytes → 0 (`crate-toolbox` v0.44)
- [ ] After that pack, freeze `matrixAutoUpdate` on static packed color-only unlit MeshBasic visual leaves that are not descendants of `lid` / `latch` / `tool` pivots (one `updateMatrixWorld(true)` first). Fastener and colliders stay live. Draws / tris / verts / attrBytes stay at the v0.44 envelope; measured 3 frozen / 10 live MeshBasic (`crate-toolbox` v0.45)
- [ ] After that freeze, disable `Mesh.raycast` on packed color-only unlit MeshBasic visual meshes (LOD body + lid/latch/tool + fastener) with a named no-op. Colliders keep `Mesh.prototype.raycast`. Draws / tris / verts / attrBytes / matrix freeze stay at the v0.45 envelope; measured 13 raycast-off / 5 collider default (`crate-toolbox` v0.46)
- [ ] After that raycast disable, pin `fog = false` and `toneMapped = false` on packed color-only unlit MeshBasic materials (same `isColorOnlyUnlitBasic` gate). Shared wood/brass/steel instances get the flags once. Mapped / lit / colliders stay r170 defaults. Draws / tris / verts / attrBytes / raycast-off / matrix freeze stay at the v0.46 envelope (`crate-toolbox` v0.47)
- [ ] After that flag pin, also pin opaque FrontSide draw-state (`transparent = false`, `opacity = 1`, `depthWrite = true`, `depthTest = true`, `side = FrontSide`) on packed color-only unlit MeshBasic materials (same `isColorOnlyUnlitBasic` gate and helpers). Shared wood/brass/steel instances get the flags once. Mapped / lit / colliders stay authored / r170 defaults. Draws / tris / verts / attrBytes / raycast-off / matrix freeze stay at the v0.47 envelope (`crate-toolbox` v0.48)
- [ ] After that opaque FrontSide pin, also pin `castShadow = false` and `receiveShadow = false` on packed color-only unlit MeshBasic visual meshes (same `isColorOnlyUnlitBasic` gate). Mapped / lit / colliders stay authored / r170 Mesh defaults. Draws / tris / verts / attrBytes / unique MeshBasic / raycast-off / matrix freeze stay at the v0.48 envelope (`crate-toolbox` v0.49)
- [ ] After that shadow-flag pin, also pin `frustumCulled = true` on packed color-only unlit MeshBasic visual meshes (same `isColorOnlyUnlitBasic` gate). Mapped / lit / colliders stay authored / r170 Mesh defaults. Draws / tris / verts / attrBytes / unique MeshBasic / raycast-off / matrix freeze / shadow-off stay at the v0.49 envelope (`crate-toolbox` v0.50)
- [ ] After that frustumCulled pin, also pin `blending = NormalBlending`, `premultipliedAlpha = false`, and `alphaTest = 0` on packed color-only unlit MeshBasic materials (same `isColorOnlyUnlitBasic` gate and helpers; companions `dithering = false` / `alphaToCoverage = false`). Shared wood/brass/steel instances get the flags once. Mapped / lit / colliders stay authored / r170 defaults. Draws / tris / verts / attrBytes / unique MeshBasic / raycast-off / matrix freeze / shadow-off / frustumCulled-on stay at the v0.50 envelope (`crate-toolbox` v0.51)
- [ ] After that blending/alpha pin, also pin `wireframe = false`, `colorWrite = true`, `depthFunc = LessEqualDepth`, and `polygonOffset = false` (`polygonOffsetFactor = 0` / `polygonOffsetUnits = 0`) on packed color-only unlit MeshBasic materials (same `isColorOnlyUnlitBasic` gate and helpers). Shared wood/brass/steel instances get the flags once. Mapped / lit / colliders stay authored / r170 defaults. Draws / tris / verts / attrBytes / unique MeshBasic / raycast-off / matrix freeze / shadow-off / frustumCulled-on stay at the v0.51 envelope (`crate-toolbox` v0.52)
- [ ] After that wireframe/depthFunc/colorWrite/polygonOffset pin, also pin r170 Material stencil defaults (`stencilWrite = false`, `stencilFunc = AlwaysStencilFunc`, `stencilRef = 0`, `stencilWriteMask = 0xff`, `stencilFuncMask = 0xff`, `stencilFail = KeepStencilOp`, `stencilZFail = KeepStencilOp`, `stencilZPass = KeepStencilOp`) on packed color-only unlit MeshBasic materials (same `isColorOnlyUnlitBasic` gate and helpers). Shared wood/brass/steel instances get the flags once. Mapped / lit / colliders stay authored / r170 defaults. Draws / tris / verts / attrBytes / unique MeshBasic / raycast-off / matrix freeze / shadow-off / frustumCulled-on stay at the v0.52 envelope (`crate-toolbox` v0.53)
- [ ] Scale 1 unit = 1 m; seated reach or ray-use for every required step
- [ ] Throw / physics never applies impulse to the camera rig
- [ ] State change is visual + audio and/or haptic; not audio-only
- [ ] Sidecar or `extras.studio` ingest validated (glTF Validator + behavior sanity)

## A11y / UX

- [ ] Seated mode viable
- [ ] Critical info not audio-only
- [ ] Recenter / height adjustment available

## Shipping

- [ ] Device/browser matrix updated
- [ ] CHANGELOG entry
- [ ] Known issues listed in release notes

# Learning path — WebXR VR Studio

A pragmatic path from “can I enter VR?” to “can we ship a comfortable product?”

## 1. Platform literacy (1–2 days)

1. Read [MDN: WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API).
2. Skim the [Immersive Web explainer](https://immersive-web.github.io/webxr/explainer.html).
3. Internalize: secure context → `navigator.xr` → `isSessionSupported` → user gesture → `requestSession` → reference space → `requestAnimationFrame` → `getViewerPose` → render to `XRWebGLLayer`.
4. Work through [`docs/fundamentals/`](docs/fundamentals/).

## 2. Hands-on (1–3 days)

1. Run [`examples/webxr-starter`](examples/webxr-starter/) on desktop with the WebXR API Emulator, then on a Quest headset over HTTPS / LAN.
2. Trace `select` / `squeezestart` events and `XRInputSource.targetRaySpace` / `gripSpace`.
3. Change reference space from `local` to `local-floor` and observe floor alignment.

## 3. Engine choice (half day)

1. Read [`docs/stack/`](docs/stack/) and [ADR 0001](studio/adr/0001-framework.md).
2. Prototype the same scene in your shortlisted engine; do **not** debate without a frame-time sample.

## 4. Comfort & interaction (ongoing)

1. [`docs/design/`](docs/design/) — especially locomotion and FOV vignette patterns.
2. [ADR 0002](studio/adr/0002-locomotion.md) and [ADR 0003](studio/adr/0003-interaction.md).
3. Pair with someone who gets VR-sick easily for every locomotion change.

## 5. Photoreal interactive assets

1. Read [asset-to-interaction-workflow](studio/asset-to-interaction-workflow.md) and [ADR 0004](studio/adr/0004-asset-interaction-architecture.md).
2. Run [`examples/interactive-prop`](examples/interactive-prop/) — latch (cancel by latching again), open, grab the tool, drive the front fastener four times. `C` = colliders; `1`/`2`/`3` = L3 LODs; `P` = Quest 3 diag overlay. Same `crate-toolbox` id.
3. Pair with [interactive-objects](docs/design/interactive-objects.md) (affordances) and [photoreal-realtime](docs/performance/photoreal-realtime.md) (budgets). v0.6 L2 maps are 512² procedural albedo+ORM; v0.12 adds matching 512² normals; v0.13 drops `normalMap` on LOD2; v0.14 halves LOD1 `normalScale` (same maps); v0.23 drops ORM on LOD2 (albedo-only; constant wood-ORM-midtone roughness/metalness); v0.24 drops `normalMap` on LOD1 (albedo+ORM only); v0.25 drops ORM on LOD1 (albedo-only; constant wood-ORM-midtone roughness/metalness on wood/handle, brass-ORM-midtone on latch); v0.26 binds 256² albedo on LOD1/LOD2 (LOD0 stays 512²); v0.27 switches LOD2 far wood to unlit `MeshBasicMaterial` (same 256² albedo; no roughness/metalness); v0.28 switches LOD1 mid body / lid / latch / tool stub to unlit `MeshBasicMaterial` (same 256² wood / brass albedos; no roughness/metalness); v0.29 drops the LOD2 albedo `map` (color-only unlit MeshBasic at wood midtone `0x633318`; LOD1 still 256² MeshBasic; unique canvases stay 11); v0.30 drops the LOD1 albedo `map` (color-only unlit MeshBasic at wood midtone `0x633318` / brass midtone `0xBE7E31`; unique canvases 11 → 9); v0.31 halves LOD0 hero maps (512² → 256² MeshStandard albedo+ORM+normal at full modest `normalScale`; unique canvases stay 9; `L3_LOD_ALBEDO_SIZE` stays the historical 256 mid/far constant); v0.32 drops LOD0 `normalMap` (256² MeshStandard albedo+ORM only; unique canvases 9 → 6); v0.33 drops LOD0 packed ORM (256² MeshStandard albedo-only; constant wood/brass/steel ORM-midtone roughness/metalness; unique canvases 6 → 3); v0.34 switches LOD0 to unlit MeshBasic with the same 256² albedo maps (no roughness/metalness; unique canvases stay 3); v0.35 drops the LOD0 albedo `map` (color-only unlit MeshBasic at wood midtone `0x633318` / brass midtone `0xBE7E31` / steel midtone `0xC1C3C9`; unique canvases 3 → 0). v0.36 wires packaged `lod0` / `lod1` / `lod2` (or `userData.lodLevel`) into `userData.lod` so only one packaged level draws; missing names fail soft. v0.37 merges same-material meshes within each procedural lodGroup (LOD0 14 → 6 draws, LOD1 8 → 4; tris unchanged; wood/woodDark/handleMat share one MeshBasic). v0.38 applies that same merge on packaged ingest within each discovered lod* group (unit/mock 3→1; procedural draws unchanged). v0.39 welds coincident vertices after concat (unique verts 440 → 230 / 192 → 100; tris and draws unchanged). v0.40 strips unused uv/normal after weld on color-only MeshBasic (attrBytes 8800 → 4200 / 3776 → 1776 / 1680 → 720; draws / tris / verts unchanged). v0.41 compact lingering Uint32 indices to Uint16 when verts fit (LOD attrBytes stay 4200 / 1776 / 720 — already Uint16 after weld); fastener unused-attr strip + compact (840 → 360; stays outside LOD merge). v0.42 shares identical color-only MeshBasic instances across LOD levels when the midtone hex matches (unique instances 6 → 3; draws / tris / verts / attrBytes unchanged; packaged hex-dedupe skipped). v0.43 sets StaticDrawUsage + Three r170 onUpload so the first GPU upload releases CPU `.array` on color-only MeshBasic LOD/fastener geos (pre-upload attrBytes stay 4200 / 1776 / 720 + fastener 360; post-upload CPU attrBytes → 0; colliders keep arrays). v0.44 quantizes Float32 `position` to Float16 on those same geos after Uint16 compact (pre-upload attrBytes 4200 → 2820 / 1776 → 1176 / 720 → 432; fastener 360 → 216). v0.45 freezes `matrixAutoUpdate` on static color-only MeshBasic body LOD leaves after one `updateMatrixWorld(true)` (lid/latch/tool/fastener stay live; 3 frozen / 10 live). v0.46 disables `Mesh.raycast` on packed color-only MeshBasic visuals (body + lid/latch/tool + fastener; 13 raycast-off; colliders keep default; pick path stays AABB). v0.47 pins `fog = false` and `toneMapped = false` on packed color-only unlit MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay r170 defaults). v0.48 also pins opaque FrontSide draw-state (`transparent = false`, `opacity = 1`, `depthWrite = true`, `depthTest = true`, `side = FrontSide`) on those same materials (mapped/lit/colliders stay authored / r170 defaults). v0.49 pins `castShadow = false` and `receiveShadow = false` on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.50 pins `frustumCulled = true` on those same packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.51 also pins `blending = NormalBlending` / `premultipliedAlpha = false` / `alphaTest = 0` (companions `dithering = false` / `alphaToCoverage = false`) on those same packed color-only MeshBasic materials (mapped/lit/colliders stay authored / r170 defaults). v0.7 probes a KTX2 GLB when you drop one in ([ktx2-quest3-packaging](docs/performance/ktx2-quest3-packaging.md)). v0.8 scrubs per-frame allocations on the XR loop (overlay off). v0.9: hand hover before pinch. v0.10: tracking-loss / null-pose `endGrab`. v0.11: visibility-loss `endGrab` (no auto-regrab). v0.15: clamp WebGL pixel ratio to 1 while presenting (restore on `sessionend`). v0.16: present-path antialias/MSAA off (constructor `antialias: false`; Three copies it into `XRWebGLLayer` — no live flip). v0.17: present-path `NoToneMapping` while immersive; restore lookdev ACES + exposure on `sessionend`. v0.18: present-path IBL off while immersive (null `scene.environment`; r170 intensity does not skip sampling); restore the saved PMREM + lookdev intensity on `sessionend`. v0.19: present-path directional / punctual off while immersive (hemisphere-only; `sun.visible = false` + intensity 0 — r170 intensity 0 does not drop `NUM_DIR_LIGHTS`); restore lookdev visible + intensity on `sessionend`. v0.20: present-path ambient-only fill while immersive (HemisphereLight off + one `AmbientLight` at intensity 0.4; r170 intensity 0 does not drop `NUM_HEMI_LIGHTS`); restore lookdev hemi and disable/detach the present-only ambient on `sessionend`. v0.21: present-path texture anisotropy clamp to 1 while immersive (lookdev / packaged GLB may use GPU max); restore saved lookdev anisotropy on `sessionend`. v0.22: present-path XR framebuffer scale factor clamp to 1 while immersive (`setFramebufferScaleFactor`; r170 has no getter and cannot rebuild the current layer while presenting — also set 1 at renderer setup); restore saved lookdev scale on `sessionend`.
4. Do not ship a generator or scan mesh as a grab target without retopo, UVs, and a collider split.

## 6. Ship discipline

1. [`docs/performance/`](docs/performance/) checklist before feature freeze.
2. [`docs/shipping/`](docs/shipping/) matrix filled for the release. Quest 3 Browser timings: [quest-3-on-device-qa](docs/shipping/quest-3-on-device-qa.md) (blank until a headset run).
3. [`docs/testing/`](docs/testing/) headset + emulator pass.
4. Meet [`studio/quality-bar.md`](studio/quality-bar.md).

## Canonical external references

| Topic | Source |
| --- | --- |
| Core API | [MDN WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API) |
| Sessions | [XRSystem.requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession) |
| Spaces | [XRSession.requestReferenceSpace](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestReferenceSpace) |
| Input | [Inputs and input sources](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Inputs) |
| Startup / security | [Starting up and shutting down](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Startup_and_shutdown) |
| FFR | [XRWebGLLayer.fixedFoveation](https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/fixedFoveation) |
| Layers | [WebXR Layers API Level 1](https://www.w3.org/TR/webxrlayers-1/) |
| Samples | [immersive-web/webxr-samples](https://github.com/immersive-web/webxr-samples) |

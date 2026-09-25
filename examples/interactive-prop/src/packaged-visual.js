/**
 * Prefer a packaged GLB (KTX2 / meshopt) when the URL exists.
 * Missing file → null (caller keeps procedural color-only MeshBasic
 * on LOD0 / LOD1 / LOD2). Does not
 * strip, downsample, or rewrite materials at ingest.
 * Loaders are dynamic-imported only after a successful probe.
 *
 * v0.36: if the GLB has conventional `lod0` / `lod1` / `lod2` groups
 * (same names as procedural `lodGroup()`, plus `userData.lodLevel`),
 * ingest wires `userData.lod` and shows only LOD0. Missing names fail
 * soft — one visual set stays visible; no fake LODs.
 *
 * v0.38: after those groups are discovered, the same load-time
 * `mergeSameMaterialMeshes` helper as procedural v0.37 runs on each
 * `lod*` node (direct mesh children, same material reference). Does
 * not merge across LOD levels, pivots outside that node, colliders,
 * or the fastener. Does not rewrite materials.
 *
 * v0.39: that helper welds coincident vertices after concat (same
 * path for procedural and packaged). Author still prefers pre-welded
 * batches in DCC; runtime weld is a safety net.
 *
 * v0.40: after weld (and on unmerged color-only MeshBasic singles in
 * the same helper), unused `uv` / `normal` attributes are stripped.
 * Author may omit those channels in DCC; runtime strip is a safety
 * net. Mapped / lit materials keep their attributes. Materials are
 * still not rewritten.
 *
 * v0.41: after that strip, compact a lingering Uint32 index to
 * Uint16 when `position.count` ≤ 65535 (concat always builds Uint32;
 * weld only rewrites to Uint16 when it actually reduces verts). A
 * root-level `fastener` / `fastenerMesh` MeshBasic — still outside
 * the LOD merge skip set — gets the same unused-attr strip + compact.
 * Do not invent a fastener if none is authored.
 *
 * v0.42: procedural create shares color-only MeshBasic instances
 * across LODs when midtone hex matches. Packaged ingest does **not**
 * hex-dedupe materials (same-hex MeshBasics can still differ in
 * side / opacity / transparent; multi-material slots must stay
 * intact). Author shared glTF material slots in DCC instead.
 *
 * v0.43: after that pack, color-only unlit MeshBasic geometries
 * (LOD meshes via `mergeSameMaterialMeshes` / `packColorOnlyGeometry`,
 * plus an authored root fastener) set `StaticDrawUsage` and
 * `onUpload` so the first GPU upload releases CPU `.array`. Collider
 * hulls are not packed. Mapped / lit materials are not released.
 *
 * v0.44: after Uint16 compact and **before** that `onUpload` hook,
 * `packColorOnlyGeometry` quantizes Float32 `position` to Three r170
 * `Float16BufferAttribute` (WebGL2 `HALF_FLOAT`) on those same
 * color-only unlit MeshBasic geos. Mapped / lit / morph /
 * interleaved stay Float32. Collider hulls are not packed.
 *
 * v0.45: after the entity is fully built and LODs attached (or
 * fail-soft with no lod groups), `freezeStaticColorOnlyWorldMatrices`
 * bakes one `updateMatrixWorld(true)` then sets `matrixAutoUpdate =
 * false` on static packed color-only MeshBasic visual leaves that are
 * not under `lid` / `latch` / `tool` pivots. Fastener stays live
 * (`applyFastenerVisual` writes rotation/position). Colliders stay
 * live. Does not change draws / tris / verts / attrBytes.
 *
 * v0.46: after that freeze, `disableColorOnlyVisualRaycast` assigns
 * a no-op `mesh.raycast` on packed color-only unlit MeshBasic visual
 * meshes (LOD0/1/2 body + lid/latch/tool + fastener). Colliders keep
 * default `Mesh.prototype.raycast`. Pick path stays collider AABB.
 *
 * v0.47: after that raycast disable, `pinColorOnlyVisualMaterialFlags`
 * sets `fog = false` and `toneMapped = false` on packed color-only
 * unlit MeshBasic visual materials (same `isColorOnlyUnlitBasic`
 * gate). Does not hex-dedupe or invent materials. Mapped / lit stay
 * at r170 defaults. Collider MeshBasics stay untouched.
 *
 * v0.48: the same helper also pins opaque FrontSide draw-state
 * (`transparent = false`, `opacity = 1`, `depthWrite = true`,
 * `depthTest = true`, `side = FrontSide`) on those color-only
 * MeshBasics. Accidental DoubleSide / transparent from DCC is
 * fenced at load time. Mapped / lit / colliders stay untouched.
 *
 * v0.49: after that material pin, `pinColorOnlyVisualShadowFlags`
 * sets `castShadow = false` and `receiveShadow = false` on packed
 * color-only unlit MeshBasic visual meshes (same
 * `isColorOnlyUnlitBasic` gate). Does not hex-dedupe or invent
 * meshes. Mapped / lit stay at authored / r170 Mesh defaults.
 * Collider meshes stay untouched. Does not enable shadows elsewhere.
 *
 * v0.50: after that shadow pin, `pinColorOnlyVisualFrustumCulled`
 * sets `frustumCulled = true` on packed color-only unlit MeshBasic
 * visual meshes (same `isColorOnlyUnlitBasic` gate). Accidental
 * DCC / GLB `frustumCulled = false` would skip GPU frustum
 * rejection. Does not hex-dedupe or invent meshes. Mapped / lit
 * stay at authored / r170 Mesh defaults. Collider meshes stay
 * untouched. Does not disable culling or invent a custom strategy.
 *
 * v0.51: the same `pinColorOnlyVisualMaterialFlags` helper also
 * pins `blending = NormalBlending`, `premultipliedAlpha = false`,
 * and `alphaTest = 0` (plus `dithering = false` /
 * `alphaToCoverage = false`) on those color-only MeshBasics.
 * Accidental DCC / GLB CustomBlending / AdditiveBlending /
 * premultiply / alphaTest would force blend or discard paths.
 * Mapped / lit / colliders stay untouched.
 *
 * v0.52: the same helper also pins `wireframe = false`,
 * `colorWrite = true`, `depthFunc = LessEqualDepth`, and
 * `polygonOffset = false` (`polygonOffsetFactor = 0` /
 * `polygonOffsetUnits = 0`) on those color-only MeshBasics.
 * Accidental DCC / GLB wireframe / colorWrite-off / non-LessEqual
 * depthFunc / polygonOffset would force extra fragment or depth
 * work. Mapped / lit / colliders stay untouched.
 *
 * v0.53: the same helper also pins r170 Material stencil defaults
 * (`stencilWrite = false`, `stencilFunc = AlwaysStencilFunc`,
 * `stencilRef = 0`, `stencilWriteMask = 0xff`,
 * `stencilFuncMask = 0xff`, `stencilFail = KeepStencilOp`,
 * `stencilZFail = KeepStencilOp`, `stencilZPass = KeepStencilOp`)
 * on those color-only MeshBasics. Accidental DCC / GLB
 * `stencilWrite=true` (or non-Always func / non-Keep ops) would
 * force stencil test/write on a TBDR mobile GPU. Mapped / lit /
 * colliders stay untouched.
 *
 * v0.54: the same helper also pins r170 Material clipping defaults
 * (`clippingPlanes = null`, `clipIntersection = false`,
 * `clipShadows = false`) on those color-only MeshBasics.
 * Accidental DCC / GLB non-null `clippingPlanes` /
 * `clipIntersection` / `clipShadows` would force clipping-plane
 * fragment work on a TBDR mobile GPU. Mapped / lit / colliders
 * stay untouched.
 *
 * v0.55: the same helper also pins r170 Material boolean GPU-state
 * defaults (`alphaHash = false`, `forceSinglePass = false`) on
 * those color-only MeshBasics. Accidental DCC / GLB
 * `alphaHash=true` would force a stochastic discard path;
 * `forceSinglePass=true` can change multi-pass material behavior.
 * Mapped / lit / colliders stay untouched.
 *
 * v0.56: the same helper also pins r170 NormalBlending
 * factor/equation companions (`blendSrc = SrcAlphaFactor`,
 * `blendDst = OneMinusSrcAlphaFactor`, `blendEquation =
 * AddEquation`, `blendSrcAlpha = null`, `blendDstAlpha = null`,
 * `blendEquationAlpha = null`) on those color-only MeshBasics.
 * Accidental DCC / GLB CustomBlending leftovers still sit on the
 * material even when blending mode is restored to NormalBlending.
 * Mapped / lit / colliders stay untouched.
 *
 * v0.57: the same helper also pins r170 Material `vertexColors =
 * false` on those color-only MeshBasics. Accidental DCC / GLB
 * `vertexColors = true` leftovers force a color-attribute shader
 * variant even when maps are absent (still passes
 * `isColorOnlyUnlitBasic`). Mapped / lit / colliders stay
 * untouched.
 *
 * v0.58: the same helper also pins r170 Material `precision =
 * null` on those color-only MeshBasics. Accidental DCC / GLB
 * `precision = 'highp'` (or other string) leftovers force a
 * non-renderer precision even when maps are absent (still
 * passes `isColorOnlyUnlitBasic`). Mapped / lit / colliders
 * stay untouched. Do not force 'mediump' / 'lowp' / 'highp'.
 *
 * v0.59: the same helper also pins r170 Material `shadowSide =
 * null` on those color-only MeshBasics. Accidental DCC / GLB
 * `shadowSide = FrontSide` / `BackSide` / `DoubleSide`
 * leftovers force a non-`side` shadow-cast face even when maps
 * are absent (still passes `isColorOnlyUnlitBasic`). When null,
 * shadow casting side derives from `side`. Mesh-level
 * `castShadow` / `receiveShadow` stay pinned false (v0.49) —
 * this is the matching **material** fence, not a mesh change.
 * Mapped / lit / colliders stay untouched. Do not force a
 * non-null shadowSide.
 *
 * v0.60: after that frustumCulled pin (and after the v0.49
 * shadow-flag pin), `pinColorOnlyVisualRenderOrder` sets
 * `renderOrder = 0` on packed color-only unlit MeshBasic
 * visual meshes (same `isColorOnlyUnlitBasic` gate). Accidental
 * DCC / GLB non-zero `renderOrder` forces separate opaque /
 * transparent sort buckets and can break batching. Does not
 * hex-dedupe or invent meshes. Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes stay untouched. Does
 * **not** pin `mesh.visible` (LOD visibility uses it), change
 * `layers`, or force a non-zero renderOrder.
 *
 * v0.61: the same helper also pins r170 Material `visible =
 * true` on those color-only MeshBasics. Accidental DCC / GLB
 * `visible = false` leftovers hide draws without using LOD
 * `mesh.visible` (still passes `isColorOnlyUnlitBasic`).
 * Mapped / lit / colliders stay untouched. Do **not** pin
 * `mesh.visible` (LOD visibility uses it). Do not force
 * `material.visible = false`.
 *
 * v0.62: the same helper also pins r170 MeshBasic envMap
 * companions (`combine = MultiplyOperation`,
 * `reflectivity = 1`, `refractionRatio = 0.98`) on those
 * color-only MeshBasics. Accidental DCC / GLB MixOperation /
 * AddOperation / non-1 reflectivity / non-0.98
 * refractionRatio leftovers still sit on the material even
 * when `envMap` is null (still passes
 * `isColorOnlyUnlitBasic`). Mapped / lit / colliders stay
 * untouched. Does not force envMap or attach maps. Does not
 * change the `isColorOnlyUnlitBasic` map/envMap gate.
 *
 * v0.63: the same helper also pins r170 MeshBasic
 * map-intensity companions (`lightMapIntensity = 1`,
 * `aoMapIntensity = 1`) on those color-only MeshBasics.
 * Accidental DCC / GLB `lightMapIntensity !== 1` /
 * `aoMapIntensity !== 1` leftovers still sit on the
 * material even when maps are already gated null (still
 * passes `isColorOnlyUnlitBasic`). Mapped / lit /
 * colliders stay untouched. Does not force lightMap /
 * aoMap or attach maps. Does not change the
 * `isColorOnlyUnlitBasic` map / lightMap / aoMap gate.
 *
 * v0.64: the same helper also pins r170 MeshBasic
 * `wireframeLinewidth = 1` on those color-only
 * MeshBasics. Accidental DCC / GLB
 * `wireframeLinewidth !== 1` leftovers still sit on
 * the material even when `wireframe === false` (still
 * passes `isColorOnlyUnlitBasic`). Mapped / lit /
 * colliders stay untouched. Does **not** enable
 * wireframe. Does **not** pin `mesh.visible`.
 *
 * v0.65: the same helper also pins r170 MeshBasic
 * `wireframeLinecap = 'round'` /
 * `wireframeLinejoin = 'round'` on those color-only
 * MeshBasics. Accidental DCC / GLB `'butt'` /
 * `'miter'` leftovers still sit on the material even
 * when `wireframe === false` (still passes
 * `isColorOnlyUnlitBasic`). Mapped / lit / colliders
 * stay untouched. Does **not** enable wireframe. Does
 * **not** pin `mesh.visible`.
 *
 * v0.66: the same helper also pins r170 MeshBasic
 * `envMapRotation` `(0, 0, 0)` / `order = 'XYZ'`
 * on those color-only MeshBasics (keeps the existing
 * Euler instance). Accidental DCC / GLB leftover
 * non-zero `envMapRotation` still sits on the
 * material even when `envMap` is null (still passes
 * `isColorOnlyUnlitBasic`). Mapped / lit / colliders
 * stay untouched. Does not force envMap or attach
 * maps. Does not change the `isColorOnlyUnlitBasic`
 * map / envMap gate. Does **not** enable wireframe.
 * Does **not** pin `mesh.visible`.
 *
 * v0.67: after that renderOrder pin (and after the
 * v0.66 envMapRotation material pin),
 * `pinColorOnlyVisualLayers` sets r170 Object3D
 * layers default (layer 0 only / `mask = 1`) on
 * packed color-only unlit MeshBasic visual meshes
 * (same `isColorOnlyUnlitBasic` gate; keeps the
 * existing Layers instance). Accidental DCC / GLB
 * leftover non-default layer masks can hide draws
 * from the default camera or force unexpected
 * multi-layer membership. Does not hex-dedupe or
 * invent meshes. Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes stay
 * untouched. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change
 * `matrixWorldAutoUpdate` / `matrixAutoUpdate`,
 * enable extra camera/layers tricks, or invent a
 * custom layer mask.
 *
 * v0.68: the same material helper also pins r170
 * Material CustomBlending color/alpha companions
 * (`blendColor` `(0, 0, 0)` / `blendAlpha = 0`)
 * on those color-only MeshBasics (keeps the
 * existing Color instance). Accidental DCC / GLB
 * leftover non-default `blendColor` / `blendAlpha`
 * still sit on the material even when `blending`
 * is NormalBlending (still passes
 * `isColorOnlyUnlitBasic`) and can leak into a
 * later blend-mode change. Mapped / lit /
 * colliders stay untouched. Does **not** enable
 * CustomBlending or change `blending` away from
 * NormalBlending. Does **not** pin `mesh.visible`.
 *
 * v0.69: after that layers pin (and after the
 * v0.68 blendColor / blendAlpha material pin),
 * `pinColorOnlyVisualMatrixWorldAutoUpdate` sets
 * r170 Object3D `matrixWorldAutoUpdate = true`
 * (`Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE`)
 * on packed color-only unlit MeshBasic visual
 * meshes (same `isColorOnlyUnlitBasic` gate).
 * Accidental DCC / GLB leftover
 * `matrixWorldAutoUpdate = false` can stall
 * automatic world-matrix updates from animated
 * parents even when local `matrixAutoUpdate`
 * policy is intentional. Does not hex-dedupe or
 * invent meshes. Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes stay
 * untouched. Does **not** pin `mesh.visible`
 * (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes
 * static body LOD leaves), change `layers`, or
 * change `blendColor` / `blendAlpha`.
 *
 * v0.70: after that matrixWorldAutoUpdate pin,
 * `pinColorOnlyVisualUp` sets r170 Object3D
 * `up` `(0, 1, 0)` (`Object3D.DEFAULT_UP`) on
 * packed color-only unlit MeshBasic visual
 * meshes (same `isColorOnlyUnlitBasic` gate;
 * keeps the existing Vector3 instance).
 * Accidental DCC / GLB leftover non-Y-up `up`
 * (common Z-up exporter leftovers such as
 * `(0, 0, 1)`) can skew Object3D `lookAt` and
 * related orientation helpers even when local
 * transforms are intentional. Does not
 * hex-dedupe or invent meshes. Mapped / lit
 * stay at authored / r170 Mesh defaults.
 * Collider meshes stay untouched. Does **not**
 * pin `mesh.visible` (LOD visibility uses it),
 * change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, or
 * change `blendColor` / `blendAlpha`.
 *
 * v0.71: after that up pin,
 * `pinColorOnlyVisualScale` sets r170 Object3D
 * `scale` `(1, 1, 1)` on packed color-only
 * unlit MeshBasic visual meshes (same
 * `isColorOnlyUnlitBasic` gate; keeps the
 * existing Vector3 instance). Accidental DCC /
 * GLB leftover non-unit / negative /
 * non-uniform `scale` (common non-uniform bake,
 * negative axis flip, or non-1 uniform
 * leftovers) can invert face winding under
 * FrontSide culling (missing draws) and skew
 * world-matrix composition even when local
 * position/rotation are intentional. Does not
 * hex-dedupe or invent meshes. Mapped / lit
 * stay at authored / r170 Mesh defaults.
 * Collider meshes stay untouched. Does **not**
 * pin `mesh.visible` (LOD visibility uses it),
 * change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, or change `blendColor` /
 * `blendAlpha`.
 *
 * v0.72: the same material helper also pins
 * r170 Material `dithering = false` /
 * `alphaToCoverage = false` on those
 * color-only MeshBasics as first-class
 * measured flags (v0.51 already assigned
 * them as blending/alpha companions).
 * Accidental DCC / GLB leftover
 * `dithering = true` can add fragment
 * cost on a TBDR mobile GPU for opaque
 * unlit midtones that do not need it.
 * Accidental `alphaToCoverage = true`
 * expects MSAA coverage samples and can
 * produce wrong edges / wasted work on
 * Quest Browser paths that are not
 * relying on A2C for these stand-ins.
 * Mapped / lit / colliders stay
 * untouched. Does **not** pin
 * `mesh.visible`. Does not change
 * `matrixAutoUpdate` /
 * `matrixWorldAutoUpdate` / `layers` /
 * `up` / `scale` / `blendColor` /
 * `blendAlpha`.
 *
 * v0.73: after that scale pin,
 * `pinColorOnlyVisualRotationOrder` sets
 * r170 Object3D `rotation.order = 'XYZ'`
 * on packed color-only unlit MeshBasic
 * visual meshes (same
 * `isColorOnlyUnlitBasic` gate; keeps
 * the existing Euler instance). Does
 * **not** rewrite `rotation.x` /
 * `rotation.y` / `rotation.z`
 * (lid/latch/tool/fastener intentional
 * local rotations must stay). Does
 * **not** touch `mesh.quaternion` (Three
 * keeps quaternion in sync from Euler
 * when rotation is edited; do not force
 * identity quaternion). Accidental DCC /
 * GLB leftover non-`XYZ` Euler `order`
 * (`YXZ`, `ZYX`, etc.) can change how
 * subsequent local Euler edits compose
 * even when current xyz values look
 * fine. Does not hex-dedupe or invent
 * meshes. Mapped / lit stay at
 * authored / r170 Mesh defaults.
 * Collider meshes stay untouched. Does
 * **not** pin `mesh.visible` (LOD
 * visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves),
 * change `matrixWorldAutoUpdate`,
 * change `layers`, change `up`, change
 * `scale`, or change `blendColor` /
 * `blendAlpha` / dithering / A2C.
 *
 * v0.74: the same material helper also pins
 * r170 Material `polygonOffsetFactor = 0` /
 * `polygonOffsetUnits = 0` on those
 * color-only MeshBasics as first-class
 * measured flags (v0.52 already assigned
 * them as polygonOffset companions, with
 * `polygonOffset = false`). Accidental
 * DCC / GLB leftover non-zero
 * `polygonOffsetFactor` /
 * `polygonOffsetUnits` can still sit on
 * color-only unlit midtone stand-ins even
 * when `polygonOffset === false`. When
 * offset is off they are unused GPU state
 * noise and can confuse DCC round-trips;
 * if offset were later flipped on,
 * leftovers would bias depth on a TBDR
 * mobile GPU. Mapped / lit / colliders
 * stay untouched. Does **not** enable
 * `polygonOffset`. Does **not** invent
 * non-zero factors/units. Does **not**
 * pin `mesh.visible`. Does not change
 * `matrixAutoUpdate` /
 * `matrixWorldAutoUpdate` / `layers` /
 * `up` / `scale` / `rotation.order` /
 * `blendColor` / `blendAlpha` /
 * dithering / A2C.
 *
 * v0.75: the same material helper also pins
 * r170 Material `stencilRef = 0` /
 * `stencilWriteMask = 0xff` /
 * `stencilFuncMask = 0xff` /
 * `stencilZFail = KeepStencilOp` /
 * `stencilZPass = KeepStencilOp` on
 * those color-only MeshBasics as
 * first-class measured flags (v0.53
 * already assigned the full stencil
 * suite and measured `stencilWrite` /
 * `stencilFunc` / `stencilFail` in the
 * short form). Accidental DCC / GLB
 * leftover non-zero `stencilRef` /
 * non-0xff masks / non-Keep
 * `stencilZFail` / `stencilZPass` can
 * still sit on color-only unlit
 * midtone stand-ins even when
 * `stencilWrite === false`. When
 * stencil write is off they are unused
 * GPU state noise and can confuse DCC
 * round-trips; if stencil write were
 * later flipped on, leftovers would
 * test/write the stencil buffer on a
 * TBDR mobile GPU. Mapped / lit /
 * colliders stay untouched. Does
 * **not** enable stencil write. Does
 * **not** invent non-Always func /
 * non-Keep ops / non-zero ref /
 * non-0xff masks. Does **not** pin
 * `mesh.visible`. Does not change
 * `matrixAutoUpdate` /
 * `matrixWorldAutoUpdate` / `layers` /
 * `up` / `scale` / `rotation.order` /
 * prior material pins including
 * polygonOffset companions /
 * dithering / A2C / `blendColor` /
 * `blendAlpha`.
 *
 * v0.76: after that rotation.order pin
 * (and after the v0.75 Material stencil
 * companions),
 * `pinColorOnlyVisualCustomShadowMaterials`
 * clears leftover Mesh
 * `customDepthMaterial` /
 * `customDistanceMaterial` to the r170
 * Mesh default absence on packed
 * color-only unlit MeshBasic visual
 * meshes (same
 * `isColorOnlyUnlitBasic` gate). Does
 * **not** invent replacement materials.
 * Does **not** enable `castShadow` /
 * `receiveShadow`. Accidental DCC /
 * GLB leftover custom depth/distance
 * materials force extra shadow-material
 * compiles/paths if shadow casting is
 * later enabled on a TBDR mobile GPU,
 * and are unused GPU/state noise while
 * `castShadow === false`. Does not
 * hex-dedupe or invent meshes. Mapped /
 * lit stay at authored / r170 Mesh
 * defaults. Collider meshes stay
 * untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`, or
 * change prior material pins including
 * stencil companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha`.
 *
 * v0.77: after that customDepth/Distance
 * clear,
 * `pinColorOnlyVisualRenderCallbacks`
 * deletes leftover own-property
 * `onBeforeRender` / `onAfterRender` so
 * the r170 Object3D prototype empty
 * no-ops remain on packed color-only
 * unlit MeshBasic visual meshes (same
 * `isColorOnlyUnlitBasic` gate). Does
 * **not** invent replacement callbacks.
 * Does **not** assign `undefined`
 * (WebGLRenderer always invokes these).
 * Does **not** enable shadows or touch
 * `customDepthMaterial` /
 * `customDistanceMaterial`. Accidental
 * DCC / GLB leftover own-property
 * render callbacks become per-draw JS
 * work on Quest Browser / TBDR.
 * Does not hex-dedupe or invent meshes.
 * Mapped / lit stay at authored / r170
 * Mesh defaults. Collider meshes stay
 * untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`, or
 * change prior material pins including
 * stencil companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha` / the
 * v0.76 customDepth/Distance clear.
 *
 * v0.78: after that Mesh
 * render-callback clear (and after
 * the long material-flag fence
 * through v0.75 stencil companions /
 * v0.74 polygonOffset companions /
 * v0.72 dithering+A2C),
 * `pinColorOnlyUnlitBasicMaterialRenderCallbacks`
 * (via `pinColorOnlyUnlitBasicFlags`
 * / `pinColorOnlyVisualMaterialFlags`)
 * deletes leftover own-property
 * Material `onBeforeCompile` /
 * `onBeforeRender` so the r170
 * Material.prototype empty no-ops
 * remain on packed color-only unlit
 * MeshBasic materials (same
 * `isColorOnlyUnlitBasic` gate). Does
 * **not** invent replacement
 * callbacks or custom shaders. Does
 * **not** assign `undefined`
 * (WebGLRenderer always invokes
 * these). Does **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch
 * `onBeforeShadow` / `onAfterShadow`.
 * Accidental DCC / GLB leftover
 * own-property Material compile /
 * render callbacks become
 * compile/per-draw JS work on Quest
 * Browser / TBDR and leftover
 * `onBeforeCompile` stubs can also
 * fragment `customProgramCacheKey`.
 * Does not hex-dedupe or invent
 * materials. Mapped / lit stay at
 * authored / r170 Material defaults.
 * Collider materials stay untouched.
 * Does **not** pin `mesh.visible`
 * (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves),
 * change `matrixWorldAutoUpdate`,
 * change `layers`, change `up`,
 * change `scale`, change
 * `rotation.order`, or change prior
 * material pins including stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha` / the
 * v0.76 customDepth/Distance clear /
 * the v0.77 Mesh render-callback
 * clear.
 *
 * v0.79: after that Mesh
 * render-callback clear (and after
 * the v0.78 Material compile/render
 * callback clear),
 * `pinColorOnlyVisualShadowCallbacks`
 * deletes leftover own-property
 * `onBeforeShadow` / `onAfterShadow`
 * so the r170 Object3D prototype
 * empty no-ops remain on packed
 * color-only unlit MeshBasic visual
 * meshes (same
 * `isColorOnlyUnlitBasic` gate). Does
 * **not** invent replacement callbacks.
 * Does **not** assign `undefined`
 * (WebGLShadowMap always invokes
 * these when a mesh is selected for a
 * shadow-map pass). Does **not**
 * enable `castShadow` /
 * `receiveShadow`. Does **not** touch
 * Mesh `onBeforeRender` /
 * `onAfterRender` (v0.77) or Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch `customDepthMaterial`
 * / `customDistanceMaterial`.
 * Accidental DCC / GLB leftover
 * own-property shadow callbacks
 * become per-shadow-draw JS work on
 * Quest Browser / TBDR if a light
 * later has `castShadow`, and are
 * leftover callback noise while
 * `castShadow === false`. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes
 * stay untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins
 * including stencil companions /
 * polygonOffset companions /
 * dithering / A2C / `blendColor` /
 * `blendAlpha` / the v0.76
 * customDepth/Distance clear / the
 * v0.77 Mesh render-callback clear /
 * the v0.78 Material compile/render
 * callback clear.
 *
 * v0.80: after that Mesh
 * shadow-callback clear (and after
 * the v0.78 Material compile/render
 * callback clear),
 * `pinColorOnlyUnlitBasicCustomProgramCacheKey`
 * (via `pinColorOnlyUnlitBasicFlags`
 * / `pinColorOnlyVisualMaterialFlags`)
 * deletes leftover own-property
 * Material `customProgramCacheKey`
 * so the r170 Material.prototype
 * method remains on packed
 * color-only unlit MeshBasic
 * materials (same
 * `isColorOnlyUnlitBasic` gate).
 * Does **not** invent a replacement
 * function. Does **not** assign
 * `undefined` (WebGLRenderer uses
 * `customProgramCacheKey()` when
 * building/caching programs). Does
 * **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Accidental DCC / GLB
 * leftover own-property
 * `customProgramCacheKey` stubs
 * fragment the program cache and
 * can force extra compiles on Quest
 * Browser / TBDR. Does not
 * hex-dedupe or invent materials.
 * Mapped / lit stay at authored /
 * r170 Material defaults. Collider
 * materials stay untouched. Does
 * **not** pin `mesh.visible` (LOD
 * visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves),
 * change `matrixWorldAutoUpdate`,
 * change `layers`, change `up`,
 * change `scale`, change
 * `rotation.order`, or change prior
 * material pins including stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha` / the
 * v0.76 customDepth/Distance clear /
 * the v0.77 Mesh render-callback
 * clear / the v0.78 Material
 * compile/render callback clear /
 * the v0.79 Mesh shadow-callback
 * clear.
 *
 * v0.81: after that Material
 * customProgramCacheKey clear (and
 * after the v0.78 Material
 * compile/render callback clear),
 * `pinColorOnlyUnlitBasicDefines`
 * (via `pinColorOnlyUnlitBasicFlags`
 * / `pinColorOnlyVisualMaterialFlags`)
 * clears leftover Material `defines`
 * so the r170 MeshBasicMaterial /
 * Material default absence remains
 * (`defines === undefined`) on packed
 * color-only unlit MeshBasic
 * materials (same
 * `isColorOnlyUnlitBasic` gate).
 * Does **not** invent a replacement
 * `#define` map. Does **not** assign
 * a sentinel empty `{}` (r170
 * `WebGLPrograms` treats
 * `parameters.defines !== undefined`
 * as present and walks keys into the
 * program cache key). Does **not**
 * touch Material
 * `customProgramCacheKey` (v0.80).
 * Does **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Accidental DCC / GLB
 * leftover Material `defines`
 * objects fragment the program cache
 * and can force extra compiles on
 * Quest Browser / TBDR. Does not
 * hex-dedupe or invent materials.
 * Mapped / lit stay at authored /
 * r170 Material defaults. Collider
 * materials stay untouched. Does
 * **not** pin `mesh.visible` (LOD
 * visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves),
 * change `matrixWorldAutoUpdate`,
 * change `layers`, change `up`,
 * change `scale`, change
 * `rotation.order`, or change prior
 * material pins including stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha` / the
 * v0.76 customDepth/Distance clear /
 * the v0.77 Mesh render-callback
 * clear / the v0.78 Material
 * compile/render callback clear /
 * the v0.79 Mesh shadow-callback
 * clear / the v0.80 Material
 * customProgramCacheKey clear.
 *
 * v0.82: after that Material
 * `defines` clear (and after the
 * long Material flag fence through
 * v0.80 `customProgramCacheKey` /
 * v0.78 `onBeforeCompile` +
 * `onBeforeRender` / v0.75 stencil
 * companions),
 * `pinColorOnlyUnlitBasicFlatShading`
 * (via `pinColorOnlyUnlitBasicFlags`
 * / `pinColorOnlyVisualMaterialFlags`)
 * sets Material `flatShading = false`
 * on packed color-only unlit
 * MeshBasic materials (same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * Material / MeshBasicMaterial leave
 * `flatShading` unset (`undefined`).
 * `WebGLPrograms` copies
 * `flatShading: material.flatShading
 * === true` into program parameters
 * and the program cache key;
 * `WebGLProgram` emits
 * `#define FLAT_SHADED` when that
 * parameter is true. Leftover
 * DCC/GLB `flatShading = true`
 * fragments the cache and can force
 * a separate FLAT_SHADED program on
 * Quest Browser / TBDR. Does **not**
 * invent custom shaders. Does **not**
 * enable flat shading. Does **not**
 * touch Material `defines` (v0.81).
 * Does **not** touch Material
 * `customProgramCacheKey` (v0.80).
 * Does **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Does not hex-dedupe or
 * invent materials. Mapped / lit stay
 * at authored / r170 Material
 * defaults. Collider materials stay
 * untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins
 * including `defines` /
 * `customProgramCacheKey` / stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha`.
 *
 * v0.83: after that Material
 * `flatShading` pin (and after the
 * Material program-cache fence
 * through v0.81 `defines` / v0.80
 * `customProgramCacheKey` / v0.78
 * `onBeforeCompile` +
 * `onBeforeRender`),
 * `pinColorOnlyUnlitBasicGlslVersion`
 * (via `pinColorOnlyUnlitBasicFlags`
 * / `pinColorOnlyVisualMaterialFlags`)
 * deletes leftover Material
 * `glslVersion` so the r170
 * MeshBasicMaterial / Material
 * default absence remains
 * (`glslVersion === undefined`) on
 * packed color-only unlit MeshBasic
 * materials (same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * Material / MeshBasicMaterial leave
 * `glslVersion` unset (`undefined`;
 * `Object.hasOwn` false).
 * `ShaderMaterial` assigns
 * `glslVersion = null` in its own
 * constructor — do not convert
 * MeshBasic to ShaderMaterial.
 * `WebGLPrograms.getParameters`
 * copies `glslVersion:
 * material.glslVersion` into program
 * parameters. `WebGLProgram` emits
 * `#version ${parameters.glslVersion}`
 * when that parameter is truthy, and
 * omits the `pc_fragColor` /
 * `gl_FragColor` defines when
 * `parameters.glslVersion === GLSL3`
 * (`'300 es'`). Leftover DCC/GLB
 * `glslVersion = GLSL3` (or `'100'` /
 * `'300 es'`) can force the wrong
 * shader preamble on Quest Browser /
 * TBDR. Does **not** assign a
 * sentinel string. Does **not**
 * assign `GLSL3` / `GLSL1` /
 * `'300 es'` / `'100'`. Does **not**
 * invent custom shaders. Does **not**
 * touch Material `flatShading`
 * (v0.82). Does **not** touch
 * Material `defines` (v0.81). Does
 * **not** touch Material
 * `customProgramCacheKey` (v0.80).
 * Does **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Does not hex-dedupe or
 * invent materials. Mapped / lit stay
 * at authored / r170 Material
 * defaults. Collider materials stay
 * untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins
 * including `flatShading` /
 * `defines` / `customProgramCacheKey`
 * / stencil companions /
 * polygonOffset companions /
 * dithering / A2C / `blendColor` /
 * `blendAlpha`.
 *
 * v0.84: after that Material
 * `glslVersion` clear (and after the
 * Mesh callback fence through v0.79
 * `onBeforeShadow` / `onAfterShadow`
 * / v0.77 `onBeforeRender` /
 * `onAfterRender` / v0.76
 * customDepth/Distance),
 * `pinColorOnlyVisualAnimations`
 * clears leftover Object3D
 * `animations` so the r170 empty
 * list remains
 * (`Array.isArray(mesh.animations) &&
 * mesh.animations.length === 0`) on
 * packed color-only unlit MeshBasic
 * visual meshes (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * the Object3D constructor assigns
 * `this.animations = []`. GLTFLoader
 * / DCC paths can leave a non-empty
 * AnimationClip array on a node even
 * when lid/latch/tool/fastener motion
 * is procedural L4/L5 pivot mutation
 * (`tryUse` / `tryDriveFastener`).
 * When `animations` is an array,
 * mutate it (`length = 0`); if
 * missing or non-array, assign
 * `animations = []`. Does **not**
 * invent AnimationClips. Does **not**
 * create an AnimationMixer. Does
 * **not** call `AnimationMixer.update`.
 * Does **not** touch Material
 * `glslVersion` (v0.83). Does **not**
 * touch Material `flatShading`
 * (v0.82). Does **not** touch
 * Material `defines` (v0.81). Does
 * **not** touch Material
 * `customProgramCacheKey` (v0.80).
 * Does **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Does **not** touch
 * `customDepthMaterial` /
 * `customDistanceMaterial`. Does
 * **not** enable shadows. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes
 * stay untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins
 * including `glslVersion` /
 * `flatShading` / `defines` /
 * `customProgramCacheKey` / stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha`.
 *
 * v0.85: after that Object3D
 * `animations` clear,
 * `pinColorOnlyVisualMorphTargets`
 * deletes leftover Mesh
 * `morphTargetInfluences` /
 * `morphTargetDictionary` so the
 * r170 absence remains
 * (`morphTargetInfluences === undefined`
 * && `morphTargetDictionary === undefined`;
 * `Object.hasOwn` false) on packed
 * color-only unlit MeshBasic visual
 * meshes (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * the Mesh constructor calls
 * `updateMorphTargets()`, which
 * assigns both properties only when
 * `Object.keys(geometry.morphAttributes).length > 0`.
 * A non-morph Mesh leaves both
 * absent. `Mesh.copy` copies them
 * when the source defines them.
 * GLTFLoader / DCC paths can leave
 * a non-empty influence array and/or
 * dictionary even when this prop’s
 * color-only stand-ins have no
 * morphAttributes and lid/latch/tool/
 * fastener motion is procedural
 * (`tryUse` / `tryDriveFastener`).
 * Prefer `delete` when present. Does
 * **not** assign `null` or empty
 * `[]` / `{}`. Does **not** invent
 * morph targets. Does **not** call
 * `updateMorphTargets()`. Does **not**
 * add morphAttributes. Does **not**
 * enable morphing. Does **not** touch
 * Object3D `animations` (v0.84). Does
 * **not** touch Material `glslVersion`
 * (v0.83). Does **not** touch Material
 * `flatShading` (v0.82). Does **not**
 * touch Material `defines` (v0.81).
 * Does **not** touch Material
 * `customProgramCacheKey` (v0.80).
 * Does **not** touch Material
 * `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Does **not** touch
 * `customDepthMaterial` /
 * `customDistanceMaterial`. Does
 * **not** enable shadows. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit stay at authored /
 * r170 Mesh defaults. Collider meshes
 * stay untouched. Does **not** pin
 * `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body
 * LOD leaves), change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins
 * including `glslVersion` /
 * `flatShading` / `defines` /
 * `customProgramCacheKey` / stencil
 * companions / polygonOffset
 * companions / dithering / A2C /
 * `blendColor` / `blendAlpha`.
 *
 * v0.86: after that Mesh morph-target
 * absence,
 * `pinColorOnlyVisualMorphAttributes`
 * clears leftover BufferGeometry
 * `morphAttributes` so
 * `Object.keys(geometry.morphAttributes).length === 0`
 * and pins `morphTargetsRelative`
 * to the r170 default `false` on
 * packed color-only unlit MeshBasic
 * visual geometries (body LOD leaves
 * + lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * the BufferGeometry constructor
 * assigns `this.morphAttributes = {}`
 * and `this.morphTargetsRelative = false`.
 * r170 `WebGLRenderer` calls
 * `WebGLMorphtargets.update` when
 * `morphAttributes.position`,
 * `.normal`, or `.color` is not
 * `undefined` (an empty array or
 * empty BufferAttribute under the
 * key still counts). Mutate the
 * existing object: delete own keys;
 * dispose a leftover BufferAttribute
 * only when `dispose` exists and the
 * attribute is not a live geometry
 * attribute. Do **not** reassign
 * `null` / `undefined`. Set
 * `morphTargetsRelative = false`
 * only when it is not already false.
 * Does **not** invent morph targets.
 * Does **not** call
 * `updateMorphTargets()`. Does **not**
 * add morphAttributes. Does **not**
 * enable morphing. Does **not** touch
 * Mesh `morphTargetInfluences` /
 * `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D
 * `animations` (v0.84). Does **not**
 * touch Material `glslVersion`. Does
 * **not** enable shadows. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does **not** pin
 * `mesh.visible`, change
 * `matrixAutoUpdate`, change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins.
 *
 * v0.87: after that morphAttributes
 * clear,
 * `pinColorOnlyVisualGroups`
 * clears leftover BufferGeometry
 * `groups` so
 * `Array.isArray(geometry.groups) &&
 * geometry.groups.length === 0`
 * on packed color-only unlit
 * MeshBasic visual geometries
 * (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * the BufferGeometry constructor
 * assigns `this.groups = []`.
 * `clearGroups()` assigns a new
 * `[]` (it does not set length on
 * the existing array). Mutate the
 * existing array
 * (`groups.length = 0`). If
 * missing or non-array, assign
 * `groups = []`. Do **not** call
 * `clearGroups()`. Do **not**
 * invent groups. Do **not** assign
 * a material array. Do **not**
 * touch `drawRange`. r170
 * `WebGLRenderer.projectObject`
 * pushes one render item per group
 * only when `Array.isArray(material)`.
 * A single MeshBasicMaterial pushes
 * one item with `group = null`, so
 * leftover groups do not multiply
 * draws while the material stays a
 * single MeshBasicMaterial.
 * Clearing the list keeps a later
 * material-array binding or
 * `BufferGeometry.copy` round-trip
 * from reviving per-group draws.
 * Does **not** touch
 * `morphAttributes` /
 * `morphTargetsRelative` (v0.86).
 * Does **not** touch Mesh
 * `morphTargetInfluences` /
 * `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D
 * `animations` (v0.84). Does **not**
 * enable shadows. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does **not** pin
 * `mesh.visible`, change
 * `matrixAutoUpdate`, change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins.
 *
 * v0.88: after that groups clear,
 * `pinColorOnlyVisualDrawRange`
 * pins leftover BufferGeometry
 * `drawRange` so
 * `drawRange.start === 0` &&
 * `drawRange.count === Infinity`
 * on packed color-only unlit
 * MeshBasic visual geometries
 * (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * the BufferGeometry constructor
 * assigns
 * `this.drawRange = { start: 0, count: Infinity }`.
 * `setDrawRange(start, count)` writes
 * those fields on the existing
 * object and throws when
 * `drawRange` is missing. Mutate
 * the existing object
 * (`start = 0`, `count = Infinity`).
 * If missing or non-object, assign
 * `{ start: 0, count: Infinity }`.
 * Do **not** call `setDrawRange()`.
 * Do **not** invent a partial range.
 * Do **not** replace the geometry.
 * Do **not** touch `groups` (v0.87).
 * r170 `renderBufferDirect` draws
 * `geometry.drawRange` when the
 * render item's `group` is null.
 * A single MeshBasicMaterial pushes
 * `group = null`, so a leftover
 * partial `drawRange` clips or
 * under-draws the stand-in.
 * Pinning the default keeps the
 * full index / position span.
 * Does **not** touch
 * `morphAttributes` /
 * `morphTargetsRelative` (v0.86).
 * Does **not** touch Mesh
 * `morphTargetInfluences` /
 * `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D
 * `animations` (v0.84). Does **not**
 * enable shadows. Does not
 * hex-dedupe or invent meshes.
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does **not** pin
 * `mesh.visible`, change
 * `matrixAutoUpdate`, change
 * `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change
 * `scale`, change `rotation.order`,
 * or change prior material pins.
 *
 * v0.89: after that drawRange pin,
 * `pinColorOnlyVisualSkinAttributes`
 * strips leftover `skinIndex` /
 * `skinWeight` on packed color-only
 * unlit MeshBasic visual geometries
 * (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Verified r170 (three@0.170.0):**
 * `WebGLPrograms` sets `skinning`
 * only when `object.isSkinnedMesh === true`.
 * `WebGLProgram` emits
 * `#define USE_SKINNING` and
 * `attribute vec4 skinIndex` /
 * `attribute vec4 skinWeight` only
 * then. A plain Mesh + MeshBasic
 * does not read them.
 * `WebGLGeometries.update` still
 * uploads every
 * `geometry.attributes` entry, so
 * leftover skin attrs inflate
 * pre-upload attrBytes.
 * `GLTFLoader` maps `JOINTS_0` →
 * `skinIndex` and `WEIGHTS_0` →
 * `skinWeight`, and builds a
 * `SkinnedMesh` only when the node
 * has a skin. This pulse deletes
 * the leftover attributes via
 * `BufferGeometry.deleteAttribute`.
 * Do **not** invent a SkinnedMesh.
 * Do **not** enable skinning. Do
 * **not** touch bones / `skeleton`
 * / `bindMatrix` /
 * `bindMatrixInverse`. Do **not**
 * delete `position`. Do **not**
 * touch `drawRange` (v0.88). Do
 * **not** touch `groups` (v0.87).
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft
 * (no lod groups) still runs this
 * pin.
 *
 * v0.90: after that skin strip,
 * `pinColorOnlyVisualUpdateRange`
 * pins leftover BufferAttribute
 * `updateRange` so
 * `offset === 0` && `count === -1`
 * on every non-interleaved
 * BufferAttribute plus
 * `geometry.index` when it is a
 * BufferAttribute, on packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor
 * assigns `this.updateRanges = []`
 * and does **not** assign
 * `updateRange`. `WebGLAttributes.updateBuffer`
 * full-uploads when
 * `updateRanges.length === 0` and
 * partial-uploads each
 * `{ start, count }` otherwise.
 * `addUpdateRange(start, count)`
 * pushes a partial range. Mutate
 * the existing `updateRange` object
 * (`offset = 0`, `count = -1`).
 * If missing or non-object, assign
 * `{ offset: 0, count: -1 }`.
 * Do **not** call `addUpdateRange()`.
 * Do **not** rewrite `updateRanges`.
 * Do **not** change `usage`.
 * Do **not** replace attributes or
 * the geometry. Do **not** delete
 * `skinIndex` / `skinWeight`
 * (v0.89). Do **not** touch
 * `drawRange` (v0.88). Do **not**
 * touch `groups` (v0.87).
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft
 * (no lod groups) still runs this
 * pin, including the fastener.
 *
 * v0.91: after that updateRange pin,
 * `pinColorOnlyVisualUpdateRanges`
 * clears leftover BufferAttribute
 * `updateRanges` so
 * `Array.isArray(updateRanges) &&
 * updateRanges.length === 0` on
 * every non-interleaved
 * BufferAttribute plus
 * `geometry.index` when it is a
 * BufferAttribute, on packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor
 * assigns `this.updateRanges = []`.
 * `WebGLAttributes.updateBuffer`
 * full-uploads when
 * `updateRanges.length === 0` and
 * partial-uploads each
 * `{ start, count }` otherwise.
 * Mutate the existing array
 * (`length = 0`). If missing or
 * non-array, assign `[]`.
 * Do **not** call `addUpdateRange()`.
 * Do **not** call `clearUpdateRanges()`.
 * Do **not** touch `updateRange`
 * (v0.90). Do **not** change `usage`.
 * Do **not** replace attributes or
 * the geometry. Do **not** delete
 * `skinIndex` / `skinWeight`.
 * Do **not** touch `drawRange` /
 * `groups` / `morphAttributes`.
 * Mapped / lit / interleaved stay
 * authored. Collider meshes stay
 * untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft
 * (no lod groups) still runs this
 * pin, including the fastener.
 *
 * v0.92: after that updateRanges
 * clear, `pinColorOnlyVisualBounds`
 * pins leftover BufferGeometry
 * `boundingBox` and `boundingSphere`
 * to the r170 constructor `null`
 * on packed color-only unlit
 * MeshBasic visual geometries
 * (body LOD leaves + lid/latch/tool
 * + fastener; same
 * `isColorOnlyUnlitBasic` gate).
 * **Checked installed three@0.170.0:**
 * the BufferGeometry constructor
 * assigns `this.boundingBox = null`
 * and `this.boundingSphere = null`.
 * `Frustum.intersectsObject` uses
 * `geometry.boundingSphere` when
 * the Mesh has no own
 * `boundingSphere`, and calls
 * `computeBoundingSphere` only when
 * that sphere is `null`. A leftover
 * non-null sphere is tested as-is
 * while `frustumCulled` stays true
 * (v0.50). Assign `null`. Do **not**
 * invent `Box3` / `Sphere`. Do
 * **not** call `computeBoundingBox`
 * or `computeBoundingSphere` in the
 * pin. Do **not** touch
 * `updateRanges` (v0.91). Do **not**
 * touch `updateRange` (v0.90). Do
 * **not** change `usage`. Do **not**
 * replace attributes or the
 * geometry. Do **not** change
 * `frustumCulled`. Mapped / lit /
 * interleaved stay authored.
 * Collider meshes stay untouched.
 * Does not hex-dedupe or invent
 * meshes. Fail-soft (no lod groups)
 * still runs this pin, including
 * the fastener. The v0.43 `onUpload`
 * callback recomputes bounds when
 * they are null while CPU arrays
 * are still present, then releases
 * the arrays.
 *
 * v0.93: after that geometry bounds
 * pin, `pinColorOnlyVisualMeshBoundingSphere`
 * deletes leftover Mesh / Object3D
 * `boundingSphere` so the property is
 * absent (`mesh.boundingSphere === undefined`)
 * on those same packed color-only
 * unlit MeshBasic visual meshes
 * (body LOD leaves + lid/latch/tool
 * + fastener; same
 * `isColorOnlyUnlitBasic` gate and
 * the same collider / interleaved /
 * mapped / lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * `Frustum.intersectsObject` uses
 * `object.boundingSphere` when that
 * property is not `undefined`. A Mesh
 * does not assign it, so the else
 * branch copies
 * `geometry.boundingSphere` and calls
 * `geometry.computeBoundingSphere()`
 * only when that sphere is `null`
 * (v0.92 restores that path). A
 * leftover non-undefined
 * `mesh.boundingSphere` short-circuits
 * past the geometry path while
 * `frustumCulled` stays true (v0.50).
 * `null !== undefined`, so assigning
 * `null` would still take the object
 * branch. Prefer `delete`. Do **not**
 * assign `null`. Do **not** invent a
 * `Sphere`. Do **not** call
 * `computeBoundingSphere` on the mesh.
 * Do **not** touch
 * `geometry.boundingBox` /
 * `geometry.boundingSphere` (v0.92).
 * Do **not** touch `updateRanges`
 * (v0.91) or `updateRange` (v0.90).
 * Do **not** change `usage`. Do
 * **not** change `frustumCulled`.
 * Mapped / lit / interleaved keep
 * authored object spheres. Collider
 * meshes stay untouched. Does not
 * hex-dedupe or invent meshes.
 * Fail-soft (no lod groups) still
 * runs this pin, including the
 * fastener.
 *
 * v0.94: after that object-sphere
 * clear, `pinColorOnlyVisualUsage`
 * pins leftover BufferAttribute
 * `usage` to the r170 constructor
 * default `StaticDrawUsage` on every
 * non-interleaved BufferAttribute
 * plus `geometry.index` when it is a
 * BufferAttribute, on those same
 * packed color-only unlit MeshBasic
 * visual geometries (body LOD leaves
 * + lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and
 * the same collider / interleaved /
 * mapped / lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor
 * assigns `this.usage = StaticDrawUsage`.
 * `setUsage` writes that field in
 * place. `WebGLAttributes.createBuffer`
 * passes `attribute.usage` to
 * `gl.bufferData`. A leftover
 * `DynamicDrawUsage` (or any other
 * non-static usage) on static packed
 * color-only props is a wasteful
 * buffer hint on Quest 3 TBDR.
 * Do **not** replace the attribute
 * or the geometry. Do **not** touch
 * `updateRange` (v0.90) or
 * `updateRanges` (v0.91). Do **not**
 * touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Do **not**
 * touch Mesh `boundingSphere` (v0.93).
 * Do **not** change `frustumCulled`.
 * Mapped / lit / interleaved keep
 * authored usage. Collider meshes
 * stay untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft (no lod
 * groups) still runs this pin,
 * including the fastener.
 *
 * v0.95: after that usage pin,
 * `pinColorOnlyVisualNormalized` pins
 * leftover BufferAttribute `normalized`
 * to the r170 constructor default
 * `false` (`normalized === false`) on
 * every non-interleaved BufferAttribute
 * plus `geometry.index` when it is a
 * BufferAttribute, on those same packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor is
 * `(array, itemSize, normalized = false)`
 * and assigns `this.normalized = normalized`.
 * Omitting the argument leaves
 * `normalized === false`.
 * `Float16BufferAttribute` forwards that
 * flag. `WebGLAttributes.createBuffer`
 * does not read `normalized`.
 * `WebGLBindingStates.setupVertexAttributes`
 * passes `geometryAttribute.normalized`
 * to `gl.vertexAttribPointer`. A leftover
 * `normalized === true` on Float16 /
 * Float32 `position` (or the index)
 * incorrectly normalizes static packed
 * color-only props and breaks Quest 3
 * TBDR draws. Assign
 * `attribute.normalized = false` in
 * place only when it is not already
 * false. Do **not** replace the
 * attribute, the typed array, or the
 * geometry. Do **not** call `setUsage`
 * (v0.94 usage stays). Do **not** touch
 * `updateRange` (v0.90) or `updateRanges`
 * (v0.91). Do **not** touch geometry
 * `boundingBox` / `boundingSphere`
 * (v0.92). Do **not** touch Mesh
 * `boundingSphere` (v0.93). Do **not**
 * change `frustumCulled`. Mapped / lit /
 * interleaved keep authored `normalized`.
 * Collider meshes stay untouched. Does
 * not hex-dedupe or invent meshes.
 * Fail-soft (no lod groups) still runs
 * this pin, including the fastener.
 *
 * v0.96: after that normalized pin,
 * `pinColorOnlyVisualGpuType` pins
 * leftover BufferAttribute `gpuType`
 * to the r170 constructor default
 * `FloatType` (`gpuType === FloatType`)
 * on every non-interleaved BufferAttribute
 * plus `geometry.index` when it is a
 * BufferAttribute, on those same packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor assigns
 * `this.gpuType = FloatType` (1015).
 * `Float16BufferAttribute` does not
 * override `gpuType`.
 * `WebGLAttributes.createBuffer` chooses
 * the GL component type from the typed
 * array and does not read `gpuType`.
 * `WebGLBindingStates.setupVertexAttributes`
 * calls `gl.vertexAttribIPointer` when
 * `geometryAttribute.gpuType === IntType`.
 * A leftover `IntType` on Float16 /
 * Float32 `position` (or the index)
 * mis-types static packed color-only
 * props and breaks Quest 3 TBDR draws.
 * Assign `attribute.gpuType = FloatType`
 * in place only when it is not already
 * `FloatType`. Do **not** replace the
 * attribute, the typed array, or the
 * geometry. Do **not** call `setUsage`
 * (v0.94 usage stays). Do **not**
 * reassign `normalized` (v0.95 stays).
 * Do **not** touch `updateRange` (v0.90)
 * or `updateRanges` (v0.91). Do **not**
 * touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Do **not**
 * touch Mesh `boundingSphere` (v0.93).
 * Do **not** change `frustumCulled`.
 * Mapped / lit / interleaved keep
 * authored `gpuType`. Collider meshes
 * stay untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft (no lod
 * groups) still runs this pin,
 * including the fastener.
 *
 * v0.97: after that gpuType pin,
 * `pinColorOnlyVisualName` pins
 * leftover BufferAttribute `name`
 * to the r170 constructor default
 * empty string (`name === ''`) on
 * every non-interleaved BufferAttribute
 * plus `geometry.index` when it is a
 * BufferAttribute, on those same packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor assigns
 * `this.name = ''`. `Float16BufferAttribute`
 * does not override `name`.
 * `BufferAttribute.toJSON` writes
 * `data.name` only when `this.name !== ''`.
 * `BufferGeometryLoader` copies a JSON
 * attribute name onto the BufferAttribute.
 * `WebGLAttributes` and `WebGLBindingStates`
 * do not read `attribute.name`. GLTF / DCC
 * ingest often leaves accessor or exporter
 * names on attributes and the index.
 * Clearing them to `''` is load-time
 * packaging only: no draw / tri /
 * attrBytes change; it drops leftover
 * string retention on Quest 3 TBDR static
 * props. Assign `attribute.name = ''` in
 * place only when it is not already `''`.
 * Do **not** replace the attribute, the
 * typed array, or the geometry. Do **not**
 * touch `gpuType` (v0.96 gpuType-float
 * stays). Do **not** call `setUsage`
 * (v0.94 usage stays). Do **not**
 * reassign `normalized` (v0.95 stays).
 * Do **not** touch `updateRange` (v0.90)
 * or `updateRanges` (v0.91). Do **not**
 * touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Do **not**
 * touch Mesh `boundingSphere` (v0.93).
 * Do **not** change `frustumCulled`.
 * Do **not** rename the Mesh.
 * Mapped / lit / interleaved keep
 * authored `name`. Collider meshes
 * stay untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft (no lod
 * groups) still runs this pin,
 * including the fastener.
 *
 * v0.98: after that name pin,
 * `pinColorOnlyVisualVersion` pins
 * leftover BufferAttribute `version`
 * to the r170 constructor default
 * `0` (`version === 0`) on every
 * non-interleaved BufferAttribute
 * plus `geometry.index` when it is a
 * BufferAttribute, on those same packed
 * color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferAttribute constructor assigns
 * `this.version = 0`. The `needsUpdate`
 * setter increments `version` when
 * `value === true`.
 * `Float16BufferAttribute` does not
 * override `version`.
 * `WebGLAttributes.update` stores
 * `attribute.version` on the first
 * upload and calls `updateBuffer`
 * (`gl.bufferSubData`, then
 * `onUploadCallback`) when the stored
 * buffer version is less than
 * `attribute.version`. A leftover
 * non-zero `version` on static packed
 * color-only props before first upload
 * forces extra TBDR buffer work.
 * Assign `attribute.version = 0` in
 * place only when it is not already
 * `0`. Do **not** replace the
 * attribute, the typed array, or the
 * geometry. Do **not** touch `name`
 * (v0.97 name-empty stays). Do **not**
 * touch `gpuType` (v0.96 gpuType-float
 * stays). Do **not** call `setUsage`
 * (v0.94 usage stays). Do **not**
 * reassign `normalized` (v0.95 stays).
 * Do **not** touch `onUpload` /
 * `onUploadCallback` (v0.43 CPU-release
 * hook stays). Do **not** touch
 * `updateRange` (v0.90) or
 * `updateRanges` (v0.91). Do **not**
 * touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Do **not**
 * touch Mesh `boundingSphere` (v0.93).
 * Do **not** change `frustumCulled`.
 * Do **not** rename the Mesh.
 * Mapped / lit / interleaved keep
 * authored `version`. Collider meshes
 * stay untouched. Does not hex-dedupe
 * or invent meshes. Fail-soft (no lod
 * groups) still runs this pin,
 * including the fastener.
 *
 * v0.99: after that version pin,
 * `pinColorOnlyVisualGeometryName` pins
 * leftover BufferGeometry `name` to the
 * r170 constructor default empty string
 * (`geometry.name === ''`) on those same
 * packed color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferGeometry constructor assigns
 * `this.name = ''`. `BufferGeometry.toJSON`
 * writes `data.name` only when
 * `this.name !== ''`. `BufferGeometry.copy`
 * copies `source.name`.
 * `BufferGeometryLoader` assigns
 * `geometry.name = json.name` when
 * `json.name` is present.
 * `ObjectLoader.parseGeometries` assigns
 * `geometry.name = data.name` when
 * `data.name !== undefined`. Stock
 * GLTFLoader names the Mesh and copies
 * primitive extras onto
 * `geometry.userData`; it does not assign
 * `geometry.name`. `WebGLRenderer` does
 * not read `geometry.name`. DCC exporters
 * and JSON round-trips still leave mesh
 * or primitive names on the geometry.
 * Clearing them to `''` is load-time
 * packaging only: no draw / tri /
 * attrBytes change; it drops leftover
 * string retention on Quest 3 TBDR static
 * props. Assign `geometry.name = ''` in
 * place only when it is not already `''`.
 * Do **not** replace the geometry, the
 * attributes, or the typed arrays. Do
 * **not** touch BufferAttribute `version`
 * (v0.98 version-zero stays). Do **not**
 * touch BufferAttribute `name` (v0.97
 * name-empty stays). Do **not** touch
 * `gpuType` (v0.96 gpuType-float stays).
 * Do **not** call `setUsage` (v0.94 usage
 * stays). Do **not** reassign `normalized`
 * (v0.95 stays). Do **not** touch
 * `onUpload` / `onUploadCallback` (v0.43
 * CPU-release hook stays). Do **not**
 * touch `updateRange` (v0.90) or
 * `updateRanges` (v0.91). Do **not** touch
 * geometry `boundingBox` / `boundingSphere`
 * (v0.92). Do **not** touch Mesh
 * `boundingSphere` (v0.93). Do **not**
 * change `frustumCulled`. Do **not**
 * rename the Mesh (`lidMesh` / `latchMesh`
 * / `fastenerMesh` stay). Mapped / lit /
 * interleaved keep authored
 * `geometry.name`. Collider meshes stay
 * untouched. Does not hex-dedupe or invent
 * meshes. Fail-soft (no lod groups) still
 * runs this pin, including the fastener.
 *
 * v1.0.0: after that geometry-name pin,
 * `pinColorOnlyVisualGeometryUserData` pins
 * leftover BufferGeometry `userData` to a
 * fresh empty plain object
 * (`geometry.userData = {}`) on those same
 * packed color-only unlit MeshBasic visual
 * geometries (body LOD leaves +
 * lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the
 * same collider / interleaved / mapped /
 * lit / shared-material /
 * shared-geometry skip rules).
 * **Checked installed three@0.170.0:**
 * the BufferGeometry constructor assigns
 * `this.userData = {}`. `BufferGeometry.toJSON`
 * writes `data.userData` only when
 * `Object.keys(this.userData).length > 0`.
 * `BufferGeometry.copy` assigns
 * `this.userData = source.userData` (shared
 * reference). `BufferGeometryLoader` assigns
 * `geometry.userData = json.userData` when
 * `json.userData` is truthy.
 * `ObjectLoader.parseGeometries` assigns
 * `geometry.userData = data.userData` when
 * `data.userData !== undefined`. Stock
 * GLTFLoader `addPrimitiveAttributes` calls
 * `assignExtrasToUserData(geometry, primitiveDef)`,
 * which `Object.assign`s primitive extras
 * onto `geometry.userData`. `WebGLRenderer`
 * does not read `geometry.userData`. DCC /
 * glTF primitive extras still sit on
 * `geometry.userData` after the v0.99 name
 * pin. Clearing them to a fresh `{}` is
 * load-time packaging only: no draw / tri /
 * attrBytes change. Assign
 * `geometry.userData = {}` only when it is
 * not already an empty plain object (each
 * replacement is a fresh object). Do **not**
 * replace the geometry, the attributes, or
 * the typed arrays. Do **not** touch
 * BufferGeometry `name` (v0.99
 * geometry-name-empty stays). Do **not**
 * touch Mesh / Object3D `userData`. Do
 * **not** touch BufferAttribute `version`
 * (v0.98 version-zero stays). Do **not**
 * touch BufferAttribute `name` (v0.97
 * name-empty stays). Do **not** touch
 * `gpuType` (v0.96 gpuType-float stays).
 * Do **not** call `setUsage` (v0.94 usage
 * stays). Do **not** reassign `normalized`
 * (v0.95 stays). Do **not** touch
 * `onUpload` / `onUploadCallback` (v0.43
 * CPU-release hook stays). Do **not**
 * touch `updateRange` (v0.90) or
 * `updateRanges` (v0.91). Do **not** touch
 * geometry `boundingBox` / `boundingSphere`
 * (v0.92). Do **not** touch Mesh
 * `boundingSphere` (v0.93). Do **not**
 * change `frustumCulled`. Do **not**
 * rename the Mesh (`lidMesh` / `latchMesh`
 * / `fastenerMesh` stay). Mapped / lit /
 * interleaved keep authored
 * `geometry.userData`. Collider meshes stay
 * untouched. Does not hex-dedupe or invent
 * meshes. Fail-soft (no lod groups) still
 * runs this pin, including the fastener.
 *
 * v1.1.0: after that geometry-userData pin,
 * `pinColorOnlyVisualMaterialUserData` pins
 * leftover Material `userData` to a fresh empty
 * plain object (`material.userData = {}`) on the
 * packed color-only unlit MeshBasic materials
 * used by those same visuals (shared wood /
 * brass / steel stand-ins; unique MeshBasic
 * stays 3; body LOD leaves + lid/latch/tool +
 * fastener; same `isColorOnlyUnlitBasic` gate
 * and the same collider / interleaved / mapped /
 * lit / shared-material / shared-geometry skip
 * rules).
 * **Checked installed three@0.170.0:** the
 * Material constructor assigns
 * `this.userData = {}`. `Material.toJSON` writes
 * `data.userData` only when
 * `Object.keys(this.userData).length > 0`.
 * `Material.copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone, not the shared reference
 * `BufferGeometry.copy` uses). `MaterialLoader`
 * assigns `material.userData = json.userData`
 * when `json.userData !== undefined`.
 * `ObjectLoader.parseMaterials` uses that
 * loader. Stock GLTFLoader `loadMaterial` calls
 * `assignExtrasToUserData(material, materialDef)`,
 * which `Object.assign`s material extras onto
 * `material.userData`. `WebGLRenderer` does not
 * read `material.userData`. DCC / glTF material
 * extras can still sit on `material.userData`
 * after the v1.0.0 geometry pin. Clearing them
 * to a fresh `{}` is load-time packaging only:
 * no draw / tri / attrBytes change. Assign
 * `material.userData = {}` only when it is not
 * already an empty plain object (each
 * replacement is a fresh object; do not share
 * one `{}` across materials). Do **not**
 * replace the material, the geometry, the
 * attributes, or the typed arrays. Do **not**
 * touch Material `name`. Do **not** touch prior
 * material program-cache / flag pins. Do **not**
 * touch BufferGeometry `userData` (v1.0.0
 * geometry-userData-empty stays) or
 * BufferGeometry `name` (v0.99
 * geometry-name-empty stays). Do **not** touch
 * Mesh / Object3D `userData`. Do **not** touch
 * BufferAttribute `version` / `name` /
 * `gpuType` / `normalized` / `usage` /
 * `updateRange` / `updateRanges` / `onUpload` /
 * `onUploadCallback`. Do **not** touch geometry
 * bounds or Mesh `boundingSphere`. Do **not**
 * change `frustumCulled`. Do **not** rename the
 * Mesh (`lidMesh` / `latchMesh` /
 * `fastenerMesh` stay). Mapped / lit /
 * interleaved keep authored
 * `material.userData`. Collider meshes stay
 * untouched. Does not hex-dedupe or invent
 * materials. Fail-soft (no lod groups) still
 * runs this pin, including the fastener.
 *
 * v1.2.0: after that material-userData pin,
 * `pinColorOnlyVisualMaterialName` pins
 * leftover Material `name` to the r170
 * constructor default empty string
 * (`material.name === ''`) on the packed
 * color-only unlit MeshBasic materials used
 * by those same visuals (shared wood / brass /
 * steel stand-ins; unique MeshBasic stays 3;
 * body LOD leaves + lid/latch/tool +
 * fastener; same `isColorOnlyUnlitBasic` gate
 * and the same collider / interleaved / mapped /
 * lit / shared-material / shared-geometry skip
 * rules).
 * **Checked installed three@0.170.0:** the
 * Material constructor assigns `this.name = ''`.
 * `Material.toJSON` writes `data.name` only
 * when `this.name !== ''`. `Material.copy`
 * copies `source.name`. `MaterialLoader`
 * assigns `material.name = json.name` when
 * `json.name !== undefined`.
 * `ObjectLoader.parseMaterials` uses that
 * loader. Stock GLTFLoader `loadMaterial`
 * assigns `material.name = materialDef.name`
 * when `materialDef.name` is set.
 * `WebGLRenderer` does not read `material.name`.
 * `WebGLPrograms.getParameters` copies
 * `shaderName: material.name` and
 * `WebGLProgram` emits `#define SHADER_NAME`
 * from that parameter. `getProgramCacheKey`
 * does not include `shaderName`, so a leftover
 * name does not fork the program cache or
 * change the draw. DCC / glTF material names
 * can still sit on `material.name` after the
 * v1.1.0 userData pin. Clearing them to `''`
 * is load-time packaging only: no draw / tri /
 * attrBytes change. Assign `material.name = ''`
 * only when it is not already `''`. Do **not**
 * replace the material, the geometry, the
 * attributes, or the typed arrays. Do **not**
 * touch Material `userData` (v1.1.0
 * material-userData-empty stays). Do **not**
 * touch prior material program-cache / flag
 * pins. Do **not** touch BufferGeometry
 * `userData` (v1.0.0 geometry-userData-empty
 * stays) or BufferGeometry `name` (v0.99
 * geometry-name-empty stays). Do **not** touch
 * Mesh / Object3D `userData`. Do **not** touch
 * BufferAttribute `version` / `name` /
 * `gpuType` / `normalized` / `usage` /
 * `updateRange` / `updateRanges` / `onUpload` /
 * `onUploadCallback`. Do **not** touch geometry
 * bounds or Mesh `boundingSphere`. Do **not**
 * change `frustumCulled`. Do **not** rename the
 * Mesh (`lidMesh` / `latchMesh` /
 * `fastenerMesh` stay). Mapped / lit /
 * interleaved keep authored `material.name`.
 * Collider meshes stay untouched. Does not
 * hex-dedupe or invent materials. Fail-soft
 * (no lod groups) still runs this pin,
 * including the fastener.
 *
 * v1.3.0: after that material-name pin,
 * `pinColorOnlyVisualMeshName` pins leftover
 * Mesh / Object3D `name` to the r170
 * constructor default empty string
 * (`mesh.name === ''`) on packed color-only
 * unlit MeshBasic visual meshes (body LOD
 * leaves + lid/latch/tool + fastener; same
 * `isColorOnlyUnlitBasic` gate and the same
 * collider / interleaved / mapped / lit /
 * shared-material / shared-geometry skip
 * rules). Reserved names stay: `lidMesh`,
 * `latchMesh`, `fastenerMesh`, and any
 * `collider_*` mesh name.
 * **Checked installed three@0.170.0:** the
 * Object3D constructor assigns `this.name = ''`.
 * `Mesh` does not override `name`.
 * `Object3D.toJSON` writes `object.name` only
 * when `this.name !== ''`. `Object3D.copy`
 * copies `source.name`. `ObjectLoader.parseObject`
 * assigns `object.name = data.name` when
 * `data.name !== undefined`. Stock GLTFLoader
 * assigns `mesh.name` from the mesh definition
 * (`meshDef.name` or `mesh_` + index) and, when
 * the node has a name, assigns `node.name`
 * (a single-primitive node is the mesh, so the
 * node name replaces the primitive name).
 * `WebGLRenderer` does not read `mesh.name`.
 * `WebGLPrograms.getParameters` copies
 * `shaderName: material.name`, not the mesh
 * name, so a leftover mesh name does not fork
 * the program cache or change the draw. DCC /
 * glTF node and mesh names can still sit on
 * `mesh.name` after the v1.2.0 material-name
 * pin. Clearing non-reserved names to `''` is
 * load-time packaging only: no draw / tri /
 * attrBytes change. Assign `mesh.name = ''`
 * only when it is not already `''` and not a
 * reserved name. Do **not** replace the mesh,
 * the material, the geometry, the attributes,
 * or the typed arrays. Do **not** touch
 * Material `name` (v1.2.0 material-name-empty
 * stays) or Material `userData` (v1.1.0
 * material-userData-empty stays). Do **not**
 * touch BufferGeometry `userData` / `name`.
 * Do **not** touch Mesh / Object3D `userData`.
 * Do **not** touch BufferAttribute fields,
 * bounds, morphs, animations, shadows,
 * `frustumCulled`, `matrixAutoUpdate`, or
 * `mesh.visible`. Mapped / lit / interleaved
 * keep authored `mesh.name`. Collider meshes
 * stay untouched. Does not hex-dedupe or
 * invent meshes. Fail-soft (no lod groups)
 * still runs this pin, including the fastener.
 *
 * v1.4.0: after that mesh-name pin,
 * `pinColorOnlyVisualMeshUserData` pins leftover Mesh / Object3D
 * `userData` to the r170 constructor default empty plain object
 * (`mesh.userData` is a fresh `{}` with `Object.prototype` and no
 * own keys) on packed color-only unlit MeshBasic visual meshes
 * (body LOD leaves + lid/latch/tool + fastener; the same 13
 * visuals; same `isColorOnlyUnlitBasic` gate and the same collider
 * / interleaved / mapped / lit / shared-material / shared-geometry
 * skip rules).
 * **Checked installed three@0.170.0:** the Object3D constructor
 * assigns `this.userData = {}`. `Mesh` does not override
 * `userData`. `Object3D.toJSON` writes `object.userData` only when
 * `Object.keys(this.userData).length > 0`. `Object3D.copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone). `ObjectLoader.parseObject` assigns
 * `object.userData = data.userData` when `data.userData !==
 * undefined`. Stock GLTFLoader `loadMesh` calls
 * `assignExtrasToUserData(mesh, meshDef)` and `_loadNodeShallow`
 * calls `assignExtrasToUserData(node, nodeDef)`. A single-primitive
 * node is the mesh, so node extras land on `mesh.userData`.
 * `WebGLRenderer` does not read `mesh.userData`. DCC / glTF extras
 * can still sit on `mesh.userData` after the v1.3.0 name pin.
 * Clearing them to a fresh `{}` is load-time packaging only: no
 * draw / tri / attrBytes change. Assign `mesh.userData = {}` only
 * when it is not already an empty plain object (each replacement
 * is a fresh object; do not share one `{}` across meshes). Do
 * **not** replace the mesh, the material, the geometry, the
 * attributes, or the typed arrays. Do **not** touch Mesh /
 * Object3D `name` (v1.3.0 mesh-name-empty stays; reserved names
 * `lidMesh` / `latchMesh` / `fastenerMesh` and any `collider_*`
 * stay). Do **not** touch Material `name` or Material `userData`.
 * Do **not** touch BufferGeometry `userData` / `name`. Do **not**
 * touch entity/root `userData`, tool Group `userData`, or collider
 * mesh `userData`. Do **not** touch BufferAttribute fields, bounds,
 * morphs, animations, shadows, `frustumCulled`, `matrixAutoUpdate`,
 * or `mesh.visible`. Mapped / lit / interleaved keep authored
 * `mesh.userData`. Collider meshes stay untouched. Does not
 * hex-dedupe or invent meshes. Fail-soft (no lod groups) still
 * runs this pin, including the fastener.
 *
 * v1.5.0: after that mesh-userData pin,
 * `pinColorOnlyVisualMaterialVersion` pins leftover Material
 * `version` to the r170 constructor default `0`
 * (`material.version === 0`) on the 3 shared color-only MeshBasic
 * materials (wood / brass / steel; unique MeshBasic stays 3;
 * measured material-version-zero 3; same `isColorOnlyUnlitBasic`
 * gate and the same collider / interleaved / mapped / lit /
 * shared-material / shared-geometry skip rules).
 * **Checked installed three@0.170.0:** the Material constructor
 * assigns `this.version = 0`. The `needsUpdate` setter increments
 * `version` when `value === true`. The `alphaTest` setter also
 * increments `version` when the test crosses zero. `Material.copy`
 * does not copy `version`. `Material.toJSON` does not write
 * `material.version` (`metadata.version` 4.6 is the JSON format
 * version). `WebGLRenderer.setProgram` sets `needsProgramChange`
 * and stores `materialProperties.__version = material.version`
 * when `material.version !== materialProperties.__version`, then
 * calls `getProgram`, which builds parameters via
 * `WebGLPrograms.getParameters`. `getProgramCacheKey` does not
 * include `material.version`, so a leftover number does not fork
 * a second program. A leftover non-zero `material.version` on a
 * static packed color-only MeshBasic is a dirty counter. The
 * mismatch still allocates program parameters on the JS thread
 * before the fast path (`version === __version`) can skip
 * `getProgram`. On Quest 3 TBDR that load-time parameter rebuild
 * is packaging waste: no draw / tri / attrBytes change. Assign
 * `material.version = 0` in place only when it is not already `0`.
 * Do **not** call `material.needsUpdate = true` (that increments
 * `version`). Direct assignment does not go through `needsUpdate`.
 * Pin once per shared material instance. Do **not** replace the
 * material, the mesh, the geometry, the attributes, or the typed
 * arrays. Do **not** invent materials. Do **not** touch Material
 * `name` (v1.2.0 material-name-empty stays) or Material `userData`
 * (v1.1.0 material-userData-empty stays). Do **not** touch Mesh /
 * Object3D `userData` (v1.4.0 mesh-userData-empty stays) or Mesh /
 * Object3D `name` (v1.3.0; reserved names `lidMesh` / `latchMesh` /
 * `fastenerMesh` and any `collider_*` stay). Do **not** touch
 * BufferGeometry `userData` / `name`. Do **not** touch
 * BufferAttribute fields, prior material program-cache / flag
 * pins, bounds, morphs, animations, shadows, `frustumCulled`,
 * `matrixAutoUpdate`, or `mesh.visible`. Mapped / lit /
 * interleaved keep authored `material.version`. Collider meshes
 * stay untouched. Fail-soft (no lod groups) still runs this pin,
 * including the fastener.
 *
 * v1.6.0: after that material-version pin,
 * `pinColorOnlyVisualMatrixWorldNeedsUpdate` pins leftover Object3D /
 * Mesh `matrixWorldNeedsUpdate` to the r170 constructor default
 * `false` (`mesh.matrixWorldNeedsUpdate === false`) on the 13 packed
 * color-only unlit MeshBasic visual meshes (body LOD leaves +
 * lid/latch/tool + fastener; measured matrixWorldNeedsUpdate-false
 * 13; same `isColorOnlyUnlitBasic` gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry
 * skip rules).
 * **Checked installed three@0.170.0:** the Object3D constructor
 * assigns `this.matrixWorldNeedsUpdate = false`. `Mesh` does not
 * override it. `updateMatrix()` assigns
 * `this.matrixWorldNeedsUpdate = true`. `updateMatrixWorld(force)`
 * recomputes `matrixWorld` when `this.matrixWorldNeedsUpdate || force`
 * (and `matrixWorldAutoUpdate === true`), then assigns
 * `this.matrixWorldNeedsUpdate = false`. `updateWorldMatrix` does
 * not read or clear the flag; when `matrixAutoUpdate` is true it
 * calls `updateMatrix()`, which sets the flag `true`.
 * `Object3D.copy` copies `source.matrixWorldNeedsUpdate`.
 * `applyMatrix4` calls `updateMatrix()` when `matrixAutoUpdate` is
 * true, so a glTF node matrix leaves the flag `true` on a live node.
 * `WebGLRenderer.render` calls `scene.updateMatrixWorld()` when
 * `scene.matrixWorldAutoUpdate === true`. The fast path inside
 * `updateMatrixWorld` skips `multiplyMatrices` only when the flag is
 * `false` and `force` is false. A leftover `true` on a static packed
 * color-only visual (`matrixAutoUpdate === false` from v0.45, so
 * `updateMatrix` is not called first) forces that world-matrix
 * multiply on the JS thread before the flag is cleared. On Quest 3
 * TBDR that load-time / first-frame rebuild is packaging waste: no
 * draw / tri / attrBytes change. Assign
 * `mesh.matrixWorldNeedsUpdate = false` in place only when it is not
 * already `false`. Do **not** call `updateMatrix` or
 * `updateMatrixWorld` inside the pin. Do **not** replace the mesh,
 * the material, the geometry, the attributes, or the typed arrays.
 * Do **not** change `matrixAutoUpdate` (v0.45 freeze stays;
 * lid/latch/tool/fastener stay live). Do **not** change
 * `matrixWorldAutoUpdate` (v0.69 stays). Do **not** touch Material
 * `version` (v1.5.0 material-version-zero stays) or Material `name`
 * or Material `userData`. Do **not** touch Mesh / Object3D `userData`
 * (v1.4.0) or Mesh / Object3D `name` (v1.3.0; reserved names
 * `lidMesh` / `latchMesh` / `fastenerMesh` and any `collider_*`
 * stay). Do **not** touch BufferGeometry `userData` / `name`. Do
 * **not** touch BufferAttribute fields, prior material program-cache
 * / flag pins, bounds, morphs, animations, shadows, `frustumCulled`,
 * or `mesh.visible`. Mapped / lit / interleaved keep authored
 * `matrixWorldNeedsUpdate`. Collider meshes stay untouched.
 * Fail-soft (no lod groups) still runs this pin, including the
 * fastener.
 *
 * v1.7.0: after that matrixWorldNeedsUpdate pin,
 * `pinColorOnlyVisualColorAttribute` strips leftover BufferGeometry
 * `color` so the attribute is absent
 * (`geometry.getAttribute('color')` is missing and
 * `geometry.hasAttribute('color') === false`) on the 13 packed
 * color-only unlit MeshBasic visual geometries (body LOD leaves +
 * lid/latch/tool + fastener; measured colorAttribute-absent 13)
 * when the material already has `vertexColors === false` (v0.57
 * stays; same `isColorOnlyUnlitBasic` gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry
 * skip rules). `COLOR_ONLY_UNUSED_COLOR_ATTRS` is `['color']` and is
 * listed on `COLOR_ONLY_UNUSED_ATTRS`.
 * `stripUnusedColorOnlyColorAttributes` deletes it from
 * `stripUnusedColorOnlyAttributes` on the pack/weld path and skips
 * interleaved geometries.
 * **Checked installed three@0.170.0:** a fresh `BufferGeometry`
 * assigns `this.attributes = {}` and has no `color` attribute.
 * `deleteAttribute(name)` does `delete this.attributes[name]` and
 * does not assign `null`. `WebGLPrograms.getParameters` copies
 * `vertexColors: material.vertexColors` and enables the vertex-color
 * program layer only when `parameters.vertexColors` is true.
 * `WebGLProgram` emits `#define USE_COLOR` and `attribute vec3 color`
 * only then. A leftover `color` BufferAttribute on a color-only
 * MeshBasic with `vertexColors === false` is never read by the
 * MeshBasic shader path. `WebGLGeometries.update` still uploads every
 * `geometry.attributes` entry, so the leftover inflates pre-upload
 * attrBytes and GPU buffer work on Quest 3 TBDR static props.
 * Deleting it is load-time packaging. `GLTFLoader` maps `COLOR_0` →
 * `color`. On clean procedural meshes draws / tris / attrBytes stay
 * unchanged vs v1.6.0. A fixture with a leftover Float32 `color` may
 * drop measured attrBytes (`count * itemSize * 4` bytes; a 24-vert
 * BoxGeometry with itemSize 3 drops 288). Prefer
 * `geometry.deleteAttribute('color')` when present. Do **not** invent
 * a replacement attribute. Do **not** assign `null`. Do **not** enable
 * `material.vertexColors`. Do **not** rewrite `vertexColors`. Do
 * **not** replace the mesh, the material, the geometry, other
 * attributes, or typed arrays. Do **not** delete `position` or the
 * index. Do **not** touch Material `version` (v1.5.0
 * material-version-zero stays) or Material `name` or Material
 * `userData`. Do **not** touch Mesh / Object3D `userData` (v1.4.0) or
 * Mesh / Object3D `name` (v1.3.0; reserved names `lidMesh` /
 * `latchMesh` / `fastenerMesh` and any `collider_*` stay). Do **not**
 * touch `matrixWorldNeedsUpdate` (v1.6.0 matrixWorldNeedsUpdate-false
 * stays). Do **not** change `matrixAutoUpdate` or
 * `matrixWorldAutoUpdate`. Do **not** touch BufferGeometry `userData`
 * / `name`, other BufferAttribute fields, prior material
 * program-cache / flag pins, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored `color`. Collider meshes stay untouched. Fail-soft (no lod
 * groups) still runs this pin, including the fastener. 90 Hz ship
 * (~11.1 ms) / 72 Hz fallback are **requested**, not measured. No
 * invented headset ms.
 *
 * v1.8.0: after that color strip,
 * `pinColorOnlyVisualOnUpload` pins leftover BufferAttribute
 * `onUpload` / `onUploadCallback` so the v0.43 `releaseCpuArray`
 * hook is the sole upload callback on the remaining attributes (at
 * least `position`, and `index` when present) of the 13 packed
 * color-only unlit MeshBasic visual geometries (body LOD leaves +
 * lid/latch/tool + fastener; measured onUpload-release 13; same
 * `isColorOnlyUnlitBasic` gate and the same collider / interleaved /
 * mapped / lit / shared-material / shared-geometry skip rules).
 * **Checked installed three@0.170.0:** `BufferAttribute` declares
 * `onUploadCallback() {}` on the prototype. `onUpload(callback)`
 * assigns `this.onUploadCallback = callback` and does not null
 * `.array` and does not bump `version`. `BufferAttribute.copy` does
 * not copy `onUploadCallback`, so a copied attribute falls back to
 * the empty prototype method. `WebGLAttributes.createBuffer` copies
 * `attribute.array` into a local, calls `gl.bufferData`, then calls
 * `attribute.onUploadCallback()`. The callback runs after the GPU
 * upload. A leftover non-release callback (or the empty prototype
 * method) skips the Quest 3 CPU-array release, so static packed
 * color-only props keep Float16 / Uint16 CPU arrays after upload on
 * a TBDR headset. The pin installs the hook and does **not** invoke
 * it. Do **not** null `.array` inside the pin. Do **not** recompute
 * bounds inside the pin. Do **not** call `setUsage`. Do **not**
 * replace the mesh, the material, the geometry, the attributes, or
 * the typed arrays. Do **not** invent attributes. An already-correct
 * `releaseCpuArray` hook stamped to that geometry is left in place.
 * Do **not** delete `color` (v1.7.0 colorAttribute-absent stays). Do
 * **not** touch `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not**
 * change `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not**
 * touch Material `version` / `name` / `userData`, Mesh `name` /
 * `userData`, BufferGeometry `name` / `userData`, BufferAttribute
 * `version` / `name` / `gpuType` / `normalized` / `usage` /
 * `updateRange` / `updateRanges`, bounds, morphs, animations,
 * shadows, `frustumCulled`, or `mesh.visible`. Mapped / lit /
 * interleaved keep authored `onUploadCallback`. Collider meshes stay
 * untouched. Fail-soft (no lod groups) still runs this pin, including
 * the fastener. 90 Hz ship (~11.1 ms) / 72 Hz fallback are
 * **requested**, not measured. No invented headset ms.
 *
 * v1.9.0: after that onUpload pin,
 * `pinColorOnlyVisualUnusedAttributes` strips leftover `normal` /
 * `uv` / `uv1` / `uv2` / `uv3` / `tangent` so none of those channels
 * remain (`geometry.getAttribute(name)` is missing and
 * `geometry.hasAttribute(name) === false`) on the 13 packed
 * color-only unlit MeshBasic visual geometries (body LOD leaves +
 * lid/latch/tool + fastener; measured unusedAttributes-absent 13;
 * same `isColorOnlyUnlitBasic` gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry
 * skip rules). `COLOR_ONLY_UNUSED_CHANNEL_ATTRS` is derived from
 * `COLOR_ONLY_UNUSED_ATTRS` (source of truth) and excludes
 * `skinIndex` / `skinWeight` (v0.89 pin) and `color` (v1.7.0 pin).
 * `stripUnusedColorOnlyChannelAttributes` deletes them from
 * `stripUnusedColorOnlyAttributes` on the pack/weld path and skips
 * interleaved geometries. Fail-soft (no lod groups) never enters
 * that pack helper on body/lid/latch/tool, so this visual pin is the
 * fence.
 * **Checked installed three@0.170.0:** `WebGLProgram` prefix always
 * emits `attribute vec3 normal` and `attribute vec2 uv`. `uv1` /
 * `uv2` / `uv3` / `tangent` are behind `USE_UV1` / `USE_UV2` /
 * `USE_UV3` / `USE_TANGENT`, which stay off without maps.
 * `meshbasic.glsl.js` reads `normal` only inside `USE_ENVMAP` or
 * `USE_SKINNING`. `uv_vertex.glsl.js` reads `uv` only under `USE_UV`
 * or `USE_ANISOTROPY`. Color-only MeshBasic does not enable those
 * defines. `WebGLGeometries.update` still uploads every
 * `geometry.attributes` entry, so leftover channels inflate
 * pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static
 * props. Deleting them is load-time packaging. `GLTFLoader` maps
 * `NORMAL` → `normal`, `TANGENT` → `tangent`, `TEXCOORD_0` → `uv`,
 * `TEXCOORD_1` → `uv1`, `TEXCOORD_2` → `uv2`, `TEXCOORD_3` → `uv3`.
 * On clean procedural meshes draws / tris / attrBytes stay unchanged
 * vs v1.8.0. A fixture with a leftover Float32 `uv` drops
 * `count * 2 * 4` bytes; a leftover Float32 `normal` drops
 * `count * 3 * 4` bytes. Prefer `geometry.deleteAttribute(name)` when
 * present. Do **not** invent a replacement attribute. Do **not**
 * assign `null`. Do **not** delete `position` or the index. Do
 * **not** delete `skinIndex` / `skinWeight` or `color`. Do **not**
 * touch `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release
 * stays). Do **not** touch Material `version` / `name` / `userData`,
 * Mesh `name` / `userData`, BufferGeometry `name` / `userData`,
 * BufferAttribute `version` / `name` / `gpuType` / `normalized` /
 * `usage` / `updateRange` / `updateRanges`,
 * `matrixWorldNeedsUpdate`, `matrixAutoUpdate`,
 * `matrixWorldAutoUpdate`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored channels. Collider meshes stay untouched. Fail-soft (no
 * lod groups) still runs this pin, including the fastener. 90 Hz ship
 * (~11.1 ms) / 72 Hz fallback are **requested**, not measured. No
 * invented headset ms.
 *
 * v1.10.0: after that unused-channel strip,
 * `pinColorOnlyVisualIndirect` pins leftover BufferGeometry `indirect`
 * to the r170 constructor default `null` (`geometry.indirect === null`)
 * on the 13 packed color-only unlit MeshBasic visual geometries (body
 * LOD leaves + lid/latch/tool + fastener; measured indirect-null 13;
 * same `isColorOnlyUnlitBasic` gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry
 * skip rules). Call `setIndirect(null)` only when `indirect` is not
 * already `null`.
 * **Checked installed three@0.170.0:** the BufferGeometry constructor
 * assigns `this.indirect = null`. `setIndirect(indirect)` assigns
 * `this.indirect = indirect`. `getIndirect()` returns `this.indirect`.
 * In `src/renderers/common/Geometries.js`, when
 * `renderObject.geometry.indirect !== null`, the renderer calls
 * `updateAttribute(indirect, AttributeType.INDIRECT)`. Leftover
 * indirect storage forces extra GPU attribute upload / binding work.
 * Color-only static MeshBasic props do not use multi-draw /
 * BatchedMesh indirect indexing. Clearing a leftover `indirect` to
 * `null` is load-time packaging for Quest 3 TBDR. On clean procedural
 * meshes draws / tris / attrBytes stay unchanged vs v1.9.0. Do
 * **not** invent a replacement buffer. Do **not** call `delete` on
 * unrelated fields. Do **not** re-run the unused-channel strip
 * (v1.9.0 unusedAttributes-absent stays). Do **not** touch `onUpload`
 * / `onUploadCallback` (v1.8.0 onUpload-release stays). Do **not**
 * delete `color` (v1.7.0 colorAttribute-absent stays). Do **not**
 * touch `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, other BufferAttribute fields,
 * `drawRange`, `groups`, `skinIndex` / `skinWeight`, `position`, the
 * index, bounds, morphs, animations, shadows, `frustumCulled`, or
 * `mesh.visible`. Mapped / lit / interleaved keep authored `indirect`.
 * Collider meshes stay untouched. Fail-soft (no lod groups) still
 * runs this pin, including the fastener. 90 Hz ship (~11.1 ms) / 72 Hz
 * fallback are **requested**, not measured. No invented headset ms.
 */

import {
  attachToolboxLod,
  disableColorOnlyVisualRaycast,
  freezeStaticColorOnlyWorldMatrices,
  mergeSameMaterialMeshes,
  packColorOnlyGeometry,
  pinColorOnlyVisualMaterialFlags,
  pinColorOnlyVisualShadowFlags,
  pinColorOnlyVisualFrustumCulled,
  pinColorOnlyVisualRenderOrder,
  pinColorOnlyVisualLayers,
  pinColorOnlyVisualMatrixWorldAutoUpdate,
  pinColorOnlyVisualUp,
  pinColorOnlyVisualScale,
  pinColorOnlyVisualRotationOrder,
  pinColorOnlyVisualCustomShadowMaterials,
  pinColorOnlyVisualRenderCallbacks,
  pinColorOnlyVisualShadowCallbacks,
  pinColorOnlyVisualAnimations,
  pinColorOnlyVisualMorphTargets,
  pinColorOnlyVisualMorphAttributes,
  pinColorOnlyVisualGroups,
  pinColorOnlyVisualDrawRange,
  pinColorOnlyVisualSkinAttributes,
  pinColorOnlyVisualUpdateRange,
  pinColorOnlyVisualUpdateRanges,
  pinColorOnlyVisualBounds,
  pinColorOnlyVisualMeshBoundingSphere,
  pinColorOnlyVisualUsage,
  pinColorOnlyVisualNormalized,
  pinColorOnlyVisualGpuType,
  pinColorOnlyVisualName,
  pinColorOnlyVisualVersion,
  pinColorOnlyVisualGeometryName,
  pinColorOnlyVisualGeometryUserData,
  pinColorOnlyVisualMaterialUserData,
  pinColorOnlyVisualMaterialName,
  pinColorOnlyVisualMeshName,
  pinColorOnlyVisualMeshUserData,
  pinColorOnlyVisualMaterialVersion,
  pinColorOnlyVisualMatrixWorldNeedsUpdate,
  pinColorOnlyVisualColorAttribute,
  pinColorOnlyVisualOnUpload,
  pinColorOnlyVisualUnusedAttributes,
  pinColorOnlyVisualIndirect,
} from "./toolbox.js";

const REQUIRED_COLLIDERS = [
  "collider_grab",
  "collider_latch",
  "collider_lid",
  "collider_tool",
];

/** Procedural + KTX2 recipe names: `lod0` / `LOD0` / `lod_0` / `lod-0`. */
const PACKAGED_LOD_NAME = /^lod[-_]?([012])$/i;

const FASTENER_NAMES = new Set(["fastener", "fastenerMesh"]);

export function resolvePackagedUrl(sidecar) {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("packaged");
  if (fromQuery) return fromQuery;
  return sidecar?.source?.packagedUrl ?? "/packaged/crate-toolbox.glb";
}

function looksLikeGlb(res) {
  if (!res || !res.ok) return false;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  // Vite SPA fallback serves index.html with 200 for missing files.
  if (ct.includes("text/html")) return false;
  return true;
}

export async function probePackagedUrl(url) {
  if (!url) return false;
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (looksLikeGlb(head)) return true;
    if (head.status === 405 || head.status === 501) {
      const get = await fetch(url, { method: "GET", headers: { Range: "bytes=0-16" } });
      return looksLikeGlb(get);
    }
    return false;
  } catch {
    return false;
  }
}

function findNamed(root, name) {
  let hit = null;
  root.traverse((o) => {
    if (!hit && o.name === name) hit = o;
  });
  return hit;
}

function isColliderNode(object) {
  if (object.userData?.collider) return true;
  return Boolean(object.name && object.name.startsWith("collider_"));
}

function isFastenerNode(object) {
  return FASTENER_NAMES.has(object.name);
}

/** Level 0/1/2 from conventional node name or `userData.lodLevel`. */
export function packagedLodLevel(object) {
  if (!object || isColliderNode(object) || isFastenerNode(object)) return null;
  const tagged = object.userData?.lodLevel;
  if (tagged === 0 || tagged === 1 || tagged === 2) return tagged;
  const match = PACKAGED_LOD_NAME.exec(object.name || "");
  return match ? Number(match[1]) : null;
}

/**
 * Collect every `lod0` / `lod1` / `lod2` visual group.
 * Colliders and the fastener stay out of the arrays.
 * @returns {{0: object[], 1: object[], 2: object[]}|null}
 */
export function discoverPackagedLodGroups(root) {
  const groups = { 0: [], 1: [], 2: [] };
  root.traverse((o) => {
    const level = packagedLodLevel(o);
    if (level == null) return;
    groups[level].push(o);
  });
  if (!groups[0].length && !groups[1].length && !groups[2].length) return null;
  return groups;
}

export function ingestPackagedRoot(root, sidecar) {
  const missing = REQUIRED_COLLIDERS.filter((n) => !findNamed(root, n));
  if (missing.length) {
    console.warn("[crate-toolbox] packaged GLB missing colliders, using procedural:", missing);
    return null;
  }
  const lidPivot = findNamed(root, "lid") || findNamed(root, "lidPivot");
  const latchPivot = findNamed(root, "latch") || findNamed(root, "latchPivot");
  const tool = findNamed(root, "tool");
  const body = findNamed(root, "body") || root;
  if (!lidPivot || !latchPivot || !tool) {
    console.warn("[crate-toolbox] packaged GLB missing lid/latch/tool nodes, using procedural");
    return null;
  }

  const studio = structuredClone(sidecar);
  if (studio.components?.activity) {
    studio.components.activity.current = studio.components.activity.initial;
  }
  root.name = root.name || "toolbox";
  root.userData.studio = studio;
  root.userData.kind = "entity";

  const colliders = [];
  root.traverse((o) => {
    if (o.name && o.name.startsWith("collider_")) {
      o.visible = false;
      o.userData.collider = true;
      o.userData.entity = root;
      if (o.name === "collider_tool") o.userData.part = "tool";
      colliders.push(o);
    }
  });

  const fastener = findNamed(root, "fastenerMesh") || findNamed(root, "fastener");
  if (fastener?.isMesh && fastener.geometry && !fastener.userData?.collider) {
    packColorOnlyGeometry(fastener.geometry, fastener.material);
  }
  root.userData.parts = { body, lidPivot, latchPivot, tool, fastener };
  root.userData.highlightables = {
    body,
    lid: lidPivot,
    latch: latchPivot,
    tool,
    fastener,
  };
  root.userData.colliders = colliders;
  if (fastener && !root.userData.fastener) {
    root.userData.fastener = { mesh: fastener, turns: 0, needed: 4, seated: false };
  }
  if (tool && !tool.userData.restLocal) {
    tool.userData.restLocal = tool.position.clone();
    tool.userData.feedbackEntity = root;
  }

  const lodGroups = discoverPackagedLodGroups(root);
  if (lodGroups) {
    // Same helper as procedural v0.37, per discovered lod* node only.
    // Direct mesh children; nested pivots / Groups are not flattened.
    for (const level of [0, 1, 2]) {
      for (const group of lodGroups[level]) {
        mergeSameMaterialMeshes(group);
      }
    }
    // Attach after merge so lod.stats draws match the surviving meshes.
    attachToolboxLod(root, lodGroups);
  } else {
    console.info(
      "[crate-toolbox] packaged GLB has no lod0/lod1/lod2 groups — all visuals stay visible (author lod0/lod1/lod2 to switch)"
    );
  }
  freezeStaticColorOnlyWorldMatrices(root);
  disableColorOnlyVisualRaycast(root);
  pinColorOnlyVisualMaterialFlags(root);
  pinColorOnlyVisualShadowFlags(root);
  pinColorOnlyVisualFrustumCulled(root);
  pinColorOnlyVisualRenderOrder(root);
  pinColorOnlyVisualLayers(root);
  pinColorOnlyVisualMatrixWorldAutoUpdate(root);
  pinColorOnlyVisualUp(root);
  pinColorOnlyVisualScale(root);
  pinColorOnlyVisualRotationOrder(root);
  pinColorOnlyVisualCustomShadowMaterials(root);
  pinColorOnlyVisualRenderCallbacks(root);
  pinColorOnlyVisualShadowCallbacks(root);
  pinColorOnlyVisualAnimations(root);
  pinColorOnlyVisualMorphTargets(root);
  pinColorOnlyVisualMorphAttributes(root);
  pinColorOnlyVisualGroups(root);
  pinColorOnlyVisualDrawRange(root);
  pinColorOnlyVisualSkinAttributes(root);
  pinColorOnlyVisualUpdateRange(root);
  pinColorOnlyVisualUpdateRanges(root);
  pinColorOnlyVisualBounds(root);
  pinColorOnlyVisualMeshBoundingSphere(root);
  pinColorOnlyVisualUsage(root);
  pinColorOnlyVisualNormalized(root);
  pinColorOnlyVisualGpuType(root);
  pinColorOnlyVisualName(root);
  pinColorOnlyVisualVersion(root);
  pinColorOnlyVisualGeometryName(root);
  pinColorOnlyVisualGeometryUserData(root);
  pinColorOnlyVisualMaterialUserData(root);
  pinColorOnlyVisualMaterialName(root);
  pinColorOnlyVisualMeshName(root);
  pinColorOnlyVisualMeshUserData(root);
  pinColorOnlyVisualMaterialVersion(root);
  pinColorOnlyVisualMatrixWorldNeedsUpdate(root);
  pinColorOnlyVisualColorAttribute(root);
  pinColorOnlyVisualOnUpload(root);
  pinColorOnlyVisualUnusedAttributes(root);
  pinColorOnlyVisualIndirect(root);
  return root;
}

/** @returns {Promise<import("three").Group|null>} */
export async function tryLoadPackagedToolbox(renderer, sidecar) {
  const url = resolvePackagedUrl(sidecar);
  if (sidecar?.source?.preferPackaged === false) return null;
  const found = await probePackagedUrl(url);
  if (!found) {
    console.info("[crate-toolbox] no packaged GLB at", url, "— procedural color-only MeshBasic");
    return null;
  }

  const [{ GLTFLoader }, { KTX2Loader }, { MeshoptDecoder }] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/loaders/KTX2Loader.js"),
    import("three/addons/libs/meshopt_decoder.module.js"),
  ]);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath("https://unpkg.com/three@0.170.0/examples/jsm/libs/basis/");
  ktx2.detectSupport(renderer);

  const loader = new GLTFLoader();
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  try {
    const gltf = await loader.loadAsync(url);
    const ingested = ingestPackagedRoot(gltf.scene, sidecar);
    if (!ingested) return null;
    ingested.userData.packaging = { source: "packaged-glb", probedUrl: url, found: true };
    console.info("[crate-toolbox] using packaged GLB", url);
    return ingested;
  } catch (err) {
    console.warn("[crate-toolbox] packaged GLB failed, using procedural:", err);
    return null;
  }
}

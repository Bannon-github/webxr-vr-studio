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

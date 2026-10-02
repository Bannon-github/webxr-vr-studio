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
 *
 * v1.11.0: after that indirect pin,
 * `pinColorOnlyVisualMaterialExtensions` deletes leftover Material
 * `extensions` so the r170 MeshBasic absence remains
 * (`material.extensions === undefined` and
 * `Object.hasOwn(material, 'extensions') === false`) on the 3 shared
 * color-only MeshBasic materials (wood / brass / steel; measured
 * extensions-absent 3; same `isColorOnlyUnlitBasic` gate and the same
 * collider / interleaved / mapped / lit / shared-material /
 * shared-geometry skip rules). Prefer `delete material.extensions`
 * when the own property is present. An already-absent `extensions` is
 * left alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `extensions`.
 * `ShaderMaterial` assigns
 * `this.extensions = { clipCullDistance: false, multiDraw: false }`
 * and copies via `Object.assign`. `WebGLPrograms.getParameters` sets
 * `HAS_EXTENSIONS = !! material.extensions`, then
 * `extensionClipCullDistance` / `extensionMultiDraw` from that object.
 * A leftover own `extensions` object on MeshBasic keeps
 * `HAS_EXTENSIONS` true even when both flags are false. A sentinel
 * `{ clipCullDistance: false, multiDraw: false }` keeps
 * `HAS_EXTENSIONS` true. `delete material.extensions` restores the
 * r170 absence. Do **not** assign `null` or that sentinel. Do **not**
 * convert MeshBasic to ShaderMaterial. Do **not** invent extension
 * maps. Do **not** enable multi-draw or clip-cull-distance. Do
 * **not** touch `indirect` (v1.10.0 indirect-null stays). Do **not**
 * re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
 * stays). Do **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, bounds, morphs, animations,
 * shadows, `frustumCulled`, or `mesh.visible`. Mapped / lit /
 * interleaved keep authored `extensions`. Collider meshes stay
 * untouched. ShaderMaterial keeps authored `extensions`. Fail-soft
 * (no lod groups) still runs this pin, including the fastener. 90 Hz
 * ship (~11.1 ms) / 72 Hz fallback are **requested**, not measured.
 * No invented headset ms.
 *
 * v1.12.0: after that extensions pin,
 * `pinColorOnlyVisualMaterialDepthPacking` deletes leftover Material
 * `depthPacking` so the r170 MeshBasic absence remains
 * (`material.depthPacking === undefined` and
 * `Object.hasOwn(material, 'depthPacking') === false`) on the 3 shared
 * color-only MeshBasic materials (wood / brass / steel; measured
 * depthPacking-absent 3; same `isColorOnlyUnlitBasic` gate and the same
 * collider / interleaved / mapped / lit / shared-material /
 * shared-geometry skip rules). Prefer `delete material.depthPacking`
 * when the own property is present. An already-absent `depthPacking`
 * is left alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `depthPacking`.
 * `MeshDepthMaterial` assigns `this.depthPacking = BasicDepthPacking`
 * and `copy` assigns `this.depthPacking = source.depthPacking`.
 * `WebGLPrograms.getParameters` sets
 * `useDepthPacking: material.depthPacking >= 0` and
 * `depthPacking: material.depthPacking || 0`.
 * `getProgramCacheKeyParameters` pushes `parameters.depthPacking`.
 * `getProgramCacheKeyBooleans` enables program layer 13 when
 * `useDepthPacking` is true. `WebGLProgram` emits
 * `#define DEPTH_PACKING` plus `parameters.depthPacking` when
 * `useDepthPacking` is true. A leftover `BasicDepthPacking` (3200) or
 * `RGBADepthPacking` (3201) pushes a different cache-key number than
 * the absent-material fallback `0`. A leftover `0` still sets
 * `useDepthPacking` (`0 >= 0`), so the boolean program mask forks and
 * the define is emitted. Assigning `null` also sets `useDepthPacking`
 * (`null >= 0`). `delete material.depthPacking` restores the r170
 * absence. Do **not** assign `null`, `undefined`, or `0`. Do **not**
 * convert MeshBasic to MeshDepthMaterial. Do **not** invent depth
 * packing. Do **not** touch `extensions` (v1.11.0 extensions-absent
 * stays). Do **not** touch `indirect` (v1.10.0 indirect-null stays).
 * Do **not** re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent stays). Do **not** touch `onUpload` /
 * `onUploadCallback` (v1.8.0 onUpload-release stays). Do **not**
 * delete `color` (v1.7.0 colorAttribute-absent stays). Do **not**
 * touch `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, bounds, morphs, animations,
 * shadows, `frustumCulled`, or `mesh.visible`. Do **not** pin Material
 * `index0AttributeName` (left for a later pulse). Mapped / lit /
 * interleaved keep authored `depthPacking`. Collider meshes stay
 * untouched. MeshDepthMaterial keeps authored `depthPacking`. Fail-soft
 * (no lod groups) still runs this pin, including the fastener. 90 Hz
 * ship (~11.1 ms) / 72 Hz fallback are **requested**, not measured.
 * No invented headset ms.
 *
 * v1.13.0: after that depthPacking pin,
 * `pinColorOnlyVisualMaterialIndex0AttributeName` deletes leftover
 * Material `index0AttributeName` so the r170 MeshBasic absence remains
 * (`material.index0AttributeName === undefined` and
 * `Object.hasOwn(material, 'index0AttributeName') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel; measured
 * index0AttributeName-absent 3; same `isColorOnlyUnlitBasic` gate and
 * the same collider / interleaved / mapped / lit / shared-material /
 * shared-geometry skip rules). Prefer
 * `delete material.index0AttributeName` when the own property is
 * present. An already-absent `index0AttributeName` is left alone. Pin
 * once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign
 * `index0AttributeName`. `ShaderMaterial` assigns
 * `this.index0AttributeName = undefined`. `ShaderMaterial.copy` does
 * not copy it. `WebGLPrograms.getParameters` copies
 * `index0AttributeName: material.index0AttributeName`.
 * `getProgramCacheKey` does not push that name (no cache-key token and
 * no program-layer bit). `WebGLProgram` emits no `#define` for it.
 * Before `gl.linkProgram`, when
 * `parameters.index0AttributeName !== undefined`, it calls
 * `gl.bindAttribLocation(program, 0, parameters.index0AttributeName)`.
 * A leftover string or empty string `''` binds attribute 0 while the
 * program cache key stays identical to constructor absence, so the
 * first material to compile bakes that binding for later materials
 * that share the other parameters. Assigning `null` also binds
 * (`null !== undefined`). `delete material.index0AttributeName`
 * restores the r170 absence. Do **not** assign `null`, `undefined`, or
 * `''`. Do **not** invent a replacement attribute name. Do **not**
 * touch `depthPacking` (v1.12.0 depthPacking-absent stays). Do **not**
 * touch `extensions` (v1.11.0 extensions-absent stays). Do **not**
 * touch `indirect` (v1.10.0 indirect-null stays). Do **not** re-run
 * the unused-channel strip (v1.9.0 unusedAttributes-absent stays). Do
 * **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, bounds, morphs, animations,
 * shadows, `frustumCulled`, or `mesh.visible`. Mapped / lit /
 * interleaved keep authored `index0AttributeName`. Collider meshes stay
 * untouched. ShaderMaterial keeps its constructor
 * `index0AttributeName`. Fail-soft (no lod groups) still runs this
 * pin, including the fastener. 90 Hz ship (~11.1 ms) / 72 Hz fallback
 * are **requested**, not measured. No invented headset ms.
 *
 * v1.14.0: after that index0AttributeName pin,
 * `pinColorOnlyVisualMaterialDefaultAttributeValues` deletes leftover
 * Material `defaultAttributeValues` so the r170 MeshBasic absence
 * remains (`material.defaultAttributeValues === undefined` and
 * `Object.hasOwn(material, 'defaultAttributeValues') === false`) on
 * the 3 shared color-only MeshBasic materials (wood / brass / steel;
 * measured defaultAttributeValues-absent 3; same `isColorOnlyUnlitBasic`
 * gate and the same collider / interleaved / mapped / lit /
 * shared-material / shared-geometry skip rules). Prefer
 * `delete material.defaultAttributeValues` when the own property is
 * present. An already-absent `defaultAttributeValues` is left alone.
 * Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign
 * `defaultAttributeValues`. `ShaderMaterial` assigns
 * `this.defaultAttributeValues = { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0] }`.
 * `ShaderMaterial.copy` does not copy `defaultAttributeValues`; the
 * copy keeps the map its constructor assigned. `WebGLPrograms` does
 * not read `defaultAttributeValues` (no cache-key token and no
 * program-layer bit). `WebGLProgram` emits no `#define` for it.
 * `WebGLBindingStates.setupVertexAttributes` reads
 * `material.defaultAttributeValues`. When a program attribute has no
 * geometry attribute and `materialDefaultAttributeValues !== undefined`,
 * it looks up `materialDefaultAttributeValues[name]` and may call
 * `gl.vertexAttrib2fv` / `gl.vertexAttrib3fv` / `gl.vertexAttrib4fv` /
 * `gl.vertexAttrib1fv`. A leftover ShaderMaterial-style map forces
 * those constant vertexAttrib uploads for missing channels while the
 * program cache key stays identical to constructor absence. An empty
 * `{}` still enters the lookup. Assigning `null` also enters it and
 * then throws on the property lookup. `delete material.defaultAttributeValues`
 * restores the r170 absence. Do **not** assign `null`, `undefined`, or
 * `{}`. Do **not** invent replacement defaults. Do **not** convert
 * MeshBasic to ShaderMaterial. Do **not** touch `index0AttributeName`
 * (v1.13.0 index0AttributeName-absent stays). Do **not** touch
 * `depthPacking` (v1.12.0 depthPacking-absent stays). Do **not** touch
 * `extensions` (v1.11.0 extensions-absent stays). Do **not** touch
 * `indirect` (v1.10.0 indirect-null stays). Do **not** re-run the
 * unused-channel strip (v1.9.0 unusedAttributes-absent stays). Do
 * **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, bounds, morphs, animations,
 * shadows, `frustumCulled`, or `mesh.visible`. Mapped / lit /
 * interleaved keep authored `defaultAttributeValues`. Collider meshes
 * stay untouched. ShaderMaterial keeps its constructor
 * `defaultAttributeValues`. Fail-soft (no lod groups) still runs this
 * pin, including the fastener. 90 Hz ship (~11.1 ms) / 72 Hz fallback
 * are **requested**, not measured. No invented headset ms.
 *
 * v1.15.0: after that defaultAttributeValues pin,
 * `pinColorOnlyVisualMaterialUniforms` deletes leftover Material
 * `uniforms` so the r170 MeshBasic absence remains
 * (`material.uniforms === undefined` and
 * `Object.hasOwn(material, 'uniforms') === false`) on the 3 shared
 * color-only MeshBasic materials (wood / brass / steel; measured
 * uniforms-absent 3; same `isColorOnlyUnlitBasic` gate and the same
 * collider / interleaved / mapped / lit / shared-material /
 * shared-geometry skip rules). Prefer `delete material.uniforms` when
 * the own property is present. An already-absent `uniforms` is left
 * alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `uniforms`.
 * `ShaderMaterial` assigns `this.uniforms = {}` and `copy` clones
 * uniforms via `cloneUniforms(source.uniforms)`. `RawShaderMaterial`
 * extends `ShaderMaterial`, so it keeps that constructor `uniforms`
 * object. `WebGLPrograms.getUniforms` uses `material.uniforms` only
 * when `shaderIDs[material.type]` is absent (custom ShaderMaterial /
 * RawShaderMaterial path). MeshBasic resolves shaderID `'basic'` and
 * clones `ShaderLib` uniforms instead, so a leftover `uniforms` object
 * is not the active upload map — but it still retains heap (Texture /
 * Vector / Color uniform values) on Quest 3's tight memory budget and
 * can confuse ingest/debug when DCC or mistaken ShaderMaterial
 * assignment bleeds onto color-only MeshBasic. Assigning `null`,
 * `undefined`, or `{}` stores an own property, which is not the r170
 * MeshBasic absence. `delete material.uniforms` restores the r170
 * absence. Do **not** assign `null`, `undefined`, or `{}`. Do **not**
 * invent replacement uniforms. Do **not** convert MeshBasic to
 * ShaderMaterial. Do **not** clear `uniforms` on real ShaderMaterial /
 * RawShaderMaterial. Do **not** touch `defaultAttributeValues` (v1.14.0
 * defaultAttributeValues-absent stays). Do **not** touch
 * `index0AttributeName` (v1.13.0 index0AttributeName-absent stays). Do
 * **not** touch `depthPacking` (v1.12.0 depthPacking-absent stays). Do
 * **not** touch `extensions` (v1.11.0 extensions-absent stays). Do
 * **not** touch `indirect` (v1.10.0 indirect-null stays). Do **not**
 * re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
 * stays). Do **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, `uniformsGroups`,
 * `uniformsNeedUpdate`, `vertexShader`, `fragmentShader`, `lights`,
 * `clipping`, `isShaderMaterial`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored `uniforms`. Collider meshes stay untouched. ShaderMaterial /
 * RawShaderMaterial keep constructor `uniforms`. Fail-soft (no lod
 * groups) still runs this pin, including the fastener. 90 Hz ship
 * (~11.1 ms) / 72 Hz fallback are **requested**, not measured. No
 * invented headset ms.
 *
 * v1.16.0: after that uniforms pin,
 * `pinColorOnlyVisualMaterialUniformsNeedUpdate` deletes leftover
 * Material `uniformsNeedUpdate` so the r170 MeshBasic absence remains
 * (`material.uniformsNeedUpdate === undefined` and
 * `Object.hasOwn(material, 'uniformsNeedUpdate') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel;
 * measured uniformsNeedUpdate-absent 3; same `isColorOnlyUnlitBasic`
 * gate and the same collider / interleaved / mapped / lit /
 * shared-material / shared-geometry skip rules). Prefer
 * `delete material.uniformsNeedUpdate` when the own property is
 * present. An already-absent `uniformsNeedUpdate` is left alone. Pin
 * once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `uniformsNeedUpdate`.
 * `ShaderMaterial` assigns `this.uniformsNeedUpdate = false`.
 * `ShaderMaterial.copy` does not copy `uniformsNeedUpdate`; the copy
 * keeps the constructor `false`. `RawShaderMaterial` extends
 * `ShaderMaterial`, so it keeps that constructor flag.
 * `WebGLPrograms` does not read `uniformsNeedUpdate`. `getUniforms`
 * still resolves shaderID from `shaderIDs[material.type]`. MeshBasic
 * stays shaderID `'basic'` and clones `ShaderLib` uniforms, so a
 * leftover `uniformsNeedUpdate` does not invent a custom shader path.
 * `WebGLRenderer.setProgram` re-uploads only when
 * `material.isShaderMaterial && material.uniformsNeedUpdate === true`,
 * then assigns `material.uniformsNeedUpdate = false`. MeshBasic is
 * not `isShaderMaterial`, so a leftover `true`, `false`, or `null`
 * does not take that extra upload.
 * `WebGLMaterials.refreshMaterialUniforms` assigns
 * `material.uniformsNeedUpdate = false` only in the `isShaderMaterial`
 * branch (`#15581`). Assigning `null`, `undefined`, `false`, or
 * `true` stores an own property, which is not the r170 MeshBasic
 * absence. `delete material.uniformsNeedUpdate` restores the r170
 * absence. Do **not** assign `null`, `undefined`, `false`, or `true`.
 * Do **not** invent a custom shader path. Do **not** convert MeshBasic
 * to ShaderMaterial. Do **not** clear `uniformsNeedUpdate` on real
 * ShaderMaterial / RawShaderMaterial. Do **not** touch `uniforms`
 * (v1.15.0 uniforms-absent stays). Do **not** touch
 * `defaultAttributeValues` (v1.14.0 defaultAttributeValues-absent
 * stays). Do **not** touch `index0AttributeName` (v1.13.0
 * index0AttributeName-absent stays). Do **not** touch `depthPacking`
 * (v1.12.0 depthPacking-absent stays). Do **not** touch `extensions`
 * (v1.11.0 extensions-absent stays). Do **not** touch `indirect`
 * (v1.10.0 indirect-null stays). Do **not** re-run the unused-channel
 * strip (v1.9.0 unusedAttributes-absent stays). Do **not** touch
 * `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release stays). Do
 * **not** delete `color` (v1.7.0 colorAttribute-absent stays). Do
 * **not** touch `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not**
 * change `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not**
 * touch Material `version` / `name` / `userData`, Mesh `name` /
 * `userData`, BufferGeometry `name` / `userData`, BufferAttribute
 * fields, prior Material program-cache / flag pins, `uniformsGroups`,
 * `vertexShader`, `fragmentShader`, `lights`, `clipping`,
 * `isShaderMaterial`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored `uniformsNeedUpdate`. Collider meshes stay untouched.
 * ShaderMaterial / RawShaderMaterial keep constructor
 * `uniformsNeedUpdate` (typically `false`). Fail-soft (no lod groups)
 * still runs this pin, including the fastener. 90 Hz ship (~11.1 ms) /
 * 72 Hz fallback are **requested**, not measured. No invented headset
 * ms.
 *
 * v1.17.0: after that uniformsNeedUpdate pin,
 * `pinColorOnlyVisualMaterialUniformsGroups` deletes leftover Material
 * `uniformsGroups` so the r170 MeshBasic absence remains
 * (`material.uniformsGroups === undefined` and
 * `Object.hasOwn(material, 'uniformsGroups') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel;
 * measured uniformsGroups-absent 3; same `isColorOnlyUnlitBasic` gate
 * and the same collider / interleaved / mapped / lit / shared-material
 * / shared-geometry skip rules). Prefer `delete material.uniformsGroups`
 * when the own property is present. An already-absent `uniformsGroups`
 * is left alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `uniformsGroups`.
 * `ShaderMaterial` assigns `this.uniformsGroups = []`.
 * `ShaderMaterial.copy` assigns
 * `this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups)`,
 * which builds a new array and calls `.clone()` on each group.
 * `RawShaderMaterial` extends `ShaderMaterial`, so it keeps that
 * constructor array. `WebGLPrograms` does not read `uniformsGroups`.
 * `getUniforms` still resolves shaderID from `shaderIDs[material.type]`.
 * MeshBasic stays shaderID `'basic'` and clones `ShaderLib` uniforms,
 * so a leftover `uniformsGroups` array does not invent a custom shader
 * path and does not change draws, tris, or attrBytes.
 * `WebGLRenderer.setProgram` walks `material.uniformsGroups` and calls
 * `WebGLUniformsGroups.update` / `bind` (UBO create/bind) only when
 * `material.isShaderMaterial || material.isRawShaderMaterial`.
 * MeshBasic is neither, so a leftover array is not uploaded as uniform
 * buffer objects. Assigning `null`, `undefined`, `[]`, or `{}` stores
 * an own property, which is not the r170 MeshBasic absence.
 * `delete material.uniformsGroups` restores the r170 absence. Do
 * **not** assign `null`, `undefined`, `[]`, or `{}`. Do **not** invent
 * a custom shader path. Do **not** convert MeshBasic to ShaderMaterial.
 * Do **not** clear `uniformsGroups` on real ShaderMaterial /
 * RawShaderMaterial. Do **not** touch `uniformsNeedUpdate` (v1.16.0
 * uniformsNeedUpdate-absent stays). Do **not** touch `uniforms`
 * (v1.15.0 uniforms-absent stays). Do **not** touch
 * `defaultAttributeValues` (v1.14.0 defaultAttributeValues-absent
 * stays). Do **not** touch `index0AttributeName` (v1.13.0
 * index0AttributeName-absent stays). Do **not** touch `depthPacking`
 * (v1.12.0 depthPacking-absent stays). Do **not** touch `extensions`
 * (v1.11.0 extensions-absent stays). Do **not** touch `indirect`
 * (v1.10.0 indirect-null stays). Do **not** re-run the unused-channel
 * strip (v1.9.0 unusedAttributes-absent stays). Do **not** touch
 * `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release stays). Do
 * **not** delete `color` (v1.7.0 colorAttribute-absent stays). Do
 * **not** touch `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not**
 * change `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not**
 * touch Material `version` / `name` / `userData`, Mesh `name` /
 * `userData`, BufferGeometry `name` / `userData`, BufferAttribute
 * fields, prior Material program-cache / flag pins, `vertexShader`,
 * `fragmentShader`, `lights`, `clipping`, `isShaderMaterial`, bounds,
 * morphs, animations, shadows, `frustumCulled`, or `mesh.visible`.
 * Mapped / lit / interleaved keep authored `uniformsGroups`. Collider
 * meshes stay untouched. ShaderMaterial / RawShaderMaterial keep
 * constructor `uniformsGroups` (typically `[]`). Fail-soft (no lod
 * groups) still runs this pin, including the fastener. 90 Hz ship
 * (~11.1 ms) / 72 Hz fallback are **requested**, not measured. No
 * invented headset ms.
 *
 * v1.18.0: after that uniformsGroups pin,
 * `pinColorOnlyVisualMaterialVertexShader` deletes leftover Material
 * `vertexShader` so the r170 MeshBasic absence remains
 * (`material.vertexShader === undefined` and
 * `Object.hasOwn(material, 'vertexShader') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel;
 * measured vertexShader-absent 3; same `isColorOnlyUnlitBasic` gate
 * and the same collider / interleaved / mapped / lit / shared-material
 * / shared-geometry skip rules). Prefer `delete material.vertexShader`
 * when the own property is present. An already-absent `vertexShader`
 * is left alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `vertexShader`.
 * `Material.js` does not mention `vertexShader`; `Material.copy` and
 * `MeshBasicMaterial.copy` do not copy it. `ShaderMaterial` assigns
 * `this.vertexShader = default_vertex`. `ShaderMaterial.copy` assigns
 * `this.vertexShader = source.vertexShader` (the source string, not a
 * rewritten stub). `ShaderMaterial.toJSON` writes
 * `data.vertexShader = this.vertexShader`. `RawShaderMaterial` extends
 * `ShaderMaterial` and does not assign its own `vertexShader`, so it
 * keeps that constructor string. `MaterialLoader.parse` assigns
 * `material.vertexShader = json.vertexShader` when
 * `json.vertexShader !== undefined`, including onto a MeshBasic.
 * `WebGLPrograms.getParameters` resolves shaderID from
 * `shaderIDs[material.type]`. When shaderID is set (`MeshBasicMaterial`
 * maps to `'basic'`), `vertexShader` comes from
 * `ShaderLib[shaderID].vertexShader`, not `material.vertexShader`.
 * The custom path (`vertexShader = material.vertexShader` and
 * `WebGLShaderCache.update`) runs only when shaderID is absent.
 * `getProgramCacheKey` pushes `parameters.shaderID` when present, so a
 * leftover `material.vertexShader` is not a cache-key token for
 * MeshBasic. `WebGLProgram` compiles `parameters.vertexShader`, which
 * for MeshBasic is the ShaderLib basic shader. `getUniforms` still
 * resolves shaderID from `shaderIDs[material.type]`. MeshBasic stays
 * shaderID `'basic'` and clones `ShaderLib` uniforms, so a leftover
 * `vertexShader` string does not invent a custom shader path and does
 * not change draws, tris, or attrBytes. Assigning `null`, `undefined`,
 * `''`, or a stub GLSL string stores an own property, which is not the
 * r170 MeshBasic absence. `delete material.vertexShader` restores the
 * r170 absence. Do **not** assign `null`, `undefined`, `''`, or a stub
 * GLSL string. Do **not** invent a custom shader path. Do **not**
 * convert MeshBasic to ShaderMaterial. Do **not** clear `vertexShader`
 * on real ShaderMaterial / RawShaderMaterial. Do **not** touch
 * `uniformsGroups` (v1.17.0 uniformsGroups-absent stays). Do **not**
 * touch `uniformsNeedUpdate` (v1.16.0 uniformsNeedUpdate-absent stays).
 * Do **not** touch `uniforms` (v1.15.0 uniforms-absent stays). Do
 * **not** touch `defaultAttributeValues` (v1.14.0
 * defaultAttributeValues-absent stays). Do **not** touch
 * `index0AttributeName` (v1.13.0 index0AttributeName-absent stays). Do
 * **not** touch `depthPacking` (v1.12.0 depthPacking-absent stays). Do
 * **not** touch `extensions` (v1.11.0 extensions-absent stays). Do
 * **not** touch `indirect` (v1.10.0 indirect-null stays). Do **not**
 * re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
 * stays). Do **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, `fragmentShader`, `lights`,
 * `clipping`, `isShaderMaterial`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored `vertexShader`. Collider meshes stay untouched.
 * ShaderMaterial / RawShaderMaterial keep constructor `vertexShader`
 * (the `default_vertex` chunk). Fail-soft (no lod groups) still runs
 * this pin, including the fastener. 90 Hz ship (~11.1 ms) / 72 Hz
 * fallback are **requested**, not measured. No invented headset ms.
 *
 * v1.19.0: after that vertexShader pin,
 * `pinColorOnlyVisualMaterialFragmentShader` deletes leftover Material
 * `fragmentShader` so the r170 MeshBasic absence remains
 * (`material.fragmentShader === undefined` and
 * `Object.hasOwn(material, 'fragmentShader') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel;
 * measured fragmentShader-absent 3; same `isColorOnlyUnlitBasic` gate
 * and the same collider / interleaved / mapped / lit / shared-material
 * / shared-geometry skip rules). Prefer `delete material.fragmentShader`
 * when the own property is present. An already-absent `fragmentShader`
 * is left alone. Pin once per shared material instance.
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `fragmentShader`.
 * `Material.js` does not mention `fragmentShader`; `Material.copy` and
 * `MeshBasicMaterial.copy` do not copy it. `ShaderMaterial` assigns
 * `this.fragmentShader = default_fragment`. `ShaderMaterial.copy` assigns
 * `this.fragmentShader = source.fragmentShader` (the source string, not a
 * rewritten stub). `ShaderMaterial.toJSON` writes
 * `data.fragmentShader = this.fragmentShader`. `RawShaderMaterial` extends
 * `ShaderMaterial` and does not assign its own `fragmentShader`, so it
 * keeps that constructor string. `MaterialLoader.parse` assigns
 * `material.fragmentShader = json.fragmentShader` when
 * `json.fragmentShader !== undefined`, including onto a MeshBasic.
 * `WebGLPrograms.getParameters` resolves shaderID from
 * `shaderIDs[material.type]`. When shaderID is set (`MeshBasicMaterial`
 * maps to `'basic'`), `fragmentShader` comes from
 * `ShaderLib[shaderID].fragmentShader`, not `material.fragmentShader`.
 * The custom path (`fragmentShader = material.fragmentShader` and
 * `WebGLShaderCache.update`) runs only when shaderID is absent.
 * `getProgramCacheKey` pushes `parameters.shaderID` when present, so a
 * leftover `material.fragmentShader` is not a cache-key token for
 * MeshBasic. `WebGLProgram` compiles `parameters.fragmentShader`, which
 * for MeshBasic is the ShaderLib basic shader. `getUniforms` still
 * resolves shaderID from `shaderIDs[material.type]`. MeshBasic stays
 * shaderID `'basic'` and clones `ShaderLib` uniforms, so a leftover
 * `fragmentShader` string does not invent a custom shader path and does
 * not change draws, tris, or attrBytes. Assigning `null`, `undefined`,
 * `''`, or a stub GLSL string stores an own property, which is not the
 * r170 MeshBasic absence. `delete material.fragmentShader` restores the
 * r170 absence. Do **not** assign `null`, `undefined`, `''`, or a stub
 * GLSL string. Do **not** invent a custom shader path. Do **not**
 * convert MeshBasic to ShaderMaterial. Do **not** clear `fragmentShader`
 * on real ShaderMaterial / RawShaderMaterial. Do **not** touch
 * `vertexShader` (v1.18.0 vertexShader-absent stays). Do **not** touch `uniformsGroups` (v1.17.0 uniformsGroups-absent stays). Do **not**
 * touch `uniformsNeedUpdate` (v1.16.0 uniformsNeedUpdate-absent stays).
 * Do **not** touch `uniforms` (v1.15.0 uniforms-absent stays). Do
 * **not** touch `defaultAttributeValues` (v1.14.0
 * defaultAttributeValues-absent stays). Do **not** touch
 * `index0AttributeName` (v1.13.0 index0AttributeName-absent stays). Do
 * **not** touch `depthPacking` (v1.12.0 depthPacking-absent stays). Do
 * **not** touch `extensions` (v1.11.0 extensions-absent stays). Do
 * **not** touch `indirect` (v1.10.0 indirect-null stays). Do **not**
 * re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
 * stays). Do **not** touch `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Do **not** delete `color` (v1.7.0
 * colorAttribute-absent stays). Do **not** touch
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Do **not** change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do **not** touch
 * Material `version` / `name` / `userData`, Mesh `name` / `userData`,
 * BufferGeometry `name` / `userData`, BufferAttribute fields, prior
 * Material program-cache / flag pins, `lights`, `clipping`, `isShaderMaterial`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`. Mapped / lit / interleaved keep
 * authored `fragmentShader`. Collider meshes stay untouched.
 * ShaderMaterial / RawShaderMaterial keep constructor `fragmentShader`
 * (the `default_fragment` chunk). Fail-soft (no lod groups) still runs
 * this pin, including the fastener. 90 Hz ship (~11.1 ms) / 72 Hz
 * fallback are **requested**, not measured. No invented headset ms.
 *
 * v1.20.0 pins leftover Material `lights` (the ShaderMaterial boolean, not
 * scene lights) to the r170 MeshBasic absence (`material.lights ===
 * undefined` and `Object.hasOwn(material, 'lights') === false`) on the 3
 * shared color-only MeshBasic materials (wood / brass / steel; measured
 * lights-absent 3) after the v1.19.0 fragmentShader pin.
 * `pinColorOnlyUnlitBasicMaterialLights` / `pinColorOnlyVisualMaterialLights`
 * run after `pinColorOnlyVisualMaterialFragmentShader` on procedural create
 * and packaged ingest, including fail-soft (no lod groups) and the fastener.
 * Same `isColorOnlyUnlitBasic` gate and the same collider / interleaved /
 * mapped / lit / shared-material / shared-geometry skip rules. Prefer `delete
 * material.lights` when the own property is present. Do not assign `null`,
 * `undefined`, `false`, or `true`. An already-absent `lights` is left alone.
 * Pin once per shared material instance. Do not invent a custom shader path.
 * Do not convert MeshBasic to ShaderMaterial. Do not clear `lights` on real
 * ShaderMaterial / RawShaderMaterial. Do not touch `fragmentShader` (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch `vertexShader` (v1.18.0
 * vertexShader-absent 3 stays). Do not touch `uniformsGroups` (v1.17.0
 * uniformsGroups-absent 3 stays). Do not touch `uniformsNeedUpdate` (v1.16.0
 * uniformsNeedUpdate-absent 3 stays). Do not touch `uniforms` (v1.15.0
 * uniforms-absent 3 stays). Do not touch `defaultAttributeValues` (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch `index0AttributeName`
 * (v1.13.0 index0AttributeName-absent 3 stays). Do not touch `depthPacking`
 * (v1.12.0 depthPacking-absent 3 stays). Do not touch `extensions` (v1.11.0
 * extensions-absent 3 stays). Do not touch `indirect` (v1.10.0 indirect-null
 * 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch `onUpload` /
 * `onUploadCallback` (v1.8.0 onUpload-release 13 stays). Do not touch `color`
 * (v1.7.0 colorAttribute-absent 13 stays). Do not touch
 * `matrixWorldNeedsUpdate` (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do
 * not change `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do not touch
 * Material `version` / `name` / `userData`, Mesh / Object3D `name` /
 * `userData` (reserved `lidMesh` / `latchMesh` / `fastenerMesh` /
 * `collider_*` stay), BufferGeometry `name` / `userData`, BufferAttribute
 * fields, prior Material program-cache / flag pins, `clipping`,
 * `isShaderMaterial`, bounds, morphs, animations, shadows, `frustumCulled`,
 * or `mesh.visible`. Mapped / lit / interleaved keep authored `lights`.
 * Collider meshes stay untouched. ShaderMaterial / RawShaderMaterial keep
 * constructor `lights` (typically `false`). Checked installed three@0.170.0:
 * fresh `Material` / `MeshBasicMaterial` constructors do not assign `lights`
 * (`lights === undefined` and `Object.hasOwn` is false). `Material.js` does
 * not mention `lights`; `MeshBasicMaterial.js` does not mention `lights`;
 * `Material.copy` and `MeshBasicMaterial.copy` do not copy it.
 * `ShaderMaterial` assigns `this.lights = false`. `ShaderMaterial.copy`
 * assigns `this.lights = source.lights`. `ShaderMaterial.toJSON` writes
 * `data.lights = this.lights`. `RawShaderMaterial` extends `ShaderMaterial`
 * and does not assign its own `lights`, so it keeps that constructor `false`.
 * `MaterialLoader.parse` assigns `material.lights = json.lights` when
 * `json.lights !== undefined`, including onto a MeshBasic.
 * `WebGLPrograms.getParameters` does not read `material.lights`. Its `lights`
 * argument is the scene light state (`lights.directional.length` and the
 * other counts). shaderID still comes from `shaderIDs[material.type]`. When
 * shaderID is set (`MeshBasicMaterial` maps to `'basic'`), the program comes
 * from `ShaderLib`, not a custom shader. The custom path (`vertexShader =
 * material.vertexShader`, `fragmentShader = material.fragmentShader`, and
 * `WebGLShaderCache.update`) runs only when shaderID is absent.
 * `getProgramCacheKey` pushes `parameters.shaderID` when present and does not
 * push `material.lights`, so a leftover boolean is not a cache-key token for
 * MeshBasic. `getUniforms` still resolves shaderID from
 * `shaderIDs[material.type]`. MeshBasic stays shaderID `'basic'` and clones
 * `ShaderLib` uniforms. `WebGLRenderer.materialNeedsLights` reads
 * `material.lights` only as `(material.isShaderMaterial && material.lights
 * === true)`, which is the ShaderMaterial path (shaderID absent). MeshBasic
 * is not `isShaderMaterial`, so a leftover boolean does not set
 * `needsLights`, does not wire lighting uniforms, does not invent a custom
 * shader path, and does not change draws, tris, or attrBytes. Assigning
 * `null`, `undefined`, `false`, or `true` stores an own property, which is
 * not the r170 MeshBasic absence. `delete material.lights` removes the own
 * property so the r170 absence remains. Clean procedural pre-upload draws 6 /
 * 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216,
 * unique MeshBasic 3, fragmentShader-absent 3, vertexShader-absent 3,
 * uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3,
 * depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty
 * 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay
 * vs v1.19.0. lights-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72
 * Hz fallback are requested, not measured. No invented headset ms. Headset ms
 * / FFR still TODO. Do not require 207/240 Hz.
 *
 * v1.21.0 pins leftover Material clipping (the ShaderMaterial boolean, not Material clippingPlanes
 * / clipIntersection / clipShadows) to the r170 MeshBasic absence (material.clipping === undefined
 * and Object.hasOwn(material, 'clipping') === false) on the 3 shared color-only MeshBasic materials
 * (wood / brass / steel; measured clipping-absent 3) after the v1.20.0 lights pin.
 * pinColorOnlyUnlitBasicMaterialClipping / pinColorOnlyVisualMaterialClipping run after
 * pinColorOnlyVisualMaterialLights on procedural create and packaged ingest, including fail-soft
 * (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete
 * material.clipping when the own property is present. Do not assign null, undefined, false, or
 * true. An already-absent clipping is left alone. Pin once per shared material instance. Do not
 * invent a custom shader path. Do not convert MeshBasic to ShaderMaterial. Do not clear clipping on
 * real ShaderMaterial / RawShaderMaterial. Do not touch lights (v1.20.0 lights-absent 3 stays). Do
 * not touch fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader
 * (v1.18.0 vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent
 * 3 stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not
 * touch uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, isShaderMaterial, bounds, morphs, animations,
 * shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored clipping.
 * Collider meshes stay untouched. ShaderMaterial / RawShaderMaterial keep constructor clipping
 * (typically false). Checked installed three@0.170.0: fresh Material / MeshBasicMaterial
 * constructors do not assign clipping (clipping === undefined and Object.hasOwn is false).
 * Material.js assigns clippingPlanes, not this.clipping; MeshBasicMaterial.js does not mention
 * clipping; Material.copy and MeshBasicMaterial.copy do not copy the ShaderMaterial clipping
 * boolean. ShaderMaterial assigns this.clipping = false. ShaderMaterial.copy assigns this.clipping
 * = source.clipping. ShaderMaterial.toJSON writes data.clipping = this.clipping. RawShaderMaterial
 * extends ShaderMaterial and does not assign its own clipping, so it keeps that constructor false.
 * MaterialLoader.parse assigns material.clipping = json.clipping when json.clipping !== undefined,
 * including onto a MeshBasic. WebGLPrograms.getParameters does not read material.clipping.
 * numClippingPlanes and numClipIntersection come from the WebGLClipping state (clippingPlanes /
 * clipIntersection), and getProgramCacheKey pushes those counts, not material.clipping. shaderID
 * still comes from shaderIDs[material.type]. When shaderID is set (MeshBasicMaterial maps to
 * 'basic'), the program comes from ShaderLib, not a custom shader. The custom path (vertexShader =
 * material.vertexShader, fragmentShader = material.fragmentShader, and WebGLShaderCache.update)
 * runs only when shaderID is absent. WebGLRenderer.setProgram wires uniforms.clippingPlanes when
 * (!material.isShaderMaterial && !material.isRawShaderMaterial) || material.clipping === true.
 * MeshBasic takes the first clause, so a leftover clipping boolean is not consulted, does not
 * invent a custom shader path, and does not change draws, tris, or attrBytes.
 * WebGLClipping.setState reads clippingPlanes, clipIntersection, and clipShadows, not
 * material.clipping. Those plane flags stay on the v0.54 pin. Assigning null, undefined, false, or
 * true stores an own property, which is not the r170 MeshBasic absence. delete material.clipping
 * removes the own property so the r170 absence remains. Clean procedural pre-upload draws 6 / 4 /
 * 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3,
 * lights-absent 3, fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13 stay vs v1.20.0. clipping-absent 3 is the new count. Quest 3 90 Hz
 * (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR
 * still TODO. Do not require 207/240 Hz.
 *
 * v1.22.0 pins leftover Material isShaderMaterial to the r170 MeshBasic absence
 * (material.isShaderMaterial === undefined and Object.hasOwn(material, 'isShaderMaterial') === false)
 * on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isShaderMaterial-absent 3) after the v1.21.0 clipping pin.
 * pinColorOnlyUnlitBasicMaterialIsShaderMaterial / pinColorOnlyVisualMaterialIsShaderMaterial run
 * after pinColorOnlyVisualMaterialClipping on procedural create and packaged ingest, including
 * fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider /
 * interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete
 * material.isShaderMaterial when the own property is present. Do not assign null, undefined, false, or
 * true. An already-absent isShaderMaterial is left alone. Pin once per shared material instance. Do
 * not invent a custom shader path. Do not convert MeshBasic to ShaderMaterial. Do not clear
 * isShaderMaterial on real ShaderMaterial / RawShaderMaterial (they keep constructor true). Do not
 * touch clipping (v1.21.0 clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3
 * stays). Do not touch fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch
 * vertexShader (v1.18.0 vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0
 * uniformsGroups-absent 3 stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3
 * stays). Do not touch uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues
 * (v1.14.0 defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect (v1.10.0
 * indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0 unusedAttributes-absent 13
 * stays). Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch
 * color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0
 * matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do
 * not touch Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh /
 * latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData, BufferAttribute fields,
 * prior Material program-cache / flag pins, clippingPlanes, clipIntersection, clipShadows,
 * isMeshBasicMaterial, isRawShaderMaterial, type, bounds, morphs, animations, shadows, frustumCulled,
 * or mesh.visible. Mapped / lit / interleaved keep authored isShaderMaterial. Collider meshes stay
 * untouched. ShaderMaterial / RawShaderMaterial keep constructor isShaderMaterial (true). Checked
 * installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign
 * isShaderMaterial (isShaderMaterial === undefined and Object.hasOwn is false). MeshBasicMaterial
 * assigns this.isMeshBasicMaterial = true only. Material.js does not mention isShaderMaterial.
 * Material.copy and MeshBasicMaterial.copy do not copy it. ShaderMaterial assigns
 * this.isShaderMaterial = true. ShaderMaterial.copy does not assign isShaderMaterial (the constructor
 * already set true). ShaderMaterial.toJSON does not write isShaderMaterial. RawShaderMaterial assigns
 * this.isRawShaderMaterial = true and inherits isShaderMaterial from ShaderMaterial (true, own
 * property). MaterialLoader does not parse isShaderMaterial. WebGLPrograms does not read
 * material.isShaderMaterial. shaderID still comes from shaderIDs[material.type]. When shaderID is set
 * (MeshBasicMaterial maps to 'basic'), the program comes from ShaderLib, not a custom shader. The
 * custom path (vertexShader = material.vertexShader, fragmentShader = material.fragmentShader, and
 * WebGLShaderCache.update) runs only when shaderID is absent, so a leftover isShaderMaterial does not
 * switch MeshBasic off 'basic'. WebGLRenderer.setProgram wires uniforms.clippingPlanes when
 * (!material.isShaderMaterial && !material.isRawShaderMaterial) || material.clipping === true;
 * re-uploads uniforms when material.isShaderMaterial && material.uniformsNeedUpdate === true; walks
 * material.uniformsGroups and calls WebGLUniformsGroups.update / bind when material.isShaderMaterial
 * || material.isRawShaderMaterial; materialNeedsLights includes (material.isShaderMaterial &&
 * material.lights === true); releaseMaterialProgramReferences calls releaseShaderCache when
 * material.isShaderMaterial. A leftover own isShaderMaterial === true on MeshBasic can divert those
 * bind branches while shaderID stays 'basic', which is inconsistent Quest 3 TBDR / bind behavior.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before the shader else-if, so that
 * refresh still takes the MeshBasic branch and does not assign uniformsNeedUpdate = false from the
 * shader branch. Assigning null, undefined, false, or true stores an own property, which is not the
 * r170 MeshBasic absence. delete material.isShaderMaterial removes the own property so the r170
 * absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 /
 * 1176 / 432 + fastener 216, unique MeshBasic 3, clipping-absent 3, lights-absent 3,
 * fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent
 * 3, uniforms-absent 3, defaultAttributeValues-absent 3, index0AttributeName-absent 3,
 * depthPacking-absent 3, extensions-absent 3, indirect-null 13, unusedAttributes-absent 13,
 * onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13,
 * material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty
 * 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.21.0.
 * isShaderMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested,
 * not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz.
 *
 * v1.23.0 pins leftover Material isRawShaderMaterial to the r170 MeshBasic absence
 * (material.isRawShaderMaterial === undefined and Object.hasOwn(material, 'isRawShaderMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isRawShaderMaterial-absent 3) after the v1.22.0 isShaderMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsRawShaderMaterial / pinColorOnlyVisualMaterialIsRawShaderMaterial
 * run after pinColorOnlyVisualMaterialIsShaderMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isRawShaderMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isRawShaderMaterial is left alone. Pin once per
 * shared material instance. Do not invent a custom shader path. Do not convert MeshBasic to
 * ShaderMaterial or RawShaderMaterial. Do not clear isRawShaderMaterial on real RawShaderMaterial /
 * ShaderMaterial (RawShaderMaterial keeps constructor true). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3 stays). Do not
 * touch lights (v1.20.0 lights-absent 3 stays). Do not touch fragmentShader (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0 vertexShader-absent 3 stays).
 * Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3 stays). Do not touch
 * uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0
 * uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, isMeshBasicMaterial, type, bounds, morphs,
 * animations, shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored
 * isRawShaderMaterial. Collider meshes stay untouched. RawShaderMaterial keeps constructor
 * isRawShaderMaterial (true). ShaderMaterial does not assign isRawShaderMaterial; an authored own
 * property on ShaderMaterial stays. Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isRawShaderMaterial (isRawShaderMaterial ===
 * undefined and Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true
 * only. Material.js does not mention isRawShaderMaterial. Material.copy and MeshBasicMaterial.copy
 * do not copy it. ShaderMaterial does not assign isRawShaderMaterial. ShaderMaterial.copy does not
 * assign isRawShaderMaterial. ShaderMaterial.toJSON does not write isRawShaderMaterial.
 * RawShaderMaterial assigns this.isRawShaderMaterial = true and has no toJSON override.
 * MaterialLoader does not parse isRawShaderMaterial. WebGLPrograms.getParameters sets
 * parameters.isRawShaderMaterial = material.isRawShaderMaterial === true. shaderID still comes from
 * shaderIDs[material.type]. When shaderID is set (MeshBasicMaterial maps to 'basic'), vertexShader
 * and fragmentShader still come from ShaderLib, not a custom shader. The custom path (vertexShader
 * = material.vertexShader, fragmentShader = material.fragmentShader, and WebGLShaderCache.update)
 * runs only when shaderID is absent, so a leftover isRawShaderMaterial does not switch MeshBasic
 * off 'basic'. getProgramCacheKey skips getProgramCacheKeyParameters, getProgramCacheKeyBooleans,
 * and outputColorSpace when parameters.isRawShaderMaterial === true (the raw cache-key path).
 * WebGLProgram emits the raw prefix and skips the WebGL2 GLSL3 rewrite (attribute to in,
 * gl_FragColor to pc_fragColor) when parameters.isRawShaderMaterial is true. A leftover own
 * isRawShaderMaterial === true on MeshBasic therefore keeps ShaderLib 'basic' source while the
 * program prefix and cache key follow the raw path, which is inconsistent Quest 3 TBDR / bind
 * behavior. WebGLRenderer.setProgram wires uniforms.clippingPlanes when (!material.isShaderMaterial
 * && !material.isRawShaderMaterial) || material.clipping === true, so a leftover true skips that
 * wiring unless clipping === true; it walks material.uniformsGroups and calls
 * WebGLUniformsGroups.update / bind when material.isShaderMaterial || material.isRawShaderMaterial.
 * That UBO walk reads groups.length. MeshBasic leaves uniformsGroups absent, so a leftover true
 * would throw if setProgram reached it (source reading, not a measured Quest crash).
 * materialNeedsLights reads (material.isShaderMaterial && material.lights === true) and does not
 * read isRawShaderMaterial alone. The uniform re-upload reads material.isShaderMaterial &&
 * material.uniformsNeedUpdate === true and does not read isRawShaderMaterial alone.
 * releaseMaterialProgramReferences calls releaseShaderCache when material.isShaderMaterial and does
 * not read isRawShaderMaterial. WebGLMaterials does not mention isRawShaderMaterial. Assigning
 * null, undefined, false, or true stores an own property, which is not the r170 MeshBasic absence.
 * delete material.isRawShaderMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, attrBytes
 * 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique MeshBasic 3, isShaderMaterial-absent 3,
 * clipping-absent 3, lights-absent 3, fragmentShader-absent 3, vertexShader-absent 3,
 * uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty
 * 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.22.0. drawCallsEstimate stays 7.
 * isRawShaderMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 *
 * v1.24.0 pins leftover Material linewidth to the r170 MeshBasic absence
 * (material.linewidth === undefined and Object.hasOwn(material, 'linewidth') === false)
 * on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * linewidth-absent 3) after the v1.23.0 isRawShaderMaterial pin.
 * pinColorOnlyUnlitBasicMaterialLinewidth / pinColorOnlyVisualMaterialLinewidth run
 * after pinColorOnlyVisualMaterialIsRawShaderMaterial on procedural create and packaged
 * ingest, including fail-soft (no lod groups) and the fastener. Same
 * isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit /
 * shared-material / shared-geometry skip rules. Prefer delete material.linewidth when
 * the own property is present. Do not assign null, undefined, 0, or 1. An
 * already-absent linewidth is left alone. Pin once per shared material instance. Do not
 * clear linewidth on real ShaderMaterial / LineBasicMaterial / LineDashedMaterial (they
 * keep authored / constructor values). Do not touch isRawShaderMaterial (v1.23.0
 * isRawShaderMaterial-absent 3 stays). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3
 * stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader
 * (v1.18.0 vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0
 * uniformsGroups-absent 3 stays). Do not touch uniformsNeedUpdate (v1.16.0
 * uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0 uniforms-absent 3
 * stays). Do not touch defaultAttributeValues (v1.14.0 defaultAttributeValues-absent 3
 * stays). Do not touch index0AttributeName (v1.13.0 index0AttributeName-absent 3
 * stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3 stays). Do not touch
 * extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect (v1.10.0
 * indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13
 * stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13
 * stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch
 * Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh
 * / latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData,
 * BufferAttribute fields, prior Material program-cache / flag pins, clippingPlanes,
 * clipIntersection, clipShadows, isMeshBasicMaterial, type, wireframe,
 * wireframeLinewidth, wireframeLinecap, wireframeLinejoin, bounds, morphs, animations,
 * shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored
 * linewidth. Collider meshes stay untouched. ShaderMaterial keeps constructor linewidth
 * (1); an authored own linewidth on ShaderMaterial stays. LineBasicMaterial keeps
 * constructor linewidth (1) and LineBasicMaterial.copy keeps source.linewidth.
 * LineDashedMaterial extends LineBasicMaterial and keeps that constructor linewidth.
 * Checked installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do
 * not assign linewidth (linewidth === undefined and Object.hasOwn is false).
 * MeshBasicMaterial assigns this.wireframeLinewidth = 1 only (also wireframe = false,
 * wireframeLinecap = 'round', wireframeLinejoin = 'round'). Material.js does not assign
 * this.linewidth in the constructor. Material.copy and MeshBasicMaterial.copy do not
 * copy linewidth. MeshBasicMaterial.copy copies wireframeLinewidth, not linewidth.
 * Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ linewidth }) warns and does not store linewidth. ShaderMaterial
 * assigns this.linewidth = 1. ShaderMaterial.copy does not copy linewidth (it copies
 * wireframe and wireframeLinewidth). Material.toJSON writes linewidth only when
 * this.linewidth !== undefined && this.linewidth !== 1 (ShaderMaterial.toJSON calls
 * super.toJSON, so a constructor linewidth of 1 is omitted and a non-1 value is
 * written). LineBasicMaterial assigns this.linewidth = 1 and LineBasicMaterial.copy
 * assigns this.linewidth = source.linewidth. LineDashedMaterial extends
 * LineBasicMaterial, calls super() (linewidth 1), and copy calls super.copy (linewidth
 * is copied). MaterialLoader assigns material.linewidth = json.linewidth when
 * json.linewidth !== undefined, which can store an own property on MeshBasic.
 * WebGLRenderer.renderBufferDirect reads material.linewidth only on the object.isLine
 * branch (let lineWidth = material.linewidth; if lineWidth === undefined lineWidth = 1;
 * state.setLineWidth(lineWidth * getTargetPixelRatio())). The object.isMesh branch
 * reads material.wireframeLinewidth when material.wireframe === true and does not read
 * material.linewidth. WebGLState.setLineWidth calls gl.lineWidth(width) when
 * lineWidthAvailable. r170 sets lineWidthAvailable when the WebGL version string is >=
 * 1.0 (WebGL 1 and WebGL 2) or OpenGL ES >= 2.0, and reset calls gl.lineWidth(1).
 * WebGLShadowMap copies result.linewidth = material.linewidth. WebGL 2 (Quest Browser)
 * only accepts line width 1; a non-1 gl.lineWidth is an INVALID_VALUE and unused. A
 * leftover own linewidth on a color-only MeshBasic is therefore unused packaging waste
 * / inconsistent authored state: crate visuals are Mesh, so the mesh draw does not
 * consult material.linewidth, and a non-1 value would not widen lines on Quest Browser.
 * Assigning null, undefined, 0, or 1 stores an own property, which is not the r170
 * MeshBasic absence. delete material.linewidth removes the own property so the r170
 * absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24,
 * unique verts 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener
 * draws 1, tris 12, unique verts 24), unique MeshBasic 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent
 * 3, vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3,
 * uniforms-absent 3, defaultAttributeValues-absent 3, index0AttributeName-absent 3,
 * depthPacking-absent 3, extensions-absent 3, indirect-null 13, unusedAttributes-absent
 * 13, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13,
 * material-version-zero 3, material-name-empty 3, material-userData-empty 3,
 * geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10,
 * mesh-userData-empty 13 stay vs v1.23.0. drawCallsEstimate stays 7. linewidth-absent 3
 * is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not
 * measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240
 * Hz.
 *
 * v1.25.0 pins leftover Material isMeshStandardMaterial to the r170 MeshBasic absence
 * (material.isMeshStandardMaterial === undefined and Object.hasOwn(material,
 * 'isMeshStandardMaterial') === false) on the 3 shared color-only MeshBasic materials
 * (wood / brass / steel; measured isMeshStandardMaterial-absent 3) after the v1.24.0
 * linewidth pin. pinColorOnlyUnlitBasicMaterialIsMeshStandardMaterial /
 * pinColorOnlyVisualMaterialIsMeshStandardMaterial run after
 * pinColorOnlyVisualMaterialLinewidth on procedural create and packaged ingest, including
 * fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip
 * rules. Prefer delete material.isMeshStandardMaterial when the own property is present.
 * Do not assign null, undefined, false, or true. An already-absent isMeshStandardMaterial
 * is left alone. Pin once per shared material instance. Do not convert MeshBasic to
 * MeshStandardMaterial. Do not invent maps, roughness, metalness, or envMap. Do not clear
 * isMeshStandardMaterial on real MeshStandardMaterial / MeshPhysicalMaterial (they keep
 * constructor true). MeshPhysicalMaterial extends MeshStandardMaterial, calls super() so
 * isMeshStandardMaterial is true, and also sets this.isMeshPhysicalMaterial = true. Do
 * not touch linewidth (v1.24.0 linewidth-absent 3 stays). Do not touch
 * isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not touch
 * isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping
 * (v1.21.0 clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays).
 * Do not touch fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch
 * vertexShader (v1.18.0 vertexShader-absent 3 stays). Do not touch uniformsGroups
 * (v1.17.0 uniformsGroups-absent 3 stays). Do not touch uniformsNeedUpdate (v1.16.0
 * uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0 uniforms-absent 3
 * stays). Do not touch defaultAttributeValues (v1.14.0 defaultAttributeValues-absent 3
 * stays). Do not touch index0AttributeName (v1.13.0 index0AttributeName-absent 3 stays).
 * Do not touch depthPacking (v1.12.0 depthPacking-absent 3 stays). Do not touch
 * extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect (v1.10.0
 * indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays).
 * Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do
 * not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version /
 * name / userData, Mesh / Object3D name / userData (reserved lidMesh / latchMesh /
 * fastenerMesh / collider_* stay), BufferGeometry name / userData, BufferAttribute
 * fields, prior Material program-cache / flag pins, clippingPlanes, clipIntersection,
 * clipShadows, isMeshBasicMaterial, type, isMeshPhysicalMaterial, wireframe,
 * wireframeLinewidth, wireframeLinecap, wireframeLinejoin, bounds, morphs, animations,
 * shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored
 * isMeshStandardMaterial. Collider meshes stay untouched. MeshStandardMaterial keeps
 * constructor isMeshStandardMaterial (true). MeshPhysicalMaterial keeps that inherited
 * constructor true and keeps isMeshPhysicalMaterial true. Checked installed
 * three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign
 * isMeshStandardMaterial (isMeshStandardMaterial === undefined and Object.hasOwn is
 * false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true only. Material.js
 * does not mention isMeshStandardMaterial. Material.copy and MeshBasicMaterial.copy do
 * not copy it. Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ isMeshStandardMaterial: true }) warns and does not store
 * isMeshStandardMaterial. MeshStandardMaterial assigns this.isMeshStandardMaterial =
 * true. MeshStandardMaterial.copy does not assign isMeshStandardMaterial (the constructor
 * already set true). MeshStandardMaterial has no toJSON override. MeshPhysicalMaterial
 * extends MeshStandardMaterial, calls super() so isMeshStandardMaterial is true, and
 * assigns this.isMeshPhysicalMaterial = true. MeshPhysicalMaterial.copy calls super.copy
 * and does not assign isMeshStandardMaterial. Material.toJSON does not write
 * isMeshStandardMaterial. MaterialLoader does not parse isMeshStandardMaterial. shaderID
 * still comes from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'.
 * MeshStandardMaterial and MeshPhysicalMaterial map to 'physical'. When shaderID is set,
 * vertexShader and fragmentShader still come from ShaderLib, not a MeshStandard program,
 * so a leftover isMeshStandardMaterial does not switch MeshBasic off 'basic'.
 * WebGLPrograms.getParameters and WebGLRenderer.getProgram / setProgram read
 * material.isMeshStandardMaterial for environment / envMap resolution
 * (materialProperties.environment = material.isMeshStandardMaterial ? scene.environment :
 * null, and (material.isMeshStandardMaterial ? cubeuvmaps : cubemaps).get(material.envMap
 * || environment)). A leftover true therefore resolves scene.environment through
 * cubeuvmaps and can set HAS_ENVMAP / envMapMode / envMapCubeUVHeight on a program whose
 * shaderID is still 'basic'. WebGLRenderer.materialNeedsLights returns
 * material.isMeshLambertMaterial || material.isMeshToonMaterial ||
 * material.isMeshPhongMaterial || material.isMeshStandardMaterial ||
 * material.isShadowMaterial || (material.isShaderMaterial && material.lights === true). A
 * leftover true makes needsLights true and getProgram wires lighting uniforms
 * (ambientLightColor, lightProbe, directionalLights, and the rest). ShaderLib.basic does
 * not include UniformsLib.lights, so those slots are absent on a MeshBasic program
 * (source reading, not a measured Quest crash). setProgram also assigns
 * m_uniforms.envMapIntensity.value = scene.environmentIntensity when
 * material.isMeshStandardMaterial && material.envMap === null && scene.environment !==
 * null. ShaderLib.basic envmap uniforms do not include envMapIntensity (that value is on
 * the standard / physical uniform block), so a leftover true can reach a missing
 * envMapIntensity slot when a scene environment is set (source reading, not a measured
 * Quest crash). WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before
 * isMeshStandardMaterial, so refresh still calls refreshUniformsCommon and does not call
 * refreshUniformsStandard / refreshUniformsPhysical when isMeshBasicMaterial stays true.
 * Those environment / lights forks are independent of the refresh branch. Assigning null,
 * undefined, false, or true stores an own property, which is not the r170 MeshBasic
 * absence. delete material.isMeshStandardMaterial removes the own property so the r170
 * absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24,
 * unique verts 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws
 * 1, tris 12, unique verts 24), unique MeshBasic 3, linewidth-absent 3,
 * isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3,
 * lights-absent 3, fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent
 * 3, uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null
 * 13, unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13,
 * mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.24.0. drawCallsEstimate stays 7.
 * isMeshStandardMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz
 * fallback are requested, not measured. No invented headset ms. Headset ms / FFR still
 * TODO. Do not require 207/240 Hz.
 * v1.26.0 pins leftover Material isMeshLambertMaterial to the r170 MeshBasic absence
 * (material.isMeshLambertMaterial === undefined and Object.hasOwn(material,
 * 'isMeshLambertMaterial') === false) on the 3 shared color-only MeshBasic materials (wood / brass
 * / steel; measured isMeshLambertMaterial-absent 3) after the v1.25.0 isMeshStandardMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshLambertMaterial /
 * pinColorOnlyVisualMaterialIsMeshLambertMaterial run after
 * pinColorOnlyVisualMaterialIsMeshStandardMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isMeshLambertMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshLambertMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshLambertMaterial. Do not invent maps or
 * lights. Do not clear isMeshLambertMaterial on real MeshLambertMaterial (it keeps constructor
 * true). Do not touch isMeshStandardMaterial (v1.25.0 isMeshStandardMaterial-absent 3 stays). Do
 * not touch linewidth (v1.24.0 linewidth-absent 3 stays). Do not touch isRawShaderMaterial (v1.23.0
 * isRawShaderMaterial-absent 3 stays). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3 stays). Do not
 * touch lights (v1.20.0 lights-absent 3 stays). Do not touch fragmentShader (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0 vertexShader-absent 3 stays).
 * Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3 stays). Do not touch
 * uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0
 * uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, isMeshBasicMaterial, type, isMeshPhysicalMaterial,
 * wireframe, wireframeLinewidth, wireframeLinecap, wireframeLinejoin, bounds, morphs, animations,
 * shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored
 * isMeshLambertMaterial. Collider meshes stay untouched. MeshLambertMaterial keeps constructor
 * isMeshLambertMaterial (true). Checked installed three@0.170.0: fresh Material / MeshBasicMaterial
 * constructors do not assign isMeshLambertMaterial (isMeshLambertMaterial === undefined and
 * Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true only.
 * Material.js does not mention isMeshLambertMaterial. Material.copy and MeshBasicMaterial.copy do
 * not copy it. Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ isMeshLambertMaterial: true }) warns and does not store
 * isMeshLambertMaterial. MeshLambertMaterial assigns this.isMeshLambertMaterial = true.
 * MeshLambertMaterial.copy does not assign isMeshLambertMaterial (the constructor already set
 * true). MeshLambertMaterial has no toJSON override. Material.toJSON does not write
 * isMeshLambertMaterial. MaterialLoader does not parse isMeshLambertMaterial. shaderID still comes
 * from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. MeshLambertMaterial maps to
 * 'lambert'. When shaderID is set, vertexShader and fragmentShader still come from ShaderLib, not a
 * MeshLambert program, so a leftover isMeshLambertMaterial does not switch MeshBasic off 'basic'.
 * WebGLRenderer.materialNeedsLights returns material.isMeshLambertMaterial ||
 * material.isMeshToonMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial ||
 * material.isShadowMaterial || (material.isShaderMaterial && material.lights === true). A leftover
 * own isMeshLambertMaterial === true on a color-only MeshBasic makes needsLights true and
 * getProgram wires lighting uniforms (uniforms.ambientLightColor, uniforms.lightProbe,
 * uniforms.directionalLights, and the rest) on a program whose shaderID stays 'basic'. setProgram
 * calls markUniformsLightsNeedsUpdate when materialProperties.needsLights. ShaderLib.basic does not
 * include UniformsLib.lights, so those slots are absent on a MeshBasic program (source reading, not
 * a measured Quest crash). ShaderLib.lambert does include UniformsLib.lights.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshLambertMaterial,
 * so refresh still calls refreshUniformsCommon and does not take the Lambert else-if when
 * isMeshBasicMaterial stays true. Those lights forks are independent of the refresh branch.
 * Assigning null, undefined, false, or true stores an own property, which is not the r170 MeshBasic
 * absence. delete material.isMeshLambertMaterial removes the own property so the r170 absence
 * remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100
 * / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24),
 * unique MeshBasic 3, isMeshStandardMaterial-absent 3, linewidth-absent 3,
 * isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3,
 * fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13 stay vs v1.25.0. drawCallsEstimate stays 7.
 * isMeshLambertMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.27.0 pins leftover Material isMeshToonMaterial to the r170 MeshBasic absence
 * (material.isMeshToonMaterial === undefined and Object.hasOwn(material,
 * 'isMeshToonMaterial') === false) on the 3 shared color-only MeshBasic materials (wood / brass
 * / steel; measured isMeshToonMaterial-absent 3) after the v1.26.0 isMeshLambertMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshToonMaterial /
 * pinColorOnlyVisualMaterialIsMeshToonMaterial run after
 * pinColorOnlyVisualMaterialIsMeshLambertMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isMeshToonMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshToonMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshToonMaterial. Do not invent maps or
 * lights. Do not clear isMeshToonMaterial on real MeshToonMaterial (it keeps constructor
 * true). Do not touch isMeshLambertMaterial (v1.26.0 isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0 isMeshStandardMaterial-absent 3 stays). Do
 * not touch linewidth (v1.24.0 linewidth-absent 3 stays). Do not touch isRawShaderMaterial (v1.23.0
 * isRawShaderMaterial-absent 3 stays). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3 stays). Do not
 * touch lights (v1.20.0 lights-absent 3 stays). Do not touch fragmentShader (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0 vertexShader-absent 3 stays).
 * Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3 stays). Do not touch
 * uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0
 * uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, isMeshBasicMaterial, type, isMeshPhysicalMaterial,
 * wireframe, wireframeLinewidth, wireframeLinecap, wireframeLinejoin, bounds, morphs, animations,
 * shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved keep authored
 * isMeshToonMaterial. Collider meshes stay untouched. MeshToonMaterial keeps constructor
 * isMeshToonMaterial (true). Checked installed three@0.170.0: fresh Material / MeshBasicMaterial
 * constructors do not assign isMeshToonMaterial (isMeshToonMaterial === undefined and
 * Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true only.
 * Material.js does not mention isMeshToonMaterial. Material.copy and MeshBasicMaterial.copy do
 * not copy it. Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ isMeshToonMaterial: true }) warns and does not store
 * isMeshToonMaterial. MeshToonMaterial assigns this.isMeshToonMaterial = true.
 * MeshToonMaterial.copy does not assign isMeshToonMaterial (the constructor already set
 * true). MeshToonMaterial has no toJSON override. Material.toJSON does not write
 * isMeshToonMaterial. MaterialLoader does not parse isMeshToonMaterial. shaderID still comes
 * from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. MeshToonMaterial maps to
 * 'toon'. When shaderID is set, vertexShader and fragmentShader still come from ShaderLib, not a
 * MeshToon program, so a leftover isMeshToonMaterial does not switch MeshBasic off 'basic'.
 * WebGLRenderer.materialNeedsLights returns material.isMeshLambertMaterial ||
 * material.isMeshToonMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial ||
 * material.isShadowMaterial || (material.isShaderMaterial && material.lights === true). A leftover
 * own isMeshToonMaterial === true on a color-only MeshBasic makes needsLights true and
 * getProgram wires lighting uniforms (uniforms.ambientLightColor, uniforms.lightProbe,
 * uniforms.directionalLights, and the rest) on a program whose shaderID stays 'basic'. setProgram
 * calls markUniformsLightsNeedsUpdate when materialProperties.needsLights. ShaderLib.basic does not
 * include UniformsLib.lights, so those slots are absent on a MeshBasic program (source reading, not
 * a measured Quest crash). ShaderLib.toon does include UniformsLib.lights.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshToonMaterial,
 * so refresh still calls refreshUniformsCommon and does not take the Toon else-if (does not call refreshUniformsToon) when
 * isMeshBasicMaterial stays true. Those lights forks are independent of the refresh branch.
 * Assigning null, undefined, false, or true stores an own property, which is not the r170 MeshBasic
 * absence. delete material.isMeshToonMaterial removes the own property so the r170 absence
 * remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100
 * / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24),
 * unique MeshBasic 3, isMeshLambertMaterial-absent 3, isMeshStandardMaterial-absent 3, linewidth-absent 3,
 * isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3,
 * fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13 stay vs v1.26.0. drawCallsEstimate stays 7.
 * isMeshToonMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.28.0 pins leftover Material isMeshPhongMaterial to the r170 MeshBasic absence
 * (material.isMeshPhongMaterial === undefined and Object.hasOwn(material, 'isMeshPhongMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isMeshPhongMaterial-absent 3) after the v1.27.0 isMeshToonMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshPhongMaterial /
 * pinColorOnlyVisualMaterialIsMeshPhongMaterial run after
 * pinColorOnlyVisualMaterialIsMeshToonMaterial on procedural create and packaged ingest, including
 * fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same
 * collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isMeshPhongMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshPhongMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshPhongMaterial. Do not invent maps or
 * lights. Do not clear isMeshPhongMaterial on real MeshPhongMaterial (it keeps constructor true).
 * Do not touch isMeshToonMaterial (v1.27.0 isMeshToonMaterial-absent 3 stays). Do not touch
 * isMeshLambertMaterial (v1.26.0 isMeshLambertMaterial-absent 3 stays). Do not touch
 * isMeshStandardMaterial (v1.25.0 isMeshStandardMaterial-absent 3 stays). Do not touch linewidth
 * (v1.24.0 linewidth-absent 3 stays). Do not touch isRawShaderMaterial (v1.23.0
 * isRawShaderMaterial-absent 3 stays). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3 stays). Do
 * not touch lights (v1.20.0 lights-absent 3 stays). Do not touch fragmentShader (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0 vertexShader-absent 3 stays).
 * Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3 stays). Do not touch
 * uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0
 * uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag
 * pins, clippingPlanes, clipIntersection, clipShadows, isMeshBasicMaterial, type,
 * isMeshPhysicalMaterial, wireframe, wireframeLinewidth, wireframeLinecap, wireframeLinejoin,
 * bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved
 * keep authored isMeshPhongMaterial. Collider meshes stay untouched. MeshPhongMaterial keeps
 * constructor isMeshPhongMaterial (true). Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isMeshPhongMaterial (isMeshPhongMaterial ===
 * undefined and Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true
 * only. Material.js does not mention isMeshPhongMaterial. Material.copy and MeshBasicMaterial.copy
 * do not copy it. Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ isMeshPhongMaterial: true }) warns and does not store isMeshPhongMaterial.
 * MeshPhongMaterial assigns this.isMeshPhongMaterial = true. MeshPhongMaterial.copy does not
 * assign isMeshPhongMaterial (the constructor already set true). MeshPhongMaterial has no toJSON
 * override. Material.toJSON does not write isMeshPhongMaterial. MaterialLoader does not parse
 * isMeshPhongMaterial. shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps
 * to 'basic'. MeshPhongMaterial maps to 'phong'. When shaderID is set, vertexShader and
 * fragmentShader still come from ShaderLib, not a MeshPhong program, so a leftover
 * isMeshPhongMaterial does not switch MeshBasic off 'basic'. WebGLRenderer.materialNeedsLights
 * returns material.isMeshLambertMaterial || material.isMeshToonMaterial ||
 * material.isMeshPhongMaterial || material.isMeshStandardMaterial || material.isShadowMaterial ||
 * (material.isShaderMaterial && material.lights === true). A leftover own isMeshPhongMaterial ===
 * true on a color-only MeshBasic makes needsLights true and getProgram wires lighting uniforms
 * (uniforms.ambientLightColor, uniforms.lightProbe, uniforms.directionalLights, and the rest) on a
 * program whose shaderID stays 'basic'. setProgram calls markUniformsLightsNeedsUpdate when
 * materialProperties.needsLights. ShaderLib.basic does not include UniformsLib.lights, so those
 * slots are absent on a MeshBasic program (source reading, not a measured Quest crash).
 * ShaderLib.phong does include UniformsLib.lights. WebGLMaterials.refreshMaterialUniforms checks
 * isMeshBasicMaterial before isMeshPhongMaterial, so refresh still calls refreshUniformsCommon and
 * does not take the Phong else-if (does not call refreshUniformsPhong) when isMeshBasicMaterial
 * stays true. Those lights forks are independent of the refresh branch. Assigning null, undefined,
 * false, or true stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isMeshPhongMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48,
 * attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique
 * MeshBasic 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13,
 * geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.27.0.
 * drawCallsEstimate stays 7. isMeshPhongMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1
 * ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still
 * TODO. Do not require 207/240 Hz.
 * v1.29.0 pins leftover Material isShadowMaterial to the r170 MeshBasic absence
 * (material.isShadowMaterial === undefined and Object.hasOwn(material, 'isShadowMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isShadowMaterial-absent 3) after the v1.28.0 isMeshPhongMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsShadowMaterial /
 * pinColorOnlyVisualMaterialIsShadowMaterial run after
 * pinColorOnlyVisualMaterialIsMeshPhongMaterial on procedural create and packaged ingest, including
 * fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same
 * collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isShadowMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isShadowMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to ShadowMaterial. Do not invent maps or
 * lights. Do not clear isShadowMaterial on real ShadowMaterial (it keeps constructor true).
 * Do not touch isMeshPhongMaterial (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0 isMeshToonMaterial-absent 3 stays). Do not touch
 * isMeshLambertMaterial (v1.26.0 isMeshLambertMaterial-absent 3 stays). Do not touch
 * isMeshStandardMaterial (v1.25.0 isMeshStandardMaterial-absent 3 stays). Do not touch linewidth
 * (v1.24.0 linewidth-absent 3 stays). Do not touch isRawShaderMaterial (v1.23.0
 * isRawShaderMaterial-absent 3 stays). Do not touch isShaderMaterial (v1.22.0
 * isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0 clipping-absent 3 stays). Do
 * not touch lights (v1.20.0 lights-absent 3 stays). Do not touch fragmentShader (v1.19.0
 * fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0 vertexShader-absent 3 stays).
 * Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3 stays). Do not touch
 * uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch uniforms (v1.15.0
 * uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag
 * pins, clippingPlanes, clipIntersection, clipShadows, isMeshBasicMaterial, type,
 * isMeshPhysicalMaterial, wireframe, wireframeLinewidth, wireframeLinecap, wireframeLinejoin,
 * bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped / lit / interleaved
 * keep authored isShadowMaterial. Collider meshes stay untouched. ShadowMaterial keeps
 * constructor isShadowMaterial (true). Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isShadowMaterial (isShadowMaterial ===
 * undefined and Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true
 * only. Material.js does not mention isShadowMaterial. Material.copy and MeshBasicMaterial.copy
 * do not copy it. Material.setValues skips a key when this[key] === undefined, so new
 * MeshBasicMaterial({ isShadowMaterial: true }) warns and does not store isShadowMaterial.
 * ShadowMaterial assigns this.isShadowMaterial = true. ShadowMaterial.copy does not
 * assign isShadowMaterial (the constructor already set true). ShadowMaterial has no toJSON
 * override. Material.toJSON does not write isShadowMaterial. MaterialLoader does not parse
 * isShadowMaterial. shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps
 * to 'basic'. ShadowMaterial maps to 'shadow'. When shaderID is set, vertexShader and
 * fragmentShader still come from ShaderLib, not a ShadowMaterial program, so a leftover
 * isShadowMaterial does not switch MeshBasic off 'basic'. WebGLRenderer.materialNeedsLights
 * returns material.isMeshLambertMaterial || material.isMeshToonMaterial ||
 * material.isMeshPhongMaterial || material.isMeshStandardMaterial || material.isShadowMaterial ||
 * (material.isShaderMaterial && material.lights === true). A leftover own isShadowMaterial ===
 * true on a color-only MeshBasic makes needsLights true and getProgram wires lighting uniforms
 * (uniforms.ambientLightColor, uniforms.lightProbe, uniforms.directionalLights, and the rest) on a
 * program whose shaderID stays 'basic'. setProgram calls markUniformsLightsNeedsUpdate when
 * materialProperties.needsLights. ShaderLib.basic does not include UniformsLib.lights, so those
 * slots are absent on a MeshBasic program (source reading, not a measured Quest crash).
 * ShaderLib.shadow does include UniformsLib.lights. WebGLMaterials.refreshMaterialUniforms checks
 * isMeshBasicMaterial before isShadowMaterial, so refresh still calls refreshUniformsCommon and
 * does not take the ShadowMaterial else-if (that branch copies uniforms.color and uniforms.opacity) when isMeshBasicMaterial
 * stays true. Those lights forks are independent of the refresh branch. Assigning null, undefined,
 * false, or true stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isShadowMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48,
 * attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique
 * MeshBasic 3, isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13,
 * geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.28.0.
 * drawCallsEstimate stays 7. isShadowMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1
 * ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still
 * TODO. Do not require 207/240 Hz.
 * v1.30.0 pins leftover Material isMeshPhysicalMaterial to the r170 MeshBasic absence
 * (material.isMeshPhysicalMaterial === undefined and Object.hasOwn(material,
 * 'isMeshPhysicalMaterial') === false) on the 3 shared color-only MeshBasic materials (wood / brass
 * / steel; measured isMeshPhysicalMaterial-absent 3) after the v1.29.0 isShadowMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshPhysicalMaterial /
 * pinColorOnlyVisualMaterialIsMeshPhysicalMaterial run after
 * pinColorOnlyVisualMaterialIsShadowMaterial on procedural create and packaged ingest, including
 * fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider
 * / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete
 * material.isMeshPhysicalMaterial when the own property is present. Do not assign null, undefined,
 * false, or true. An already-absent isMeshPhysicalMaterial is left alone. Pin once per shared
 * material instance. Do not convert MeshBasic to MeshPhysicalMaterial. Do not invent maps, lights,
 * roughness, metalness, or envMap. Do not clear isMeshPhysicalMaterial on real MeshPhysicalMaterial
 * (it keeps constructor true and inherited isMeshStandardMaterial true). Do not clear
 * isMeshBasicMaterial or change type. Do not touch isShadowMaterial (v1.29.0
 * isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial (v1.28.0
 * isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isMeshPhysicalMaterial. Collider meshes stay untouched.
 * MeshPhysicalMaterial keeps constructor isMeshPhysicalMaterial (true) and inherited
 * isMeshStandardMaterial (true). Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isMeshPhysicalMaterial (isMeshPhysicalMaterial ===
 * undefined and Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true
 * only. Material.js does not mention isMeshPhysicalMaterial. Material.copy and
 * MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when this[key] ===
 * undefined, so new MeshBasicMaterial({ isMeshPhysicalMaterial: true }) warns and does not store
 * isMeshPhysicalMaterial. MeshPhysicalMaterial extends MeshStandardMaterial. The
 * MeshPhysicalMaterial constructor calls super() (MeshStandardMaterial assigns
 * this.isMeshStandardMaterial = true) and assigns this.isMeshPhysicalMaterial = true.
 * MeshPhysicalMaterial.copy calls super.copy(source) and does not assign isMeshPhysicalMaterial
 * (the constructor already set true). MeshPhysicalMaterial has no toJSON override. Material.toJSON
 * does not write isMeshPhysicalMaterial. MaterialLoader does not parse isMeshPhysicalMaterial.
 * shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'.
 * MeshPhysicalMaterial maps to 'physical'. When shaderID is set, vertexShader and fragmentShader
 * still come from ShaderLib, so a leftover isMeshPhysicalMaterial does not switch MeshBasic off
 * 'basic'. isMeshPhysicalMaterial is not a WebGLRenderer.materialNeedsLights term. That boolean
 * chain was already walked (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial ||
 * isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights === true)); packing pin
 * comments have deferred isMeshPhysicalMaterial in the do-not-touch set since the v1.25.0
 * isMeshStandardMaterial pin. A leftover own isMeshPhysicalMaterial === true on a color-only
 * MeshBasic does not by itself make needsLights true while those earlier flags stay absent. Real
 * MeshPhysicalMaterial takes needsLights because inherited isMeshStandardMaterial is true.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshStandardMaterial.
 * The isMeshStandardMaterial branch calls refreshUniformsCommon and refreshUniformsStandard, then
 * nests if (material.isMeshPhysicalMaterial) { refreshUniformsPhysical(uniforms, material,
 * transmissionRenderTarget); }. refreshUniformsPhysical writes uniforms.ior,
 * uniforms.specularIntensity, and uniforms.specularColor, and when the matching factors are greater
 * than 0 it also writes sheen, clearcoat, dispersion, iridescence, transmission, thickness,
 * attenuation, and anisotropy uniforms. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon and does not enter the standard branch, so it does not call
 * refreshUniformsPhysical. A leftover own true is still not the r170 MeshBasic constructor shape
 * (fresh Material / MeshBasicMaterial leave the flag absent). Real MeshPhysicalMaterial keeps
 * constructor true, keeps inherited isMeshStandardMaterial true, and leaves isMeshBasicMaterial
 * absent, so refresh takes that nested physical call. Assigning null, undefined, false, or true
 * stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isMeshPhysicalMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, attrBytes
 * 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique MeshBasic
 * 3, isShadowMaterial-absent 3, isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3,
 * isMeshLambertMaterial-absent 3, isMeshStandardMaterial-absent 3, linewidth-absent 3,
 * isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3,
 * fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13 stay vs v1.29.0. drawCallsEstimate stays 7.
 * isMeshPhysicalMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.31.0 pins leftover Material isMeshMatcapMaterial to the r170 MeshBasic absence
 * (material.isMeshMatcapMaterial === undefined and Object.hasOwn(material, 'isMeshMatcapMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isMeshMatcapMaterial-absent 3) after the v1.30.0 isMeshPhysicalMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshMatcapMaterial /
 * pinColorOnlyVisualMaterialIsMeshMatcapMaterial run after
 * pinColorOnlyVisualMaterialIsMeshPhysicalMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isMeshMatcapMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshMatcapMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshMatcapMaterial. Do not invent maps,
 * lights, matcap textures, or envMap. Do not clear isMeshMatcapMaterial on real MeshMatcapMaterial
 * (it keeps constructor true). Do not clear isMeshBasicMaterial or change type. Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isMeshMatcapMaterial. Collider meshes stay untouched.
 * MeshMatcapMaterial keeps constructor isMeshMatcapMaterial (true). Checked installed
 * three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign isMeshMatcapMaterial
 * (isMeshMatcapMaterial === undefined and Object.hasOwn is false). MeshBasicMaterial assigns
 * this.isMeshBasicMaterial = true only. Material.js does not mention isMeshMatcapMaterial.
 * Material.copy and MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when
 * this[key] === undefined, so new MeshBasicMaterial({ isMeshMatcapMaterial: true }) warns and does
 * not store isMeshMatcapMaterial. MeshMatcapMaterial extends Material. The constructor assigns
 * this.isMeshMatcapMaterial = true, this.defines = { 'MATCAP': '' }, and this.matcap = null.
 * MeshMatcapMaterial.copy calls super.copy(source), resets defines to { 'MATCAP': '' }, copies
 * matcap, and does not assign isMeshMatcapMaterial (the constructor already set true).
 * MeshMatcapMaterial has no toJSON override. Material.toJSON does not write isMeshMatcapMaterial.
 * MaterialLoader does not parse isMeshMatcapMaterial (it can construct MeshMatcapMaterial by type).
 * shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'.
 * MeshMatcapMaterial maps to 'matcap'. When shaderID is set, vertexShader and fragmentShader still
 * come from ShaderLib, so a leftover isMeshMatcapMaterial does not switch MeshBasic off 'basic'.
 * isMeshMatcapMaterial is not a WebGLRenderer.materialNeedsLights term. That boolean chain was
 * already walked (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial ||
 * isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights === true)). v1.30.0
 * cleared the deferred nested isMeshPhysicalMaterial check under the isMeshStandardMaterial branch.
 * The next leftover Material type-flag in refreshMaterialUniforms order, after that nested Physical
 * check, is isMeshMatcapMaterial. A leftover own isMeshMatcapMaterial === true on a color-only
 * MeshBasic does not by itself make needsLights true while those earlier flags stay absent. Real
 * MeshMatcapMaterial does not assign isMeshStandardMaterial, so it also does not take needsLights
 * from this flag. WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before
 * isMeshStandardMaterial, and the isMeshMatcapMaterial else-if comes after the Standard/Physical
 * block. That else-if calls refreshUniformsCommon and refreshUniformsMatcap. refreshUniformsMatcap
 * writes uniforms.matcap.value = material.matcap when material.matcap is set. While
 * isMeshBasicMaterial stays true, refresh still calls refreshUniformsCommon and does not enter the
 * matcap else-if, so it does not call refreshUniformsMatcap. A leftover own true is still not the
 * r170 MeshBasic constructor shape (fresh Material / MeshBasicMaterial leave the flag absent). Real
 * MeshMatcapMaterial keeps constructor true and leaves isMeshBasicMaterial absent, so refresh takes
 * that matcap else-if. Assigning null, undefined, false, or true stores an own property, which is
 * not the r170 MeshBasic absence. delete material.isMeshMatcapMaterial removes the own property so
 * the r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique
 * verts 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12,
 * unique verts 24), unique MeshBasic 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty
 * 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.30.0. drawCallsEstimate stays 7.
 * isMeshMatcapMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.32.0 pins leftover Material isMeshDepthMaterial to the r170 MeshBasic absence
 * (material.isMeshDepthMaterial === undefined and Object.hasOwn(material, 'isMeshDepthMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isMeshDepthMaterial-absent 3) after the v1.31.0 isMeshMatcapMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshDepthMaterial / pinColorOnlyVisualMaterialIsMeshDepthMaterial
 * run after pinColorOnlyVisualMaterialIsMeshMatcapMaterial on procedural create and packaged
 * ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and
 * the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules.
 * Prefer delete material.isMeshDepthMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshDepthMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshDepthMaterial. Do not invent maps,
 * lights, depthPacking changes (v1.12.0 depthPacking-absent 3 stays), or envMap. Do not clear
 * isMeshDepthMaterial on real MeshDepthMaterial (it keeps constructor true). Do not clear
 * isMeshBasicMaterial or change type. Do not touch isMeshMatcapMaterial (v1.31.0
 * isMeshMatcapMaterial-absent 3 stays). Do not touch isMeshPhysicalMaterial (v1.30.0
 * isMeshPhysicalMaterial-absent 3 stays). Do not touch isShadowMaterial (v1.29.0
 * isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial (v1.28.0
 * isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isMeshDepthMaterial. Collider meshes stay untouched.
 * MeshDepthMaterial keeps constructor isMeshDepthMaterial (true). Checked installed three@0.170.0:
 * fresh Material / MeshBasicMaterial constructors do not assign isMeshDepthMaterial
 * (isMeshDepthMaterial === undefined and Object.hasOwn is false). MeshBasicMaterial assigns
 * this.isMeshBasicMaterial = true only. Material.js does not mention isMeshDepthMaterial.
 * Material.copy and MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when
 * this[key] === undefined, so new MeshBasicMaterial({ isMeshDepthMaterial: true }) warns and does
 * not store isMeshDepthMaterial. MeshDepthMaterial extends Material. The constructor assigns
 * this.isMeshDepthMaterial = true, this.depthPacking = BasicDepthPacking, this.map = null,
 * this.alphaMap = null, and this.displacementMap = null. MeshDepthMaterial.copy calls
 * super.copy(source), copies depthPacking, map, alphaMap, and displacementMap, and does not assign
 * isMeshDepthMaterial (the constructor already set true). MeshDepthMaterial has no toJSON override.
 * Material.toJSON does not write isMeshDepthMaterial or depthPacking. MaterialLoader does not parse
 * isMeshDepthMaterial (it can construct MeshDepthMaterial by type). shaderID still comes from
 * shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. MeshDepthMaterial maps to 'depth'.
 * When shaderID is set, vertexShader and fragmentShader still come from ShaderLib, so a leftover
 * isMeshDepthMaterial does not switch MeshBasic off 'basic'. isMeshDepthMaterial is not a
 * WebGLRenderer.materialNeedsLights term. That boolean chain was already walked
 * (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial || isMeshStandardMaterial ||
 * isShadowMaterial || (isShaderMaterial && lights === true)). v1.31.0 cleared isMeshMatcapMaterial,
 * the else-if immediately before isMeshDepthMaterial in refreshMaterialUniforms. The next leftover
 * Material type-flag in that order, after isMeshMatcapMaterial, is isMeshDepthMaterial (then
 * Distance, Normal, LineBasic/Dashed, Points, Sprite, Shader). A leftover own isMeshDepthMaterial
 * === true on a color-only MeshBasic does not by itself make needsLights true while those earlier
 * flags stay absent. Real MeshDepthMaterial does not assign isMeshStandardMaterial, so it also does
 * not take needsLights from this flag. WebGLMaterials.refreshMaterialUniforms checks
 * isMeshBasicMaterial before isMeshMatcapMaterial, and the isMeshDepthMaterial else-if comes after
 * the matcap else-if. That else-if calls refreshUniformsCommon only. There is no
 * refreshUniformsDepth in r170. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon on the MeshBasic branch and does not enter the depth else-if. A leftover
 * own true is still not the r170 MeshBasic constructor shape (fresh Material / MeshBasicMaterial
 * leave the flag absent). Real MeshDepthMaterial keeps constructor true and leaves
 * isMeshBasicMaterial absent, so refresh takes that depth else-if. Assigning null, undefined,
 * false, or true stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isMeshDepthMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, attrBytes
 * 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique MeshBasic
 * 3, isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty
 * 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.31.0. drawCallsEstimate stays 7.
 * isMeshDepthMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.33.0 pins leftover Material isMeshDistanceMaterial to the r170 MeshBasic absence
 * (material.isMeshDistanceMaterial === undefined and Object.hasOwn(material,
 * 'isMeshDistanceMaterial') === false) on the 3 shared color-only MeshBasic materials (wood /
 * brass / steel; measured isMeshDistanceMaterial-absent 3) after the v1.32.0 isMeshDepthMaterial
 * pin. pinColorOnlyUnlitBasicMaterialIsMeshDistanceMaterial /
 * pinColorOnlyVisualMaterialIsMeshDistanceMaterial run after
 * pinColorOnlyVisualMaterialIsMeshDepthMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules.
 * Prefer delete material.isMeshDistanceMaterial when the own property is present. Do not assign
 * null, undefined, false, or true. An already-absent isMeshDistanceMaterial is left alone. Pin
 * once per shared material instance. Do not convert MeshBasic to MeshDistanceMaterial. Do not
 * invent maps, lights, displacementScale, displacementBias, depthPacking changes (v1.12.0
 * depthPacking-absent 3 stays), or envMap. Do not clear isMeshDistanceMaterial on real
 * MeshDistanceMaterial (it keeps constructor true and constructor distance fields map / alphaMap /
 * displacementMap / displacementScale / displacementBias). Do not clear isMeshBasicMaterial or
 * change type. Do not touch isMeshDepthMaterial (v1.32.0 isMeshDepthMaterial-absent 3 stays). Do
 * not touch isMeshMatcapMaterial (v1.31.0 isMeshMatcapMaterial-absent 3 stays). Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not
 * touch uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag
 * pins, clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth,
 * wireframeLinecap, wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or
 * mesh.visible. Mapped / lit / interleaved keep authored isMeshDistanceMaterial. Collider meshes
 * stay untouched. MeshDistanceMaterial keeps constructor isMeshDistanceMaterial (true). Checked
 * installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign
 * isMeshDistanceMaterial (isMeshDistanceMaterial === undefined and Object.hasOwn is false).
 * MeshBasicMaterial assigns this.isMeshBasicMaterial = true only. Material.js does not mention
 * isMeshDistanceMaterial. Material.copy and MeshBasicMaterial.copy do not copy it.
 * Material.setValues skips a key when this[key] === undefined, so new MeshBasicMaterial({
 * isMeshDistanceMaterial: true }) warns and does not store isMeshDistanceMaterial.
 * MeshDistanceMaterial extends Material. The constructor assigns this.isMeshDistanceMaterial =
 * true, this.map = null, this.alphaMap = null, this.displacementMap = null, this.displacementScale
 * = 1, and this.displacementBias = 0. MeshDistanceMaterial.copy calls super.copy(source), copies
 * map, alphaMap, displacementMap, displacementScale, and displacementBias, and does not assign
 * isMeshDistanceMaterial (the constructor already set true). MeshDistanceMaterial has no toJSON
 * override. Material.toJSON does not write isMeshDistanceMaterial. Material.toJSON writes
 * displacementScale and displacementBias only when displacementMap is a texture, so a fresh
 * MeshDistanceMaterial (displacementMap null) does not serialize those fields. MaterialLoader does
 * not parse isMeshDistanceMaterial (it can construct MeshDistanceMaterial by type). shaderID still
 * comes from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. MeshDistanceMaterial
 * maps to 'distanceRGBA'. When shaderID is set, vertexShader and fragmentShader still come from
 * ShaderLib, so a leftover isMeshDistanceMaterial does not switch MeshBasic off 'basic'.
 * isMeshDistanceMaterial is not a WebGLRenderer.materialNeedsLights term. That boolean chain was
 * already walked (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial ||
 * isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights === true)). v1.32.0
 * cleared isMeshDepthMaterial, the else-if immediately before isMeshDistanceMaterial in
 * refreshMaterialUniforms. The next leftover Material type-flag in that order, after
 * isMeshDepthMaterial, is isMeshDistanceMaterial (then Normal, LineBasic/Dashed, Points, Sprite,
 * Shader). A leftover own isMeshDistanceMaterial === true on a color-only MeshBasic does not by
 * itself make needsLights true while those earlier flags stay absent. Real MeshDistanceMaterial
 * does not assign isMeshStandardMaterial, so it also does not take needsLights from this flag.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshDepthMaterial,
 * and the isMeshDistanceMaterial else-if comes after the depth else-if. That else-if calls
 * refreshUniformsCommon and refreshUniformsDistance. refreshUniformsDistance reads
 * properties.get(material).light and writes uniforms.referencePosition, uniforms.nearDistance, and
 * uniforms.farDistance from that light. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon on the MeshBasic branch and does not enter the distance else-if, so it
 * does not call refreshUniformsDistance. A leftover own true is still not the r170 MeshBasic
 * constructor shape (fresh Material / MeshBasicMaterial leave the flag absent). Real
 * MeshDistanceMaterial keeps constructor true and leaves isMeshBasicMaterial absent, so refresh
 * takes that distance else-if. Assigning null, undefined, false, or true stores an own property,
 * which is not the r170 MeshBasic absence. delete material.isMeshDistanceMaterial removes the own
 * property so the r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96
 * / 24, unique verts 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1,
 * tris 12, unique verts 24), unique MeshBasic 3, isMeshDepthMaterial-absent 3,
 * isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13,
 * geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.32.0.
 * drawCallsEstimate stays 7. isMeshDistanceMaterial-absent 3 is the new count. Quest 3 90 Hz
 * (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms /
 * FFR still TODO. Do not require 207/240 Hz.

 * v1.34.0 pins leftover Material isMeshNormalMaterial to the r170 MeshBasic absence
 * (material.isMeshNormalMaterial === undefined and Object.hasOwn(material, 'isMeshNormalMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isMeshNormalMaterial-absent 3) after the v1.33.0 isMeshDistanceMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsMeshNormalMaterial /
 * pinColorOnlyVisualMaterialIsMeshNormalMaterial run after
 * pinColorOnlyVisualMaterialIsMeshDistanceMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isMeshNormalMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isMeshNormalMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to MeshNormalMaterial. Do not invent maps,
 * lights, bumpMap, bumpScale, normalMap, normalMapType, normalScale, displacement fields,
 * depthPacking changes (v1.12.0 depthPacking-absent 3 stays), or envMap. Do not clear
 * isMeshNormalMaterial on real MeshNormalMaterial (it keeps constructor true and constructor
 * normal-material fields bumpMap / bumpScale / normalMap / normalMapType / normalScale /
 * displacementMap / displacementScale / displacementBias / wireframe / wireframeLinewidth /
 * flatShading). Do not clear isMeshBasicMaterial or change type. Do not touch
 * isMeshDistanceMaterial (v1.33.0 isMeshDistanceMaterial-absent 3 stays). Do not touch
 * isMeshDepthMaterial (v1.32.0 isMeshDepthMaterial-absent 3 stays). Do not touch
 * isMeshMatcapMaterial (v1.31.0 isMeshMatcapMaterial-absent 3 stays). Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isMeshNormalMaterial. Collider meshes stay untouched.
 * MeshNormalMaterial keeps constructor isMeshNormalMaterial (true). Checked installed
 * three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign isMeshNormalMaterial
 * (isMeshNormalMaterial === undefined and Object.hasOwn is false). MeshBasicMaterial assigns
 * this.isMeshBasicMaterial = true only. Material.js does not mention isMeshNormalMaterial.
 * Material.copy and MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when
 * this[key] === undefined, so new MeshBasicMaterial({ isMeshNormalMaterial: true }) warns and does
 * not store isMeshNormalMaterial. MeshNormalMaterial extends Material. The constructor assigns
 * this.isMeshNormalMaterial = true, this.bumpMap = null, this.bumpScale = 1, this.normalMap = null,
 * this.normalMapType = TangentSpaceNormalMap, this.normalScale = new Vector2(1, 1),
 * this.displacementMap = null, this.displacementScale = 1, this.displacementBias = 0,
 * this.wireframe = false, this.wireframeLinewidth = 1, and this.flatShading = false.
 * MeshNormalMaterial.copy calls super.copy(source), copies bumpMap, bumpScale, normalMap,
 * normalMapType, normalScale, displacementMap, displacementScale, displacementBias, wireframe,
 * wireframeLinewidth, and flatShading, and does not assign isMeshNormalMaterial (the constructor
 * already set true). MeshNormalMaterial has no toJSON override. Material.toJSON does not write
 * isMeshNormalMaterial. Material.toJSON writes bumpScale only when bumpMap is a texture, writes
 * normalMapType and normalScale only when normalMap is a texture, and writes displacementScale and
 * displacementBias only when displacementMap is a texture, so a fresh MeshNormalMaterial (bumpMap,
 * normalMap, and displacementMap null; flatShading false; wireframe false) does not serialize those
 * fields. MaterialLoader does not parse isMeshNormalMaterial (it can construct MeshNormalMaterial
 * by type). shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'.
 * MeshNormalMaterial maps to 'normal'. When shaderID is set, vertexShader and fragmentShader still
 * come from ShaderLib, so a leftover isMeshNormalMaterial does not switch MeshBasic off 'basic'.
 * isMeshNormalMaterial is not a WebGLRenderer.materialNeedsLights term. That boolean chain was
 * already walked (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial ||
 * isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights === true)). v1.33.0
 * cleared isMeshDistanceMaterial, the else-if immediately before isMeshNormalMaterial in
 * refreshMaterialUniforms. The next leftover Material type-flag in that order, after
 * isMeshDistanceMaterial, is isMeshNormalMaterial (then LineBasic/Dashed, Points, Sprite, Shader).
 * A leftover own isMeshNormalMaterial === true on a color-only MeshBasic does not by itself make
 * needsLights true while those earlier flags stay absent. Real MeshNormalMaterial does not assign
 * isMeshStandardMaterial, so it also does not take needsLights from this flag.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshDistanceMaterial,
 * and the isMeshNormalMaterial else-if comes after the distance else-if. That else-if calls
 * refreshUniformsCommon only. There is no refreshUniformsNormal in r170. While isMeshBasicMaterial
 * stays true, refresh still calls refreshUniformsCommon on the MeshBasic branch and does not enter
 * the normal else-if. A leftover own true is still not the r170 MeshBasic constructor shape (fresh
 * Material / MeshBasicMaterial leave the flag absent). Real MeshNormalMaterial keeps constructor
 * true and leaves isMeshBasicMaterial absent, so refresh takes that normal else-if. Assigning null,
 * undefined, false, or true stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isMeshNormalMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, attrBytes
 * 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique MeshBasic
 * 3, isMeshDistanceMaterial-absent 3, isMeshDepthMaterial-absent 3, isMeshMatcapMaterial-absent 3,
 * isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3, isMeshPhongMaterial-absent 3,
 * isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3, isMeshStandardMaterial-absent 3,
 * linewidth-absent 3, isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3,
 * lights-absent 3, fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13 stay vs v1.33.0. drawCallsEstimate stays 7.
 * isMeshNormalMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.35.0 pins leftover Material isLineBasicMaterial to the r170 MeshBasic absence
 * (material.isLineBasicMaterial === undefined and Object.hasOwn(material, 'isLineBasicMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isLineBasicMaterial-absent 3) after the v1.34.0 isMeshNormalMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsLineBasicMaterial / pinColorOnlyVisualMaterialIsLineBasicMaterial
 * run after pinColorOnlyVisualMaterialIsMeshNormalMaterial on procedural create and packaged
 * ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and
 * the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules.
 * Prefer delete material.isLineBasicMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isLineBasicMaterial is left alone. Pin once per
 * shared material instance. Do not convert MeshBasic to LineBasicMaterial or Line. Do not invent
 * maps, lights, linewidth changes beyond the v1.24.0 linewidth-absent pin, linecap, linejoin, or
 * envMap. Do not clear isLineBasicMaterial on real LineBasicMaterial (it keeps constructor true and
 * constructor line fields color / map / linewidth / linecap / linejoin / fog). Do not clear
 * isMeshBasicMaterial or change type. Do not touch isMeshNormalMaterial (v1.34.0
 * isMeshNormalMaterial-absent 3 stays). Do not touch flatShading (the v0.82 false pin on packed
 * MeshBasics stays). Do not touch isMeshDistanceMaterial (v1.33.0 isMeshDistanceMaterial-absent 3
 * stays). Do not touch isMeshDepthMaterial (v1.32.0 isMeshDepthMaterial-absent 3 stays). Do not
 * touch isMeshMatcapMaterial (v1.31.0 isMeshMatcapMaterial-absent 3 stays). Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isLineBasicMaterial. Collider meshes stay untouched.
 * LineBasicMaterial keeps constructor isLineBasicMaterial (true). Checked installed three@0.170.0:
 * fresh Material / MeshBasicMaterial constructors do not assign isLineBasicMaterial
 * (isLineBasicMaterial === undefined and Object.hasOwn is false). MeshBasicMaterial assigns
 * this.isMeshBasicMaterial = true only. Material.js does not mention isLineBasicMaterial.
 * Material.copy and MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when
 * this[key] === undefined, so new MeshBasicMaterial({ isLineBasicMaterial: true }) warns and does
 * not store isLineBasicMaterial. LineBasicMaterial extends Material. The constructor assigns
 * this.isLineBasicMaterial = true, this.color = new Color(0xffffff), this.map = null,
 * this.linewidth = 1, this.linecap = 'round', this.linejoin = 'round', and this.fog = true.
 * LineBasicMaterial.copy calls super.copy(source), copies color, map, linewidth, linecap, linejoin,
 * and fog, and does not assign isLineBasicMaterial (the constructor already set true).
 * LineBasicMaterial has no toJSON override. Material.toJSON does not write isLineBasicMaterial,
 * linecap, or linejoin. Material.toJSON writes linewidth only when linewidth !== 1, so a fresh
 * LineBasicMaterial (linewidth 1) does not serialize linewidth. Material.toJSON writes fog only
 * when fog === false, so a fresh LineBasicMaterial (fog true) does not serialize fog.
 * Material.toJSON writes color when color is a Color, so a fresh LineBasicMaterial serializes color
 * 0xffffff. MaterialLoader does not parse isLineBasicMaterial (it can construct LineBasicMaterial
 * by type and parses linewidth). shaderID still comes from shaderIDs[material.type].
 * MeshBasicMaterial maps to 'basic'. LineBasicMaterial also maps to 'basic'. When shaderID is set,
 * vertexShader and fragmentShader still come from ShaderLib, so a leftover isLineBasicMaterial does
 * not switch MeshBasic off 'basic'. isLineBasicMaterial is not a WebGLRenderer.materialNeedsLights
 * term. That boolean chain was already walked (isMeshLambertMaterial || isMeshToonMaterial ||
 * isMeshPhongMaterial || isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights
 * === true)). v1.34.0 cleared isMeshNormalMaterial, the else-if immediately before
 * isLineBasicMaterial in refreshMaterialUniforms. The next leftover Material type-flag in that
 * order, after isMeshNormalMaterial, is isLineBasicMaterial (then the nested isLineDashedMaterial
 * check inside that branch, then Points, Sprite, Shadow, Shader). A leftover own
 * isLineBasicMaterial === true on a color-only MeshBasic does not by itself make needsLights true
 * while those earlier flags stay absent. Real LineBasicMaterial does not assign
 * isMeshStandardMaterial or isShadowMaterial, so it also does not take needsLights from this flag.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isMeshNormalMaterial,
 * and the isLineBasicMaterial else-if comes after the normal else-if. That else-if calls
 * refreshUniformsLine, which copies material.color into uniforms.diffuse and material.opacity into
 * uniforms.opacity, and writes uniforms.map when material.map is set. A nested if
 * (material.isLineDashedMaterial) then calls refreshUniformsDash. This pulse does not delete
 * isLineDashedMaterial. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon on the MeshBasic branch and does not enter the line else-if, so it does not
 * call refreshUniformsLine. A leftover own true is still not the r170 MeshBasic constructor shape
 * (fresh Material / MeshBasicMaterial leave the flag absent). Real LineBasicMaterial keeps
 * constructor true and leaves isMeshBasicMaterial absent, so refresh takes that line else-if.
 * Assigning null, undefined, false, or true stores an own property, which is not the r170 MeshBasic
 * absence. delete material.isLineBasicMaterial removes the own property so the r170 absence
 * remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100
 * / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24),
 * unique MeshBasic 3, isMeshDistanceMaterial-absent 3, isMeshDepthMaterial-absent 3,
 * isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty
 * 13, mesh-name-empty 10, mesh-userData-empty 13, isMeshNormalMaterial-absent 3 stay vs v1.34.0.
 * drawCallsEstimate stays 7. isLineBasicMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1
 * ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still
 * TODO. Do not require 207/240 Hz.
 * v1.36.0 pins leftover Material isLineDashedMaterial to the r170 MeshBasic absence
 * (material.isLineDashedMaterial === undefined and Object.hasOwn(material, 'isLineDashedMaterial')
 * === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isLineDashedMaterial-absent 3) after the v1.35.0 isLineBasicMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsLineDashedMaterial /
 * pinColorOnlyVisualMaterialIsLineDashedMaterial run after
 * pinColorOnlyVisualMaterialIsLineBasicMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules.
 * Prefer delete material.isLineDashedMaterial when the own property is present. Do not assign
 * null, undefined, false, or true. An already-absent isLineDashedMaterial is left alone. Pin once
 * per shared material instance. Do not convert MeshBasic to LineDashedMaterial, LineBasicMaterial,
 * or Line. Do not invent maps, lights, linewidth changes beyond the v1.24.0 linewidth-absent pin,
 * linecap, linejoin, scale, dashSize, gapSize, or envMap. Do not clear isLineDashedMaterial on
 * real LineDashedMaterial (it keeps constructor true, inherited constructor isLineBasicMaterial
 * true, constructor dash fields scale / dashSize / gapSize, and constructor line fields color /
 * map / linewidth / linecap / linejoin / fog). Do not clear isLineBasicMaterial (v1.35.0
 * isLineBasicMaterial-absent 3 stays). Do not clear isMeshBasicMaterial or change type. Do not
 * touch isMeshNormalMaterial (v1.34.0 isMeshNormalMaterial-absent 3 stays). Do not touch
 * flatShading (the v0.82 false pin on packed MeshBasics stays). Do not touch
 * isMeshDistanceMaterial (v1.33.0 isMeshDistanceMaterial-absent 3 stays). Do not touch
 * isMeshDepthMaterial (v1.32.0 isMeshDepthMaterial-absent 3 stays). Do not touch
 * isMeshMatcapMaterial (v1.31.0 isMeshMatcapMaterial-absent 3 stays). Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not
 * touch uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag
 * pins, clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth,
 * wireframeLinecap, wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or
 * mesh.visible. Mapped / lit / interleaved keep authored isLineDashedMaterial. Collider meshes
 * stay untouched. LineDashedMaterial keeps constructor isLineDashedMaterial (true) and inherited
 * isLineBasicMaterial (true). LineBasicMaterial keeps constructor isLineBasicMaterial (true) and
 * does not gain isLineDashedMaterial. Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isLineDashedMaterial (isLineDashedMaterial ===
 * undefined and Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true
 * only. Material.js does not mention isLineDashedMaterial. Material.copy and
 * MeshBasicMaterial.copy do not copy it. Material.setValues skips a key when this[key] ===
 * undefined, so new MeshBasicMaterial({ isLineDashedMaterial: true }) warns and does not store
 * isLineDashedMaterial. LineDashedMaterial extends LineBasicMaterial. The constructor calls
 * super() (LineBasicMaterial assigns this.isLineBasicMaterial = true, this.color = new
 * Color(0xffffff), this.map = null, this.linewidth = 1, this.linecap = 'round', this.linejoin =
 * 'round', and this.fog = true) and assigns this.isLineDashedMaterial = true, this.scale = 1,
 * this.dashSize = 3, and this.gapSize = 1. LineDashedMaterial.copy calls super.copy(source),
 * copies scale, dashSize, and gapSize, and does not assign isLineDashedMaterial (the constructor
 * already set true). LineBasicMaterial.copy copies color, map, linewidth, linecap, linejoin, and
 * fog, and does not assign isLineDashedMaterial. LineDashedMaterial has no toJSON override.
 * Material.toJSON does not write isLineDashedMaterial. Material.toJSON writes dashSize, gapSize,
 * and scale when they are not undefined, so a fresh LineDashedMaterial (scale 1, dashSize 3,
 * gapSize 1) serializes those fields. Material.toJSON writes linewidth only when linewidth !== 1,
 * so a fresh LineDashedMaterial (linewidth 1) does not serialize linewidth. Material.toJSON writes
 * fog only when fog === false, so a fresh LineDashedMaterial (fog true) does not serialize fog.
 * Material.toJSON writes color when color is a Color, so a fresh LineDashedMaterial serializes
 * color 0xffffff. MaterialLoader does not parse isLineDashedMaterial (it can construct
 * LineDashedMaterial by type and parses dashSize, gapSize, and scale). shaderID still comes from
 * shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. LineBasicMaterial also maps to
 * 'basic'. LineDashedMaterial maps to 'dashed'. When shaderID is set, vertexShader and
 * fragmentShader still come from ShaderLib, so a leftover isLineDashedMaterial does not switch
 * MeshBasic off 'basic'. isLineDashedMaterial is not a WebGLRenderer.materialNeedsLights term.
 * That boolean chain was already walked (isMeshLambertMaterial || isMeshToonMaterial ||
 * isMeshPhongMaterial || isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights
 * === true)). v1.35.0 cleared isLineBasicMaterial, the else-if that contains the nested
 * isLineDashedMaterial check in refreshMaterialUniforms. The next leftover Material type-flag in
 * that order, after isLineBasicMaterial, is nested isLineDashedMaterial (then Points, Sprite,
 * Shadow, Shader). A leftover own isLineDashedMaterial === true on a color-only MeshBasic does not
 * by itself make needsLights true while those earlier flags stay absent. Real LineDashedMaterial
 * does not assign isMeshStandardMaterial or isShadowMaterial, so it also does not take needsLights
 * from this flag. WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before
 * isLineBasicMaterial. The isLineBasicMaterial else-if calls refreshUniformsLine, which copies
 * material.color into uniforms.diffuse and material.opacity into uniforms.opacity, and writes
 * uniforms.map when material.map is set. A nested if (material.isLineDashedMaterial) then calls
 * refreshUniformsDash, which writes uniforms.dashSize from material.dashSize, uniforms.totalSize
 * from material.dashSize + material.gapSize, and uniforms.scale from material.scale. While
 * isMeshBasicMaterial stays true, refresh still calls refreshUniformsCommon on the MeshBasic
 * branch and does not enter the line else-if, so it does not call refreshUniformsDash. A leftover
 * own true is still not the r170 MeshBasic constructor shape (fresh Material / MeshBasicMaterial
 * leave the flag absent). Real LineDashedMaterial keeps constructor isLineDashedMaterial true,
 * keeps inherited isLineBasicMaterial true, and leaves isMeshBasicMaterial absent, so refresh
 * takes that line else-if and then the nested dash if. Assigning null, undefined, false, or true
 * stores an own property, which is not the r170 MeshBasic absence. delete
 * material.isLineDashedMaterial removes the own property so the r170 absence remains. Clean
 * procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48,
 * attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique verts 24), unique
 * MeshBasic 3, isMeshDistanceMaterial-absent 3, isMeshDepthMaterial-absent 3,
 * isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13,
 * geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13, isMeshNormalMaterial-absent
 * 3, isLineBasicMaterial-absent 3 stay vs v1.35.0. drawCallsEstimate stays 7.
 * isLineDashedMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.37.0 pins leftover Material isPointsMaterial to the r170 MeshBasic absence
 * (material.isPointsMaterial === undefined and Object.hasOwn(material, 'isPointsMaterial') ===
 * false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isPointsMaterial-absent 3) after the v1.36.0 isLineDashedMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsPointsMaterial / pinColorOnlyVisualMaterialIsPointsMaterial run
 * after pinColorOnlyVisualMaterialIsLineDashedMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules.
 * Prefer delete material.isPointsMaterial when the own property is present. Do not assign null,
 * undefined, false, or true. An already-absent isPointsMaterial is left alone. Pin once per shared
 * material instance. Do not convert MeshBasic to PointsMaterial or Points. Do not invent maps,
 * lights, size, sizeAttenuation, or envMap. Do not clear isPointsMaterial on real PointsMaterial
 * (it keeps constructor true and constructor points fields color / map / alphaMap / size /
 * sizeAttenuation / fog). Do not clear isLineDashedMaterial (v1.36.0 isLineDashedMaterial-absent 3
 * stays). Do not clear isLineBasicMaterial (v1.35.0 isLineBasicMaterial-absent 3 stays). Do not
 * clear isMeshBasicMaterial or change type. Do not touch isMeshNormalMaterial (v1.34.0
 * isMeshNormalMaterial-absent 3 stays). Do not touch flatShading (the v0.82 false pin on packed
 * MeshBasics stays). Do not touch isMeshDistanceMaterial (v1.33.0 isMeshDistanceMaterial-absent 3
 * stays). Do not touch isMeshDepthMaterial (v1.32.0 isMeshDepthMaterial-absent 3 stays). Do not
 * touch isMeshMatcapMaterial (v1.31.0 isMeshMatcapMaterial-absent 3 stays). Do not touch
 * isMeshPhysicalMaterial (v1.30.0 isMeshPhysicalMaterial-absent 3 stays). Do not touch
 * isShadowMaterial (v1.29.0 isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial
 * (v1.28.0 isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not
 * touch uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag
 * pins, clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth,
 * wireframeLinecap, wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or
 * mesh.visible. Mapped / lit / interleaved keep authored isPointsMaterial. Collider meshes stay
 * untouched. PointsMaterial keeps constructor isPointsMaterial (true) and constructor points
 * fields color / map / alphaMap / size / sizeAttenuation / fog. LineDashedMaterial keeps
 * constructor isLineDashedMaterial (true) and inherited isLineBasicMaterial (true) and does not
 * gain isPointsMaterial. Checked installed three@0.170.0: fresh Material / MeshBasicMaterial
 * constructors do not assign isPointsMaterial (isPointsMaterial === undefined and Object.hasOwn is
 * false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true only. Material.js does not
 * mention isPointsMaterial. Material.copy and MeshBasicMaterial.copy do not copy it.
 * Material.setValues skips a key when this[key] === undefined, so new MeshBasicMaterial({
 * isPointsMaterial: true }) warns and does not store isPointsMaterial. PointsMaterial extends
 * Material. The constructor assigns this.isPointsMaterial = true, this.color = new
 * Color(0xffffff), this.map = null, this.alphaMap = null, this.size = 1, this.sizeAttenuation =
 * true, and this.fog = true. PointsMaterial.copy calls super.copy(source), copies color, map,
 * alphaMap, size, sizeAttenuation, and fog, and does not assign isPointsMaterial (the constructor
 * already set true). PointsMaterial has no toJSON override. Material.toJSON does not write
 * isPointsMaterial. Material.toJSON writes size when size !== undefined and sizeAttenuation when
 * sizeAttenuation !== undefined, so a fresh PointsMaterial (size 1, sizeAttenuation true)
 * serializes those fields. Material.toJSON writes map only when map is a texture and alphaMap only
 * when alphaMap is a texture, so a fresh PointsMaterial (map null, alphaMap null) does not
 * serialize map or alphaMap. Material.toJSON writes fog only when fog === false, so a fresh
 * PointsMaterial (fog true) does not serialize fog. Material.toJSON writes color when color is a
 * Color, so a fresh PointsMaterial serializes color 0xffffff. MaterialLoader does not parse
 * isPointsMaterial (it can construct PointsMaterial by type and parses size, sizeAttenuation, and
 * alphaMap). shaderID still comes from shaderIDs[material.type]. MeshBasicMaterial maps to
 * 'basic'. PointsMaterial maps to 'points'. When shaderID is set, vertexShader and fragmentShader
 * still come from ShaderLib, so a leftover isPointsMaterial does not switch MeshBasic off 'basic'.
 * isPointsMaterial is not a WebGLRenderer.materialNeedsLights term. That boolean chain was already
 * walked (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial ||
 * isMeshStandardMaterial || isShadowMaterial || (isShaderMaterial && lights === true)). v1.36.0
 * cleared isLineDashedMaterial, the nested check inside the isLineBasicMaterial else-if in
 * refreshMaterialUniforms. The next leftover Material type-flag in that order, after nested
 * isLineDashedMaterial, is isPointsMaterial (then Sprite, Shadow, Shader). This pulse does not
 * delete isSpriteMaterial. A leftover own isPointsMaterial === true on a color-only MeshBasic does
 * not by itself make needsLights true while those earlier flags stay absent. Real PointsMaterial
 * does not assign isMeshStandardMaterial or isShadowMaterial, so it also does not take needsLights
 * from this flag. WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before
 * isLineBasicMaterial, and the isPointsMaterial else-if comes after that line else-if. That
 * else-if calls refreshUniformsPoints(uniforms, material, pixelRatio, height), which copies
 * material.color into uniforms.diffuse and material.opacity into uniforms.opacity, writes
 * uniforms.size from material.size * pixelRatio, writes uniforms.scale from height * 0.5, writes
 * uniforms.map and uvTransform when material.map is set, writes uniforms.alphaMap and
 * alphaMapTransform when material.alphaMap is set, and writes uniforms.alphaTest when
 * material.alphaTest > 0. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon on the MeshBasic branch and does not enter the points else-if, so it does
 * not call refreshUniformsPoints. A leftover own true is still not the r170 MeshBasic constructor
 * shape (fresh Material / MeshBasicMaterial leave the flag absent). Real PointsMaterial keeps
 * constructor isPointsMaterial true and leaves isMeshBasicMaterial absent, so refresh takes that
 * points else-if. Assigning null, undefined, false, or true stores an own property, which is not
 * the r170 MeshBasic absence. delete material.isPointsMaterial removes the own property so the
 * r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique
 * verts 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12,
 * unique verts 24), unique MeshBasic 3, isMeshDistanceMaterial-absent 3,
 * isMeshDepthMaterial-absent 3, isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3,
 * isShadowMaterial-absent 3, isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3,
 * isMeshLambertMaterial-absent 3, isMeshStandardMaterial-absent 3, linewidth-absent 3,
 * isRawShaderMaterial-absent 3, isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3,
 * fragmentShader-absent 3, vertexShader-absent 3, uniformsGroups-absent 3,
 * uniformsNeedUpdate-absent 3, uniforms-absent 3, defaultAttributeValues-absent 3,
 * index0AttributeName-absent 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13,
 * unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13,
 * matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3,
 * material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty
 * 10, mesh-userData-empty 13, isMeshNormalMaterial-absent 3, isLineBasicMaterial-absent 3,
 * isLineDashedMaterial-absent 3 stay vs v1.36.0. drawCallsEstimate stays 7.
 * isPointsMaterial-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are
 * requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require
 * 207/240 Hz.
 * v1.38.0 pins leftover Material isSpriteMaterial to the r170 MeshBasic absence
 * (material.isSpriteMaterial === undefined and Object.hasOwn(material, 'isSpriteMaterial') ===
 * false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured
 * isSpriteMaterial-absent 3) after the v1.37.0 isPointsMaterial pin.
 * pinColorOnlyUnlitBasicMaterialIsSpriteMaterial / pinColorOnlyVisualMaterialIsSpriteMaterial run
 * after pinColorOnlyVisualMaterialIsPointsMaterial on procedural create and packaged ingest,
 * including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the
 * same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer
 * delete material.isSpriteMaterial when the own property is present. Do not assign null, undefined,
 * false, or true. An already-absent isSpriteMaterial is left alone. Pin once per shared material
 * instance. Do not convert MeshBasic to SpriteMaterial or Sprite. Do not invent maps, lights,
 * rotation, sizeAttenuation, or envMap. Do not clear isSpriteMaterial on real SpriteMaterial (it
 * keeps constructor true and constructor sprite fields color / map / alphaMap / rotation /
 * sizeAttenuation / transparent / fog). Do not clear isPointsMaterial (v1.37.0
 * isPointsMaterial-absent 3 stays). Do not clear isLineDashedMaterial (v1.36.0
 * isLineDashedMaterial-absent 3 stays). Do not clear isLineBasicMaterial (v1.35.0
 * isLineBasicMaterial-absent 3 stays). Do not clear isMeshBasicMaterial or change type. Do not
 * touch isMeshNormalMaterial (v1.34.0 isMeshNormalMaterial-absent 3 stays). Do not touch
 * flatShading (the v0.82 false pin on packed MeshBasics stays). Do not touch isMeshDistanceMaterial
 * (v1.33.0 isMeshDistanceMaterial-absent 3 stays). Do not touch isMeshDepthMaterial (v1.32.0
 * isMeshDepthMaterial-absent 3 stays). Do not touch isMeshMatcapMaterial (v1.31.0
 * isMeshMatcapMaterial-absent 3 stays). Do not touch isMeshPhysicalMaterial (v1.30.0
 * isMeshPhysicalMaterial-absent 3 stays). Do not touch isShadowMaterial (v1.29.0
 * isShadowMaterial-absent 3 stays). Do not touch isMeshPhongMaterial (v1.28.0
 * isMeshPhongMaterial-absent 3 stays). Do not touch isMeshToonMaterial (v1.27.0
 * isMeshToonMaterial-absent 3 stays). Do not touch isMeshLambertMaterial (v1.26.0
 * isMeshLambertMaterial-absent 3 stays). Do not touch isMeshStandardMaterial (v1.25.0
 * isMeshStandardMaterial-absent 3 stays). Do not touch linewidth (v1.24.0 linewidth-absent 3
 * stays). Do not touch isRawShaderMaterial (v1.23.0 isRawShaderMaterial-absent 3 stays). Do not
 * touch isShaderMaterial (v1.22.0 isShaderMaterial-absent 3 stays). Do not touch clipping (v1.21.0
 * clipping-absent 3 stays). Do not touch lights (v1.20.0 lights-absent 3 stays). Do not touch
 * fragmentShader (v1.19.0 fragmentShader-absent 3 stays). Do not touch vertexShader (v1.18.0
 * vertexShader-absent 3 stays). Do not touch uniformsGroups (v1.17.0 uniformsGroups-absent 3
 * stays). Do not touch uniformsNeedUpdate (v1.16.0 uniformsNeedUpdate-absent 3 stays). Do not touch
 * uniforms (v1.15.0 uniforms-absent 3 stays). Do not touch defaultAttributeValues (v1.14.0
 * defaultAttributeValues-absent 3 stays). Do not touch index0AttributeName (v1.13.0
 * index0AttributeName-absent 3 stays). Do not touch depthPacking (v1.12.0 depthPacking-absent 3
 * stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect
 * (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
 * onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not
 * touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change
 * matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh
 * / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay),
 * BufferGeometry name / userData, BufferAttribute fields, prior Material program-cache / flag pins,
 * clippingPlanes, clipIntersection, clipShadows, wireframe, wireframeLinewidth, wireframeLinecap,
 * wireframeLinejoin, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Mapped /
 * lit / interleaved keep authored isSpriteMaterial. Collider meshes stay untouched. SpriteMaterial
 * keeps constructor isSpriteMaterial (true) and constructor sprite fields color / map / alphaMap /
 * rotation / sizeAttenuation / transparent / fog. PointsMaterial keeps constructor isPointsMaterial
 * (true) and constructor points fields color / map / alphaMap / size / sizeAttenuation / fog and
 * does not gain isSpriteMaterial. Checked installed three@0.170.0: fresh Material /
 * MeshBasicMaterial constructors do not assign isSpriteMaterial (isSpriteMaterial === undefined and
 * Object.hasOwn is false). MeshBasicMaterial assigns this.isMeshBasicMaterial = true only.
 * Material.js does not mention isSpriteMaterial. Material.copy and MeshBasicMaterial.copy do not
 * copy it. Material.setValues skips a key when this[key] === undefined, so new MeshBasicMaterial({
 * isSpriteMaterial: true }) warns and does not store isSpriteMaterial. SpriteMaterial extends
 * Material. The constructor assigns this.isSpriteMaterial = true, this.color = new Color(0xffffff),
 * this.map = null, this.alphaMap = null, this.rotation = 0, this.sizeAttenuation = true,
 * this.transparent = true, and this.fog = true. SpriteMaterial.copy calls super.copy(source),
 * copies color, map, alphaMap, rotation, sizeAttenuation, and fog, and does not assign
 * isSpriteMaterial (the constructor already set true). SpriteMaterial has no toJSON override.
 * Material.toJSON does not write isSpriteMaterial. Material.toJSON writes sizeAttenuation when
 * sizeAttenuation !== undefined, so a fresh SpriteMaterial (sizeAttenuation true) serializes
 * sizeAttenuation. Material.toJSON writes rotation only when rotation !== undefined and rotation
 * !== 0, so a fresh SpriteMaterial (rotation 0) does not serialize rotation. Material.toJSON writes
 * transparent when transparent === true, so a fresh SpriteMaterial (transparent true) serializes
 * transparent. Material.toJSON writes map only when map is a texture and alphaMap only when
 * alphaMap is a texture, so a fresh SpriteMaterial (map null, alphaMap null) does not serialize map
 * or alphaMap. Material.toJSON writes fog only when fog === false, so a fresh SpriteMaterial (fog
 * true) does not serialize fog. Material.toJSON writes color when color is a Color, so a fresh
 * SpriteMaterial serializes color 0xffffff. Material.toJSON comments that rotation is a
 * SpriteMaterial field. MaterialLoader does not parse isSpriteMaterial (it can construct
 * SpriteMaterial by type and parses rotation and sizeAttenuation). shaderID still comes from
 * shaderIDs[material.type]. MeshBasicMaterial maps to 'basic'. SpriteMaterial maps to 'sprite'.
 * When shaderID is set, vertexShader and fragmentShader still come from ShaderLib, so a leftover
 * isSpriteMaterial does not switch MeshBasic off 'basic'. isSpriteMaterial is not a
 * WebGLRenderer.materialNeedsLights term. That boolean chain was already walked
 * (isMeshLambertMaterial || isMeshToonMaterial || isMeshPhongMaterial || isMeshStandardMaterial ||
 * isShadowMaterial || (isShaderMaterial && lights === true)). v1.37.0 cleared isPointsMaterial, the
 * else-if immediately before isSpriteMaterial in refreshMaterialUniforms. The next leftover
 * Material type-flag in that order, after isPointsMaterial, is isSpriteMaterial (then Shadow,
 * Shader). This pulse does not delete isShadowMaterial or isShaderMaterial. A leftover own
 * isSpriteMaterial === true on a color-only MeshBasic does not by itself make needsLights true
 * while those earlier flags stay absent. Real SpriteMaterial does not assign isMeshStandardMaterial
 * or isShadowMaterial, so it also does not take needsLights from this flag.
 * WebGLMaterials.refreshMaterialUniforms checks isMeshBasicMaterial before isPointsMaterial, and
 * the isSpriteMaterial else-if comes after that points else-if. That else-if calls
 * refreshUniformsSprites(uniforms, material), which copies material.color into uniforms.diffuse and
 * material.opacity into uniforms.opacity, writes uniforms.rotation from material.rotation, writes
 * uniforms.map and mapTransform when material.map is set, writes uniforms.alphaMap and
 * alphaMapTransform when material.alphaMap is set, and writes uniforms.alphaTest when
 * material.alphaTest > 0. While isMeshBasicMaterial stays true, refresh still calls
 * refreshUniformsCommon on the MeshBasic branch and does not enter the sprite else-if, so it does
 * not call refreshUniformsSprites. A leftover own true is still not the r170 MeshBasic constructor
 * shape (fresh Material / MeshBasicMaterial leave the flag absent). Real SpriteMaterial keeps
 * constructor isSpriteMaterial true and leaves isMeshBasicMaterial absent, so refresh takes that
 * sprite else-if. Assigning null, undefined, false, or true stores an own property, which is not
 * the r170 MeshBasic absence. delete material.isSpriteMaterial removes the own property so the r170
 * absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts
 * 230 / 100 / 48, attrBytes 2820 / 1176 / 432 + fastener 216 (fastener draws 1, tris 12, unique
 * verts 24), unique MeshBasic 3, isMeshDistanceMaterial-absent 3, isMeshDepthMaterial-absent 3,
 * isMeshMatcapMaterial-absent 3, isMeshPhysicalMaterial-absent 3, isShadowMaterial-absent 3,
 * isMeshPhongMaterial-absent 3, isMeshToonMaterial-absent 3, isMeshLambertMaterial-absent 3,
 * isMeshStandardMaterial-absent 3, linewidth-absent 3, isRawShaderMaterial-absent 3,
 * isShaderMaterial-absent 3, clipping-absent 3, lights-absent 3, fragmentShader-absent 3,
 * vertexShader-absent 3, uniformsGroups-absent 3, uniformsNeedUpdate-absent 3, uniforms-absent 3,
 * defaultAttributeValues-absent 3, index0AttributeName-absent 3, depthPacking-absent 3,
 * extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13,
 * colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3,
 * material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty
 * 13, mesh-name-empty 10, mesh-userData-empty 13, isMeshNormalMaterial-absent 3,
 * isLineBasicMaterial-absent 3, isLineDashedMaterial-absent 3, isPointsMaterial-absent 3 stay vs
 * v1.37.0. drawCallsEstimate stays 7. isSpriteMaterial-absent 3 is the new count. Quest 3 90 Hz
 * (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR
 * still TODO. Do not require 207/240 Hz.
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
  pinColorOnlyVisualMaterialExtensions,
  pinColorOnlyVisualMaterialDepthPacking,
  pinColorOnlyVisualMaterialIndex0AttributeName,
  pinColorOnlyVisualMaterialDefaultAttributeValues,
  pinColorOnlyVisualMaterialUniforms,
  pinColorOnlyVisualMaterialUniformsNeedUpdate,
  pinColorOnlyVisualMaterialUniformsGroups,
  pinColorOnlyVisualMaterialVertexShader,
  pinColorOnlyVisualMaterialFragmentShader,
  pinColorOnlyVisualMaterialLights,
  pinColorOnlyVisualMaterialClipping,
  pinColorOnlyVisualMaterialIsShaderMaterial,
  pinColorOnlyVisualMaterialIsRawShaderMaterial,
  pinColorOnlyVisualMaterialLinewidth,
  pinColorOnlyVisualMaterialIsMeshStandardMaterial,
  pinColorOnlyVisualMaterialIsMeshLambertMaterial,
  pinColorOnlyVisualMaterialIsMeshToonMaterial,
  pinColorOnlyVisualMaterialIsMeshPhongMaterial,
  pinColorOnlyVisualMaterialIsShadowMaterial,
  pinColorOnlyVisualMaterialIsMeshPhysicalMaterial,
  pinColorOnlyVisualMaterialIsMeshMatcapMaterial,
  pinColorOnlyVisualMaterialIsMeshDepthMaterial,
  pinColorOnlyVisualMaterialIsMeshDistanceMaterial,
  pinColorOnlyVisualMaterialIsMeshNormalMaterial,
  pinColorOnlyVisualMaterialIsLineBasicMaterial,
  pinColorOnlyVisualMaterialIsLineDashedMaterial,
  pinColorOnlyVisualMaterialIsPointsMaterial,
  pinColorOnlyVisualMaterialIsSpriteMaterial,
  pinColorOnlyVisualMaterialBumpMap,
  pinColorOnlyVisualMaterialNormalMap,
  pinColorOnlyVisualMaterialDisplacementMap,
  pinColorOnlyVisualMaterialEmissiveMap,
  pinColorOnlyVisualMaterialMetalnessMap,
  pinColorOnlyVisualMaterialRoughnessMap,
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
  pinColorOnlyVisualMaterialExtensions(root);
  pinColorOnlyVisualMaterialDepthPacking(root);
  pinColorOnlyVisualMaterialIndex0AttributeName(root);
  pinColorOnlyVisualMaterialDefaultAttributeValues(root);
  pinColorOnlyVisualMaterialUniforms(root);
  pinColorOnlyVisualMaterialUniformsNeedUpdate(root);
  pinColorOnlyVisualMaterialUniformsGroups(root);
  pinColorOnlyVisualMaterialVertexShader(root);
  pinColorOnlyVisualMaterialFragmentShader(root);
  pinColorOnlyVisualMaterialLights(root);
  pinColorOnlyVisualMaterialClipping(root);
  pinColorOnlyVisualMaterialIsShaderMaterial(root);
  pinColorOnlyVisualMaterialIsRawShaderMaterial(root);
  pinColorOnlyVisualMaterialLinewidth(root);
  pinColorOnlyVisualMaterialIsMeshStandardMaterial(root);
  pinColorOnlyVisualMaterialIsMeshLambertMaterial(root);
  pinColorOnlyVisualMaterialIsMeshToonMaterial(root);
  pinColorOnlyVisualMaterialIsMeshPhongMaterial(root);
  pinColorOnlyVisualMaterialIsShadowMaterial(root);
  pinColorOnlyVisualMaterialIsMeshPhysicalMaterial(root);
  pinColorOnlyVisualMaterialIsMeshMatcapMaterial(root);
  pinColorOnlyVisualMaterialIsMeshDepthMaterial(root);
  pinColorOnlyVisualMaterialIsMeshDistanceMaterial(root);
  pinColorOnlyVisualMaterialIsMeshNormalMaterial(root);
  pinColorOnlyVisualMaterialIsLineBasicMaterial(root);
  pinColorOnlyVisualMaterialIsLineDashedMaterial(root);
  pinColorOnlyVisualMaterialIsPointsMaterial(root);
  pinColorOnlyVisualMaterialIsSpriteMaterial(root);
  pinColorOnlyVisualMaterialBumpMap(root);
  pinColorOnlyVisualMaterialNormalMap(root);
  pinColorOnlyVisualMaterialDisplacementMap(root);
  pinColorOnlyVisualMaterialEmissiveMap(root);
  pinColorOnlyVisualMaterialMetalnessMap(root);
  pinColorOnlyVisualMaterialRoughnessMap(root);
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

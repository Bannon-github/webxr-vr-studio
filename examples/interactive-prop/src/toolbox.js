import * as THREE from "three";
import behaviorTemplate from "./behavior.json" with { type: "json" };
import {
  L3_LOD0_BRASS_COLOR,
  L3_LOD0_STEEL_COLOR,
  L3_LOD0_WOOD_COLOR,
  L3_LOD1_BRASS_COLOR,
  L3_LOD1_WOOD_COLOR,
  L3_LOD2_WOOD_COLOR,
  getCrateL2Maps,
  mappedBasic,
} from "./pbr-maps.js";

/**
 * Procedural crate that follows ADR 0004: visual meshes, collider_* hulls,
 * and extras.studio-equivalent metadata on userData.studio.
 * Production swaps this for a GLB + sidecar; the component split stays.
 */

function std(spec) {
  return new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness,
    metalness: spec.metalness,
  });
}

function boxMesh(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function lodGroup(level) {
  const g = new THREE.Group();
  g.name = `lod${level}`;
  g.userData.lodLevel = level;
  return g;
}

function geometryAttrBytes(geo) {
  let bytes = 0;
  for (const name of Object.keys(geo.attributes)) {
    const arr = geo.getAttribute(name)?.array;
    if (arr) bytes += arr.byteLength;
  }
  if (geo.index?.array) bytes += geo.index.array.byteLength;
  return bytes;
}

function countGroupStats(group) {
  let tris = 0;
  let draws = 0;
  let verts = 0;
  let attrBytes = 0;
  group.traverse((o) => {
    if (!o.isMesh || o.userData.collider) return;
    const geo = o.geometry;
    if (!geo) return;
    const idx = geo.index;
    const pos = geo.getAttribute("position");
    if (idx) tris += idx.count / 3;
    else if (pos) tris += pos.count / 3;
    if (pos) verts += pos.count;
    attrBytes += geometryAttrBytes(geo);
    draws += 1;
  });
  return { tris, draws, verts, attrBytes };
}

/**
 * Concatenate BufferGeometries that share the same attributes.
 * Does not weld (call `weldCoincidentVertices` after) and does not
 * copy BoxGeometry per-face groups (those would multiply GPU draws
 * under a single material). Load-time only.
 */
function concatGeometries(geometries) {
  if (!geometries.length) return null;
  const first = geometries[0];
  const names = Object.keys(first.attributes);
  for (const g of geometries) {
    if (Object.keys(g.attributes).length !== names.length) return null;
    for (const name of names) {
      const a = g.getAttribute(name);
      const b = first.getAttribute(name);
      if (!a || a.itemSize !== b.itemSize) return null;
    }
    if (Boolean(g.index) !== Boolean(first.index)) return null;
  }

  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const proto = first.getAttribute(name);
    let length = 0;
    for (const g of geometries) length += g.getAttribute(name).array.length;
    const data = new proto.array.constructor(length);
    let offset = 0;
    for (const g of geometries) {
      const arr = g.getAttribute(name).array;
      data.set(arr, offset);
      offset += arr.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(data, proto.itemSize, proto.normalized));
  }

  if (first.index) {
    let total = 0;
    for (const g of geometries) total += g.index.count;
    const index = new Uint32Array(total);
    let offset = 0;
    let vertexOffset = 0;
    for (const g of geometries) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[offset + i] = src[i] + vertexOffset;
      offset += src.length;
      vertexOffset += g.getAttribute("position").count;
    }
    merged.setIndex(new THREE.BufferAttribute(index, 1));
  }
  return merged;
}

/**
 * Color-only unlit MeshBasic: no maps and no envMap (envMap samples
 * normals). Those materials do not read `uv` / `normal` / `tangent`.
 * Load-time only.
 */
export function isColorOnlyUnlitBasic(material) {
  if (!material || Array.isArray(material) || !material.isMeshBasicMaterial) return false;
  if (material.map || material.lightMap || material.aoMap) return false;
  if (material.specularMap || material.alphaMap || material.envMap) return false;
  return true;
}

/** Channels MeshBasic ignores when `isColorOnlyUnlitBasic` is true. */
export const COLOR_ONLY_UNUSED_ATTRS = Object.freeze(["normal", "uv", "uv1", "uv2", "uv3", "tangent"]);

/**
 * Drop unused BufferGeometry attributes on color-only unlit MeshBasic.
 * Keeps `position` (and `color` when `vertexColors` is set). Mapped or
 * lit materials are left intact. Mutates in place. Load-time only —
 * author may omit these in DCC; this is a safety net after merge/weld.
 */
export function stripUnusedColorOnlyAttributes(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  for (const name of COLOR_ONLY_UNUSED_ATTRS) {
    if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
  }
  if (!material.vertexColors && geometry.getAttribute("color")) {
    geometry.deleteAttribute("color");
  }
  return geometry;
}

/**
 * Copy a >16-bit index into Uint16 when `position.count` fits.
 * No-op when there is no index, verts exceed 65535, or the index is
 * already ≤2 bytes/element. Does not change triangle or vertex count.
 * Load-time only — a safety net when concat leaves Uint32 and weld
 * early-returns (`next === vertexCount`), or a packaged mesh arrives
 * with a 32-bit index.
 */
export function compactIndexToUint16(geometry) {
  if (!geometry) return geometry;
  const index = geometry.getIndex();
  if (!index?.array) return geometry;
  const pos = geometry.getAttribute("position");
  if (!pos || pos.count > 65535) return geometry;
  const src = index.array;
  if (!(src.BYTES_PER_ELEMENT > 2)) return geometry;
  const compact = new Uint16Array(src.length);
  compact.set(src);
  geometry.setIndex(new THREE.BufferAttribute(compact, 1));
  return geometry;
}

/**
 * Quantize `position` from Float32 to Float16 on color-only unlit MeshBasic.
 * Three r170 `Float16BufferAttribute` stores IEEE-754 binary16 bits in a
 * `Uint16Array`; `WebGLAttributes.createBuffer` then uploads as
 * `gl.HALF_FLOAT` when `isFloat16BufferAttribute` is set (WebGL2).
 *
 * **Verified r170 constructor trap (do not pass Float32Array through):**
 * `new Float16BufferAttribute(array, itemSize)` does
 * `super(new Uint16Array(array), …)` — that copies via ToUint16 truncation,
 * not `DataUtils.toHalfFloat`. Sub-1.0 crate positions would become 0.
 * Encode with `setXYZ` (r170 override calls `toHalfFloat`) or pass an
 * already-encoded `Uint16Array`.
 *
 * Recomputes bounding box/sphere from quantized `getX`/`getY`/`getZ`
 * (`Box3.setFromBufferAttribute` → `Vector3.fromBufferAttribute`) so
 * frustum culls match GPU verts **before** `onUpload` nulls `.array`.
 * Mapped / lit / morph / interleaved / non-Float32 positions are left
 * intact. Load-time only — not per-frame.
 */
export function quantizePositionToFloat16(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  if (Object.keys(geometry.morphAttributes || {}).length) return geometry;
  const pos = geometry.getAttribute("position");
  if (!pos || pos.isInterleavedBufferAttribute) return geometry;
  if (pos.isFloat16BufferAttribute) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  if (!(pos.array instanceof Float32Array) || pos.itemSize !== 3) return geometry;

  const quantized = new THREE.Float16BufferAttribute(pos.count * pos.itemSize, pos.itemSize, pos.normalized);
  for (let i = 0; i < pos.count; i++) {
    quantized.setXYZ(i, pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  geometry.setAttribute("position", quantized);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * After GPU upload, drop CPU typed arrays on color-only unlit MeshBasic
 * geometries (Three r170 `BufferAttribute.onUpload` / `onUploadCallback`).
 * r170 `WebGLAttributes.createBuffer` copies `.array` into `bufferData`
 * *before* the callback, then keeps that local for type detection — nulling
 * `.array` in the hook is safe. Sets `.usage` to `StaticDrawUsage` (already
 * the r170 default; explicit so packed geos stay static). Computes bounding
 * volumes first so later frustum culls do not need `.array`.
 *
 * Apply only to color-only MeshBasic. Mapped / lit / morph / interleaved
 * geometries are left intact. Colliders are not passed here — the pick
 * path uses collider AABB `userData.size`, not visual BufferGeometry
 * arrays, but collider wireframes may still need CPU arrays for debug
 * bounds. Load-time only — not per-frame.
 */
export function releaseCpuArraysOnGpuUpload(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  if (Object.keys(geometry.morphAttributes || {}).length) return geometry;
  const names = Object.keys(geometry.attributes);
  for (const name of names) {
    if (geometry.getAttribute(name)?.isInterleavedBufferAttribute) return geometry;
  }
  const index = geometry.getIndex();
  if (index?.isInterleavedBufferAttribute) return geometry;

  if (geometry.boundingBox === null) geometry.computeBoundingBox();
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

  const releaseArray = function releaseCpuArray() {
    this.array = null;
  };
  for (const name of names) {
    const attr = geometry.getAttribute(name);
    if (!attr?.isBufferAttribute) continue;
    attr.setUsage(THREE.StaticDrawUsage);
    attr.onUpload(releaseArray);
  }
  if (index?.isBufferAttribute) {
    index.setUsage(THREE.StaticDrawUsage);
    index.onUpload(releaseArray);
  }
  return geometry;
}

/**
 * Strip unused color-only attrs, compact a wasteful 32-bit index, quantize
 * Float32 `position` to Float16, then hook GPU-upload CPU-array release
 * on color-only unlit MeshBasic. Shared by procedural create (v0.37–v0.44)
 * and packaged ingest. v0.45 matrix freeze, v0.46 visual raycast
 * disable, v0.47 MeshBasic fog/toneMapped pin, v0.48 opaque
 * FrontSide draw-state fences, v0.49 Mesh castShadow /
 * receiveShadow pin, v0.50 Mesh frustumCulled pin, v0.51
 * MeshBasic blending/alpha pin, v0.52 MeshBasic
 * wireframe/colorWrite/depthFunc/polygonOffset pin,
 * v0.53 MeshBasic stencil pin, v0.54 MeshBasic
 * clipping pin, v0.55 MeshBasic alphaHash /
 * forceSinglePass pin, v0.56 MeshBasic NormalBlending
 * factor/equation companion pin, v0.57 MeshBasic
 * vertexColors pin, v0.58 MeshBasic precision pin,
 * v0.59 MeshBasic shadowSide pin, v0.60 Mesh
 * renderOrder pin, v0.61 MeshBasic visible pin,
 * v0.62 MeshBasic envMap companion pin,
 * v0.63 MeshBasic map-intensity companion pin,
 * v0.64 MeshBasic wireframeLinewidth pin, and
 * v0.65 MeshBasic wireframe line-style pin
 * are post-attach Object3D / material-state steps,
 * not geometry pack steps.
 */
export function packColorOnlyGeometry(geometry, material) {
  stripUnusedColorOnlyAttributes(geometry, material);
  compactIndexToUint16(geometry);
  quantizePositionToFloat16(geometry, material);
  releaseCpuArraysOnGpuUpload(geometry, material);
  return geometry;
}

/**
 * Scene names for L4/L5 animated pivots. Procedural create uses
 * `lid` / `latch` / `tool` (`lidPivot` / `latchPivot` are the JS
 * bindings). Packaged ingest also accepts `lidPivot` / `latchPivot`.
 */
export const ANIMATED_TOOLBOX_PIVOT_NAMES = Object.freeze(["lid", "lidPivot", "latch", "latchPivot", "tool"]);

const ANIMATED_PIVOT_NAME_SET = new Set(ANIMATED_TOOLBOX_PIVOT_NAMES);
const FASTENER_MESH_NAMES = new Set(["fastener", "fastenerMesh"]);

function isFastenerVisual(object, entity) {
  if (!object) return false;
  if (entity?.userData?.fastener?.mesh === object) return true;
  return FASTENER_MESH_NAMES.has(object.name);
}

/** True when `object` is an animated pivot or a descendant of one. */
export function isUnderAnimatedToolboxPivot(object, entity) {
  const parts = entity?.userData?.parts;
  const pivots = [];
  if (parts?.lidPivot) pivots.push(parts.lidPivot);
  if (parts?.latchPivot) pivots.push(parts.latchPivot);
  if (parts?.tool) pivots.push(parts.tool);
  let node = object;
  while (node) {
    if (pivots.includes(node)) return true;
    if (ANIMATED_PIVOT_NAME_SET.has(node.name)) return true;
    node = node.parent;
  }
  return false;
}

/**
 * After the entity is fully built and LODs attached, bake world
 * matrices once then freeze local-matrix auto-update on **static**
 * packed color-only unlit MeshBasic visual leaves.
 *
 * **Verified r170 API:** `Object3D.matrixAutoUpdate` (default true via
 * `DEFAULT_MATRIX_AUTO_UPDATE`); `updateMatrixWorld(force)` still
 * composes `matrixWorld = parent.matrixWorld * matrix` when force /
 * needsUpdate even if local auto-update is off. Do **not** set
 * `matrixWorldAutoUpdate` false — crate grab still needs world
 * matrices to follow the root.
 *
 * Skip colliders (pick AABB uses `updateWorldMatrix` + `userData.size`).
 * Skip meshes under lid/latch/tool pivots (L4 hinge / L5 extract).
 * Skip fastener: `applyFastenerVisual` writes `rotation.z` / `position.z`
 * on the mesh itself — freeze would stall L5 drive. Mapped / lit
 * materials stay live. Load-time only — not per-frame.
 */
export function freezeStaticColorOnlyWorldMatrices(entity) {
  if (!entity) return entity;
  entity.updateMatrixWorld(true);
  entity.traverse((o) => {
    if (!o.isMesh || o.userData.collider) return;
    if (o.name && o.name.startsWith("collider_")) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (isFastenerVisual(o, entity)) return;
    if (isUnderAnimatedToolboxPivot(o, entity)) return;
    o.matrixAutoUpdate = false;
  });
  return entity;
}

/**
 * Shared no-op for `Mesh.raycast`. Three r170
 * `Mesh.prototype.raycast(raycaster, intersects)` walks triangles and
 * pushes hits. Assigning this empty function returns without pushing.
 * Pick path (`firstHit` / `collectPickables`) uses collider AABB slabs
 * (`userData.size`), not visual `Mesh.raycast` — this is a CPU fence
 * if anything still calls triangle raycast on hero/LOD/fastener meshes.
 */
export function noopColorOnlyVisualRaycast(/* raycaster, intersects */) {}

function colorOnlyGeometryBlocksPack(geometry) {
  if (!geometry) return false;
  if (Object.keys(geometry.morphAttributes || {}).length) return true;
  for (const name of Object.keys(geometry.attributes || {})) {
    if (geometry.getAttribute(name)?.isInterleavedBufferAttribute) return true;
  }
  if (geometry.getIndex()?.isInterleavedBufferAttribute) return true;
  return false;
}

/**
 * After procedural create + LOD attach (and on packaged ingest of
 * packed color-only MeshBasic visuals), disable triangle raycast on
 * every color-only unlit MeshBasic visual mesh: LOD0/1/2 body +
 * lid/latch/tool meshes + fastener MeshBasic.
 *
 * **Verified r170 API:** `Mesh.prototype.raycast` is the default
 * identity (`new Mesh().raycast === Mesh.prototype.raycast`).
 * Assigning `mesh.raycast = noopColorOnlyVisualRaycast` is enough.
 *
 * **Verified pick path (ADR 0004 / photoreal-realtime):**
 * `collectPickables` gathers `userData.colliders` only;
 * `firstHit` slab-tests `userData.size`. No `intersectObjects`.
 * Hover/grab do not need visual mesh raycast.
 *
 * Skip colliders even if they are MeshBasic debug hulls — leave
 * default `Mesh.prototype.raycast` intact. Skip mapped / lit /
 * morph / interleaved (same color-only unlit MeshBasic gate as the
 * pack pipeline). Fastener is a visual MeshBasic — disable it too
 * (L5 drive is transform writes, not mesh raycast). Load-time only.
 */
export function disableColorOnlyVisualRaycast(entity) {
  if (!entity) return entity;
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.collider) return;
    if (o.name && o.name.startsWith("collider_")) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (colorOnlyGeometryBlocksPack(o.geometry)) return;
    o.raycast = noopColorOnlyVisualRaycast;
  });
  return entity;
}

/**
 * Pin Quest-safe MeshBasic flags on a color-only unlit MeshBasic.
 *
 * **Verified r170 API:** `new MeshBasicMaterial().fog === true` and
 * `.toneMapped === true` (`Material` defaults; MeshBasic does not
 * override them). Unlit midtone stand-ins should not pay fog
 * varyings/uniforms or lookdev ACES wash. Present path already uses
 * `NoToneMapping` while immersive (v0.17); lookdev still uses ACES
 * — `toneMapped = false` keeps authored midtones stable. `fog =
 * false` drops fog from the MeshBasic program when `scene.fog` is
 * set later.
 *
 * **Verified r170 API (opaque FrontSide):** a fresh
 * `MeshBasicMaterial` is already `transparent === false`,
 * `opacity === 1`, `depthWrite === true`, `depthTest === true`,
 * `side === FrontSide` (0). Accidental DoubleSide or
 * transparent/alpha from DCC / packaged GLBs doubles fill or
 * forces blending on a TBDR mobile GPU. Pin those five as the
 * unlit midtone stand-in contract. Load-time only — not per-frame.
 *
 * **Verified r170 API (blending / alpha):** a fresh
 * `MeshBasicMaterial` is already `blending === NormalBlending`,
 * `premultipliedAlpha === false`, `alphaTest === 0`,
 * `dithering === false`, `alphaToCoverage === false`
 * (`Material` defaults). Accidental CustomBlending /
 * AdditiveBlending / premultiply / alphaTest from DCC / packaged
 * GLBs forces blend or discard paths on a TBDR mobile GPU. Pin
 * those as the rest of the opaque unlit contract v0.48 started.
 * Load-time only — not per-frame.
 *
 * **Verified r170 API (wireframe / colorWrite / depthFunc /
 * polygonOffset):** a fresh `MeshBasicMaterial` is already
 * `wireframe === false` (MeshBasic default), `colorWrite === true`,
 * `depthFunc === LessEqualDepth` (3), `polygonOffset === false`,
 * `polygonOffsetFactor === 0`, `polygonOffsetUnits === 0`
 * (`Material` defaults except wireframe). Accidental wireframe /
 * colorWrite-off / non-LessEqual depthFunc / polygonOffset from
 * DCC / packaged GLBs forces extra fragment or depth work on a
 * TBDR mobile GPU. Pin those as the remaining r170 opaque GPU-state
 * fence after v0.51 blending/alpha. Load-time only — not per-frame.
 *
 * **Verified r170 API (stencil):** a fresh `MeshBasicMaterial` is
 * already `stencilWrite === false`, `stencilFunc ===
 * AlwaysStencilFunc` (519), `stencilRef === 0`,
 * `stencilWriteMask === 0xff`, `stencilFuncMask === 0xff`,
 * `stencilFail === KeepStencilOp` (7680), `stencilZFail ===
 * KeepStencilOp`, `stencilZPass === KeepStencilOp` (`Material`
 * defaults). Accidental DCC / packaged GLB `stencilWrite=true` (or
 * non-Always func / non-Keep ops) forces stencil test/write on a
 * TBDR mobile GPU. Pin r170 defaults as the Quest-safe unlit
 * contract after v0.52 GPU-state. Load-time only — not per-frame.
 *
 * **Verified r170 API (clipping):** a fresh `MeshBasicMaterial` is
 * already `clippingPlanes === null`, `clipIntersection === false`,
 * `clipShadows === false` (`Material` defaults). Accidental DCC /
 * packaged GLB non-null `clippingPlanes` / `clipIntersection` /
 * `clipShadows` forces clipping-plane fragment work on a TBDR
 * mobile GPU. Pin r170 defaults as the Quest-safe unlit contract
 * after v0.53 stencil. Load-time only — not per-frame.
 *
 * **Verified r170 API (alphaHash / forceSinglePass):** a fresh
 * `MeshBasicMaterial` is already `alphaHash === false` and
 * `forceSinglePass === false` (`Material` defaults). Accidental
 * DCC / packaged GLB `alphaHash=true` forces a stochastic discard
 * path; `forceSinglePass=true` can change multi-pass material
 * behavior. Pin r170 defaults as the Quest-safe unlit contract
 * after v0.54 clipping. Load-time only — not per-frame.
 *
 * **Verified r170 API (NormalBlending factor/equation companions):**
 * a fresh `MeshBasicMaterial` is already `blendSrc ===
 * SrcAlphaFactor` (204), `blendDst === OneMinusSrcAlphaFactor`
 * (205), `blendEquation === AddEquation` (100), and
 * `blendSrcAlpha` / `blendDstAlpha` / `blendEquationAlpha` ===
 * `null` (`Material` defaults). Accidental DCC / packaged GLB
 * CustomBlending leftovers still sit on the material even when
 * `blending` is restored to NormalBlending. Pin r170 NormalBlending
 * companions as the Quest-safe opaque unlit contract after v0.51
 * blending mode + v0.55 alphaHash. Load-time only — not per-frame.
 *
 * **Verified r170 API (vertexColors):** a fresh `MeshBasicMaterial`
 * is already `vertexColors === false` (`Material` default).
 * Accidental DCC / packaged GLB `vertexColors = true` leftovers
 * force a color-attribute shader variant on a TBDR mobile GPU even
 * when maps are absent (still passes `isColorOnlyUnlitBasic`).
 * `stripUnusedColorOnlyAttributes` already drops `color` when
 * `!material.vertexColors` — pinning false makes that strip
 * reliably apply after DCC leftovers. Pin r170 default as the
 * Quest-safe unlit contract after v0.56 NormalBlending companions.
 * Load-time only — not per-frame.
 *
 * **Verified r170 API (precision):** a fresh `MeshBasicMaterial`
 * is already `precision === null` (`Material` default). Accidental
 * DCC / packaged GLB `precision = 'highp'` (or other string)
 * leftovers force a non-renderer precision on a TBDR mobile GPU
 * even when maps are absent (still passes `isColorOnlyUnlitBasic`).
 * Pin r170 default `null` so Quest Browser / the WebGLRenderer
 * choose precision. Do not force `'mediump'` / `'lowp'` /
 * `'highp'` strings. Load-time only — not per-frame.
 *
 * **Verified r170 API (shadowSide):** a fresh `MeshBasicMaterial`
 * is already `shadowSide === null` (`Material` default). When
 * null, shadow casting side derives from `side`. Accidental
 * DCC / packaged GLB `shadowSide = FrontSide` / `BackSide` /
 * `DoubleSide` leftovers force a non-`side` shadow-cast face
 * even when maps are absent (still passes
 * `isColorOnlyUnlitBasic`). Pin r170 default `null` so shadow
 * side follows `side` (already FrontSide on these stand-ins).
 * Mesh-level `castShadow` / `receiveShadow` stay pinned false
 * (v0.49) — this is the matching **material** fence, not a
 * mesh change. Do not force a non-null shadowSide. Load-time
 * only — not per-frame.
 *
 * **Verified r170 API (visible):** a fresh `MeshBasicMaterial`
 * is already `visible === true` (`Material` default). Accidental
 * DCC / packaged GLB `visible = false` leftovers hide draws
 * without using LOD `mesh.visible` (still passes
 * `isColorOnlyUnlitBasic`). Pin r170 default `true` so the
 * Quest-safe opaque unlit stand-in actually draws. Do **not**
 * pin `mesh.visible` — LOD visibility uses it. Do not force
 * `material.visible = false`. Load-time only — not per-frame.
 *
 * **Verified r170 API (envMap companions):** a fresh
 * `MeshBasicMaterial` is already `combine ===
 * MultiplyOperation` (0), `reflectivity === 1`, and
 * `refractionRatio === 0.98` (`MeshBasicMaterial` defaults;
 * `REVISION` 170). `isColorOnlyUnlitBasic` already requires
 * `envMap` to be falsy — this pulse does not change that
 * gate and does not attach or force an envMap. Accidental
 * DCC / packaged GLB `combine = MixOperation` /
 * `AddOperation`, non-1 `reflectivity`, or non-0.98
 * `refractionRatio` leftovers still sit on the material
 * even when `envMap` is null (still passes
 * `isColorOnlyUnlitBasic`). Pin r170 MeshBasic envMap
 * companions as the Quest-safe unlit contract after v0.61
 * visible. Do not force envMap or attach maps. Load-time
 * only — not per-frame.
 *
 * **Verified r170 API (map-intensity companions):** a fresh
 * `MeshBasicMaterial` is already `lightMapIntensity === 1`
 * and `aoMapIntensity === 1` (`MeshBasicMaterial` defaults;
 * `REVISION` 170). `isColorOnlyUnlitBasic` already requires
 * `lightMap` / `aoMap` (and the other maps) to be falsy —
 * this pulse does not change that gate and does not attach
 * or force a lightMap / aoMap. Accidental DCC / packaged
 * GLB `lightMapIntensity !== 1` or `aoMapIntensity !== 1`
 * leftovers still sit on the material even when maps are
 * already gated null (still passes
 * `isColorOnlyUnlitBasic`). Pin r170 MeshBasic
 * map-intensity companions as the Quest-safe unlit
 * contract after v0.62 envMap companions. Do not force
 * lightMap / aoMap or attach maps. Load-time only — not
 * per-frame.
 *
 * **Verified r170 API (wireframeLinewidth):** a fresh
 * `MeshBasicMaterial` is already `wireframeLinewidth === 1`
 * (`MeshBasicMaterial` default; `REVISION` 170). v0.52
 * already pins `wireframe = false`. Accidental DCC /
 * packaged GLB `wireframeLinewidth !== 1` leftovers can
 * still sit on color-only unlit stand-ins even when
 * `wireframe === false` (still passes
 * `isColorOnlyUnlitBasic`). Most WebGL implementations
 * only support linewidth 1; non-1 leftovers are unused
 * noise and can confuse DCC round-trips. Pin r170
 * MeshBasic `wireframeLinewidth = 1` as the Quest-safe
 * unlit contract after v0.63 map-intensity companions.
 * Do **not** enable wireframe. Do **not** pin
 * `mesh.visible`. Load-time only — not per-frame.
 *
 * **Verified r170 API (wireframe line style):** a fresh
 * `MeshBasicMaterial` is already `wireframeLinecap ===
 * 'round'` and `wireframeLinejoin === 'round'`
 * (`MeshBasicMaterial` defaults; `REVISION` 170). v0.52
 * already pins `wireframe = false`. Accidental DCC /
 * packaged GLB `wireframeLinecap` / `wireframeLinejoin`
 * leftovers (e.g. `'butt'` / `'miter'`) can still sit
 * on color-only unlit stand-ins even when
 * `wireframe === false` (still passes
 * `isColorOnlyUnlitBasic`). WebGL ignores them for
 * filled triangles, but non-defaults are unused noise
 * and can confuse DCC round-trips. Pin r170 MeshBasic
 * `wireframeLinecap = 'round'` /
 * `wireframeLinejoin = 'round'` as the Quest-safe
 * unlit contract after v0.64 wireframeLinewidth. Do
 * **not** enable wireframe. Do **not** pin
 * `mesh.visible`. Load-time only — not per-frame.
 *
 * **Verified r170 API (envMapRotation):** a fresh
 * `MeshBasicMaterial` already has `envMapRotation` as
 * an Euler instance at `(0, 0, 0)` with
 * `order === 'XYZ'` (`new Euler()` /
 * `Euler.DEFAULT_ORDER`; `REVISION` 170).
 * `isColorOnlyUnlitBasic` already requires `envMap` to
 * be falsy — this pulse does not change that gate and
 * does not attach or force an envMap. Accidental DCC /
 * packaged GLB leftover non-zero `envMapRotation`
 * still sits on the material even when `envMap` is
 * null (still passes `isColorOnlyUnlitBasic`). Pin
 * r170 MeshBasic `envMapRotation.x/y/z = 0` (and
 * verified `order = 'XYZ'`) as the Quest-safe unlit
 * contract after v0.65 wireframe line style. Keep the
 * existing Euler instance — do **not** replace it
 * with a new Euler. Do **not** enable wireframe. Do
 * **not** pin `mesh.visible`. Load-time only — not
 * per-frame.
 *
 * **Verified r170 API (CustomBlending color/alpha companions):**
 * a fresh `MeshBasicMaterial` already has `blendColor`
 * as a Color instance at `(0, 0, 0)` and
 * `blendAlpha === 0` (`Material` ctor
 * `blendColor = new Color(0, 0, 0)` /
 * `blendAlpha = 0`; `REVISION` 170). These only
 * affect CustomBlending paths. v0.51 already pins
 * `blending = NormalBlending`; v0.56 already pins
 * NormalBlending factor/equation companions. Accidental
 * DCC / packaged GLB leftover non-default
 * `blendColor` / `blendAlpha` still sit on the
 * material even when `blending` is NormalBlending
 * (still passes `isColorOnlyUnlitBasic`) and can leak
 * into a later blend-mode change. Pin r170 Material
 * `blendColor.r/g/b = 0` and `blendAlpha = 0` as the
 * Quest-safe unlit contract after v0.67 Object3D layers
 * (and after the v0.56 factor/equation companions).
 * Keep the existing Color instance — do **not**
 * replace it with a new `Color()`. Do **not** enable
 * CustomBlending or change `blending` away from
 * NormalBlending. Do **not** pin `mesh.visible`.
 * Load-time only — not per-frame.
 *
 * **Verified r170 API (dithering / alphaToCoverage):**
 * a fresh `MeshBasicMaterial` is already
 * `dithering === false` and
 * `alphaToCoverage === false` (`Material`
 * defaults; `REVISION` 170). v0.51 already
 * assigned these as blending/alpha companions,
 * but they were not first-class measured
 * flags. Accidental DCC / packaged GLB leftover
 * `dithering = true` can add fragment cost on
 * a TBDR mobile GPU for opaque unlit midtones
 * that do not need it. Accidental
 * `alphaToCoverage = true` expects MSAA
 * coverage samples and can produce wrong
 * edges / wasted work on Quest Browser paths
 * that are not relying on A2C for these
 * stand-ins. Pin r170 Material
 * `dithering = false` /
 * `alphaToCoverage = false` as the
 * Quest-safe unlit contract after v0.71
 * Object3D scale (and after the v0.68
 * blendColor / blendAlpha material fence /
 * v0.53 stencil suite). Still passes
 * `isColorOnlyUnlitBasic`. Do **not** pin
 * `mesh.visible`. Load-time only — not
 * per-frame.
 *
 * **Verified r170 API (polygonOffset companions):**
 * a fresh `MeshBasicMaterial` is already
 * `polygonOffset === false`,
 * `polygonOffsetFactor === 0`, and
 * `polygonOffsetUnits === 0`
 * (`Material` defaults; `REVISION` 170).
 * v0.52 already assigned these as GPU-state
 * companions, but `polygonOffsetFactor` /
 * `polygonOffsetUnits` were not first-class
 * measured flags. Accidental DCC /
 * packaged GLB leftover non-zero
 * `polygonOffsetFactor` /
 * `polygonOffsetUnits` can still sit on
 * color-only unlit midtone stand-ins even
 * when `polygonOffset === false` (still
 * passes `isColorOnlyUnlitBasic`). When
 * offset is off they are unused GPU state
 * noise and can confuse DCC round-trips;
 * if offset were later flipped on,
 * leftovers would bias depth on a TBDR
 * mobile GPU. Pin r170 Material
 * `polygonOffset = false` /
 * `polygonOffsetFactor = 0` /
 * `polygonOffsetUnits = 0` as the
 * Quest-safe unlit contract after v0.73
 * Object3D rotation.order (and after the
 * v0.72 dithering / A2C material fence).
 * Do **not** enable `polygonOffset`. Do
 * **not** invent non-zero factors/units.
 * Do **not** pin `mesh.visible`.
 * Load-time only — not per-frame.
 *
 * **Verified r170 API (stencil companions):**
 * a fresh `MeshBasicMaterial` is already
 * `stencilWrite === false`,
 * `stencilFunc === AlwaysStencilFunc`
 * (519), `stencilRef === 0`,
 * `stencilWriteMask === 0xff`,
 * `stencilFuncMask === 0xff`,
 * `stencilFail === KeepStencilOp`
 * (7680), `stencilZFail ===
 * KeepStencilOp`, and
 * `stencilZPass === KeepStencilOp`
 * (`Material` defaults; `REVISION` 170).
 * v0.53 already assigned the full
 * stencil suite, but measured
 * `stencilWrite` / `stencilFunc` /
 * `stencilFail` in the short form —
 * `stencilRef` / masks / `stencilZFail`
 * / `stencilZPass` were not first-class
 * measured flags. Accidental DCC /
 * packaged GLB leftover non-zero
 * `stencilRef` / non-0xff masks /
 * non-Keep `stencilZFail` /
 * `stencilZPass` can still sit on
 * color-only unlit midtone stand-ins
 * even when `stencilWrite === false`
 * (still passes
 * `isColorOnlyUnlitBasic`). When
 * stencil write is off they are unused
 * GPU state noise and can confuse DCC
 * round-trips; if stencil write were
 * later flipped on, leftovers would
 * test/write the stencil buffer on a
 * TBDR mobile GPU. Pin r170 Material
 * `stencilRef = 0` /
 * `stencilWriteMask = 0xff` /
 * `stencilFuncMask = 0xff` /
 * `stencilZFail = KeepStencilOp` /
 * `stencilZPass = KeepStencilOp` as
 * the Quest-safe unlit contract after
 * v0.74 polygonOffset companions (and
 * after the v0.53 short-form stencil
 * fence). Do **not** enable stencil
 * write. Do **not** invent non-Always
 * func / non-Keep ops / non-zero ref /
 * non-0xff masks. Do **not** pin
 * `mesh.visible`. Load-time only —
 * not per-frame.
 *
 * **Verified r170 API (Material shader /
 * callback fence):** a fresh
 * `MeshBasicMaterial` / `Material`
 * does **not** define
 * `onBeforeCompile` or
 * `onBeforeRender` as own properties
 * (`Object.hasOwn` is false;
 * `REVISION` 170). Both exist as
 * empty no-ops on
 * `Material.prototype`. Material has
 * **no** `onAfterRender`.
 * WebGLRenderer always invokes
 * `material.onBeforeRender`
 * (per-draw, no presence check) and
 * `material.onBeforeCompile` (on
 * program compile, no presence
 * check). `customProgramCacheKey()`
 * returns
 * `this.onBeforeCompile.toString()`,
 * so leftover own-property compile
 * stubs can also fragment the
 * program cache. Accidental DCC /
 * packaged GLB leftover own-property
 * stubs therefore become
 * compile/per-draw JS work on Quest
 * Browser / TBDR. After v0.77
 * cleared leftover Mesh
 * `onBeforeRender` / `onAfterRender`
 * (and after the long material-flag
 * fence through v0.75 stencil
 * companions / v0.74 polygonOffset
 * companions / v0.72 dithering+A2C),
 * delete leftover own-property
 * Material `onBeforeCompile` /
 * `onBeforeRender` so the r170
 * Material.prototype empty no-ops
 * remain. Still passes
 * `isColorOnlyUnlitBasic`. Do **not**
 * invent replacement callbacks or
 * custom shaders. Do **not** assign
 * `undefined` (that would throw). Do
 * **not** touch Mesh
 * `onBeforeRender` / `onAfterRender`
 * (v0.77). Do **not** touch
 * `onBeforeShadow` / `onAfterShadow`.
 * Do **not** pin `mesh.visible`.
 * Load-time only — not per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe.
 */
export function pinColorOnlyUnlitBasicMaterialRenderCallbacks(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  delete material.onBeforeCompile;
  delete material.onBeforeRender;
  return material;
}

/**
 * Pin Quest-safe Material flags on a packed color-only unlit MeshBasic
 * visual material, then run
 * `pinColorOnlyUnlitBasicMaterialRenderCallbacks` so leftover
 * own-property `onBeforeCompile` / `onBeforeRender` are deleted.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe. Load-time only — not per-frame.
 */
export function pinColorOnlyUnlitBasicFlags(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  material.fog = false;
  material.toneMapped = false;
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
  material.depthTest = true;
  material.side = THREE.FrontSide;
  material.blending = THREE.NormalBlending;
  material.premultipliedAlpha = false;
  material.alphaTest = 0;
  material.dithering = false;
  material.alphaToCoverage = false;
  material.wireframe = false;
  material.colorWrite = true;
  material.depthFunc = THREE.LessEqualDepth;
  material.polygonOffset = false;
  material.polygonOffsetFactor = 0;
  material.polygonOffsetUnits = 0;
  material.stencilWrite = false;
  material.stencilFunc = THREE.AlwaysStencilFunc;
  material.stencilRef = 0;
  material.stencilWriteMask = 0xff;
  material.stencilFuncMask = 0xff;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
  material.clippingPlanes = null;
  material.clipIntersection = false;
  material.clipShadows = false;
  material.alphaHash = false;
  material.forceSinglePass = false;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneMinusSrcAlphaFactor;
  material.blendEquation = THREE.AddEquation;
  material.blendSrcAlpha = null;
  material.blendDstAlpha = null;
  material.blendEquationAlpha = null;
  material.vertexColors = false;
  material.precision = null;
  material.shadowSide = null;
  material.visible = true;
  material.combine = THREE.MultiplyOperation;
  material.reflectivity = 1;
  material.refractionRatio = 0.98;
  material.lightMapIntensity = 1;
  material.aoMapIntensity = 1;
  material.wireframeLinewidth = 1;
  material.wireframeLinecap = "round";
  material.wireframeLinejoin = "round";
  // Keep the existing Euler instance — do not replace it.
  if (material.envMapRotation) {
    material.envMapRotation.x = 0;
    material.envMapRotation.y = 0;
    material.envMapRotation.z = 0;
    material.envMapRotation.order = "XYZ";
  }
  // Keep the existing Color instance — do not replace it.
  if (material.blendColor) {
    material.blendColor.r = 0;
    material.blendColor.g = 0;
    material.blendColor.b = 0;
  }
  material.blendAlpha = 0;
  pinColorOnlyUnlitBasicMaterialRenderCallbacks(material);
  return material;
}

/**
 * After materials are shared (procedural) or color-only MeshBasics
 * are detected (packaged ingest), pin fog/toneMapped, opaque
 * FrontSide, blending/alpha, remaining r170 Material GPU-state
 * (wireframe / colorWrite / depthFunc / polygonOffset), r170
 * Material stencil defaults, r170 Material clipping defaults,
 * r170 Material alphaHash / forceSinglePass defaults, r170
 * NormalBlending factor/equation companions, r170 Material
 * vertexColors = false, r170 Material precision = null,
 * r170 Material shadowSide = null, r170 Material
 * visible = true, r170 MeshBasic envMap companions
 * (`combine = MultiplyOperation`, `reflectivity = 1`,
 * `refractionRatio = 0.98`), r170 MeshBasic
 * map-intensity companions (`lightMapIntensity = 1`,
 * `aoMapIntensity = 1`), r170 MeshBasic
 * `wireframeLinewidth = 1`, r170 MeshBasic
 * wireframe line-style defaults
 * (`wireframeLinecap = 'round'`,
 * `wireframeLinejoin = 'round'`), r170
 * MeshBasic `envMapRotation` `(0, 0, 0)` /
 * `order = 'XYZ'` (existing Euler instance;
 * does not force envMap), and r170 Material
 * CustomBlending color/alpha companions
 * (`blendColor` `(0, 0, 0)` existing Color
 * instance; `blendAlpha = 0`; does not enable
 * CustomBlending), r170 Material
 * dithering / alphaToCoverage defaults
 * (`dithering = false`,
 * `alphaToCoverage = false`), and r170
 * Material polygonOffset companions
 * (`polygonOffset = false`,
 * `polygonOffsetFactor = 0`,
 * `polygonOffsetUnits = 0`; does not
 * enable polygonOffset), and r170
 * Material stencil companions
 * (`stencilRef = 0`,
 * `stencilWriteMask = 0xff`,
 * `stencilFuncMask = 0xff`,
 * `stencilZFail = KeepStencilOp`,
 * `stencilZPass = KeepStencilOp`;
 * does not enable stencil write),
 * and r170 Material shader/callback
 * absence (`onBeforeCompile` /
 * `onBeforeRender` leftover
 * own-properties deleted so the
 * Material.prototype empty no-ops
 * remain; does not invent
 * replacement callbacks; does not
 * assign `undefined`)
 * on every unique packed color-only unlit MeshBasic visual material.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Does not invent materials. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMaterialFlags(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  const seen = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.collider) return;
    if (o.name && o.name.startsWith("collider_")) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (colorOnlyGeometryBlocksPack(o.geometry)) return;
    if (blockedMaterials.has(o.material)) return;
    if (seen.has(o.material)) return;
    seen.add(o.material);
    pinColorOnlyUnlitBasicFlags(o.material);
  });
  return entity;
}

/**
 * Pin Quest-safe shadow flags on a packed color-only unlit MeshBasic
 * visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` is already
 * `castShadow === false` and `receiveShadow === false`
 * (`Object3D` defaults). Accidental DCC / packaged GLB flags of
 * true still force WebGLRenderer shadow-map work when a light
 * later has `castShadow`. Pin both false as the unlit midtone
 * stand-in contract. Load-time only — not per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline / material
 * pin helpers. Does not invent meshes or enable shadows elsewhere.
 */
export function pinColorOnlyUnlitBasicShadowFlags(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/**
 * After materials are pinned (procedural share / packaged detect),
 * pin `castShadow = false` and `receiveShadow = false` on every
 * packed color-only unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualShadowFlags(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicShadowFlags(o);
  });
  return entity;
}

/**
 * Pin Quest-safe frustum culling on a packed color-only unlit
 * MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` is already
 * `frustumCulled === true` (`Object3D` default). Accidental DCC /
 * packaged GLB `frustumCulled = false` forces WebGLRenderer to
 * skip GPU frustum rejection and always draw that mesh. Pin true
 * as the unlit midtone stand-in contract. Load-time only — not
 * per-frame. Does **not** disable culling, invert it, or invent
 * a custom culling strategy.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline / shadow
 * pin helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicFrustumCulled(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.frustumCulled = true;
  return mesh;
}

/**
 * After shadow flags are pinned (procedural share / packaged
 * detect), pin `frustumCulled = true` on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves + lid/latch/tool
 * + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualFrustumCulled(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicFrustumCulled(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D renderOrder on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` is already
 * `renderOrder === 0` (`Object3D` default). Accidental DCC /
 * packaged GLB non-zero `renderOrder` forces WebGLRenderer into
 * separate opaque/transparent sort buckets and can break
 * batching even when materials are already Quest-safe opaque
 * unlit stand-ins. Pin r170 default `0` as the unlit midtone
 * stand-in contract. Load-time only — not per-frame. Does
 * **not** pin `mesh.visible` (LOD visibility uses it), change
 * `layers`, change `matrixWorldAutoUpdate`, invent custom
 * shaders, or force a non-zero renderOrder.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled pin helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicRenderOrder(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.renderOrder = 0;
  return mesh;
}

/**
 * After frustumCulled is pinned (procedural share / packaged
 * detect), pin `renderOrder = 0` on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves + lid/latch/tool
 * + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualRenderOrder(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicRenderOrder(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D layers on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` already
 * has `layers.mask === 1` (only layer 0 enabled —
 * `layers.isEnabled(0) === true`; `REVISION` 170). Accidental
 * DCC / packaged GLB leftover non-default layer masks can hide
 * draws from the default camera (layer 0) or force unexpected
 * multi-layer membership. Pin r170 default membership: only
 * layer 0 enabled. Keep the existing `mesh.layers` Layers
 * instance — do **not** replace it with a new `Layers()`.
 * `layers.set(0)` is equivalent to `layers.mask = 1` on a
 * fresh Object3D. Load-time only — not per-frame. Does
 * **not** pin `mesh.visible` (LOD visibility uses it), change
 * `matrixWorldAutoUpdate` / `matrixAutoUpdate`, enable extra
 * camera/layers tricks, invent a custom layer mask, or invent
 * a layer-based culling strategy.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder pin helpers. Does not
 * invent meshes.
 */
export function pinColorOnlyUnlitBasicLayers(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.layers.set(0);
  return mesh;
}

/**
 * After renderOrder is pinned (procedural share / packaged
 * detect), pin r170 Object3D layers default (layer 0 only)
 * on every packed color-only unlit MeshBasic visual mesh
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualLayers(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicLayers(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D matrixWorldAutoUpdate on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` already
 * has `matrixWorldAutoUpdate === true`
 * (`Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE`; `REVISION`
 * 170). Accidental DCC / packaged GLB leftover
 * `matrixWorldAutoUpdate = false` stalls automatic
 * world-matrix updates from animated parents even when the
 * local `matrixAutoUpdate` policy is intentional (v0.45
 * freezes `matrixAutoUpdate` on static body LOD leaves
 * after one `updateMatrixWorld(true)`; lid/latch/tool/
 * fastener stay live). Pin r170 default `true` as the
 * unlit midtone stand-in contract. Load-time only — not
 * per-frame. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change `matrixAutoUpdate`, change
 * `layers`, change `blendColor` / `blendAlpha`, invent
 * custom shaders, or force `matrixWorldAutoUpdate` false.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers pin
 * helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.matrixWorldAutoUpdate = true;
  return mesh;
}

/**
 * After layers is pinned (procedural share / packaged
 * detect), pin r170 Object3D `matrixWorldAutoUpdate = true`
 * on every packed color-only unlit MeshBasic visual mesh
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMatrixWorldAutoUpdate(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicMatrixWorldAutoUpdate(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D up on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` already
 * has `up` `(0, 1, 0)` (`Object3D.DEFAULT_UP`; `REVISION`
 * 170). Accidental DCC / packaged GLB leftover non-Y-up
 * `up` vectors (common Z-up exporter leftovers such as
 * `(0, 0, 1)`) can skew Object3D `lookAt` and related
 * orientation helpers even when local transforms are
 * intentional. Pin r170 default `(0, 1, 0)` as the unlit
 * midtone stand-in contract. Keep the existing `mesh.up`
 * Vector3 instance — do **not** replace it with
 * `Object3D.DEFAULT_UP.clone()` or `new Vector3()`.
 * Load-time only — not per-frame. Does **not** pin
 * `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body
 * LOD leaves), change `matrixWorldAutoUpdate`, change
 * `layers`, change `blendColor` / `blendAlpha`, invent
 * custom shaders, or invent a custom up vector.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate pin helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicUp(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  if (mesh.up) {
    mesh.up.x = 0;
    mesh.up.y = 1;
    mesh.up.z = 0;
  }
  return mesh;
}

/**
 * After matrixWorldAutoUpdate is pinned (procedural share /
 * packaged detect), pin r170 Object3D `up` `(0, 1, 0)`
 * (`Object3D.DEFAULT_UP`) on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualUp(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicUp(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D scale on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` already
 * has `scale` `(1, 1, 1)` (`REVISION` 170). Accidental
 * DCC / packaged GLB leftover non-unit / negative /
 * non-uniform `scale` (common non-uniform bake, negative
 * axis flip, or non-1 uniform leftovers) can invert face
 * winding under FrontSide culling (missing draws) and
 * skew world-matrix composition even when local
 * position/rotation are intentional. Pin r170 default
 * `(1, 1, 1)` as the unlit midtone stand-in contract.
 * Keep the existing `mesh.scale` Vector3 instance — do
 * **not** replace it with `new Vector3(1, 1, 1)` or
 * reassign `mesh.scale`. Load-time only — not per-frame.
 * Does **not** pin `mesh.visible` (LOD visibility uses
 * it), change `matrixAutoUpdate` (v0.45 already freezes
 * static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`,
 * change `blendColor` / `blendAlpha`, invent custom
 * shaders, or invent a custom scale.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate / up pin helpers. Does not invent
 * meshes.
 */
export function pinColorOnlyUnlitBasicScale(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  if (mesh.scale) {
    mesh.scale.x = 1;
    mesh.scale.y = 1;
    mesh.scale.z = 1;
  }
  return mesh;
}

/**
 * After up is pinned (procedural share / packaged
 * detect), pin r170 Object3D `scale` `(1, 1, 1)` on
 * every packed color-only unlit MeshBasic visual mesh
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualScale(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicScale(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Object3D Euler rotation.order on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` already
 * has `rotation.order === 'XYZ'` (`REVISION` 170; r170
 * Object3D / Euler default). Accidental DCC / packaged GLB
 * leftover non-`XYZ` Euler `order` (`YXZ`, `ZYX`, etc.) can
 * change how subsequent local Euler edits compose even when
 * current xyz values look fine — common DCC export leftover.
 * Pin r170 default `'XYZ'` as the unlit midtone stand-in
 * contract. Keep the existing `mesh.rotation` Euler instance
 * — do **not** replace it with `new Euler()` /
 * `new THREE.Euler()`. Do **not** zero or rewrite
 * `rotation.x` / `rotation.y` / `rotation.z` (lid/latch/tool/
 * fastener intentional local rotations must stay). Do **not**
 * touch `mesh.quaternion` (Three keeps quaternion in sync
 * from Euler when rotation is edited; do not force identity
 * quaternion). Load-time only — not per-frame. Does **not**
 * pin `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body LOD
 * leaves), change `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, change `scale`, change `blendColor` /
 * `blendAlpha`, invent custom shaders, or invent a custom
 * Euler order.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate / up / scale pin helpers. Does not
 * invent meshes.
 */
export function pinColorOnlyUnlitBasicRotationOrder(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  if (mesh.rotation) {
    mesh.rotation.order = "XYZ";
  }
  return mesh;
}

/**
 * After scale is pinned (procedural share / packaged
 * detect), pin r170 Object3D `rotation.order = 'XYZ'` on
 * every packed color-only unlit MeshBasic visual mesh
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualRotationOrder(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicRotationOrder(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Mesh custom shadow-material absence on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` does **not** define
 * `customDepthMaterial` or `customDistanceMaterial` on the
 * instance (they are optional; `REVISION` 170). WebGLShadowMap
 * reads `object.customDepthMaterial` /
 * `object.customDistanceMaterial` and only uses them when
 * present (`!== undefined`). Accidental DCC / packaged GLB
 * leftover stub objects force extra shadow-material paths
 * when a light later has `castShadow`, and are unused
 * GPU/state noise while `castShadow === false`. Clear both
 * to the r170 default absence (`undefined` via assignment
 * or `delete`). Load-time only — not per-frame. Does **not**
 * invent replacement materials. Does **not** enable
 * `castShadow` / `receiveShadow`. Does **not** pin
 * `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body
 * LOD leaves), change `matrixWorldAutoUpdate`, change
 * `layers`, change `up`, change `scale`, change
 * `rotation.order`, or change prior material pins
 * including stencil companions / polygonOffset companions /
 * dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate / up / scale / rotation.order pin
 * helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicCustomShadowMaterials(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  mesh.customDepthMaterial = undefined;
  mesh.customDistanceMaterial = undefined;
  return mesh;
}

/**
 * After rotation.order is pinned (procedural share / packaged
 * detect), clear leftover `customDepthMaterial` /
 * `customDistanceMaterial` to the r170 Mesh default absence
 * on every packed color-only unlit MeshBasic visual mesh
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes or replacement materials.
 * Does not enable `castShadow` / `receiveShadow`. Load-time
 * only — not per-frame.
 */
export function pinColorOnlyVisualCustomShadowMaterials(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicCustomShadowMaterials(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Mesh / Object3D render-callback absence on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` does **not**
 * define `onBeforeRender` or `onAfterRender` as own properties
 * (`Object.hasOwn` is false; `REVISION` 170). Both exist as empty
 * no-ops on `Object3D.prototype`. WebGLRenderer always invokes
 * `object.onBeforeRender` / `object.onAfterRender` (no presence
 * check). Accidental DCC / packaged GLB leftover own-property
 * stubs therefore become per-draw JS work on Quest Browser /
 * TBDR. Restore the r170 default by deleting leftover own
 * properties so the prototype empty no-ops remain. Load-time
 * only — not per-frame. Does **not** invent replacement
 * callbacks. Does **not** assign `undefined` (that would throw
 * in WebGLRenderer). Does **not** enable `castShadow` /
 * `receiveShadow` or touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** pin `mesh.visible`
 * (LOD visibility uses it), change `matrixAutoUpdate` (v0.45
 * already freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`,
 * change `scale`, change `rotation.order`, or change prior
 * material pins including stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha /
 * the v0.76 customDepth/Distance clear.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate / up / scale / rotation.order /
 * customDepth/Distance pin helpers. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicRenderCallbacks(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  delete mesh.onBeforeRender;
  delete mesh.onAfterRender;
  return mesh;
}

/**
 * After leftover customDepth/Distance are cleared (procedural
 * share / packaged detect), clear leftover own-property
 * `onBeforeRender` / `onAfterRender` so the r170 Object3D
 * prototype empty no-ops remain on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes or replacement callbacks.
 * Does not enable `castShadow` / `receiveShadow`. Does not
 * touch `customDepthMaterial` / `customDistanceMaterial`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualRenderCallbacks(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicRenderCallbacks(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Mesh / Object3D shadow-callback absence on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API:** a fresh `Mesh` / `Object3D` does **not**
 * define `onBeforeShadow` or `onAfterShadow` as own properties
 * (`Object.hasOwn` is false; `REVISION` 170). Both exist as empty
 * no-ops on `Object3D.prototype`. WebGLShadowMap always invokes
 * `object.onBeforeShadow` / `object.onAfterShadow` (no presence
 * check) when a mesh is selected for a shadow-map pass
 * (`castShadow` or `receiveShadow && VSMShadowMap`). Accidental
 * DCC / packaged GLB leftover own-property stubs therefore become
 * per-shadow-draw JS work if a light later has `castShadow`, and
 * are leftover callback noise while `castShadow === false` /
 * `receiveShadow === false`. Restore the r170 default by deleting
 * leftover own properties so the prototype empty no-ops remain.
 * Load-time only — not per-frame. Does **not** invent replacement
 * callbacks. Does **not** assign `undefined` (that would throw in
 * WebGLShadowMap). Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** touch Mesh `onBeforeRender` /
 * `onAfterRender` (v0.77) or Material `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does **not** touch
 * `customDepthMaterial` / `customDistanceMaterial`. Does **not**
 * pin `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body LOD
 * leaves), change `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, change `scale`, change `rotation.order`, or
 * change prior material pins including stencil companions /
 * polygonOffset companions / dithering / A2C / blendColor /
 * blendAlpha / the v0.76 customDepth/Distance clear / the v0.77
 * Mesh render-callback clear / the v0.78 Material
 * compile/render-callback clear.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow / frustumCulled / renderOrder / layers /
 * matrixWorldAutoUpdate / up / scale / rotation.order /
 * customDepth/Distance / Mesh render-callback pin helpers.
 * Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicShadowCallbacks(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  delete mesh.onBeforeShadow;
  delete mesh.onAfterShadow;
  return mesh;
}

/**
 * After leftover Mesh onBefore/AfterRender are cleared (procedural
 * share / packaged detect), clear leftover own-property
 * `onBeforeShadow` / `onAfterShadow` so the r170 Object3D
 * prototype empty no-ops remain on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes or replacement callbacks.
 * Does not enable `castShadow` / `receiveShadow`. Does not
 * touch Mesh `onBeforeRender` / `onAfterRender`. Does not
 * touch Material `onBeforeCompile` / `onBeforeRender`. Does
 * not touch `customDepthMaterial` / `customDistanceMaterial`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualShadowCallbacks(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (!isColorOnlyUnlitBasic(o.material)) return;
    if (!o.userData.collider && !(o.name && o.name.startsWith("collider_")) && !colorOnlyGeometryBlocksPack(o.geometry)) {
      return;
    }
    blockedMaterials.add(o.material);
  });
  entity.traverse((o) => {
    if (!o.isMesh) return;
    if (blockedMaterials.has(o.material)) return;
    pinColorOnlyUnlitBasicShadowCallbacks(o);
  });
  return entity;
}

/** Position-hash bin size in meters (Three.js `mergeVertices` default). */
export const MERGE_WELD_TOLERANCE = 1e-4;

const _weldGetters = ["getX", "getY", "getZ", "getW"];

/**
 * Weld vertices whose positions match within `tolerance` (Three.js
 * mergeVertices-style truncation hash). UV / normal / other attribute
 * *channels* stay — the surviving vertex keeps the first-seen values.
 * Position is the weld key so shared corners between former sibling
 * meshes become one vertex even when per-face UVs/normals differ
 * (BoxGeometry). Does not drop triangles. Load-time only.
 *
 * Prefer DCC pre-weld for mapped UV islands; this is a safety net
 * after same-material concat.
 */
export function weldCoincidentVertices(geometry, tolerance = MERGE_WELD_TOLERANCE) {
  if (!geometry) return geometry;
  const pos = geometry.getAttribute("position");
  if (!pos || pos.count < 2) return geometry;
  if (Object.keys(geometry.morphAttributes || {}).length) return geometry;
  const names = Object.keys(geometry.attributes);
  for (const name of names) {
    if (geometry.getAttribute(name)?.isInterleavedBufferAttribute) return geometry;
  }

  const eps = Math.max(tolerance, Number.EPSILON);
  const shiftMultiplier = Math.pow(10, Math.log10(1 / eps));
  const vertexCount = pos.count;
  const remap = new Uint32Array(vertexCount);
  const hashToNew = new Map();
  let next = 0;

  for (let i = 0; i < vertexCount; i++) {
    const hash = `${~~(pos.getX(i) * shiftMultiplier)},${~~(pos.getY(i) * shiftMultiplier)},${~~(pos.getZ(i) * shiftMultiplier)}`;
    let dst = hashToNew.get(hash);
    if (dst === undefined) {
      dst = next++;
      hashToNew.set(hash, dst);
    }
    remap[i] = dst;
  }
  if (next === vertexCount) return geometry;

  const welded = new THREE.BufferGeometry();
  const written = new Uint8Array(next);
  for (const name of names) {
    const attr = geometry.getAttribute(name);
    const itemSize = attr.itemSize;
    const data = new attr.array.constructor(next * itemSize);
    const out = new THREE.BufferAttribute(data, itemSize, attr.normalized);
    written.fill(0);
    for (let i = 0; i < vertexCount; i++) {
      const dst = remap[i];
      if (written[dst]) continue;
      written[dst] = 1;
      for (let k = 0; k < itemSize; k++) {
        out[_weldGetters[k]](dst, attr[_weldGetters[k]](i));
      }
    }
    welded.setAttribute(name, out);
  }

  const srcIndex = geometry.getIndex();
  const srcCount = srcIndex ? srcIndex.count : vertexCount;
  const compact = next > 65535 ? new Uint32Array(srcCount) : new Uint16Array(srcCount);
  if (srcIndex) {
    for (let i = 0; i < srcCount; i++) compact[i] = remap[srcIndex.getX(i)];
  } else {
    for (let i = 0; i < vertexCount; i++) compact[i] = remap[i];
  }
  welded.setIndex(new THREE.BufferAttribute(compact, 1));
  return welded;
}

const LOD_MERGE_SKIP_NAMES = new Set(["fastener", "fastenerMesh"]);

function skipLodMergeChild(child) {
  if (!child?.isMesh) return true;
  if (child.userData?.collider) return true;
  if (LOD_MERGE_SKIP_NAMES.has(child.name)) return true;
  if (child.name && child.name.startsWith("collider_")) return true;
  return false;
}

/**
 * Merge visual meshes that share one material instance inside a single
 * lodGroup. Does not cross body / lidPivot / latchPivot / tool — call
 * once per group. Bakes each mesh's local matrix into the merged
 * geometry, then welds coincident vertices (v0.39), then strips
 * unused `uv` / `normal` (and other unused channels) when the
 * material is color-only unlit MeshBasic (v0.40), then compact a
 * 32-bit index to Uint16 when verts fit (v0.41), then quantize
 * Float32 `position` to Float16 (v0.44), then hook post-GPU-upload
 * CPU array release on those packed geos (v0.43). A named source
 * keeps its name on the survivor. Colliders and the fastener
 * (`fastener` / `fastenerMesh`) are skipped. Direct mesh children
 * only — nested Groups (pivots) stay. Load-time only — not
 * per-frame. Shared by procedural create (v0.37) and packaged
 * ingest (v0.38); weld is the v0.39 upgrade on the same helper;
 * unused-attr strip is the v0.40 upgrade; Uint16 index compact is
 * the v0.41 upgrade; CPU-array release-on-upload is the v0.43
 * upgrade; Float16 position quantize is the v0.44 upgrade.
 * Single-mesh groups still skip concat/weld but still strip unused
 * attrs, compact the index, quantize position, and hook
 * upload-release on color-only MeshBasic.
 */
export function mergeSameMaterialMeshes(lodGroup) {
  if (!lodGroup) return lodGroup;
  const buckets = new Map();
  for (const child of [...lodGroup.children]) {
    if (skipLodMergeChild(child)) continue;
    const mat = child.material;
    if (!mat || Array.isArray(mat)) continue;
    let list = buckets.get(mat);
    if (!list) {
      list = [];
      buckets.set(mat, list);
    }
    list.push(child);
  }
  for (const [mat, meshes] of buckets) {
    if (meshes.length < 2) {
      for (const mesh of meshes) {
        packColorOnlyGeometry(mesh.geometry, mat);
      }
      continue;
    }
    const baked = [];
    for (const mesh of meshes) {
      mesh.updateMatrix();
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrix);
      baked.push(geo);
    }
    const concatenated = concatGeometries(baked);
    for (const geo of baked) geo.dispose();
    if (!concatenated) continue;
    const merged = weldCoincidentVertices(concatenated);
    if (merged !== concatenated) concatenated.dispose();
    packColorOnlyGeometry(merged, mat);
    const survivor = new THREE.Mesh(merged, mat);
    survivor.castShadow = false;
    survivor.receiveShadow = false;
    survivor.frustumCulled = true;
    survivor.renderOrder = 0;
    const named = meshes.find((m) => m.name);
    if (named) survivor.name = named.name;
    for (const mesh of meshes) {
      lodGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    lodGroup.add(survivor);
  }
  return lodGroup;
}

/**
 * One color-only unlit MeshBasic per midtone hex. v0.37 already
 * aliases woodDark/handleMat to wood *within* a LOD; v0.42 uses
 * this cache so LOD0/1/2 wood (and LOD0/1 brass) share one instance
 * when `L3_LODn_*_COLOR` matches. Does not invent materials or
 * rewrite mapped/lit types. Load-time only.
 */
export function shareColorOnlyUnlitBasic(hex, cache) {
  let mat = cache.get(hex);
  if (!mat) {
    mat = mappedBasic(hex, null, { map: false });
    pinColorOnlyUnlitBasicFlags(mat);
    cache.set(hex, mat);
  }
  return mat;
}

function makeCollider(name, w, h, d, x, y, z) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x22ff66,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.visible = false;
  mesh.userData.collider = true;
  mesh.userData.size = { x: w, y: h, z: d };
  return mesh;
}

export function createToolbox() {
  const studio = structuredClone(behaviorTemplate);
  studio.components.activity.current = studio.components.activity.initial;

  const root = new THREE.Group();
  root.name = "toolbox";
  root.userData.studio = studio;
  root.userData.kind = "entity";

  const l2 = getCrateL2Maps();
  // Color-only unlit MeshBasic (no albedo map). v0.37 aliases
  // woodDark/handleMat to the wood instance *within* a LOD. v0.42
  // aliases *across* LODs when the midtone hex matches: one wood
  // for LOD0/1/2, one brass for LOD0/1 (+ fastener), one steel
  // (LOD0-only). No roughness/metalness — those uniforms do not
  // apply to MeshBasic.
  const colorOnlyByHex = new Map();
  const wood = shareColorOnlyUnlitBasic(L3_LOD0_WOOD_COLOR, colorOnlyByHex);
  const woodDark = wood;
  const brass = shareColorOnlyUnlitBasic(L3_LOD0_BRASS_COLOR, colorOnlyByHex);
  const steel = shareColorOnlyUnlitBasic(L3_LOD0_STEEL_COLOR, colorOnlyByHex);
  const handleMat = wood;
  const woodMid = shareColorOnlyUnlitBasic(L3_LOD1_WOOD_COLOR, colorOnlyByHex);
  const woodDarkMid = woodMid;
  const brassMid = shareColorOnlyUnlitBasic(L3_LOD1_BRASS_COLOR, colorOnlyByHex);
  const handleMatMid = woodMid;
  const woodFar = shareColorOnlyUnlitBasic(L3_LOD2_WOOD_COLOR, colorOnlyByHex);

  const body = new THREE.Group();
  body.name = "body";
  // Hollow crate: walls + floor only. A solid shell would hide the tool.
  const wall = 0.016;
  const innerW = 0.36 - wall * 2;
  const innerD = 0.24 - wall * 2;
  const bodyL0 = lodGroup(0);
  bodyL0.add(boxMesh(0.36, 0.02, 0.24, woodDark, 0, 0.01, 0));
  bodyL0.add(boxMesh(0.36, 0.14, wall, wood, 0, 0.09, -0.12 + wall / 2));
  bodyL0.add(boxMesh(0.36, 0.14, wall, wood, 0, 0.09, 0.12 - wall / 2));
  bodyL0.add(boxMesh(wall, 0.14, innerD, wood, -0.18 + wall / 2, 0.09, 0));
  bodyL0.add(boxMesh(wall, 0.14, innerD, wood, 0.18 - wall / 2, 0.09, 0));
  bodyL0.add(boxMesh(innerW, 0.008, innerD, woodDark, 0, 0.024, 0));
  bodyL0.add(boxMesh(0.355, 0.012, 0.03, woodDark, 0, 0.155, -0.04));
  bodyL0.add(boxMesh(0.355, 0.012, 0.03, woodDark, 0, 0.155, 0.05));
  const bodyL1 = lodGroup(1);
  bodyL1.add(boxMesh(0.36, 0.02, 0.24, woodDarkMid, 0, 0.01, 0));
  bodyL1.add(boxMesh(0.36, 0.14, wall, woodMid, 0, 0.09, -0.12 + wall / 2));
  bodyL1.add(boxMesh(0.36, 0.14, wall, woodMid, 0, 0.09, 0.12 - wall / 2));
  bodyL1.add(boxMesh(wall, 0.14, innerD, woodMid, -0.18 + wall / 2, 0.09, 0));
  bodyL1.add(boxMesh(wall, 0.14, innerD, woodMid, 0.18 - wall / 2, 0.09, 0));
  const bodyL2 = lodGroup(2);
  bodyL2.add(boxMesh(0.36, 0.16, 0.24, woodFar, 0, 0.08, 0));
  body.add(bodyL0, bodyL1, bodyL2);
  root.add(body);

  const lidPivot = new THREE.Group();
  lidPivot.name = "lid";
  lidPivot.position.set(0, 0.16, -0.12);
  const lidL0 = lodGroup(0);
  const lid = boxMesh(0.36, 0.025, 0.24, wood, 0, 0.012, 0.12);
  lid.name = "lidMesh";
  lidL0.add(lid);
  lidL0.add(boxMesh(0.12, 0.02, 0.04, brass, 0, 0.028, 0.22));
  const lidL1 = lodGroup(1);
  lidL1.add(boxMesh(0.36, 0.025, 0.24, woodMid, 0, 0.012, 0.12));
  const lidL2 = lodGroup(2);
  lidL2.add(boxMesh(0.36, 0.02, 0.24, woodFar, 0, 0.01, 0.12));
  lidPivot.add(lidL0, lidL1, lidL2);
  root.add(lidPivot);

  const latchPivot = new THREE.Group();
  latchPivot.name = "latch";
  latchPivot.position.set(0, 0.1, 0.125);
  const latchL0 = lodGroup(0);
  const latch = boxMesh(0.04, 0.07, 0.012, brass, 0, 0, 0);
  latch.name = "latchMesh";
  latchL0.add(latch);
  const latchL1 = lodGroup(1);
  latchL1.add(boxMesh(0.04, 0.07, 0.012, brassMid, 0, 0, 0));
  const latchL2 = lodGroup(2);
  latchPivot.add(latchL0, latchL1, latchL2);
  root.add(latchPivot);

  const tool = new THREE.Group();
  tool.name = "tool";
  const toolL0 = lodGroup(0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 12), steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0.03, 0, 0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.08, 12), handleMat);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(-0.08, 0, 0);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.014), steel);
  tip.position.set(0.125, 0, 0);
  toolL0.add(shaft, grip, tip);
  const toolL1 = lodGroup(1);
  const stub = boxMesh(0.2, 0.02, 0.02, handleMatMid, 0, 0, 0);
  toolL1.add(stub);
  const toolL2 = lodGroup(2);
  tool.add(toolL0, toolL1, toolL2);
  tool.position.set(0, 0.045, 0);
  tool.userData.restLocal = tool.position.clone();
  tool.userData.feedbackEntity = root;
  root.add(tool);

  // L5 work target: front fastener. Extra 12 tris / 1 draw, not an LOD mesh.
  // Stays outside mergeSameMaterialMeshes (skip set); still gets the
  // color-only unused-attr strip + Uint16 compact (v0.41) + Float16
  // position quantize (v0.44) + post-upload CPU array release (v0.43).
  // applyFastenerVisual mutates this mesh's rotation.z / position.z,
  // so v0.45 must not freeze its matrixAutoUpdate. v0.46 still
  // disables its Mesh.raycast (L5 is transform writes, not pick).
  const fastener = boxMesh(0.028, 0.028, 0.02, brass, -0.12, 0.07, 0.131);
  fastener.name = "fastenerMesh";
  packColorOnlyGeometry(fastener.geometry, fastener.material);
  root.add(fastener);

  const colliderGrab = makeCollider("collider_grab", 0.38, 0.15, 0.24, 0, 0.075, 0);
  const colliderLatch = makeCollider("collider_latch", 0.08, 0.1, 0.06, 0, 0.1, 0.15);
  const colliderLid = makeCollider("collider_lid", 0.38, 0.06, 0.26, 0, 0.012, 0.12);
  const colliderTool = makeCollider("collider_tool", 0.26, 0.08, 0.08, 0, 0, 0);
  const colliderFastener = makeCollider("collider_fastener", 0.09, 0.09, 0.08, -0.12, 0.07, 0.16);
  colliderGrab.userData.layer = "grab";
  colliderLatch.userData.layer = "use";
  colliderLid.userData.layer = "use";
  colliderTool.userData.layer = "grab";
  colliderTool.userData.part = "tool";
  colliderFastener.userData.layer = "use";
  // Hulls live with the part they represent; they are never the render mesh.
  root.add(colliderGrab, colliderLatch, colliderFastener);
  lidPivot.add(colliderLid);
  tool.add(colliderTool);

  const highlightables = {
    body,
    lid: lidPivot,
    latch: latchPivot,
    tool,
    fastener,
  };

  root.userData.parts = { body, lidPivot, latchPivot, tool, fastener };
  root.userData.highlightables = highlightables;
  root.userData.colliders = [colliderGrab, colliderLatch, colliderLid, colliderTool, colliderFastener];
  root.userData.toolCollider = colliderTool;
  root.userData.fastener = { mesh: fastener, turns: 0, needed: 4, seated: false };
  root.userData.l2 = {
    textureSize: l2.size,
    lodAlbedoSize: l2.lodAlbedoSize,
    uniqueTextures: l2.uniqueTextures,
    maps: "none",
    lodAlbedoMaps: { 0: 0, 1: 0, 2: 0 },
    lodNormalMaps: { 0: false, 1: false, 2: false },
    lodOrmMaps: { 0: false, 1: false, 2: false },
    lodNormalScaleMul: { 0: 0, 1: 0, 2: 0 },
    lodMaterialClass: {
      0: "MeshBasicMaterial",
      1: "MeshBasicMaterial",
      2: "MeshBasicMaterial",
    },
    lod0Color: { wood: L3_LOD0_WOOD_COLOR, brass: L3_LOD0_BRASS_COLOR, steel: L3_LOD0_STEEL_COLOR },
    lod1Color: { wood: L3_LOD1_WOOD_COLOR, brass: L3_LOD1_BRASS_COLOR },
    lod2Color: L3_LOD2_WOOD_COLOR,
    uniqueMaterials: colorOnlyByHex.size,
    note: "procedural color-only stand-in; LOD0/1/2 color-only unlit MeshBasic (no map; wood/brass/steel midtones). v0.37 woodDark/handleMat alias wood within a LOD; v0.42 one shared wood instance across LOD0/1/2 and one shared brass across LOD0/1 (+ fastener) when midtone hex matches (steel stays LOD0-only). same-material merge within each lodGroup (v0.37; not across body/lid/latch/tool) then coincident-vertex weld (v0.39) then unused uv/normal strip on color-only MeshBasic (v0.40) then Uint16 index compact (v0.41) then Float16 position quantize (v0.44) then StaticDrawUsage + onUpload CPU-array release (v0.43); fastener (not an LOD mesh) gets the same unused-attr strip + compact + Float16 + upload-release. v0.45 freezes matrixAutoUpdate on static color-only MeshBasic body LOD leaves after one updateMatrixWorld(true); lid/latch/tool/fastener stay live. v0.46 disables Mesh.raycast on packed color-only MeshBasic visuals (body + lid/latch/tool + fastener); colliders keep Mesh.prototype.raycast. v0.47 pins fog = false and toneMapped = false on packed color-only unlit MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay r170 defaults). v0.48 also pins opaque FrontSide draw-state (transparent = false, opacity = 1, depthWrite = true, depthTest = true, side = FrontSide) on those same materials. v0.49 pins castShadow = false and receiveShadow = false on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.50 pins frustumCulled = true on those same visual meshes (colliders stay r170 Mesh defaults). v0.51 also pins NormalBlending / premultipliedAlpha false / alphaTest 0 (plus dithering false / alphaToCoverage false) on those same materials. v0.52 also pins wireframe false / colorWrite true / depthFunc LessEqualDepth / polygonOffset off on those same materials. v0.53 also pins r170 stencil defaults (stencilWrite false / AlwaysStencilFunc / Keep ops) on those same materials. v0.54 also pins r170 clipping defaults (clippingPlanes null / clipIntersection false / clipShadows false) on those same materials. v0.55 also pins r170 alphaHash / forceSinglePass defaults (alphaHash false / forceSinglePass false) on those same materials. v0.56 also pins r170 NormalBlending factor/equation companions (blendSrc SrcAlphaFactor / blendDst OneMinusSrcAlphaFactor / blendEquation AddEquation / blendSrcAlpha null / blendDstAlpha null / blendEquationAlpha null) on those same materials. v0.57 also pins r170 vertexColors false on those same materials. v0.58 also pins r170 precision null on those same materials. v0.59 also pins r170 shadowSide null on those same materials. v0.60 pins renderOrder = 0 on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.61 also pins r170 Material visible true on those same materials (does not pin mesh.visible — LOD visibility uses it). v0.62 also pins r170 MeshBasic envMap companions (combine MultiplyOperation / reflectivity 1 / refractionRatio 0.98) on those same materials (does not force envMap or attach maps). v0.63 also pins r170 MeshBasic map-intensity companions (lightMapIntensity 1 / aoMapIntensity 1) on those same materials (does not force lightMap / aoMap or attach maps). v0.64 also pins r170 MeshBasic wireframeLinewidth 1 on those same materials (does not enable wireframe; does not pin mesh.visible). v0.65 also pins r170 MeshBasic wireframeLinecap round / wireframeLinejoin round on those same materials (does not enable wireframe; does not pin mesh.visible). v0.66 also pins r170 MeshBasic envMapRotation (0, 0, 0) / order XYZ on those same materials (keeps the existing Euler instance; does not force envMap or attach maps; does not enable wireframe; does not pin mesh.visible). v0.67 pins r170 Object3D layers default (layer 0 only / mask 1) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Layers instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixWorldAutoUpdate / matrixAutoUpdate). v0.68 also pins r170 Material CustomBlending color/alpha companions (blendColor (0, 0, 0) / blendAlpha 0) on those same materials (keeps the existing Color instance; does not enable CustomBlending or change blending away from NormalBlending; does not pin mesh.visible). v0.69 pins r170 Object3D matrixWorldAutoUpdate true (DEFAULT_MATRIX_WORLD_AUTO_UPDATE) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / layers / blendColor / blendAlpha). v0.70 pins r170 Object3D up (0, 1, 0) (DEFAULT_UP) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Vector3 instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / blendColor / blendAlpha). v0.71 pins r170 Object3D scale (1, 1, 1) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Vector3 instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / blendColor / blendAlpha). v0.72 also pins r170 Material dithering false / alphaToCoverage false on those same materials as first-class measured flags (v0.51 already assigned them as blending/alpha companions; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / blendColor / blendAlpha). v0.73 pins r170 Object3D rotation.order XYZ on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Euler instance; does not rewrite rotation.xyz; does not touch quaternion; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / blendColor / blendAlpha / dithering / A2C). v0.74 also pins r170 Material polygonOffsetFactor 0 / polygonOffsetUnits 0 on those same materials as first-class measured flags (v0.52 already assigned them as polygonOffset companions; does not enable polygonOffset; does not invent non-zero factors/units; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / blendColor / blendAlpha / dithering / A2C). v0.75 also pins r170 Material stencilRef 0 / stencilWriteMask 0xff / stencilFuncMask 0xff / stencilZFail KeepStencilOp / stencilZPass KeepStencilOp on those same materials as first-class measured flags (v0.53 already assigned the full stencil suite and measured stencilWrite / stencilFunc / stencilFail in the short form; does not enable stencil write; does not invent non-Always func / non-Keep ops / non-zero ref / non-0xff masks; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including polygonOffset companions / dithering / A2C / blendColor / blendAlpha). v0.76 pins r170 Mesh customDepthMaterial / customDistanceMaterial absence (undefined/absent) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not invent replacement materials; does not enable castShadow / receiveShadow; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha). v0.77 pins r170 Object3D/Mesh onBeforeRender / onAfterRender instance absence (delete leftover own-property stubs so the r170 Object3D prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not enable shadows or touch customDepth/Distance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear). v0.78 pins r170 Material onBeforeCompile / onBeforeRender instance absence (delete leftover own-property stubs so the r170 Material.prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks or custom shaders) on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances; does not touch Mesh onBeforeRender / onAfterRender; does not touch onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / the v0.77 Mesh render-callback clear). v0.79 pins r170 Object3D/Mesh onBeforeShadow / onAfterShadow instance absence (delete leftover own-property stubs so the r170 Object3D prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not enable shadows or touch customDepth/Distance; does not touch Mesh onBeforeRender / onAfterRender or Material onBeforeCompile / onBeforeRender; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / the v0.77 Mesh render-callback clear / the v0.78 Material compile/render callback clear). Collider CPU arrays stay. lod.stats.attrBytes is the pre-upload envelope",
  };
  root.userData.materials = {
    lod0: { wood, woodDark, brass, steel, handleMat },
    lod1: { wood: woodMid, woodDark: woodDarkMid, brass: brassMid, handleMat: handleMatMid },
    lod2: { wood: woodFar },
  };
  root.userData.packaging = {
    source: "procedural-color-only",
    probedUrl: studio.source?.packagedUrl ?? "/packaged/crate-toolbox.glb",
    found: false,
  };
  // v0.37: merge same-material meshes inside each static lodGroup so
  // unused material slots do not multiply draws. v0.39: weld coincident
  // vertices after concat. v0.40: strip unused uv/normal on color-only
  // MeshBasic after weld (and on unmerged singles in the same helper).
  // v0.41: compact a lingering Uint32 index to Uint16 when verts fit.
  // v0.42: wood/brass MeshBasic instances are already shared across
  // LODs above (hex cache); merge still does not cross pivots.
  // v0.43: packColorOnlyGeometry also hooks post-upload CPU-array
  // release on those color-only MeshBasic geos (not colliders).
  // v0.44: after Uint16 compact and before that upload hook, quantize
  // Float32 position to Float16 on those same color-only geos.
  // v0.45: after LODs attach, freeze matrixAutoUpdate on static
  // color-only MeshBasic body leaves (not lid/latch/tool/fastener).
  // v0.46: after that freeze, disable Mesh.raycast on packed
  // color-only MeshBasic visuals (body + lid/latch/tool + fastener).
  // v0.47: after that raycast disable (and after hex-share above),
  // pin fog/toneMapped false on the shared color-only MeshBasics.
  // v0.48: the same helper also pins opaque FrontSide draw-state
  // (transparent/opacity/depthWrite/depthTest/side) on those materials.
  // v0.49: after that material pin, pin castShadow/receiveShadow
  // false on packed color-only MeshBasic visual meshes.
  // v0.50: after that shadow pin, pin frustumCulled true on those
  // same packed color-only MeshBasic visual meshes.
  // v0.51: the same material helper also pins NormalBlending /
  // premultipliedAlpha false / alphaTest 0 (plus dithering and
  // alphaToCoverage false) on those color-only MeshBasics.
  // v0.52: the same material helper also pins wireframe false /
  // colorWrite true / depthFunc LessEqualDepth / polygonOffset
  // off on those color-only MeshBasics.
  // v0.53: the same material helper also pins r170 stencil
  // defaults (stencilWrite false / AlwaysStencilFunc / Keep ops)
  // on those color-only MeshBasics.
  // v0.54: the same material helper also pins r170 clipping
  // defaults (clippingPlanes null / clipIntersection false /
  // clipShadows false) on those color-only MeshBasics.
  // v0.55: the same material helper also pins r170 alphaHash /
  // forceSinglePass defaults (alphaHash false / forceSinglePass
  // false) on those color-only MeshBasics.
  // v0.56: the same material helper also pins r170 NormalBlending
  // factor/equation companions (blendSrc SrcAlphaFactor /
  // blendDst OneMinusSrcAlphaFactor / blendEquation AddEquation /
  // blendSrcAlpha null / blendDstAlpha null /
  // blendEquationAlpha null) on those color-only MeshBasics.
  // v0.57: the same material helper also pins r170 vertexColors
  // false on those color-only MeshBasics.
  // v0.58: the same material helper also pins r170 precision
  // null on those color-only MeshBasics.
  // v0.59: the same material helper also pins r170 shadowSide
  // null on those color-only MeshBasics.
  // v0.60: after that frustumCulled pin, pin renderOrder 0 on
  // packed color-only MeshBasic visual meshes.
  // v0.61: the same material helper also pins r170 Material
  // visible true on those color-only MeshBasics (does not pin
  // mesh.visible — LOD visibility uses it).
  // v0.62: the same material helper also pins r170 MeshBasic
  // envMap companions (combine MultiplyOperation /
  // reflectivity 1 / refractionRatio 0.98) on those
  // color-only MeshBasics (does not force envMap or attach maps).
  // v0.63: the same material helper also pins r170 MeshBasic
  // map-intensity companions (lightMapIntensity 1 /
  // aoMapIntensity 1) on those color-only MeshBasics
  // (does not force lightMap / aoMap or attach maps).
  // v0.64: the same material helper also pins r170 MeshBasic
  // wireframeLinewidth 1 on those color-only MeshBasics
  // (does not enable wireframe; does not pin mesh.visible).
  // v0.65: the same material helper also pins r170 MeshBasic
  // wireframeLinecap round / wireframeLinejoin round on
  // those color-only MeshBasics (does not enable
  // wireframe; does not pin mesh.visible).
  // v0.66: the same material helper also pins r170 MeshBasic
  // envMapRotation (0, 0, 0) / order XYZ on those
  // color-only MeshBasics (keeps the existing Euler
  // instance; does not force envMap or attach maps;
  // does not enable wireframe; does not pin mesh.visible).
  // v0.67: after that renderOrder pin, pin r170 Object3D
  // layers default (layer 0 only / mask 1) on packed
  // color-only MeshBasic visual meshes (keeps the
  // existing Layers instance; does not pin mesh.visible;
  // does not change matrixWorldAutoUpdate / matrixAutoUpdate).
  // v0.68: the same material helper also pins r170
  // Material CustomBlending color/alpha companions
  // (blendColor (0, 0, 0) / blendAlpha 0) on those
  // color-only MeshBasics (keeps the existing Color
  // instance; does not enable CustomBlending or change
  // blending away from NormalBlending; does not pin
  // mesh.visible).
  // v0.69: after that layers pin, pin r170 Object3D
  // matrixWorldAutoUpdate true
  // (DEFAULT_MATRIX_WORLD_AUTO_UPDATE) on packed
  // color-only MeshBasic visual meshes (does not pin
  // mesh.visible; does not change matrixAutoUpdate /
  // layers / blendColor / blendAlpha).
  // v0.70: after that matrixWorldAutoUpdate pin, pin
  // r170 Object3D up (0, 1, 0) (DEFAULT_UP) on packed
  // color-only MeshBasic visual meshes (keeps the
  // existing Vector3 instance; does not pin
  // mesh.visible; does not change matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers / blendColor /
  // blendAlpha).
  // v0.71: after that up pin, pin r170 Object3D
  // scale (1, 1, 1) on packed color-only MeshBasic
  // visual meshes (keeps the existing Vector3
  // instance; does not pin mesh.visible; does not
  // change matrixAutoUpdate / matrixWorldAutoUpdate /
  // layers / up / blendColor / blendAlpha).
  // v0.72: the same material helper also pins
  // r170 Material dithering false /
  // alphaToCoverage false on those color-only
  // MeshBasics as first-class measured flags
  // (v0.51 already assigned them as blending/
  // alpha companions). Does not pin
  // mesh.visible; does not change
  // matrixAutoUpdate / matrixWorldAutoUpdate /
  // layers / up / scale / blendColor /
  // blendAlpha.
  // v0.73: after that scale pin, pin r170
  // Object3D rotation.order XYZ on packed
  // color-only MeshBasic visual meshes (keeps
  // the existing Euler instance; does not
  // rewrite rotation.xyz; does not touch
  // quaternion; does not pin mesh.visible;
  // does not change matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers / up /
  // scale / blendColor / blendAlpha /
  // dithering / A2C).
  // v0.74: the same material helper also pins
  // r170 Material polygonOffsetFactor 0 /
  // polygonOffsetUnits 0 on those color-only
  // MeshBasics as first-class measured flags
  // (v0.52 already assigned them as
  // polygonOffset companions). Does not
  // enable polygonOffset; does not invent
  // non-zero factors/units; does not pin
  // mesh.visible; does not change
  // matrixAutoUpdate / matrixWorldAutoUpdate /
  // layers / up / scale / rotation.order /
  // blendColor / blendAlpha / dithering / A2C.
  // v0.75: the same material helper also pins
  // r170 Material stencilRef 0 /
  // stencilWriteMask 0xff /
  // stencilFuncMask 0xff /
  // stencilZFail KeepStencilOp /
  // stencilZPass KeepStencilOp on those
  // color-only MeshBasics as first-class
  // measured flags (v0.53 already assigned
  // the full stencil suite and measured
  // stencilWrite / stencilFunc / stencilFail
  // in the short form). Does not enable
  // stencil write; does not invent
  // non-Always func / non-Keep ops /
  // non-zero ref / non-0xff masks; does
  // not pin mesh.visible; does not change
  // matrixAutoUpdate / matrixWorldAutoUpdate /
  // layers / up / scale / rotation.order /
  // prior material pins including
  // polygonOffset companions / dithering /
  // A2C / blendColor / blendAlpha.
  // v0.76: after that rotation.order pin
  // (and after the v0.75 Material stencil
  // companions), clear leftover Mesh
  // customDepthMaterial /
  // customDistanceMaterial to the r170
  // default absence on packed color-only
  // MeshBasic visual meshes. Does not
  // invent replacement materials; does
  // not enable castShadow /
  // receiveShadow; does not pin
  // mesh.visible; does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers / up /
  // scale / rotation.order / prior
  // material pins including stencil
  // companions / polygonOffset
  // companions / dithering / A2C /
  // blendColor / blendAlpha.
  // v0.77: after that customDepth/Distance
  // clear, delete leftover own-property
  // onBeforeRender / onAfterRender so the
  // r170 Object3D prototype empty no-ops
  // remain on packed color-only MeshBasic
  // visual meshes. Does not invent
  // replacement callbacks; does not
  // assign undefined; does not enable
  // shadows or touch customDepth/
  // Distance; does not pin mesh.visible;
  // does not change matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers / up /
  // scale / rotation.order / prior
  // material pins including stencil
  // companions / polygonOffset
  // companions / dithering / A2C /
  // blendColor / blendAlpha /
  // customDepth/Distance clear.
  // v0.78: after that Mesh
  // render-callback clear (and after
  // the long material-flag fence
  // through v0.75 stencil companions
  // / v0.74 polygonOffset companions
  // / v0.72 dithering+A2C), delete
  // leftover own-property Material
  // onBeforeCompile / onBeforeRender
  // so the r170 Material.prototype
  // empty no-ops remain on the 3
  // shared color-only MeshBasics.
  // Does not invent replacement
  // callbacks or custom shaders;
  // does not assign undefined; does
  // not touch Mesh onBeforeRender /
  // onAfterRender; does not touch
  // onBeforeShadow / onAfterShadow;
  // does not enable shadows or pin
  // mesh.visible; does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // stencil companions /
  // polygonOffset companions /
  // dithering / A2C / blendColor /
  // blendAlpha / the v0.77 Mesh
  // render-callback clear.
  // v0.79: after that Mesh
  // render-callback clear (and after
  // the v0.78 Material compile/render
  // callback clear), delete leftover
  // own-property onBeforeShadow /
  // onAfterShadow so the r170
  // Object3D prototype empty no-ops
  // remain on packed color-only
  // MeshBasic visual meshes. Does
  // not invent replacement
  // callbacks; does not assign
  // undefined; does not enable
  // shadows or touch customDepth/
  // Distance; does not touch Mesh
  // onBeforeRender / onAfterRender
  // or Material onBeforeCompile /
  // onBeforeRender; does not pin
  // mesh.visible; does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // stencil companions /
  // polygonOffset companions /
  // dithering / A2C / blendColor /
  // blendAlpha / customDepth/Distance
  // clear / the v0.77 Mesh
  // render-callback clear / the
  // v0.78 Material compile/render
  // callback clear.
  // Pivots stay separate. Fastener is packed above, not merged here.
  mergeSameMaterialMeshes(bodyL0);
  mergeSameMaterialMeshes(lidL0);
  mergeSameMaterialMeshes(latchL0);
  mergeSameMaterialMeshes(toolL0);
  mergeSameMaterialMeshes(bodyL1);
  mergeSameMaterialMeshes(lidL1);
  mergeSameMaterialMeshes(latchL1);
  mergeSameMaterialMeshes(toolL1);
  mergeSameMaterialMeshes(bodyL2);
  mergeSameMaterialMeshes(lidL2);
  applyActivityVisual(root, 1);
  attachToolboxLod(root, {
    0: [bodyL0, lidL0, latchL0, toolL0],
    1: [bodyL1, lidL1, latchL1, toolL1],
    2: [bodyL2, lidL2, latchL2, toolL2],
  });
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

  return root;
}

export function getToolboxLodStats(entity) {
  return entity.userData.lod?.stats ?? null;
}

/** Unique visual materials bound on one LOD set (colliders skipped). */
export function collectLodVisualMaterials(entity, level) {
  const mats = [];
  const seen = new Set();
  for (const g of entity.userData.lod?.groups?.[level] ?? []) {
    g.traverse((o) => {
      if (!o.isMesh || o.userData.collider || !o.material) return;
      if (seen.has(o.material)) return;
      seen.add(o.material);
      mats.push(o.material);
    });
  }
  return mats;
}

/**
 * Unique visual materials on LOD0/1/2 plus the fastener (colliders
 * skipped). Used to count shared MeshBasic instances across LODs.
 */
export function collectCrateVisualMaterials(entity) {
  const mats = [];
  const seen = new Set();
  const add = (mat) => {
    if (!mat || seen.has(mat)) return;
    if (Array.isArray(mat)) {
      for (const m of mat) add(m);
      return;
    }
    seen.add(mat);
    mats.push(mat);
  };
  for (const level of [0, 1, 2]) {
    for (const mat of collectLodVisualMaterials(entity, level)) add(mat);
  }
  const fastener = entity.userData.fastener?.mesh;
  if (fastener?.isMesh && !fastener.userData.collider) add(fastener.material);
  return mats;
}

function mergeStats(groups) {
  return groups.reduce(
    (acc, g) => {
      const s = countGroupStats(g);
      acc.tris += s.tris;
      acc.draws += s.draws;
      acc.verts += s.verts;
      acc.attrBytes += s.attrBytes;
      return acc;
    },
    { tris: 0, draws: 0, verts: 0, attrBytes: 0 }
  );
}

/** Studio L3 distance bands. Shared by procedural create and packaged ingest. */
export const TOOLBOX_LOD_DISTANCES = Object.freeze({
  lod1: 2.4,
  lod2: 4.5,
  hysteresis: 0.2,
});

/**
 * Bind the same `userData.lod` shape procedural create uses, then show LOD0.
 * Visibility-only — no material swap, no frame-loop allocation.
 */
export function attachToolboxLod(entity, groups) {
  const g0 = groups?.[0] ?? groups?.["0"] ?? [];
  const g1 = groups?.[1] ?? groups?.["1"] ?? [];
  const g2 = groups?.[2] ?? groups?.["2"] ?? [];
  entity.userData.lod = {
    current: 0,
    mode: "auto",
    distances: {
      lod1: TOOLBOX_LOD_DISTANCES.lod1,
      lod2: TOOLBOX_LOD_DISTANCES.lod2,
      hysteresis: TOOLBOX_LOD_DISTANCES.hysteresis,
    },
    groups: { 0: g0, 1: g1, 2: g2 },
    stats: {
      0: mergeStats(g0),
      1: mergeStats(g1),
      2: mergeStats(g2),
    },
  };
  return setToolboxLod(entity, 0);
}

const _lodCam = new THREE.Vector3();
const _lodObj = new THREE.Vector3();

/** Show exactly one visual LOD. Colliders are not in these groups. */
export function setToolboxLod(entity, level) {
  const lod = entity.userData.lod;
  if (!lod) return lod;
  const next = Math.max(0, Math.min(2, level | 0));
  for (const [key, groups] of Object.entries(lod.groups)) {
    const on = Number(key) === next;
    for (const g of groups) g.visible = on;
  }
  lod.current = next;
  return lod;
}

/**
 * Distance switch from the active camera (XR viewer or desktop).
 * Hysteresis avoids flicker at the 2.4 m / 4.5 m bands (studio L3).
 */
export function updateToolboxLod(entity, camera) {
  const lod = entity.userData.lod;
  if (!lod || lod.mode !== "auto") return lod;
  camera.getWorldPosition(_lodCam);
  entity.getWorldPosition(_lodObj);
  const dist = _lodCam.distanceTo(_lodObj);
  const { lod1, lod2, hysteresis } = lod.distances;
  let next = lod.current;
  if (lod.current === 0 && dist > lod1 + hysteresis) next = 1;
  else if (lod.current === 1 && dist < lod1 - hysteresis) next = 0;
  else if (lod.current === 1 && dist > lod2 + hysteresis) next = 2;
  else if (lod.current === 2 && dist < lod2 - hysteresis) next = 1;
  else if (lod.current === 0 && dist > lod2) next = 2;
  else if (lod.current === 2 && dist < lod1) next = 0;
  if (next !== lod.current) setToolboxLod(entity, next);
  return lod;
}

export function createResetPlate() {
  const group = new THREE.Group();
  group.name = "reset";
  group.userData.kind = "entity";
  group.userData.studio = {
    version: 1,
    entity: "reset",
    components: {
      activity: { id: "reset", current: "idle" },
    },
  };
  const plate = boxMesh(0.16, 0.02, 0.1, std({ color: 0x2a3348, roughness: 0.55, metalness: 0.2 }), 0, 0.01, 0);
  plate.name = "resetMesh";
  group.add(plate);
  const collider = makeCollider("collider_reset", 0.18, 0.05, 0.12, 0, 0.02, 0);
  collider.userData.layer = "use";
  group.add(collider);
  group.userData.colliders = [collider];
  group.userData.highlightables = { reset: plate };
  return group;
}

export function activityState(entity) {
  return entity.userData.studio?.components?.activity?.current ?? null;
}

export function tryUse(entity, colliderName) {
  const activity = entity.userData.studio?.components?.activity;
  if (!activity?.transitions) return { ok: false, reason: "no-activity" };
  const hit = activity.transitions.find(
    (t) => t.from === activity.current && t.intent === "use" && t.collider === colliderName
  );
  if (!hit) return { ok: false, reason: "nack", from: activity.current };
  activity.current = hit.to;
  return { ok: true, to: hit.to, from: hit.from };
}

/** L5: drive the front fastener while the tool is in use. */
export function tryDriveFastener(entity) {
  const f = entity.userData.fastener;
  if (!f) return { ok: false, reason: "nack" };
  if (f.seated) return { ok: false, reason: "nack", seated: true };
  f.turns += 1;
  if (f.turns >= f.needed) {
    f.turns = f.needed;
    f.seated = true;
  }
  applyFastenerVisual(entity);
  return { ok: true, turns: f.turns, seated: f.seated, needed: f.needed };
}

const _slotWorld = new THREE.Vector3();
const _toolWorld = new THREE.Vector3();

/**
 * Seat the tool in the tray. Default: only when within 0.2 m of rest (drop-to-return).
 * Pass `{ force: true }` for the desktop T key / explicit holster from any distance.
 */
export function tryReturnTool(tool, crate, opts = {}) {
  if (!tool || !crate || activityState(crate) !== "open") return false;
  if (!opts.force) {
    crate.localToWorld(_slotWorld.copy(tool.userData.restLocal));
    tool.getWorldPosition(_toolWorld);
    if (_toolWorld.distanceTo(_slotWorld) > 0.2) return false;
  }
  crate.attach(tool);
  tool.position.copy(tool.userData.restLocal);
  tool.rotation.set(0, 0, 0);
  tool.userData.heldBy = null;
  tool.userData.extracted = false;
  if (tool.userData.velocity) tool.userData.velocity.set(0, 0, 0);
  return true;
}

export function toolIsHeldOrOut(tool, crate) {
  if (!tool) return false;
  if (tool.userData.heldBy || tool.userData.extracted) return true;
  return Boolean(crate) && tool.parent !== crate;
}

const LID_OPEN = -2.15;
const LATCH_OPEN = -1.35;

export function applyActivityVisual(entity, alpha = 0.2) {
  const state = activityState(entity);
  const { lidPivot, latchPivot, tool } = entity.userData.parts || {};
  if (!lidPivot || !latchPivot) return;

  const lidTarget = state === "open" ? LID_OPEN : 0;
  const latchTarget = state === "closed" ? 0 : LATCH_OPEN;
  lidPivot.rotation.x = THREE.MathUtils.lerp(lidPivot.rotation.x, lidTarget, alpha);
  latchPivot.rotation.x = THREE.MathUtils.lerp(latchPivot.rotation.x, latchTarget, alpha);

  const toolCollider = entity.userData.toolCollider;
  if (toolCollider) {
    // Hidden contents must not receive rays (interactive-objects.md).
    // Once the tool is taken out, it stays pickable even if the crate is closed.
    const nested = tool.parent === entity;
    toolCollider.userData.pickable = state === "open" || !nested;
  }
  if (tool) tool.visible = state === "open" || tool.parent !== entity;
  applyFastenerVisual(entity);
}

export function applyFastenerVisual(entity) {
  const f = entity.userData.fastener;
  if (!f?.mesh) return;
  f.mesh.rotation.z = f.turns * (Math.PI / 2);
  f.mesh.position.z = 0.131 - (f.seated ? 0.012 : f.turns * 0.002);
}

export function setColliderDebug(roots, visible) {
  for (const root of roots) {
    for (const c of root.userData.colliders || []) c.visible = visible;
  }
}

export function restPose(entity) {
  entity.position.set(0, 0.9, -0.55);
  entity.rotation.set(0, 0.15, 0);
  entity.userData.velocity = new THREE.Vector3();
  entity.userData.angular = new THREE.Vector3();
}

export function resetToolbox(entity, tableY = 0.9) {
  if (entity.parent && entity.userData.homeParent) {
    entity.userData.homeParent.attach(entity);
  }
  restPose(entity);
  entity.position.y = tableY;
  const activity = entity.userData.studio.components.activity;
  activity.current = activity.initial;
  const tool = entity.userData.parts.tool;
  if (tool.parent !== entity) entity.attach(tool);
  tool.position.copy(tool.userData.restLocal);
  tool.rotation.set(0, 0, 0);
  tool.userData.heldBy = null;
  tool.userData.extracted = false;
  tool.userData.velocity = new THREE.Vector3();
  const f = entity.userData.fastener;
  if (f) {
    f.turns = 0;
    f.seated = false;
  }
  lidSnap(entity);
}

function lidSnap(entity) {
  const state = activityState(entity);
  const { lidPivot, latchPivot } = entity.userData.parts;
  lidPivot.rotation.x = state === "open" ? LID_OPEN : 0;
  latchPivot.rotation.x = state === "closed" ? 0 : LATCH_OPEN;
  applyActivityVisual(entity, 1);
}

export function createStatePlaque() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.13),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true })
  );
  mesh.position.set(0.42, 1.08, -0.72);
  mesh.userData.canvas = canvas;
  mesh.userData.ctx = canvas.getContext("2d");
  mesh.userData.tex = tex;
  return mesh;
}

export function updateStatePlaque(plaque, state, fastener) {
  const { ctx, canvas, tex } = plaque.userData;
  ctx.fillStyle = "#121820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3a4660";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = "#8aa0c0";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText("ACTIVITY", 28, 42);
  ctx.fillStyle = "#e8ecf5";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText(String(state).toUpperCase(), 28, 92);
  ctx.fillStyle = "#c4a35a";
  ctx.font = "22px system-ui, sans-serif";
  if (fastener) {
    const label = fastener.seated ? "FASTENER SEATED" : `DRIVE ${fastener.turns}/${fastener.needed}`;
    ctx.fillText(label, 28, 132);
  }
  tex.needsUpdate = true;
}

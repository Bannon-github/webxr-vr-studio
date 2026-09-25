import * as THREE from "three";
import { FloatType } from "three";
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
 * normals). Those materials do not read `uv` / `normal` / `tangent`,
 * and they do not read `skinIndex` / `skinWeight` (skinning is a
 * SkinnedMesh path). Load-time only.
 */
export function isColorOnlyUnlitBasic(material) {
  if (!material || Array.isArray(material) || !material.isMeshBasicMaterial) return false;
  if (material.map || material.lightMap || material.aoMap) return false;
  if (material.specularMap || material.alphaMap || material.envMap) return false;
  return true;
}

/**
 * Skinning channels a plain Mesh + MeshBasic never reads.
 * r170 GLTFLoader maps `JOINTS_0` → `skinIndex` and `WEIGHTS_0` →
 * `skinWeight`. Sibling of the non-skin unused list so the strip can
 * skip them on interleaved geometries (same interleaved gate as the
 * v0.86–v0.88 visual pins).
 */
export const COLOR_ONLY_UNUSED_SKIN_ATTRS = Object.freeze(["skinIndex", "skinWeight"]);

const COLOR_ONLY_UNUSED_SKIN_ATTR_SET = new Set(COLOR_ONLY_UNUSED_SKIN_ATTRS);

/**
 * Vertex-color channel a color-only MeshBasic never reads while
 * `vertexColors === false` (v0.57). Sibling of the skin unused list
 * so the strip can skip it on interleaved geometries (same interleaved
 * gate as the v0.86–v1.6 visual pins) and can leave it when
 * `vertexColors` is still true. r170 GLTFLoader maps `COLOR_0` → `color`.
 */
export const COLOR_ONLY_UNUSED_COLOR_ATTRS = Object.freeze(["color"]);

const COLOR_ONLY_UNUSED_COLOR_ATTR_SET = new Set(COLOR_ONLY_UNUSED_COLOR_ATTRS);

/** Channels MeshBasic ignores when `isColorOnlyUnlitBasic` is true. */
export const COLOR_ONLY_UNUSED_ATTRS = Object.freeze([
  "normal",
  "uv",
  "uv1",
  "uv2",
  "uv3",
  "tangent",
  ...COLOR_ONLY_UNUSED_SKIN_ATTRS,
  ...COLOR_ONLY_UNUSED_COLOR_ATTRS,
]);

/**
 * Non-skin, non-color channels from `COLOR_ONLY_UNUSED_ATTRS`.
 * `normal` / `uv` / `uv1` / `uv2` / `uv3` / `tangent`. Derived so
 * the list cannot drift from the source of truth. Skin stays on
 * the v0.89 pin. `color` stays on the v1.7.0 pin.
 */
export const COLOR_ONLY_UNUSED_CHANNEL_ATTRS = Object.freeze(
  COLOR_ONLY_UNUSED_ATTRS.filter(
    (name) => !COLOR_ONLY_UNUSED_SKIN_ATTR_SET.has(name) && !COLOR_ONLY_UNUSED_COLOR_ATTR_SET.has(name),
  ),
);

/**
 * Drop leftover `skinIndex` / `skinWeight` on color-only unlit MeshBasic.
 * Keeps `position`. Does not delete other attributes. Does not touch
 * `drawRange`, `groups`, `morphAttributes`, bones, `skeleton`, or
 * `bindMatrix`. Interleaved geometries stay authored (same interleaved
 * half of `colorOnlyGeometryBlocksPack` as the visual pins). Mapped /
 * lit materials are left intact. Mutates in place. Load-time only.
 */
export function stripUnusedColorOnlySkinAttributes(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  if (colorOnlyGeometryInterleaved(geometry)) return geometry;
  for (const name of COLOR_ONLY_UNUSED_SKIN_ATTRS) {
    if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

/**
 * Drop leftover `color` on color-only unlit MeshBasic when
 * `material.vertexColors === false` (v0.57 pin stays). Keeps
 * `position` and the index. Does not delete other attributes. Does
 * not invent a replacement attribute. Does not assign `null`. Does
 * not enable or rewrite `vertexColors`. Interleaved geometries stay
 * authored (same interleaved half of `colorOnlyGeometryBlocksPack`
 * as the visual pins). Mapped / lit materials are left intact.
 * Mutates in place. Load-time only.
 *
 * `BufferGeometry.deleteAttribute` only `delete`s the named key from
 * `geometry.attributes`. An already-absent `color` is left as-is
 * (`getAttribute` is missing, so `deleteAttribute` is not called).
 */
export function stripUnusedColorOnlyColorAttributes(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  if (colorOnlyGeometryInterleaved(geometry)) return geometry;
  if (material.vertexColors !== false) return geometry;
  for (const name of COLOR_ONLY_UNUSED_COLOR_ATTRS) {
    if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

/**
 * Drop leftover `normal` / `uv` / `uv1` / `uv2` / `uv3` / `tangent`
 * on color-only unlit MeshBasic. The names are
 * `COLOR_ONLY_UNUSED_CHANNEL_ATTRS`, derived from
 * `COLOR_ONLY_UNUSED_ATTRS` (source of truth). Does not delete
 * `skinIndex` / `skinWeight` (v0.89 pin). Does not delete `color`
 * (v1.7.0 pin). Does not delete `position` or the index. Does not
 * invent a replacement attribute. Does not assign `null`.
 * Interleaved geometries stay authored (same interleaved half of
 * `colorOnlyGeometryBlocksPack` as the skin and color strips).
 * Mapped / lit materials are left intact. Mutates in place.
 * Load-time only.
 *
 * `BufferGeometry.deleteAttribute` only `delete`s the named key from
 * `geometry.attributes`. An already-absent channel is left as-is
 * (`getAttribute` is missing, so `deleteAttribute` is not called).
 */
export function stripUnusedColorOnlyChannelAttributes(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  if (colorOnlyGeometryInterleaved(geometry)) return geometry;
  for (const name of COLOR_ONLY_UNUSED_CHANNEL_ATTRS) {
    if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
  }
  return geometry;
}

/**
 * Drop unused BufferGeometry attributes on color-only unlit MeshBasic.
 * Keeps `position` (and `color` when `vertexColors` is not `false`).
 * Includes leftover `normal` / `uv` / `uv1` / `uv2` / `uv3` / `tangent`
 * via `stripUnusedColorOnlyChannelAttributes` (v0.40 pack path; v1.9.0
 * visual pin), leftover skinning attributes via
 * `stripUnusedColorOnlySkinAttributes` (v0.89), and leftover `color`
 * via `stripUnusedColorOnlyColorAttributes` (v1.7.0). Mapped or lit
 * materials are left intact. Mutates in place. Load-time only —
 * author may omit these in DCC; this is a safety net after merge/weld.
 * Fail-soft packaged paths that never enter this helper still hit the
 * v1.9.0 visual pin.
 */
export function stripUnusedColorOnlyAttributes(geometry, material) {
  if (!geometry || !isColorOnlyUnlitBasic(material)) return geometry;
  stripUnusedColorOnlyChannelAttributes(geometry, material);
  stripUnusedColorOnlySkinAttributes(geometry, material);
  stripUnusedColorOnlyColorAttributes(geometry, material);
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

const cpuArrayReleaseGeometry = new WeakMap();

/**
 * r170 `BufferAttribute.onUpload` callback that recomputes null
 * bounds from the still-present CPU arrays, then nulls `this.array`.
 * Stamped to `geometry` so a later pin can tell this hook from a
 * release closure that closes over a different geometry.
 * Does not run until `WebGLAttributes` calls it after upload.
 */
function createCpuArrayReleaseOnUpload(geometry) {
  const releaseArray = function releaseCpuArray() {
    // v0.92 may have assigned both bounds back to null after this
    // hook was installed. Recompute from the still-present CPU arrays
    // (the pin does not call compute*), then drop the array.
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    this.array = null;
  };
  cpuArrayReleaseGeometry.set(releaseArray, geometry);
  return releaseArray;
}

/**
 * True when `callback` is the v0.43 / v1.8 `releaseCpuArray` hook
 * stamped to `geometry`. The r170 empty prototype method
 * (`onUploadCallback`) and a hook stamped to another geometry are
 * not this hook.
 */
export function isCpuArrayReleaseOnUpload(callback, geometry) {
  return typeof callback === "function"
    && callback.name === "releaseCpuArray"
    && cpuArrayReleaseGeometry.get(callback) === geometry;
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
 *
 * v0.92 `pinColorOnlyVisualBounds` runs after this hook is installed
 * and assigns `boundingBox` / `boundingSphere` back to `null`. The
 * `onUpload` callback recomputes those volumes while the CPU arrays
 * are still present, then releases the arrays. The bounds pin itself
 * does not call `computeBoundingBox` / `computeBoundingSphere`.
 *
 * v1.8 `pinColorOnlyVisualOnUpload` runs later and re-installs this
 * same hook when a copy / JSON / glTF path left a different
 * `onUploadCallback` or the r170 empty prototype method. The pin
 * does not null `.array` and does not recompute bounds.
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

  const releaseArray = createCpuArrayReleaseOnUpload(geometry);
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
 * `stripUnusedColorOnlyColorAttributes` drops `color` when
 * `material.vertexColors === false` (and the geometry is not
 * interleaved) — pinning false makes that strip reliably apply
 * after DCC leftovers. v1.7.0 runs the same delete again after
 * `pinColorOnlyVisualMatrixWorldNeedsUpdate`. Pin r170 default as the
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
 * Delete leftover own-property Material `customProgramCacheKey` so
 * the r170 `Material.prototype.customProgramCacheKey` remains.
 *
 * **Verified r170 API (Material compile-cache fence):** a fresh
 * `MeshBasicMaterial` / `Material` does **not** define
 * `customProgramCacheKey` as an own property (`Object.hasOwn` is
 * false; `REVISION` 170). It exists on `Material.prototype` and
 * returns `this.onBeforeCompile.toString()`. WebGLRenderer uses
 * `customProgramCacheKey()` when building/caching programs. A
 * leftover own-property stub (especially one that returns
 * unstable / unique strings) fragments the program cache and
 * forces extra compiles on Quest Browser / TBDR. After v0.78
 * deleted leftover own-property `onBeforeCompile` /
 * `onBeforeRender` so the r170 Material.prototype empty no-ops
 * remain (and after Object3D callback leftovers through shadow
 * callbacks are already fenced through v0.79), delete leftover
 * own-property `customProgramCacheKey` so the prototype method
 * remains. Still passes `isColorOnlyUnlitBasic`. Do **not**
 * invent a replacement function. Do **not** assign `undefined`
 * (the renderer may invoke it). Do **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Do **not**
 * touch Mesh `onBeforeRender` / `onAfterRender` (v0.77). Do
 * **not** touch Mesh `onBeforeShadow` / `onAfterShadow`
 * (v0.79). Do **not** pin `mesh.visible`. Load-time only — not
 * per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe.
 */
export function pinColorOnlyUnlitBasicCustomProgramCacheKey(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  delete material.customProgramCacheKey;
  return material;
}

/**
 * Clear leftover Material `defines` so the r170 MeshBasicMaterial /
 * Material default absence remains (`defines === undefined`).
 *
 * **Verified r170 API (Material defines leftover fence):** a fresh
 * `MeshBasicMaterial` / `Material` does **not** set `defines` in
 * the Material constructor (`REVISION` 170). The property is
 * absent / `undefined` (`Object.hasOwn` is false).
 * `WebGLPrograms` copies `defines: material.defines` into program
 * parameters and, when `parameters.defines !== undefined`,
 * appends each name/value into the program cache key array
 * (alongside `customProgramCacheKey`). Leftover DCC/GLB `defines`
 * objects — even an empty `{}` — fragment the program cache and
 * force extra compiles on Quest Browser / TBDR. After v0.80
 * deleted leftover own-property `customProgramCacheKey` so the
 * r170 `Material.prototype.customProgramCacheKey` remains (and
 * after v0.78 cleared Material `onBeforeCompile` /
 * `onBeforeRender`), delete leftover Material `defines` so the
 * r170 absence remains. Still passes `isColorOnlyUnlitBasic`.
 * Do **not** invent a replacement `#define` map. Do **not**
 * assign a sentinel empty `{}` (`WebGLPrograms` treats
 * `parameters.defines !== undefined` as present). Do **not**
 * touch Material `customProgramCacheKey` (v0.80). Do **not**
 * touch Material `onBeforeCompile` / `onBeforeRender` (v0.78).
 * Do **not** touch Mesh `onBeforeRender` / `onAfterRender`
 * (v0.77). Do **not** touch Mesh `onBeforeShadow` /
 * `onAfterShadow` (v0.79). Do **not** pin `mesh.visible`.
 * Load-time only — not per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe.
 */
export function pinColorOnlyUnlitBasicDefines(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  delete material.defines;
  return material;
}

/**
 * Pin Material `flatShading = false` on a packed color-only unlit
 * MeshBasic so leftover DCC/GLB `flatShading = true` cannot select
 * a FLAT_SHADED program variant.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the Material
 * constructor does **not** assign `flatShading`, and
 * `MeshBasicMaterial` does not either. A fresh
 * `new MeshBasicMaterial()` / `new Material()` has
 * `flatShading === undefined` (`Object.hasOwn` is false). Lit
 * materials (`MeshStandardMaterial`, `MeshPhongMaterial`,
 * `MeshLambertMaterial`, `MeshNormalMaterial`, `MeshMatcapMaterial`)
 * assign `this.flatShading = false` in their own constructors.
 * `Material.setValues` skips keys whose current value is
 * `undefined`, so constructor options do not stick `flatShading`
 * onto MeshBasic. GLTFLoader assigns `material.flatShading = true`
 * directly when a primitive asks for flat shading.
 * `WebGLPrograms.getParameters` copies
 * `flatShading: material.flatShading === true` into program
 * parameters (not the raw property). The program cache key enables
 * layer bit 2 when `parameters.flatShading` is true, and
 * `WebGLProgram` emits `#define FLAT_SHADED` when that parameter
 * is truthy. `undefined` and `false` both keep the non-flat
 * variant; leftover `true` fragments the cache and can force a
 * separate FLAT_SHADED program on Quest Browser / TBDR even for
 * color-only unlit MeshBasic stand-ins. After v0.81 cleared
 * leftover Material `defines` so `defines === undefined` remains
 * (and after the long Material flag fence through v0.80
 * `customProgramCacheKey` / v0.78 `onBeforeCompile` +
 * `onBeforeRender` / v0.75 stencil companions), assign
 * `flatShading = false` so the measured contract is
 * `material.flatShading === false`. Still passes
 * `isColorOnlyUnlitBasic`. Do **not** invent custom shaders.
 * Do **not** enable flat shading. Do **not** touch Material
 * `defines` (v0.81). Do **not** touch Material
 * `customProgramCacheKey` (v0.80). Do **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Do **not** touch
 * Mesh `onBeforeRender` / `onAfterRender` (v0.77). Do **not**
 * touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79). Do
 * **not** pin `mesh.visible`. Load-time only — not per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe.
 */
export function pinColorOnlyUnlitBasicFlatShading(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  material.flatShading = false;
  return material;
}

/**
 * Clear leftover Material `glslVersion` so the r170 MeshBasicMaterial /
 * Material default absence remains (`glslVersion === undefined`).
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the Material
 * constructor does **not** assign `glslVersion`, and
 * `MeshBasicMaterial` does not either. A fresh
 * `new MeshBasicMaterial()` / `new Material()` has
 * `glslVersion === undefined` (`Object.hasOwn` is false).
 * `ShaderMaterial` assigns `this.glslVersion = null` in its own
 * constructor — that is a different material class; do **not**
 * convert MeshBasic to ShaderMaterial. `WebGLPrograms.getParameters`
 * copies `glslVersion: material.glslVersion` into program
 * parameters. `WebGLProgram` sets
 * `versionString = parameters.glslVersion ? '#version ' +
 * parameters.glslVersion + '\n' : ''` when the parameter is
 * truthy, then for non-raw built-ins (including MeshBasic)
 * overwrites `versionString` to `#version 300 es`. When
 * `parameters.glslVersion === GLSL3` (`'300 es'`), the fragment
 * prefix omits `layout(location = 0) out highp vec4 pc_fragColor`
 * and `#define gl_FragColor pc_fragColor`. `getProgramCacheKey`
 * does **not** push `parameters.glslVersion`, so a leftover
 * `GLSL3` value shares a cache key with the r170 absence while
 * compiling a different preamble. Leftover DCC/GLB
 * `glslVersion = GLSL3` (or `'100'` / `'300 es'`) on color-only
 * unlit MeshBasic stand-ins can force that wrong preamble on
 * Quest Browser / TBDR. After v0.82 pinned Material
 * `flatShading = false` (and after the Material program-cache
 * fence through v0.81 `defines` / v0.80 `customProgramCacheKey` /
 * v0.78 `onBeforeCompile` + `onBeforeRender`), `delete
 * material.glslVersion` so the r170 absence remains. Still passes
 * `isColorOnlyUnlitBasic`. Do **not** assign a sentinel string.
 * Do **not** assign `GLSL3` / `GLSL1` / `'300 es'` / `'100'`.
 * Do **not** invent custom shaders / ShaderMaterial /
 * RawShaderMaterial. Do **not** touch Material `flatShading`
 * (v0.82). Do **not** touch Material `defines` (v0.81). Do
 * **not** touch Material `customProgramCacheKey` (v0.80). Do
 * **not** touch Material `onBeforeCompile` / `onBeforeRender`
 * (v0.78). Do **not** touch Mesh `onBeforeRender` /
 * `onAfterRender` (v0.77). Do **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow` (v0.79). Do **not** pin
 * `mesh.visible`. Load-time only — not per-frame.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline. Does not
 * invent materials or hex-dedupe.
 */
export function pinColorOnlyUnlitBasicGlslVersion(material) {
  if (!isColorOnlyUnlitBasic(material)) return material;
  delete material.glslVersion;
  return material;
}

/**
 * Pin Quest-safe Material flags on a packed color-only unlit MeshBasic
 * visual material, then run
 * `pinColorOnlyUnlitBasicMaterialRenderCallbacks` so leftover
 * own-property `onBeforeCompile` / `onBeforeRender` are deleted,
 * then `pinColorOnlyUnlitBasicCustomProgramCacheKey` so leftover
 * own-property `customProgramCacheKey` is deleted, then
 * `pinColorOnlyUnlitBasicDefines` so leftover Material `defines`
 * is cleared to the r170 absence (`undefined`), then
 * `pinColorOnlyUnlitBasicFlatShading` so Material `flatShading`
 * is `false` (r170 `WebGLPrograms` treats only
 * `material.flatShading === true` as the FLAT_SHADED program
 * variant), then `pinColorOnlyUnlitBasicGlslVersion` so leftover
 * Material `glslVersion` is deleted and the r170 absence remains
 * (`glslVersion === undefined`; does not assign a sentinel
 * string).
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
  pinColorOnlyUnlitBasicCustomProgramCacheKey(material);
  pinColorOnlyUnlitBasicDefines(material);
  pinColorOnlyUnlitBasicFlatShading(material);
  pinColorOnlyUnlitBasicGlslVersion(material);
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
 * assign `undefined`), and r170
 * Material compile-cache default
 * (`customProgramCacheKey` leftover
 * own-property deleted so the
 * Material.prototype method remains;
 * does not invent a replacement
 * function; does not assign
 * `undefined`), and r170 Material
 * `defines` absence (`defines`
 * leftover object deleted so
 * `defines === undefined`; does not
 * invent a replacement `#define`
 * map; does not assign a sentinel
 * empty `{}` — r170 WebGLPrograms
 * treats `parameters.defines !==
 * undefined` as present), and r170
 * Material `flatShading = false`
 * (`pinColorOnlyUnlitBasicFlatShading`;
 * fresh r170 Material /
 * MeshBasicMaterial leave
 * `flatShading` unset /
 * `undefined`; WebGLPrograms copies
 * `flatShading: material.flatShading
 * === true` into program parameters
 * and the program cache key;
 * WebGLProgram emits
 * `#define FLAT_SHADED` only when
 * that parameter is true; does not
 * invent custom shaders; does not
 * enable flat shading; does not
 * touch Material `defines`; does not
 * touch Material
 * `customProgramCacheKey`; does not
 * touch Material `onBeforeCompile` /
 * `onBeforeRender`; does not touch
 * Mesh `onBeforeRender` /
 * `onAfterRender`; does not touch
 * Mesh `onBeforeShadow` /
 * `onAfterShadow`), and r170 Material
 * `glslVersion` absence
 * (`pinColorOnlyUnlitBasicGlslVersion`;
 * `delete material.glslVersion` so
 * `glslVersion === undefined` and
 * `Object.hasOwn` is false; fresh
 * r170 Material /
 * MeshBasicMaterial leave
 * `glslVersion` unset;
 * `ShaderMaterial` assigns
 * `glslVersion = null` in its own
 * constructor — do not convert
 * MeshBasic to ShaderMaterial;
 * WebGLPrograms copies
 * `glslVersion: material.glslVersion`
 * into program parameters;
 * WebGLProgram emits
 * `#version ${parameters.glslVersion}`
 * when that parameter is truthy, then
 * overwrites built-in versionString
 * to `#version 300 es`; the fragment
 * prefix omits the `pc_fragColor` /
 * `gl_FragColor` defines when
 * `parameters.glslVersion === GLSL3`
 * (`'300 es'`); does not assign a
 * sentinel string; does not assign
 * `GLSL3` / `GLSL1` / `'300 es'` /
 * `'100'`; does not invent custom
 * shaders; does not touch Material
 * `flatShading`; does not touch
 * Material `defines`; does not touch
 * Material `customProgramCacheKey`;
 * does not touch Material
 * `onBeforeCompile` /
 * `onBeforeRender`; does not touch
 * Mesh `onBeforeRender` /
 * `onAfterRender`; does not touch
 * Mesh `onBeforeShadow` /
 * `onAfterShadow`)
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

/**
 * Pin Quest-safe Object3D `animations` emptiness on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the
 * Object3D constructor assigns `this.animations = []`
 * (`REVISION` 170). A fresh `new Object3D()` / `new Mesh()`
 * has `Array.isArray(animations) && animations.length === 0`.
 * GLTFLoader / DCC paths can leave a non-empty
 * `object.animations` AnimationClip array on a node even when
 * this studio drives lid / latch / tool / fastener motion by
 * procedural L4/L5 pivot mutation (`tryUse` /
 * `tryDriveFastener`), not by sampling Object3D.animations.
 * Leftover clips invite AnimationMixer / clip sampling into
 * the Quest Browser frame path on a TBDR mobile GPU for
 * stand-in visuals that should stay static-clip-free. After
 * v0.83 cleared leftover Material `glslVersion` (and after
 * the Mesh callback fence through v0.79 `onBeforeShadow` /
 * `onAfterShadow` / v0.77 `onBeforeRender` /
 * `onAfterRender` / v0.76 customDepth/Distance), restore the
 * r170 empty list: when `Array.isArray(mesh.animations)`,
 * mutate that array with `mesh.animations.length = 0` (keep
 * the existing array instance); if `animations` is missing or
 * not an array, assign `mesh.animations = []`. Load-time
 * only — not per-frame. Does **not** invent AnimationClips.
 * Does **not** create an AnimationMixer. Does **not** call
 * `AnimationMixer.update`. Does **not** touch Material
 * `glslVersion` (v0.83). Does **not** touch Material
 * `flatShading` (v0.82). Does **not** touch Material
 * `defines` (v0.81). Does **not** touch Material
 * `customProgramCacheKey` (v0.80). Does **not** touch
 * Material `onBeforeCompile` / `onBeforeRender` (v0.78).
 * Does **not** touch Mesh `onBeforeRender` /
 * `onAfterRender` (v0.77). Does **not** touch Mesh
 * `onBeforeShadow` / `onAfterShadow` (v0.79). Does **not**
 * touch `customDepthMaterial` / `customDistanceMaterial`.
 * Does **not** enable `castShadow` / `receiveShadow`. Does
 * **not** pin `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body LOD
 * leaves), change `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, change `scale`, change `rotation.order`, or
 * change prior material pins including glslVersion /
 * flatShading / defines / customProgramCacheKey / stencil
 * companions / polygonOffset companions / dithering / A2C /
 * blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * shadow-callback / render-callback / layers pin helpers.
 * Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicAnimations(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  if (Array.isArray(mesh.animations)) {
    mesh.animations.length = 0;
  } else {
    mesh.animations = [];
  }
  return mesh;
}

/**
 * After leftover Mesh shadow callbacks are cleared (procedural
 * create / packaged detect), clear leftover Object3D
 * `animations` so the r170 empty list remains on every packed
 * color-only unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes, AnimationClips, or an
 * AnimationMixer. Does not call `AnimationMixer.update`. Does
 * not touch Material `glslVersion`. Does not touch Mesh
 * `onBeforeShadow` / `onAfterShadow`. Load-time only — not
 * per-frame.
 */
export function pinColorOnlyVisualAnimations(entity) {
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
    pinColorOnlyUnlitBasicAnimations(o);
  });
  return entity;
}

/**
 * Pin Quest-safe Mesh morph-target absence on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the Mesh
 * constructor calls `this.updateMorphTargets()` (`REVISION` 170).
 * That method assigns `morphTargetInfluences` and
 * `morphTargetDictionary` only when
 * `Object.keys(geometry.morphAttributes).length > 0`. A fresh
 * `new Mesh(geometry, material)` with no morphAttributes leaves
 * both properties absent (`undefined`; `Object.hasOwn` false).
 * `Mesh.copy` copies them when the source defines them
 * (`slice()` / `Object.assign`). GLTFLoader / DCC paths can leave
 * a non-empty `morphTargetInfluences` array and/or a
 * `morphTargetDictionary` object on a node even when this prop’s
 * color-only stand-ins have no morphAttributes (geometry morph
 * attrs are already blocked by `colorOnlyGeometryBlocksPack` /
 * the pack pipeline) and lid / latch / tool / fastener motion is
 * procedural L4/L5 pivot mutation (`tryUse` /
 * `tryDriveFastener`). A present array — including an empty
 * `[]`, which is still truthy — looks “present” to paths that
 * branch on `object.morphTargetInfluences`. After v0.84 cleared
 * leftover Object3D `animations`, restore the r170 absence:
 * `delete mesh.morphTargetInfluences` and
 * `delete mesh.morphTargetDictionary` when present. Do **not**
 * assign `null` or empty `[]` / `{}`. Load-time only — not
 * per-frame. Does **not** invent morph targets. Does **not**
 * call `updateMorphTargets()`. Does **not** add morphAttributes.
 * Does **not** enable morphing. Does **not** touch Object3D
 * `animations` (v0.84). Does **not** touch Material
 * `glslVersion` (v0.83). Does **not** touch Material
 * `flatShading` (v0.82). Does **not** touch Material `defines`
 * (v0.81). Does **not** touch Material `customProgramCacheKey`
 * (v0.80). Does **not** touch Material `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does **not** touch Mesh
 * `onBeforeRender` / `onAfterRender` (v0.77). Does **not** touch
 * Mesh `onBeforeShadow` / `onAfterShadow` (v0.79). Does **not**
 * touch `customDepthMaterial` / `customDistanceMaterial`. Does
 * **not** enable `castShadow` / `receiveShadow`. Does **not**
 * pin `mesh.visible` (LOD visibility uses it), change
 * `matrixAutoUpdate` (v0.45 already freezes static body LOD
 * leaves), change `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, change `scale`, change `rotation.order`, or
 * change prior material pins including glslVersion /
 * flatShading / defines / customProgramCacheKey / stencil
 * companions / polygonOffset companions / dithering / A2C /
 * blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * animations / shadow-callback pin helpers. Does not invent
 * meshes.
 */
export function pinColorOnlyUnlitBasicMorphTargets(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (mesh.userData.collider) return mesh;
  if (mesh.name && mesh.name.startsWith("collider_")) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (colorOnlyGeometryBlocksPack(mesh.geometry)) return mesh;
  if (Object.hasOwn(mesh, "morphTargetInfluences") || mesh.morphTargetInfluences !== undefined) {
    delete mesh.morphTargetInfluences;
  }
  if (Object.hasOwn(mesh, "morphTargetDictionary") || mesh.morphTargetDictionary !== undefined) {
    delete mesh.morphTargetDictionary;
  }
  return mesh;
}

/**
 * After leftover Object3D `animations` are cleared (procedural
 * create / packaged detect), clear leftover Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` so the r170
 * absence remains on every packed color-only unlit MeshBasic
 * visual mesh (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip morph / interleaved (same pack-pipeline gate as raycast).
 * Skip meshes whose material is shared with a blocked collider /
 * morph mesh. Does not invent meshes or morph targets. Does not
 * call `updateMorphTargets()`. Does not add morphAttributes. Does
 * not enable morphing. Does not assign `null` or empty `[]` /
 * `{}`. Does not touch Object3D `animations`. Load-time only —
 * not per-frame.
 */
export function pinColorOnlyVisualMorphTargets(entity) {
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
    pinColorOnlyUnlitBasicMorphTargets(o);
  });
  return entity;
}

/** Interleaved half of `colorOnlyGeometryBlocksPack`. Morph-attribute keys are not a skip here. */
function colorOnlyGeometryInterleaved(geometry) {
  if (!geometry) return false;
  for (const name of Object.keys(geometry.attributes || {})) {
    if (geometry.getAttribute(name)?.isInterleavedBufferAttribute) return true;
  }
  if (geometry.getIndex()?.isInterleavedBufferAttribute) return true;
  return false;
}

function isColliderMesh(mesh) {
  const name = mesh?.name;
  return Boolean(mesh?.userData?.collider || (typeof name === "string" && name.startsWith("collider_")));
}

function addLiveGeometryAttributes(geometry, into) {
  if (!geometry || !into) return into;
  for (const name of Object.keys(geometry.attributes || {})) {
    const attr = geometry.getAttribute(name);
    if (attr) into.add(attr);
  }
  if (geometry.index) into.add(geometry.index);
  return into;
}

/**
 * Walk a morphAttributes value (r170 stores an array of BufferAttributes
 * per key). Dispose a leftover BufferAttribute only when `dispose` exists
 * and the attribute is not a live geometry attribute / index and not in
 * `preserved` (attributes still used by a skipped mesh).
 */
function disposeLeftoverMorphValue(value, preserved, seen) {
  if (value == null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) disposeLeftoverMorphValue(item, preserved, seen);
    return;
  }
  if (!value.isBufferAttribute) return;
  if (preserved?.has(value)) return;
  if (typeof value.dispose === "function") {
    value.dispose();
    preserved?.add(value);
  }
}

function rememberMorphBufferAttributes(value, into, seen) {
  if (value == null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) rememberMorphBufferAttributes(item, into, seen);
    return;
  }
  if (value.isBufferAttribute) into.add(value);
}

/**
 * Delete own keys on `geometry.morphAttributes` in place and leave the
 * r170 empty object. Assign `{}` only when the property is missing or
 * not a plain object (r170 expects an object; do not assign null).
 * Pin `morphTargetsRelative` to false only when it is not already false.
 */
function clearColorOnlyGeometryMorphAttributes(geometry, preserved) {
  if (!geometry) return;
  const current = geometry.morphAttributes;
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    geometry.morphAttributes = {};
  } else {
    const seen = new Set();
    for (const key of Object.getOwnPropertyNames(current)) {
      disposeLeftoverMorphValue(current[key], preserved, seen);
      delete current[key];
    }
  }
  if (geometry.morphTargetsRelative !== false) {
    geometry.morphTargetsRelative = false;
  }
}

/**
 * Pin Quest-safe BufferGeometry morph-attribute emptiness on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the
 * BufferGeometry constructor assigns `this.morphAttributes = {}` and
 * `this.morphTargetsRelative = false` (`REVISION` 170).
 * `BufferGeometry.copy` clones each morph-attribute array onto a fresh
 * `{}`. r170 `WebGLRenderer` calls `WebGLMorphtargets.update` when
 * `geometry.morphAttributes.position`, `.normal`, or `.color` is not
 * `undefined` — a key whose value is an empty array or an empty
 * BufferAttribute still counts. `WebGLMorphtargets.update` then builds
 * a morph data texture from those arrays. After v0.85 deleted leftover
 * Mesh `morphTargetInfluences` / `morphTargetDictionary`, clear the
 * geometry-side leftover: delete own keys on the existing
 * `morphAttributes` object (dispose a leftover BufferAttribute only
 * when `dispose` exists and the attribute is not a live geometry
 * attribute / index). Leave `{}`. Do **not** reassign `null` or
 * `undefined`. Set `morphTargetsRelative = false` only when it is not
 * already false. Load-time only — not per-frame. Does **not** invent
 * morph targets. Does **not** call `updateMorphTargets()`. Does **not**
 * add morphAttributes. Does **not** enable morphing. Does **not** touch
 * Mesh `morphTargetInfluences` / `morphTargetDictionary` (v0.85). Does
 * **not** touch Object3D `animations` (v0.84). Does **not** touch
 * Material `glslVersion` (v0.83). Does **not** touch Material
 * `flatShading` (v0.82). Does **not** touch Material `defines` (v0.81).
 * Does **not** touch Material `customProgramCacheKey` (v0.80). Does
 * **not** touch Material `onBeforeCompile` / `onBeforeRender` (v0.78).
 * Does **not** touch Mesh `onBeforeRender` / `onAfterRender` (v0.77).
 * Does **not** touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79).
 * Does **not** touch `customDepthMaterial` / `customDistanceMaterial`.
 * Does **not** enable `castShadow` / `receiveShadow`. Does **not** pin
 * `mesh.visible` (LOD visibility uses it), change `matrixAutoUpdate`
 * (v0.45 already freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`, change
 * `scale`, change `rotation.order`, or change prior material pins
 * including glslVersion / flatShading / defines / customProgramCacheKey
 * / stencil companions / polygonOffset companions / dithering / A2C /
 * blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * morph-target pin. Skip colliders. Skip interleaved geometries
 * (same interleaved half of `colorOnlyGeometryBlocksPack`). Mapped /
 * lit stay authored. This helper clears leftover morphAttributes on
 * color-only stand-ins — that is the pulse, so a color-only geometry
 * is not skipped merely because it still has morph-attribute keys.
 * Does not invent meshes.
 *
 * `preservedAttributes` is an optional set of BufferAttributes that
 * must not be disposed (live attributes, or morph attributes still
 * used by a skipped mesh).
 */
export function pinColorOnlyUnlitBasicMorphAttributes(mesh, preservedAttributes) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  const preserved = preservedAttributes ?? addLiveGeometryAttributes(mesh.geometry, new Set());
  clearColorOnlyGeometryMorphAttributes(mesh.geometry, preserved);
  return mesh;
}

/**
 * After leftover Mesh morph targets are cleared (procedural create /
 * packaged detect), clear leftover BufferGeometry `morphAttributes`
 * and pin `morphTargetsRelative` to false on every packed color-only
 * unlit MeshBasic visual geometry (body LOD leaves + lid/latch/tool +
 * fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * stays authored. Color-only leftover morphAttributes are cleared
 * (including an empty BufferAttribute or empty array under a key).
 * Does not invent meshes or morph targets. Does not call
 * `updateMorphTargets()`. Does not add morphAttributes. Does not
 * enable morphing. Does not reassign `morphAttributes` to `null` /
 * `undefined`. Does not touch Mesh `morphTargetInfluences` /
 * `morphTargetDictionary`. Does not touch Object3D `animations`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMorphAttributes(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  const skip = (mesh) => {
    if (isColliderMesh(mesh)) return true;
    if (!isColorOnlyUnlitBasic(mesh.material)) return true;
    if (!mesh.geometry) return true;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) return true;
    if (blockedMaterials.has(mesh.material)) return true;
    if (blockedGeometries.has(mesh.geometry)) return true;
    return false;
  };
  const preserved = new Set();
  const remembered = new Set();
  for (const mesh of meshes) {
    addLiveGeometryAttributes(mesh.geometry, preserved);
    if (!skip(mesh)) continue;
    const morphAttributes = mesh.geometry?.morphAttributes;
    if (!morphAttributes || typeof morphAttributes !== "object" || Array.isArray(morphAttributes)) continue;
    for (const key of Object.getOwnPropertyNames(morphAttributes)) {
      rememberMorphBufferAttributes(morphAttributes[key], preserved, remembered);
    }
  }
  for (const mesh of meshes) {
    if (skip(mesh)) continue;
    pinColorOnlyUnlitBasicMorphAttributes(mesh, preserved);
  }
  return entity;
}

/**
 * Empty leftover BufferGeometry `groups` in place. r170 stores an
 * array (`this.groups = []`). Mutate that array (`length = 0`).
 * Assign `[]` only when the property is missing or not an array.
 * Do not call `clearGroups()`: r170 replaces the array with a new
 * `[]` instead of setting length. Do not invent groups. Do not
 * touch `drawRange` (v0.88 `pinColorOnlyGeometryDrawRange` runs
 * after the groups clear).
 */
function clearColorOnlyGeometryGroups(geometry) {
  if (!geometry) return;
  const current = geometry.groups;
  if (Array.isArray(current)) {
    current.length = 0;
  } else {
    geometry.groups = [];
  }
}

/**
 * Pin Quest-safe BufferGeometry group emptiness on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the
 * BufferGeometry constructor assigns `this.groups = []`
 * (`REVISION` 170). `clearGroups()` assigns `this.groups = []`
 * (a new array; it does not set `length` on the existing one).
 * `addGroup` pushes `{ start, count, materialIndex }`.
 * `BufferGeometry.copy` re-adds each group. After v0.86 cleared
 * leftover `morphAttributes`, clear the geometry-side group
 * leftover: `groups.length = 0` on the existing array. If
 * `groups` is missing or not an array, assign `[]`. Do **not**
 * call `clearGroups()`. Do **not** invent groups. Do **not**
 * assign a material array or change materials-per-group. Do
 * **not** touch `drawRange` (v0.88
 * `pinColorOnlyUnlitBasicDrawRange` runs after this helper).
 * Load-time only — not per-frame.
 *
 * r170 `WebGLRenderer.projectObject` iterates `geometry.groups`
 * and pushes one render item per group **only when
 * `Array.isArray(material)`**. A single MeshBasicMaterial takes
 * the other branch and pushes one item with `group = null`, so
 * leftover groups do not multiply draws while the material stays
 * a single MeshBasicMaterial. `renderBufferDirect` applies a
 * group range only when that item's `group` is non-null; the
 * single-material span is `geometry.drawRange`. Clearing the
 * list keeps a later material-array binding or a
 * `BufferGeometry.copy` round-trip from reviving per-group draws
 * on a TBDR mobile GPU. Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * touch Material `glslVersion` (v0.83). Does **not** touch
 * Material `flatShading` (v0.82). Does **not** touch Material
 * `defines` (v0.81). Does **not** touch Material
 * `customProgramCacheKey` (v0.80). Does **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Does **not**
 * touch Mesh `onBeforeRender` / `onAfterRender` (v0.77). Does
 * **not** touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79).
 * Does **not** touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`, change
 * `scale`, change `rotation.order`, or change prior material
 * pins including glslVersion / flatShading / defines /
 * customProgramCacheKey / stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * morph-attribute pin. Skip colliders. Skip interleaved
 * geometries (same interleaved half of
 * `colorOnlyGeometryBlocksPack`). Mapped / lit stay authored.
 * This helper clears leftover groups on color-only stand-ins —
 * that is the pulse, so a color-only geometry is not skipped
 * merely because it still has groups. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicGroups(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  clearColorOnlyGeometryGroups(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferGeometry morph attributes are cleared
 * (procedural create / packaged detect), clear leftover
 * `groups` on every packed color-only unlit MeshBasic visual
 * geometry (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped /
 * lit. Skip interleaved geometries (same pack-pipeline
 * interleaved gate). Skip meshes whose material is shared with
 * a blocked collider or interleaved mesh. Skip geometries
 * shared with a collider, an interleaved mesh, or a mapped /
 * lit mesh so a shared BufferGeometry stays authored.
 * Color-only leftover groups are cleared. Does not invent
 * meshes or groups. Does not call `clearGroups()`. Does not
 * assign a material array. Does not touch `drawRange`
 * (`pinColorOnlyVisualDrawRange` runs after this helper). Does
 * not touch `morphAttributes` / `morphTargetsRelative`. Does
 * not touch Mesh `morphTargetInfluences` /
 * `morphTargetDictionary`. Does not touch Object3D
 * `animations`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualGroups(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicGroups(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferGeometry `drawRange` to the r170 default
 * in place. r170 stores `{ start: 0, count: Infinity }`.
 * Mutate that object's `start` and `count`. Assign
 * `{ start: 0, count: Infinity }` only when the property is
 * missing or not an object (`null` counts as missing: `typeof
 * null === "object"`). Do not call `setDrawRange()`: r170
 * writes a caller-supplied span onto the existing object and
 * throws when `drawRange` is missing. Do not invent a partial
 * range. Do not replace the geometry. Do not touch `groups`.
 */
function pinColorOnlyGeometryDrawRange(geometry) {
  if (!geometry) return;
  const current = geometry.drawRange;
  if (current !== null && typeof current === "object") {
    current.start = 0;
    current.count = Infinity;
  } else {
    geometry.drawRange = { start: 0, count: Infinity };
  }
}

/**
 * Pin Quest-safe BufferGeometry drawRange on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):** the
 * BufferGeometry constructor assigns
 * `this.drawRange = { start: 0, count: Infinity }`
 * (`REVISION` 170). `setDrawRange(start, count)` writes
 * `this.drawRange.start` / `this.drawRange.count` (it does not
 * replace the object, and it throws when `drawRange` is
 * missing). `BufferGeometry.copy` copies `start` and `count`
 * onto the destination's existing object. After v0.87 cleared
 * leftover `groups`, pin the geometry-side draw span leftover:
 * `start = 0` and `count = Infinity` on the existing object.
 * If `drawRange` is missing or not an object, assign
 * `{ start: 0, count: Infinity }`. Do **not** call
 * `setDrawRange()`. Do **not** invent a partial range. Do
 * **not** replace the geometry. Do **not** touch `groups`
 * (v0.87). Load-time only — not per-frame.
 *
 * r170 `WebGLRenderer.renderBufferDirect` reads
 * `geometry.drawRange` for the draw span
 * (`drawStart = drawRange.start`, `drawEnd = start + count`),
 * then intersects a group range only when that render item's
 * `group` is non-null. `projectObject` pushes one item with
 * `group = null` when the material is a single
 * MeshBasicMaterial (groups multiply draws only for a material
 * array — already fenced in v0.87). A leftover partial
 * `drawRange` therefore clips or under-draws the color-only
 * stand-in on Quest Browser. Pinning the r170 default keeps
 * the full index / position span (`renderBufferDirect` then
 * clamps `Infinity` to `index.count` or `position.count`).
 * Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * touch Material `glslVersion` (v0.83). Does **not** touch
 * Material `flatShading` (v0.82). Does **not** touch Material
 * `defines` (v0.81). Does **not** touch Material
 * `customProgramCacheKey` (v0.80). Does **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Does **not**
 * touch Mesh `onBeforeRender` / `onAfterRender` (v0.77). Does
 * **not** touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79).
 * Does **not** touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`, change
 * `scale`, change `rotation.order`, or change prior material
 * pins including glslVersion / flatShading / defines /
 * customProgramCacheKey / stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * groups pin. Skip colliders. Skip interleaved geometries
 * (same interleaved half of `colorOnlyGeometryBlocksPack`).
 * Mapped / lit stay authored. This helper pins leftover
 * drawRange on color-only stand-ins — that is the pulse, so a
 * color-only geometry is not skipped merely because it still
 * has a non-default drawRange. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicDrawRange(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryDrawRange(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferGeometry groups are cleared (procedural
 * create / packaged detect), pin leftover `drawRange` to the
 * r170 default (`start === 0` && `count === Infinity`) on every
 * packed color-only unlit MeshBasic visual geometry (body LOD
 * leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped /
 * lit. Skip interleaved geometries (same pack-pipeline
 * interleaved gate). Skip meshes whose material is shared with
 * a blocked collider or interleaved mesh. Skip geometries
 * shared with a collider, an interleaved mesh, or a mapped /
 * lit mesh so a shared BufferGeometry stays authored.
 * Color-only leftover draw ranges are pinned. Does not invent
 * meshes or partial ranges. Does not call `setDrawRange()`.
 * Does not replace the geometry. Does not touch `groups`. Does
 * not touch `morphAttributes` / `morphTargetsRelative`. Does
 * not touch Mesh `morphTargetInfluences` /
 * `morphTargetDictionary`. Does not touch Object3D
 * `animations`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualDrawRange(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicDrawRange(mesh);
  }
  return entity;
}

/**
 * Pin Quest-safe absence of leftover skinning attributes on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Verified r170 API (three@0.170.0 in this repo):**
 * `WebGLPrograms.getParameters` sets `skinning: object.isSkinnedMesh === true`.
 * `WebGLProgram` emits `#define USE_SKINNING` only when that parameter
 * is true, and only then declares `attribute vec4 skinIndex` /
 * `attribute vec4 skinWeight` (and `skinning_vertex` reads them).
 * A plain `Mesh` + `MeshBasicMaterial` never sets `isSkinnedMesh`, so
 * MeshBasic does not read those attributes. `WebGLGeometries.update`
 * still uploads every `geometry.attributes` entry, so leftover
 * `skinIndex` / `skinWeight` inflate the pre-upload attrBytes envelope
 * and the GPU buffer. r170 `GLTFLoader` maps `JOINTS_0` → `skinIndex`
 * and `WEIGHTS_0` → `skinWeight`, and constructs a `SkinnedMesh` only
 * when the node has a skin (`meshDef.isSkinnedMesh`). `SkinnedMesh`
 * `applyBoneTransform` reads `geometry.attributes.skinIndex` together
 * with `bindMatrix`. This helper deletes the leftover attributes on
 * color-only stand-ins. It does **not** invent a `SkinnedMesh`. It
 * does **not** enable skinning. It does **not** touch bones,
 * `skeleton`, `bindMatrix`, or `bindMatrixInverse`. It does **not**
 * delete `position`. `BufferGeometry.deleteAttribute` only removes the
 * named key from `geometry.attributes`. Load-time only — not per-frame.
 *
 * Does **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85). Does
 * **not** touch Object3D `animations` (v0.84). Does **not** touch
 * Material `glslVersion` (v0.83). Does **not** touch Material
 * `flatShading` (v0.82). Does **not** touch Material `defines`
 * (v0.81). Does **not** touch Material `customProgramCacheKey`
 * (v0.80). Does **not** touch Material `onBeforeCompile` /
 * `onBeforeRender` (v0.78). Does **not** touch Mesh `onBeforeRender` /
 * `onAfterRender` (v0.77). Does **not** touch Mesh `onBeforeShadow` /
 * `onAfterShadow` (v0.79). Does **not** touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** pin `mesh.visible` (LOD visibility
 * uses it), change `matrixAutoUpdate` (v0.45 already freezes static
 * body LOD leaves), change `matrixWorldAutoUpdate`, change `layers`,
 * change `up`, change `scale`, change `rotation.order`, or change
 * prior material pins including glslVersion / flatShading / defines /
 * customProgramCacheKey / stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline / drawRange
 * pin. Skip colliders. Skip interleaved geometries (same interleaved
 * half of `colorOnlyGeometryBlocksPack`). Mapped / lit stay authored
 * — when maps or `envMap` are present, `isColorOnlyUnlitBasic` is
 * false and skin attributes stay. This helper strips leftover skin
 * attributes on color-only stand-ins — that is the pulse, so a
 * color-only geometry is not skipped merely because it still has
 * `skinIndex` / `skinWeight`. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicSkinAttributes(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  stripUnusedColorOnlySkinAttributes(mesh.geometry, mesh.material);
  return mesh;
}

/**
 * After leftover BufferGeometry drawRange is pinned (procedural create
 * / packaged detect), strip leftover `skinIndex` / `skinWeight` on
 * every packed color-only unlit MeshBasic visual geometry (body LOD
 * leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * stays authored. Color-only leftover skin attributes are deleted.
 * Does not invent meshes or a SkinnedMesh. Does not enable skinning.
 * Does not touch bones / `skeleton` / `bindMatrix` /
 * `bindMatrixInverse`. Does not delete `position`. Does not touch
 * `drawRange`. Does not touch `groups`. Does not touch
 * `morphAttributes` / `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not touch BufferAttribute
 * `updateRange` (`pinColorOnlyVisualUpdateRange` runs after this
 * helper). Load-time only — not per-frame.
 */
export function pinColorOnlyVisualSkinAttributes(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicSkinAttributes(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `updateRange` to
 * `{ offset: 0, count: -1 }` in place. `count: -1` is the
 * legacy full-buffer sentinel. Mutate that object's `offset`
 * and `count`. Assign `{ offset: 0, count: -1 }` only when
 * the property is missing or not an object (`null` counts as
 * missing: `typeof null === "object"`). Skip
 * `InterleavedBufferAttribute`. Do not call `addUpdateRange()`
 * (r170 pushes a partial `{ start, count }` onto
 * `updateRanges`). Do not rewrite `updateRanges`. Do not
 * change `usage`. Do not replace the attribute.
 */
function pinColorOnlyBufferAttributeUpdateRange(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  const current = attribute.updateRange;
  if (current !== null && typeof current === "object") {
    current.offset = 0;
    current.count = -1;
  } else {
    attribute.updateRange = { offset: 0, count: -1 };
  }
}

/**
 * Pin leftover `updateRange` on every non-interleaved
 * BufferAttribute in `geometry.attributes`, plus
 * `geometry.index` when it is a BufferAttribute. Interleaved
 * geometries stay authored. Does not replace the geometry.
 */
function pinColorOnlyGeometryUpdateRange(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeUpdateRange(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeUpdateRange(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute updateRange on a packed
 * color-only unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns `this.updateRanges = []`
 * and does **not** assign `this.updateRange`.
 * `addUpdateRange(start, count)` pushes `{ start, count }` onto
 * that array. `clearUpdateRanges()` sets
 * `updateRanges.length = 0`. `WebGLAttributes.update` delegates
 * to `updateBuffer`, which `gl.bufferSubData`s the full array
 * when `updateRanges.length === 0` and a partial span for each
 * `{ start, count }` entry otherwise (then clears the array).
 * The legacy object `{ offset: 0, count: -1 }` (`count: -1` =
 * full buffer) is the pre-r163 contract. This helper still pins
 * that leftover object so a truncated `count` cannot remain on
 * color-only stand-ins. It does **not** call `addUpdateRange()`
 * or `clearUpdateRanges()`. It does **not** rewrite
 * `updateRanges`. It does **not** change `usage` (v0.43
 * StaticDrawUsage stays). It does **not** replace the attribute
 * or the geometry. Load-time only — not per-frame.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Mutate the existing `updateRange` object
 * (`offset = 0`, `count = -1`). If missing or not an object,
 * assign `{ offset: 0, count: -1 }`.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89 already
 * strips them before this helper on the create / ingest path).
 * Does **not** touch `drawRange` (v0.88). Does **not** touch
 * `groups` (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * touch Material `glslVersion` (v0.83). Does **not** touch
 * Material `flatShading` (v0.82). Does **not** touch Material
 * `defines` (v0.81). Does **not** touch Material
 * `customProgramCacheKey` (v0.80). Does **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Does **not**
 * touch Mesh `onBeforeRender` / `onAfterRender` (v0.77). Does
 * **not** touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79).
 * Does **not** touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`, change
 * `scale`, change `rotation.order`, or change prior material
 * pins including glslVersion / flatShading / defines /
 * customProgramCacheKey / stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * skin-attribute pin. Skip colliders. Skip interleaved
 * geometries (same interleaved half of
 * `colorOnlyGeometryBlocksPack`). Mapped / lit stay authored.
 * This helper pins leftover updateRange on color-only
 * stand-ins — that is the pulse, so a color-only geometry is
 * not skipped merely because an attribute still has a
 * non-default updateRange. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicUpdateRange(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryUpdateRange(mesh.geometry);
  return mesh;
}

/**
 * After leftover `skinIndex` / `skinWeight` are stripped
 * (procedural create / packaged detect), pin leftover
 * BufferAttribute `updateRange` to `{ offset: 0, count: -1 }`
 * on every packed color-only unlit MeshBasic visual geometry
 * (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped /
 * lit. Skip interleaved geometries (same pack-pipeline
 * interleaved gate). Skip meshes whose material is shared with
 * a blocked collider or interleaved mesh. Skip geometries
 * shared with a collider, an interleaved mesh, or a mapped /
 * lit mesh so a shared BufferGeometry stays authored.
 * Color-only leftover update ranges are pinned. Does not invent
 * meshes or partial ranges. Does not call `addUpdateRange()`.
 * Does not rewrite `updateRanges` (v0.91
 * `pinColorOnlyVisualUpdateRanges` runs after this helper).
 * Does not change `usage`. Does not replace attributes or the
 * geometry. Does not delete `skinIndex` / `skinWeight`. Does
 * not touch `drawRange`. Does not touch `groups`. Does not
 * touch `morphAttributes` / `morphTargetsRelative`. Does not
 * touch Mesh `morphTargetInfluences` /
 * `morphTargetDictionary`. Does not touch Object3D
 * `animations`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualUpdateRange(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicUpdateRange(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `updateRanges` to the r170 empty
 * array in place. Mutate that array (`length = 0`). Assign `[]`
 * only when the property is missing or not an array. Skip
 * `InterleavedBufferAttribute`. Do not call `addUpdateRange()`
 * (r170 pushes a partial `{ start, count }`). Do not call
 * `clearUpdateRanges()` (r170 sets `length` on the existing
 * array and throws when the property is missing). Do not touch
 * legacy `updateRange` (v0.90). Do not change `usage`. Do not
 * replace the attribute.
 */
function pinColorOnlyBufferAttributeUpdateRanges(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  const current = attribute.updateRanges;
  if (Array.isArray(current)) {
    current.length = 0;
  } else {
    attribute.updateRanges = [];
  }
}

/**
 * Pin leftover `updateRanges` on every non-interleaved
 * BufferAttribute in `geometry.attributes`, plus
 * `geometry.index` when it is a BufferAttribute. Interleaved
 * geometries stay authored. Does not replace the geometry.
 * Does not touch `updateRange`.
 */
function pinColorOnlyGeometryUpdateRanges(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeUpdateRanges(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeUpdateRanges(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute updateRanges emptiness on a
 * packed color-only unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns `this.updateRanges = []`
 * and does **not** assign `this.updateRange`.
 * `addUpdateRange(start, count)` pushes `{ start, count }` onto
 * that array. `clearUpdateRanges()` sets
 * `updateRanges.length = 0` and is not used here (a missing or
 * non-array property must be assigned `[]` instead).
 * `WebGLAttributes.update` delegates to `updateBuffer`, which
 * `gl.bufferSubData`s the full array when
 * `updateRanges.length === 0` and a partial span for each
 * `{ start, count }` entry otherwise (then clears the array).
 * v0.90 pinned the legacy `updateRange` object and left
 * `updateRanges` alone. This helper clears a leftover non-empty
 * `updateRanges` so the r170 full-buffer upload path stays the
 * one color-only stand-ins take. It does **not** call
 * `addUpdateRange()` or `clearUpdateRanges()`. It does **not**
 * touch `updateRange` (v0.90). It does **not** change `usage`
 * (v0.43 StaticDrawUsage stays). It does **not** replace the
 * attribute or the geometry. Load-time only — not per-frame.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Mutate the existing `updateRanges` array
 * (`length = 0`). If missing or not an array, assign `[]`.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * touch Material `glslVersion` (v0.83). Does **not** touch
 * Material `flatShading` (v0.82). Does **not** touch Material
 * `defines` (v0.81). Does **not** touch Material
 * `customProgramCacheKey` (v0.80). Does **not** touch Material
 * `onBeforeCompile` / `onBeforeRender` (v0.78). Does **not**
 * touch Mesh `onBeforeRender` / `onAfterRender` (v0.77). Does
 * **not** touch Mesh `onBeforeShadow` / `onAfterShadow` (v0.79).
 * Does **not** touch `customDepthMaterial` /
 * `customDistanceMaterial`. Does **not** enable `castShadow` /
 * `receiveShadow`. Does **not** pin `mesh.visible` (LOD
 * visibility uses it), change `matrixAutoUpdate` (v0.45 already
 * freezes static body LOD leaves), change
 * `matrixWorldAutoUpdate`, change `layers`, change `up`, change
 * `scale`, change `rotation.order`, or change prior material
 * pins including glslVersion / flatShading / defines /
 * customProgramCacheKey / stencil companions / polygonOffset
 * companions / dithering / A2C / blendColor / blendAlpha.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * updateRange pin. Skip colliders. Skip interleaved geometries
 * (same interleaved half of `colorOnlyGeometryBlocksPack`).
 * Mapped / lit stay authored. This helper clears leftover
 * updateRanges on color-only stand-ins — that is the pulse, so
 * a color-only geometry is not skipped merely because an
 * attribute still has a non-empty updateRanges. Does not invent
 * meshes.
 */
export function pinColorOnlyUnlitBasicUpdateRanges(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryUpdateRanges(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `updateRange` is pinned
 * (procedural create / packaged detect), clear leftover
 * BufferAttribute `updateRanges` to `[]` on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves
 * + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped /
 * lit. Skip interleaved geometries (same pack-pipeline
 * interleaved gate). Skip meshes whose material is shared with
 * a blocked collider or interleaved mesh. Skip geometries
 * shared with a collider, an interleaved mesh, or a mapped /
 * lit mesh so a shared BufferGeometry stays authored.
 * Color-only leftover updateRanges are cleared. Does not invent
 * meshes or partial ranges. Does not call `addUpdateRange()`.
 * Does not call `clearUpdateRanges()`. Does not touch
 * `updateRange` (v0.90). Does not change `usage`. Does not
 * replace attributes or the geometry. Does not delete
 * `skinIndex` / `skinWeight`. Does not touch `drawRange`. Does
 * not touch `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not
 * touch Object3D `animations`. Does not touch `boundingBox` /
 * `boundingSphere` (v0.92 `pinColorOnlyVisualBounds` runs after
 * this helper). Load-time only — not per-frame.
 */
export function pinColorOnlyVisualUpdateRanges(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicUpdateRanges(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferGeometry `boundingBox` / `boundingSphere` to the
 * r170 constructor `null`. Assign `null`. Do not invent `Box3` or
 * `Sphere` objects. Do not call `computeBoundingBox` or
 * `computeBoundingSphere`. Interleaved geometries stay authored. Does
 * not replace the geometry or its attributes. Does not touch
 * `updateRanges` (v0.91), `updateRange` (v0.90), or `usage`.
 */
function pinColorOnlyGeometryBounds(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
}

/**
 * Pin Quest-safe BufferGeometry bounds absence on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferGeometry constructor assigns `this.boundingBox = null` and
 * `this.boundingSphere = null`. `computeBoundingBox` allocates a
 * `Box3` only when `boundingBox === null`, then fills it from
 * `position`. `computeBoundingSphere` allocates a `Sphere` only when
 * `boundingSphere === null`, then derives center and radius from
 * `position`. `WebGLRenderer.projectObject` skips the object when
 * `frustumCulled` is true and `Frustum.intersectsObject` is false.
 * `Frustum.intersectsObject` uses `object.boundingSphere` when that
 * property is not `undefined`; a Mesh does not assign it, so the
 * else branch copies `geometry.boundingSphere` and calls
 * `geometry.computeBoundingSphere()` only when that sphere is
 * `null`. A leftover non-null sphere is transformed by `matrixWorld`
 * and tested as-is, which mis-drives the cull while v0.50 keeps
 * `Mesh.frustumCulled === true`. `boundingBox` is not the frustum
 * input; it is the paired constructor field (`null`) and is cleared
 * with the sphere so a stale box is not kept. This helper assigns
 * both properties `null`. It does **not** call `computeBoundingBox`
 * or `computeBoundingSphere` (the v0.43 `onUpload` callback
 * recomputes later, while CPU arrays still exist, if the pin cleared
 * them). It does **not** invent `Box3` / `Sphere` objects. It does
 * **not** replace the geometry or attributes. It does **not** touch
 * `updateRanges` (v0.91). It does **not** touch `updateRange`
 * (v0.90). It does **not** change `usage` (v0.43 StaticDrawUsage
 * stays). Load-time only — not per-frame.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * touch Material `glslVersion` / `flatShading` / `defines` /
 * `customProgramCacheKey` / `onBeforeCompile` / `onBeforeRender`.
 * Does **not** touch Mesh `onBeforeRender` / `onAfterRender` /
 * `onBeforeShadow` / `onAfterShadow`. Does **not** touch
 * `customDepthMaterial` / `customDistanceMaterial`. Does **not**
 * enable `castShadow` / `receiveShadow`. Does **not** pin
 * `mesh.visible`. Does **not** change `frustumCulled` (v0.50 stays
 * true). Does **not** change `matrixAutoUpdate`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * updateRanges pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper clears leftover bounds on
 * color-only stand-ins — that is the pulse, so a color-only geometry
 * is not skipped merely because bounds are already non-null. Does
 * not invent meshes.
 */
export function pinColorOnlyUnlitBasicBounds(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryBounds(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `updateRanges` are cleared
 * (procedural create / packaged detect), pin leftover BufferGeometry
 * `boundingBox` and `boundingSphere` to `null` on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferGeometry stays authored. Color-only leftover bounds are
 * cleared. Does not invent meshes, `Box3`, or `Sphere` objects. Does
 * not call `computeBoundingBox` or `computeBoundingSphere`. Does not
 * touch `updateRanges` (v0.91). Does not touch `updateRange` (v0.90).
 * Does not change `usage`. Does not replace attributes or the
 * geometry. Does not delete `skinIndex` / `skinWeight`. Does not
 * touch `drawRange`. Does not touch `groups`. Does not touch
 * `morphAttributes` / `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * delete Mesh / Object3D `boundingSphere` (v0.93
 * `pinColorOnlyVisualMeshBoundingSphere` runs after this helper
 * and leaves these geometry fields alone). Load-time only — not
 * per-frame.
 */
export function pinColorOnlyVisualBounds(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicBounds(mesh);
  }
  return entity;
}

/**
 * Delete a leftover Mesh / Object3D `boundingSphere` so the r170
 * absence remains (`mesh.boundingSphere === undefined`).
 *
 * **Checked installed three@0.170.0:** `Frustum.intersectsObject`
 * takes the object branch when `object.boundingSphere !== undefined`.
 * `null !== undefined`, so assigning `null` still takes that branch
 * and then calls `object.computeBoundingSphere()`. A Mesh does not
 * implement `computeBoundingSphere` and does not assign
 * `boundingSphere` in its constructor (the property is absent).
 * `delete` removes an own leftover (`Sphere` or `null`) so the
 * property reads `undefined` and the else branch copies
 * `geometry.boundingSphere`. v0.92 leaves that geometry sphere
 * `null` until compute-on-demand. Does not invent a `Sphere`.
 * Does not call `computeBoundingSphere` on the mesh. Does not touch
 * `geometry.boundingBox` / `geometry.boundingSphere`.
 */
function clearColorOnlyMeshBoundingSphere(mesh) {
  if (Object.hasOwn(mesh, "boundingSphere") || mesh.boundingSphere !== undefined) {
    delete mesh.boundingSphere;
  }
}

/**
 * Clear a leftover object-level `boundingSphere` on a packed
 * color-only unlit MeshBasic visual mesh so
 * `mesh.boundingSphere === undefined`.
 *
 * Same gate as `pinColorOnlyUnlitBasicBounds`: skip colliders, skip
 * mapped / lit, skip interleaved geometries, require a geometry.
 * Does **not** assign `null`. Does **not** invent a `Sphere`. Does
 * **not** call `computeBoundingSphere` on the mesh or the geometry.
 * Does **not** touch `geometry.boundingBox` / `geometry.boundingSphere`
 * (v0.92). Does **not** touch `updateRanges` (v0.91), `updateRange`
 * (v0.90), or `usage` (v0.43; v0.94 `pinColorOnlyVisualUsage`
 * runs after this helper). Does **not** delete `skinIndex` /
 * `skinWeight`. Does **not** touch `drawRange` / `groups` /
 * `morphAttributes` / `morphTargetsRelative`. Does **not** touch
 * Mesh morph targets or Object3D `animations`. Does **not** change
 * `frustumCulled` / `mesh.visible` / `matrixAutoUpdate`. Load-time
 * only — not per-frame.
 */
export function pinColorOnlyUnlitBasicMeshBoundingSphere(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  clearColorOnlyMeshBoundingSphere(mesh);
  return mesh;
}

/**
 * After leftover BufferGeometry bounds are pinned to `null`
 * (procedural create / packaged detect), delete leftover Mesh /
 * Object3D `boundingSphere` so the property is absent
 * (`mesh.boundingSphere === undefined`) on every packed color-only
 * unlit MeshBasic visual mesh (body LOD leaves + lid/latch/tool +
 * fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared mesh keeps
 * its authored object sphere. Color-only leftover object spheres
 * are deleted. Does not assign `null`. Does not invent a `Sphere`.
 * Does not call `computeBoundingSphere` on the mesh. Does not touch
 * `geometry.boundingBox` / `geometry.boundingSphere` (v0.92). Does
 * not touch `updateRanges` (v0.91). Does not touch `updateRange`
 * (v0.90). Does not change `usage` (v0.94
 * `pinColorOnlyVisualUsage` runs after this helper and leaves
 * this object sphere alone). Does not replace attributes or
 * the geometry. Does not delete `skinIndex` / `skinWeight`. Does
 * not touch `drawRange`. Does not touch `groups`. Does not touch
 * `morphAttributes` / `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Load-time
 * only — not per-frame.
 */
export function pinColorOnlyVisualMeshBoundingSphere(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMeshBoundingSphere(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `usage` to the r170 constructor
 * default `StaticDrawUsage` in place. Skip
 * `InterleavedBufferAttribute`. Do not replace the attribute.
 * Do not touch `updateRange` / `updateRanges`.
 *
 * **Checked installed three@0.170.0:** the BufferAttribute
 * constructor assigns `this.usage = StaticDrawUsage` (35044,
 * `gl.STATIC_DRAW`). `setUsage(value)` assigns `this.usage` and
 * returns `this`. `WebGLAttributes.createBuffer` passes
 * `attribute.usage` to `gl.bufferData`. `DynamicDrawUsage` is
 * 35048 (`gl.DYNAMIC_DRAW`).
 */
function pinColorOnlyBufferAttributeUsage(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  if (attribute.usage === THREE.StaticDrawUsage) return;
  if (typeof attribute.setUsage === "function") {
    attribute.setUsage(THREE.StaticDrawUsage);
  } else {
    attribute.usage = THREE.StaticDrawUsage;
  }
}

/**
 * Pin leftover `usage` on every non-interleaved BufferAttribute in
 * `geometry.attributes`, plus `geometry.index` when it is a
 * BufferAttribute. Interleaved geometries stay authored. Does not
 * replace the geometry or its attributes. Does not touch
 * `updateRange` (v0.90), `updateRanges` (v0.91), or geometry
 * `boundingBox` / `boundingSphere` (v0.92).
 */
function pinColorOnlyGeometryUsage(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeUsage(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeUsage(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute usage on a packed color-only unlit
 * MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns
 * `this.usage = StaticDrawUsage`. `setUsage` writes that field in
 * place. `WebGLAttributes.createBuffer` passes `attribute.usage` as
 * the `gl.bufferData` hint. v0.43 already calls `setUsage` on the
 * pack path. v0.90–v0.93 left `usage` alone so a DCC leftover
 * `DynamicDrawUsage` (or any other non-static usage) could survive
 * ingest when the upload hook skipped the geometry. This helper
 * pins that leftover back to `StaticDrawUsage` on static packed
 * color-only props. A dynamic hint on buffers that upload once is
 * wasteful on Quest 3 TBDR. It does **not** replace the attribute
 * or the geometry. It does **not** touch `updateRange` (v0.90). It
 * does **not** touch `updateRanges` (v0.91). It does **not** touch
 * geometry `boundingBox` / `boundingSphere` (v0.92). It does **not**
 * touch Mesh / Object3D `boundingSphere` (v0.93). It does **not**
 * touch `normalized` (v0.95 `pinColorOnlyVisualNormalized`
 * runs after this helper). It does **not** change
 * `frustumCulled`. Load-time only — not per-frame.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Already-static usage is left as-is. Any other
 * value is assigned `StaticDrawUsage` via `setUsage`.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * object-sphere pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover usage on
 * color-only stand-ins — that is the pulse, so a color-only
 * geometry is not skipped merely because an attribute still has
 * a non-static usage. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicUsage(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryUsage(mesh.geometry);
  return mesh;
}

/**
 * After leftover Mesh / Object3D `boundingSphere` is deleted
 * (procedural create / packaged detect), pin leftover
 * BufferAttribute `usage` to `StaticDrawUsage` on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferAttribute keeps its authored usage. Color-only leftover
 * non-static usage is pinned. Does not invent meshes. Does not
 * replace attributes or the geometry. Does not touch `updateRange`
 * (v0.90). Does not touch `updateRanges` (v0.91). Does not touch
 * geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch
 * Mesh / Object3D `boundingSphere` (v0.93). Does not touch
 * `normalized` (v0.95 `pinColorOnlyVisualNormalized` runs after
 * this helper and leaves this usage pin alone). Does not delete
 * `skinIndex` / `skinWeight`. Does not touch `drawRange`. Does not
 * touch `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Load-time
 * only — not per-frame.
 */
export function pinColorOnlyVisualUsage(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicUsage(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `normalized` to the r170 constructor
 * default `false` in place. Skip `InterleavedBufferAttribute`. Do
 * not replace the attribute or its typed array. Do not call
 * `setUsage`. Do not touch `updateRange` / `updateRanges`.
 *
 * **Checked installed three@0.170.0:** the BufferAttribute
 * constructor is `(array, itemSize, normalized = false)` and assigns
 * `this.normalized = normalized`. Omitting the argument leaves
 * `normalized === false`. `Float16BufferAttribute` forwards its
 * third argument to that constructor, so an omitted flag is also
 * `false`. `WebGLAttributes.createBuffer` does not read
 * `normalized` (it passes `usage` to `gl.bufferData`).
 * `WebGLBindingStates.setupVertexAttributes` reads
 * `geometryAttribute.normalized` and passes it to
 * `gl.vertexAttribPointer`.
 */
function pinColorOnlyBufferAttributeNormalized(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  if (attribute.normalized === false) return;
  attribute.normalized = false;
}

/**
 * Pin leftover `normalized` on every non-interleaved BufferAttribute
 * in `geometry.attributes`, plus `geometry.index` when it is a
 * BufferAttribute. Interleaved geometries stay authored. Does not
 * replace the geometry or its attributes. Does not call `setUsage`
 * (v0.94). Does not touch `updateRange` (v0.90), `updateRanges`
 * (v0.91), or geometry `boundingBox` / `boundingSphere` (v0.92).
 */
function pinColorOnlyGeometryNormalized(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeNormalized(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeNormalized(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute `normalized` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor defaults `normalized` to `false` and
 * assigns that field directly. `WebGLBindingStates` passes
 * `attribute.normalized` into `gl.vertexAttribPointer`. v0.94 pins
 * `usage` and does not read `normalized`, so a DCC leftover
 * `normalized === true` on Float32 / Float16 `position` (or the
 * index) can survive ingest. WebGL requires `normalized` to be false
 * for `FLOAT` and `HALF_FLOAT`. A leftover `true` normalizes static
 * packed color-only positions and breaks the Quest 3 TBDR draw.
 * This helper assigns `attribute.normalized = false` only when the
 * field is not already `false`. It does **not** replace the
 * attribute, the typed array, or the geometry. It does **not** call
 * `setUsage` (v0.94 `StaticDrawUsage` stays). It does **not** touch
 * `updateRange` (v0.90). It does **not** touch `updateRanges`
 * (v0.91). It does **not** touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). It does **not** touch Mesh / Object3D
 * `boundingSphere` (v0.93). It does **not** change `frustumCulled`.
 * Load-time only — not per-frame.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Already-false `normalized` is left as-is.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 * Does **not** touch `gpuType` (v0.96
 * `pinColorOnlyVisualGpuType` runs after this helper).
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline / usage
 * pin. Skip colliders. Skip interleaved geometries. Mapped / lit
 * stay authored. This helper pins leftover `normalized` on
 * color-only stand-ins — that is the pulse, so a color-only
 * geometry is not skipped merely because an attribute still has
 * `normalized === true`. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicNormalized(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryNormalized(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `usage` is pinned to
 * `StaticDrawUsage` (procedural create / packaged detect), pin
 * leftover BufferAttribute `normalized` to `false` on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferAttribute keeps its authored `normalized`. Color-only
 * leftover `normalized !== false` is pinned. Does not invent meshes.
 * Does not replace attributes, typed arrays, or the geometry. Does
 * not call `setUsage` (v0.94). Does not touch `updateRange` (v0.90).
 * Does not touch `updateRanges` (v0.91). Does not touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh /
 * Object3D `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does
 * not touch Mesh `morphTargetInfluences` / `morphTargetDictionary`.
 * Does not touch Object3D `animations`. Does not change
 * `frustumCulled`. Does not touch `gpuType` (v0.96
 * `pinColorOnlyVisualGpuType` runs after this helper and
 * leaves this `normalized` pin alone). Load-time only —
 * not per-frame.
 */
export function pinColorOnlyVisualNormalized(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicNormalized(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `gpuType` to the r170 constructor
 * default `FloatType` in place. Skip `InterleavedBufferAttribute`.
 * Do not replace the attribute or its typed array. Do not call
 * `setUsage`. Do not reassign `normalized`. Do not touch
 * `updateRange` / `updateRanges`.
 *
 * **Checked installed three@0.170.0:** the BufferAttribute
 * constructor assigns `this.gpuType = FloatType` (1015).
 * `Float16BufferAttribute` calls that constructor and does not
 * override `gpuType`, so a Float16 position also starts at
 * `FloatType`. `WebGLAttributes.createBuffer` chooses the GL
 * component type from the typed array (`Float32Array` →
 * `gl.FLOAT`, `isFloat16BufferAttribute` → `gl.HALF_FLOAT`) and
 * does not read `gpuType`. `WebGLBindingStates.setupVertexAttributes`
 * treats the attribute as integer when
 * `geometryAttribute.gpuType === IntType` (1013) and then calls
 * `gl.vertexAttribIPointer` instead of `gl.vertexAttribPointer`.
 */
function pinColorOnlyBufferAttributeGpuType(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  if (attribute.gpuType === FloatType) return;
  attribute.gpuType = FloatType;
}

/**
 * Pin leftover `gpuType` on every non-interleaved BufferAttribute
 * in `geometry.attributes`, plus `geometry.index` when it is a
 * BufferAttribute. Interleaved geometries stay authored. Does not
 * replace the geometry or its attributes. Does not call `setUsage`
 * (v0.94). Does not reassign `normalized` (v0.95). Does not touch
 * `updateRange` (v0.90), `updateRanges` (v0.91), or geometry
 * `boundingBox` / `boundingSphere` (v0.92).
 */
function pinColorOnlyGeometryGpuType(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeGpuType(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeGpuType(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute `gpuType` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns `this.gpuType = FloatType`.
 * `WebGLBindingStates` uses `attribute.gpuType === IntType` to
 * choose `gl.vertexAttribIPointer` over `gl.vertexAttribPointer`.
 * v0.95 pins `normalized` and does not read `gpuType`, so a DCC
 * leftover `gpuType === IntType` on Float32 / Float16 `position`
 * (or the index) can survive ingest. That integer binding
 * mis-types static packed color-only props and breaks the Quest 3
 * TBDR draw. This helper assigns `attribute.gpuType = FloatType`
 * only when the field is not already `FloatType`. It does **not**
 * replace the attribute, the typed array, or the geometry. It does
 * **not** call `setUsage` (v0.94 `StaticDrawUsage` stays). It does
 * **not** reassign `normalized` (v0.95 stays). It does **not**
 * touch `updateRange` (v0.90). It does **not** touch `updateRanges`
 * (v0.91). It does **not** touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). It does **not** touch Mesh / Object3D
 * `boundingSphere` (v0.93). It does **not** change `frustumCulled`.
 * Load-time only — not per-frame.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Already-`FloatType` `gpuType` is left as-is.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * normalized pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover `gpuType`
 * on color-only stand-ins — that is the pulse, so a color-only
 * geometry is not skipped merely because an attribute still has
 * a non-`FloatType` `gpuType`. Does **not** touch `name` (v0.97
 * `pinColorOnlyVisualName` runs after this helper). Does not
 * invent meshes.
 */
export function pinColorOnlyUnlitBasicGpuType(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryGpuType(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `normalized` is pinned to `false`
 * (procedural create / packaged detect), pin leftover BufferAttribute
 * `gpuType` to `FloatType` on every packed color-only unlit MeshBasic
 * visual geometry (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferAttribute keeps its authored `gpuType`. Color-only leftover
 * `gpuType !== FloatType` is pinned. Does not invent meshes. Does
 * not replace attributes, typed arrays, or the geometry. Does not
 * call `setUsage` (v0.94). Does not reassign `normalized` (v0.95).
 * Does not touch `updateRange` (v0.90). Does not touch `updateRanges`
 * (v0.91). Does not touch geometry `boundingBox` / `boundingSphere`
 * (v0.92). Does not touch Mesh / Object3D `boundingSphere` (v0.93).
 * Does not delete `skinIndex` / `skinWeight`. Does not touch
 * `drawRange`. Does not touch `groups`. Does not touch
 * `morphAttributes` / `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * touch `name` (v0.97 `pinColorOnlyVisualName` runs after this
 * helper and leaves this `gpuType` pin alone). Load-time only —
 * not per-frame.
 */
export function pinColorOnlyVisualGpuType(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicGpuType(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `name` to the r170 constructor
 * default empty string in place. Skip `InterleavedBufferAttribute`.
 * Do not replace the attribute or its typed array. Do not touch
 * `gpuType`. Do not call `setUsage`. Do not reassign `normalized`.
 * Do not touch `updateRange` / `updateRanges`.
 *
 * **Checked installed three@0.170.0:** the BufferAttribute
 * constructor assigns `this.name = ''`. `Float16BufferAttribute`
 * calls that constructor and does not override `name`.
 * `BufferAttribute.copy` copies `source.name`.
 * `BufferAttribute.toJSON` writes `data.name` only when
 * `this.name !== ''`. `BufferGeometryLoader` assigns
 * `bufferAttribute.name` from JSON when that field is present.
 * `WebGLAttributes` and `WebGLBindingStates` do not read
 * `attribute.name`.
 */
function pinColorOnlyBufferAttributeName(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  if (attribute.name === "") return;
  attribute.name = "";
}

/**
 * Pin leftover `name` on every non-interleaved BufferAttribute
 * in `geometry.attributes`, plus `geometry.index` when it is a
 * BufferAttribute. Interleaved geometries stay authored. Does not
 * replace the geometry or its attributes. Does not touch `gpuType`
 * (v0.96). Does not call `setUsage` (v0.94). Does not reassign
 * `normalized` (v0.95). Does not touch `updateRange` (v0.90),
 * `updateRanges` (v0.91), or geometry `boundingBox` /
 * `boundingSphere` (v0.92).
 */
function pinColorOnlyGeometryName(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeName(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeName(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute `name` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns `this.name = ''`.
 * `WebGLAttributes` and `WebGLBindingStates` do not read
 * `attribute.name`, so a leftover accessor or exporter name does
 * not change the draw. v0.96 pins `gpuType` and does not read
 * `name`, so a DCC / GLB / JSON leftover non-empty `name` on
 * Float32 / Float16 `position` (or the index) can survive ingest.
 * Those strings stay retained on static packed color-only props.
 * This helper assigns `attribute.name = ''` only when the field
 * is not already `''`. It does **not** replace the attribute, the
 * typed array, or the geometry. It does **not** touch `gpuType`
 * (v0.96 `FloatType` stays). It does **not** call `setUsage`
 * (v0.94 `StaticDrawUsage` stays). It does **not** reassign
 * `normalized` (v0.95 stays). It does **not** touch `updateRange`
 * (v0.90). It does **not** touch `updateRanges` (v0.91). It does
 * **not** touch geometry `boundingBox` / `boundingSphere` (v0.92).
 * It does **not** touch Mesh / Object3D `boundingSphere` (v0.93).
 * It does **not** change `frustumCulled`. Load-time only — not
 * per-frame. Clearing the string does not change draws, tris, or
 * attrBytes.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Already-empty `name` is left as-is.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 * Does **not** rename the Mesh.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * gpuType pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover `name`
 * on color-only stand-ins — that is the pulse, so a color-only
 * geometry is not skipped merely because an attribute still has
 * a non-empty `name`. Does **not** touch `version` (v0.98
 * `pinColorOnlyVisualVersion` runs after this helper and
 * leaves this `name` pin alone). Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicName(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryName(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `gpuType` is pinned to `FloatType`
 * (procedural create / packaged detect), pin leftover BufferAttribute
 * `name` to `''` on every packed color-only unlit MeshBasic visual
 * geometry (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferAttribute keeps its authored `name`. Color-only leftover
 * `name !== ''` is pinned. Does not invent meshes. Does not replace
 * attributes, typed arrays, or the geometry. Does not touch `gpuType`
 * (v0.96). Does not call `setUsage` (v0.94). Does not reassign
 * `normalized` (v0.95). Does not touch `updateRange` (v0.90). Does
 * not touch `updateRanges` (v0.91). Does not touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh /
 * Object3D `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does
 * not touch Mesh `morphTargetInfluences` / `morphTargetDictionary`.
 * Does not touch Object3D `animations`. Does not change
 * `frustumCulled`. Does not rename the Mesh. Does not touch
 * `version` (v0.98 `pinColorOnlyVisualVersion` runs after this
 * helper and leaves this `name` pin alone). Does not touch
 * `onUpload` / `onUploadCallback`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualName(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicName(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferAttribute `version` to the r170 constructor
 * default `0` in place. Skip `InterleavedBufferAttribute`. Do not
 * replace the attribute or its typed array. Do not touch `name`.
 * Do not touch `gpuType`. Do not call `setUsage`. Do not reassign
 * `normalized`. Do not touch `updateRange` / `updateRanges`. Do
 * not touch `onUpload` / `onUploadCallback`.
 *
 * **Checked installed three@0.170.0:** the BufferAttribute
 * constructor assigns `this.version = 0`. The `needsUpdate` setter
 * increments `version` when `value === true`. `Float16BufferAttribute`
 * calls that constructor and does not override `version`.
 * `BufferAttribute.copy` does not copy `version`. `toJSON` does not
 * write `version`. `WebGLAttributes.update` creates the GL buffer
 * on first sight and stores `attribute.version`; a later call runs
 * `updateBuffer` (`gl.bufferSubData`, then `onUploadCallback`) when
 * the stored buffer version is less than `attribute.version`.
 */
function pinColorOnlyBufferAttributeVersion(attribute) {
  if (!attribute || attribute.isInterleavedBufferAttribute) return;
  if (attribute.isBufferAttribute !== true) return;
  if (attribute.version === 0) return;
  attribute.version = 0;
}

/**
 * Pin leftover `version` on every non-interleaved BufferAttribute
 * in `geometry.attributes`, plus `geometry.index` when it is a
 * BufferAttribute. Interleaved geometries stay authored. Does not
 * replace the geometry or its attributes. Does not touch `name`
 * (v0.97). Does not touch `gpuType` (v0.96). Does not call
 * `setUsage` (v0.94). Does not reassign `normalized` (v0.95). Does
 * not touch `updateRange` (v0.90), `updateRanges` (v0.91), or
 * geometry `boundingBox` / `boundingSphere` (v0.92). Does not touch
 * `onUpload` / `onUploadCallback` (v0.43).
 */
function pinColorOnlyGeometryVersion(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  const attributes = geometry.attributes;
  if (attributes) {
    for (const name of Object.keys(attributes)) {
      pinColorOnlyBufferAttributeVersion(geometry.getAttribute(name));
    }
  }
  pinColorOnlyBufferAttributeVersion(geometry.index);
}

/**
 * Pin Quest-safe BufferAttribute `version` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferAttribute constructor assigns `this.version = 0`. The
 * `needsUpdate` setter increments `version` when `value === true`.
 * `WebGLAttributes.update` stores `attribute.version` on the first
 * upload (`createBuffer`) and calls `updateBuffer` (`gl.bufferSubData`,
 * then `onUploadCallback`) when the stored buffer version is less
 * than `attribute.version`. v0.97 pins `name` and does not read
 * `version`, so a DCC / GLB / JSON leftover, a prior `needsUpdate`,
 * or `BufferGeometry.applyMatrix4` (which sets `position.needsUpdate
 * = true`) can leave a non-zero `version` on Float32 / Float16
 * `position` (or the index) before the first upload. That mismatch
 * forces extra TBDR `bufferSubData` on static packed color-only
 * props. This helper assigns `attribute.version = 0` only when the
 * field is not already `0`. Direct assignment does not go through
 * `needsUpdate`, so it does not increment. It does **not** replace
 * the attribute, the typed array, or the geometry. It does **not**
 * touch `name` (v0.97 empty string stays). It does **not** touch
 * `gpuType` (v0.96 `FloatType` stays). It does **not** call
 * `setUsage` (v0.94 `StaticDrawUsage` stays). It does **not**
 * reassign `normalized` (v0.95 stays). It does **not** touch
 * `onUpload` / `onUploadCallback` (v0.43 CPU-release hook stays).
 * It does **not** touch `updateRange` (v0.90). It does **not** touch
 * `updateRanges` (v0.91). It does **not** touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). It does **not** touch
 * Mesh / Object3D `boundingSphere` (v0.93). It does **not** change
 * `frustumCulled`. Load-time only — not per-frame. Pinning `version`
 * does not change draws, tris, or attrBytes.
 *
 * Walks every non-interleaved `BufferAttribute` in
 * `geometry.attributes` plus `geometry.index` when it is a
 * BufferAttribute. Already-`0` `version` is left as-is.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 * Does **not** rename the Mesh.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * name pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover `version`
 * on color-only stand-ins — that is the pulse, so a color-only
 * geometry is not skipped merely because an attribute still has
 * a non-zero `version`. Does **not** touch BufferGeometry `name`
 * (v0.99 `pinColorOnlyVisualGeometryName` runs after this helper
 * and leaves this `version` pin alone). Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicVersion(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryVersion(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `name` is pinned to `''`
 * (procedural create / packaged detect), pin leftover BufferAttribute
 * `version` to `0` on every packed color-only unlit MeshBasic visual
 * geometry (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferAttribute keeps its authored `version`. Color-only leftover
 * `version !== 0` is pinned. Does not invent meshes. Does not replace
 * attributes, typed arrays, or the geometry. Does not touch `name`
 * (v0.97). Does not touch `gpuType` (v0.96). Does not call `setUsage`
 * (v0.94). Does not reassign `normalized` (v0.95). Does not touch
 * `onUpload` / `onUploadCallback` (v0.43). Does not touch
 * `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does
 * not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does
 * not touch Mesh / Object3D `boundingSphere` (v0.93). Does not delete
 * `skinIndex` / `skinWeight`. Does not touch `drawRange`. Does not
 * touch `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * rename the Mesh. Does not touch BufferGeometry `name` (v0.99
 * `pinColorOnlyVisualGeometryName` runs after this helper and
 * leaves this `version` pin alone). Load-time only — not per-frame.
 */
export function pinColorOnlyVisualVersion(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicVersion(mesh);
  }
  return entity;
}

/**
 * Pin leftover BufferGeometry `name` to the r170 constructor
 * default empty string in place. Do not replace the geometry,
 * its attributes, or typed arrays. Do not touch BufferAttribute
 * `version` / `name` / `gpuType` / `normalized` / `usage` /
 * `updateRange` / `updateRanges` / `onUpload` /
 * `onUploadCallback`. Do not touch geometry `boundingBox` /
 * `boundingSphere`.
 *
 * **Checked installed three@0.170.0:** the BufferGeometry
 * constructor assigns `this.name = ''`. `toJSON` writes
 * `data.name` only when `this.name !== ''`. `copy` copies
 * `source.name`. `BufferGeometryLoader` assigns
 * `geometry.name = json.name` when `json.name` is present.
 * `ObjectLoader.parseGeometries` assigns `geometry.name =
 * data.name` when `data.name !== undefined`. Stock GLTFLoader
 * names the Mesh and copies primitive extras onto
 * `geometry.userData`; it does not assign `geometry.name`.
 * `WebGLRenderer` does not read `geometry.name`.
 */
function pinColorOnlyBufferGeometryName(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  if (geometry.name === "") return;
  geometry.name = "";
}

/**
 * Pin Quest-safe BufferGeometry `name` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferGeometry constructor assigns `this.name = ''`.
 * `BufferGeometry.toJSON` writes `data.name` only when
 * `this.name !== ''`. `BufferGeometry.copy` copies `source.name`.
 * `BufferGeometryLoader` assigns `geometry.name = json.name` when
 * `json.name` is present. `ObjectLoader.parseGeometries` assigns
 * `geometry.name = data.name` when `data.name !== undefined`.
 * Stock GLTFLoader assigns `mesh.name` from the glTF mesh name
 * and copies primitive extras onto `geometry.userData`; it does
 * not assign `geometry.name`. `WebGLRenderer` does not read
 * `geometry.name`, so a leftover exporter / mesh / primitive name
 * does not change the draw. v0.98 pins BufferAttribute `version`
 * and does not read `geometry.name`, so a DCC / JSON leftover
 * non-empty `geometry.name` can survive ingest. Those strings
 * stay retained on static packed color-only props. This helper
 * assigns `geometry.name = ''` only when the field is not already
 * `''`. It does **not** replace the geometry, the attributes, or
 * the typed arrays. It does **not** touch BufferAttribute
 * `version` (v0.98 `0` stays). It does **not** touch
 * BufferAttribute `name` (v0.97 empty string stays). It does
 * **not** touch `gpuType` (v0.96 `FloatType` stays). It does
 * **not** call `setUsage` (v0.94 `StaticDrawUsage` stays). It
 * does **not** reassign `normalized` (v0.95 stays). It does
 * **not** touch `onUpload` / `onUploadCallback` (v0.43 CPU-release
 * hook stays). It does **not** touch `updateRange` (v0.90). It
 * does **not** touch `updateRanges` (v0.91). It does **not**
 * touch geometry `boundingBox` / `boundingSphere` (v0.92). It
 * does **not** touch Mesh / Object3D `boundingSphere` (v0.93).
 * It does **not** change `frustumCulled`. Load-time only — not
 * per-frame. Clearing the string does not change draws, tris, or
 * attrBytes.
 *
 * Already-empty `geometry.name` is left as-is.
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 * Does **not** rename the Mesh (`lidMesh` / `latchMesh` /
 * `fastenerMesh` stay). Does **not** touch BufferGeometry
 * `userData` (v1.0.0 `pinColorOnlyVisualGeometryUserData` runs
 * after this helper and leaves this `name` pin alone). Does
 * **not** touch Mesh / Object3D `userData`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * version pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover
 * `geometry.name` on color-only stand-ins — that is the pulse,
 * so a color-only geometry is not skipped merely because its
 * `name` is still non-empty. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicGeometryName(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyBufferGeometryName(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferAttribute `version` is pinned to `0`
 * (procedural create / packaged detect), pin leftover
 * BufferGeometry `name` to `''` on every packed color-only unlit
 * MeshBasic visual geometry (body LOD leaves + lid/latch/tool +
 * fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferGeometry keeps its authored `name`. Color-only leftover
 * `geometry.name !== ''` is pinned. Does not invent meshes. Does
 * not replace the geometry, attributes, or typed arrays. Does not
 * touch BufferAttribute `version` (v0.98). Does not touch
 * BufferAttribute `name` (v0.97). Does not touch `gpuType` (v0.96).
 * Does not call `setUsage` (v0.94). Does not reassign `normalized`
 * (v0.95). Does not touch `onUpload` / `onUploadCallback` (v0.43).
 * Does not touch `updateRange` (v0.90). Does not touch
 * `updateRanges` (v0.91). Does not touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Does not touch Mesh / Object3D
 * `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch
 * `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * rename the Mesh. Does not touch BufferGeometry `userData` (v1.0.0
 * `pinColorOnlyVisualGeometryUserData` runs after this helper and
 * leaves this `name` pin alone). Does not touch Mesh / Object3D
 * `userData`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualGeometryName(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicGeometryName(mesh);
  }
  return entity;
}

/**
 * True when `value` is already the r170 BufferGeometry constructor
 * default: a plain object (`Object.prototype`), with no own string
 * or symbol keys. Arrays, null, missing, non-objects, null-prototype
 * objects, and objects with a non-`Object.prototype` prototype are
 * not empty plain objects.
 */
function isEmptyPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  if (Object.getOwnPropertyNames(value).length !== 0) return false;
  if (Object.getOwnPropertySymbols(value).length !== 0) return false;
  return true;
}

/**
 * Pin leftover BufferGeometry `userData` to a fresh empty plain
 * object in place. Do not replace the geometry, its attributes, or
 * typed arrays. Do not touch `geometry.name`. Do not touch
 * BufferAttribute `version` / `name` / `gpuType` / `normalized` /
 * `usage` / `updateRange` / `updateRanges` / `onUpload` /
 * `onUploadCallback`. Do not touch geometry `boundingBox` /
 * `boundingSphere`. Do not touch Mesh / Object3D `userData`.
 *
 * **Checked installed three@0.170.0:** the BufferGeometry
 * constructor assigns `this.userData = {}`. `toJSON` writes
 * `data.userData` only when `Object.keys(this.userData).length > 0`.
 * `copy` assigns `this.userData = source.userData` (shared
 * reference). `BufferGeometryLoader` assigns
 * `geometry.userData = json.userData` when `json.userData` is
 * truthy. `ObjectLoader.parseGeometries` assigns
 * `geometry.userData = data.userData` when `data.userData !==
 * undefined`. Stock GLTFLoader `addPrimitiveAttributes` calls
 * `assignExtrasToUserData(geometry, primitiveDef)`, which
 * `Object.assign`s primitive extras onto `geometry.userData`.
 * `WebGLRenderer` does not read `geometry.userData`.
 */
function pinColorOnlyBufferGeometryUserData(geometry) {
  if (!geometry || colorOnlyGeometryInterleaved(geometry)) return;
  if (isEmptyPlainObject(geometry.userData)) return;
  geometry.userData = {};
}

/**
 * Pin Quest-safe BufferGeometry `userData` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the
 * BufferGeometry constructor assigns `this.userData = {}`.
 * `BufferGeometry.toJSON` writes `data.userData` only when
 * `Object.keys(this.userData).length > 0`. `BufferGeometry.copy`
 * assigns `this.userData = source.userData` (shared reference, not
 * a clone). `BufferGeometryLoader` assigns
 * `geometry.userData = json.userData` when `json.userData` is
 * truthy. `ObjectLoader.parseGeometries` assigns
 * `geometry.userData = data.userData` when `data.userData !==
 * undefined`. Stock GLTFLoader `addPrimitiveAttributes` calls
 * `assignExtrasToUserData(geometry, primitiveDef)`, which
 * `Object.assign`s an object primitive `extras` onto
 * `geometry.userData`. It also names the Mesh and assigns mesh
 * extras onto `mesh.userData`. `WebGLRenderer` does not read
 * `geometry.userData`, so leftover primitive extras do not change
 * the draw. v0.99 pins `geometry.name` and does not clear
 * `geometry.userData`, so DCC / glTF extras can survive ingest on
 * static packed color-only props. This helper assigns
 * `geometry.userData = {}` (a fresh plain object, not a shared
 * module-level `{}`) only when the field is missing, non-object,
 * or not already an empty plain object (own keys, or a prototype
 * other than `Object.prototype`). It does **not** replace the
 * geometry, the attributes, or the typed arrays. It does **not**
 * touch BufferGeometry `name` (v0.99 `''` stays). It does **not**
 * touch Mesh / Object3D `userData` (studio metadata stays). It does
 * **not** touch BufferAttribute `version` (v0.98 `0` stays). It
 * does **not** touch BufferAttribute `name` (v0.97 empty string
 * stays). It does **not** touch `gpuType` (v0.96 `FloatType`
 * stays). It does **not** call `setUsage` (v0.94 `StaticDrawUsage`
 * stays). It does **not** reassign `normalized` (v0.95 stays). It
 * does **not** touch `onUpload` / `onUploadCallback` (v0.43
 * CPU-release hook stays). It does **not** touch `updateRange`
 * (v0.90). It does **not** touch `updateRanges` (v0.91). It does
 * **not** touch geometry `boundingBox` / `boundingSphere` (v0.92).
 * It does **not** touch Mesh / Object3D `boundingSphere` (v0.93).
 * It does **not** change `frustumCulled`. Load-time only — not
 * per-frame. Replacing leftover extras does not change draws, tris,
 * or attrBytes.
 *
 * Already-empty plain `geometry.userData` is left as-is (same
 * object).
 *
 * Does **not** delete `skinIndex` / `skinWeight` (v0.89). Does
 * **not** touch `drawRange` (v0.88). Does **not** touch `groups`
 * (v0.87). Does **not** touch `morphAttributes` /
 * `morphTargetsRelative` (v0.86). Does **not** touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary` (v0.85).
 * Does **not** touch Object3D `animations` (v0.84). Does **not**
 * pin `mesh.visible`. Does **not** change `matrixAutoUpdate`.
 * Does **not** rename the Mesh (`lidMesh` / `latchMesh` /
 * `fastenerMesh` stay). Does **not** touch Material `userData`
 * (v1.1.0 `pinColorOnlyVisualMaterialUserData` runs after this
 * helper and leaves this geometry pin alone). Does **not** touch
 * Material `name`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the pack pipeline /
 * geometry-name pin. Skip colliders. Skip interleaved geometries.
 * Mapped / lit stay authored. This helper pins leftover
 * `geometry.userData` on color-only stand-ins — that is the pulse,
 * so a color-only geometry is not skipped merely because its
 * `userData` still has extras. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicGeometryUserData(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyBufferGeometryUserData(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferGeometry `name` is pinned to `''`
 * (procedural create / packaged detect), pin leftover
 * BufferGeometry `userData` to a fresh empty plain object on every
 * packed color-only unlit MeshBasic visual geometry (body LOD
 * leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared
 * BufferGeometry keeps its authored `userData`. Color-only leftover
 * non-empty `geometry.userData` is pinned. Does not invent meshes.
 * Does not replace the geometry, attributes, or typed arrays. Does
 * not touch BufferGeometry `name` (v0.99). Does not touch Mesh /
 * Object3D `userData`. Does not touch BufferAttribute `version`
 * (v0.98). Does not touch BufferAttribute `name` (v0.97). Does not
 * touch `gpuType` (v0.96). Does not call `setUsage` (v0.94). Does
 * not reassign `normalized` (v0.95). Does not touch `onUpload` /
 * `onUploadCallback` (v0.43). Does not touch `updateRange` (v0.90).
 * Does not touch `updateRanges` (v0.91). Does not touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh /
 * Object3D `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch
 * `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * rename the Mesh. Does not touch Material `userData` (v1.1.0
 * `pinColorOnlyVisualMaterialUserData` runs after this helper and
 * leaves this geometry pin alone). Does not touch Material `name`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualGeometryUserData(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicGeometryUserData(mesh);
  }
  return entity;
}

/**
 * Pin leftover Material `userData` to a fresh empty plain object in
 * place. Do not replace the material. Do not touch Material `name`
 * (v1.2.0 `pinColorOnlyVisualMaterialName` runs after the visual
 * helper and leaves this `userData` pin alone).
 * Do not touch Mesh / Object3D `userData` or BufferGeometry
 * `userData`.
 *
 * **Checked installed three@0.170.0:** the Material constructor
 * assigns `this.userData = {}`. `toJSON` writes `data.userData`
 * only when `Object.keys(this.userData).length > 0`. `copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone, not a shared reference — unlike `BufferGeometry.copy`).
 * `MaterialLoader` assigns `material.userData = json.userData` when
 * `json.userData !== undefined`. `ObjectLoader.parseMaterials` uses
 * that loader. Stock GLTFLoader `loadMaterial` calls
 * `assignExtrasToUserData(material, materialDef)`, which
 * `Object.assign`s material extras onto `material.userData`, and
 * `addUnknownExtensionsToUserData` may add `gltfExtensions`.
 * `WebGLRenderer` does not read `material.userData`.
 */
function pinColorOnlyMeshBasicMaterialUserData(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (isEmptyPlainObject(material.userData)) return;
  material.userData = {};
}

/**
 * Pin Quest-safe Material `userData` on a packed color-only unlit
 * MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the Material
 * constructor assigns `this.userData = {}`. `Material.toJSON` writes
 * `data.userData` only when `Object.keys(this.userData).length > 0`.
 * `Material.copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone). That is not the shared-reference assign
 * `BufferGeometry.copy` uses. `MaterialLoader` assigns
 * `material.userData = json.userData` when `json.userData !==
 * undefined`. `ObjectLoader.parseMaterials` goes through
 * `MaterialLoader`. Stock GLTFLoader `loadMaterial` names the
 * material from `materialDef.name` and calls
 * `assignExtrasToUserData(material, materialDef)`, which
 * `Object.assign`s an object `extras` onto `material.userData`.
 * Unknown glTF extensions can also land on
 * `material.userData.gltfExtensions`. `WebGLRenderer` does not read
 * `material.userData`, so leftover DCC extras do not change the
 * draw on static color-only MeshBasics. v1.0.0 pins
 * `geometry.userData` and does not clear `material.userData`, so
 * those extras can survive ingest on the shared wood / brass /
 * steel stand-ins. This helper assigns `material.userData = {}`
 * (a fresh plain object, not a shared module-level `{}`) only when
 * the field is missing, non-object, or not already an empty plain
 * object (own string or symbol keys, or a prototype other than
 * `Object.prototype`). It does **not** replace the material, the
 * geometry, the attributes, or the typed arrays. It does **not**
 * touch Material `name` (v1.2.0 `pinColorOnlyVisualMaterialName`
 * runs after this helper and leaves this `userData` pin alone). It
 * does **not**
 * touch prior material program-cache / flag pins (`glslVersion`,
 * `flatShading`, `defines`, `customProgramCacheKey`,
 * `onBeforeCompile`, `onBeforeRender`, and the v0.47–v0.75 flag
 * suite). It does **not** touch BufferGeometry `userData` (v1.0.0
 * empty plain object stays) or BufferGeometry `name` (v0.99 `''`
 * stays). It does **not** touch Mesh / Object3D `userData` (studio
 * metadata stays). It does **not** touch BufferAttribute `version`
 * / `name` / `gpuType` / `normalized` / `usage` / `updateRange` /
 * `updateRanges` / `onUpload` / `onUploadCallback`. It does **not**
 * touch geometry `boundingBox` / `boundingSphere` or Mesh
 * `boundingSphere`. It does **not** change `frustumCulled`.
 * Load-time only — not per-frame. Replacing leftover extras does
 * not change draws, tris, or attrBytes.
 *
 * Already-empty plain `material.userData` is left as-is (same
 * object), including when two materials already share that empty
 * object. Two materials that need a replacement each get their own
 * `{}`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the geometry-userData pin.
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper pins leftover `material.userData` on
 * color-only stand-ins — that is the pulse, so a color-only
 * material is not skipped merely because its `userData` still has
 * extras. Does not invent materials.
 */
export function pinColorOnlyUnlitBasicMaterialUserData(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialUserData(mesh.material);
  return mesh;
}

/**
 * After leftover BufferGeometry `userData` is pinned to a fresh
 * empty plain object (procedural create / packaged detect), pin
 * leftover Material `userData` to a fresh empty plain object on
 * every packed color-only unlit MeshBasic visual material (shared
 * wood / brass / steel stand-ins; body LOD leaves + lid/latch/tool
 * + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `userData`. Skip geometries shared with a collider, an interleaved
 * mesh, or a mapped / lit mesh so a visual that shares that geometry
 * does not pin its material. Color-only leftover non-empty
 * `material.userData` is pinned. Does not invent materials. Does not
 * replace the material, the geometry, attributes, or typed arrays.
 * Does not touch Material `name` (v1.2.0
 * `pinColorOnlyVisualMaterialName` runs after this helper and leaves
 * this `userData` pin alone). Does not touch prior material
 * program-cache / flag pins. Does not touch BufferGeometry `userData`
 * (v1.0.0) or BufferGeometry `name` (v0.99). Does not touch Mesh /
 * Object3D `userData`. Does not touch BufferAttribute `version`
 * (v0.98) / `name` (v0.97) / `gpuType` (v0.96). Does not call
 * `setUsage` (v0.94). Does not reassign `normalized` (v0.95). Does
 * not touch `onUpload` / `onUploadCallback` (v0.43). Does not touch
 * `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does
 * not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does
 * not touch Mesh / Object3D `boundingSphere` (v0.93). Does not delete
 * `skinIndex` / `skinWeight`. Does not touch `drawRange`. Does not
 * touch `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * pin `mesh.visible`. Does not rename the Mesh. Load-time only —
 * not per-frame.
 */
export function pinColorOnlyVisualMaterialUserData(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMaterialUserData(mesh);
  }
  return entity;
}

/**
 * Pin leftover Material `name` to the r170 constructor default empty
 * string in place. Do not replace the material. Do not touch Material
 * `userData`. Do not touch Mesh / Object3D `userData` or
 * BufferGeometry `userData` / `name`.
 *
 * **Checked installed three@0.170.0:** the Material constructor
 * assigns `this.name = ''`. `toJSON` writes `data.name` only when
 * `this.name !== ''`. `copy` copies `source.name`. `MaterialLoader`
 * assigns `material.name = json.name` when `json.name !== undefined`.
 * Stock GLTFLoader `loadMaterial` assigns
 * `material.name = materialDef.name` when `materialDef.name` is set.
 * `WebGLRenderer` does not read `material.name`.
 * `WebGLPrograms.getParameters` copies `shaderName: material.name`
 * and `WebGLProgram` emits `#define SHADER_NAME` from that parameter.
 * `getProgramCacheKey` does not include `shaderName`, so a leftover
 * name does not fork the program cache or change the draw.
 */
function pinColorOnlyMeshBasicMaterialName(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (material.name === "") return;
  material.name = "";
}

/**
 * Pin Quest-safe Material `name` on a packed color-only unlit
 * MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the Material
 * constructor assigns `this.name = ''`. `Material.toJSON` writes
 * `data.name` only when `this.name !== ''`. `Material.copy` copies
 * `source.name`. `MaterialLoader` assigns `material.name = json.name`
 * when `json.name !== undefined`. `ObjectLoader.parseMaterials` goes
 * through `MaterialLoader`. Stock GLTFLoader `loadMaterial` assigns
 * `material.name = materialDef.name` when `materialDef.name` is set,
 * then calls `assignExtrasToUserData`. `WebGLRenderer` does not read
 * `material.name`. `WebGLPrograms.getParameters` copies
 * `shaderName: material.name`, and `WebGLProgram` prefixes the shader
 * with `#define SHADER_NAME` plus that string. `getProgramCacheKey`
 * does not push `shaderName`, so two otherwise identical MeshBasics
 * share one program whether or not their names differ. A leftover
 * DCC name is string retention on the shared wood / brass / steel
 * stand-ins; it does not change the draw. v1.1.0 pins
 * `material.userData` and does not clear `material.name`, so those
 * names can survive ingest. This helper assigns `material.name = ''`
 * only when the field is not already `''`. It does **not** replace
 * the material, the geometry, the attributes, or the typed arrays.
 * It does **not** touch Material `userData` (v1.1.0 empty plain
 * object stays). It does **not** touch prior material program-cache
 * / flag pins (`glslVersion`, `flatShading`, `defines`,
 * `customProgramCacheKey`, `onBeforeCompile`, `onBeforeRender`, and
 * the v0.47–v0.75 flag suite). It does **not** touch BufferGeometry
 * `userData` (v1.0.0 empty plain object stays) or BufferGeometry
 * `name` (v0.99 `''` stays). It does **not** touch Mesh / Object3D
 * `userData` (studio metadata stays). It does **not** touch
 * BufferAttribute `version` / `name` / `gpuType` / `normalized` /
 * `usage` / `updateRange` / `updateRanges` / `onUpload` /
 * `onUploadCallback`. It does **not** touch geometry `boundingBox` /
 * `boundingSphere` or Mesh `boundingSphere`. It does **not** change
 * `frustumCulled`. Load-time only — not per-frame. Clearing the
 * string does not change draws, tris, or attrBytes.
 *
 * Already-empty `material.name` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the material-userData pin.
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper pins leftover `material.name` on color-only
 * stand-ins — that is the pulse, so a color-only material is not
 * skipped merely because its `name` is still non-empty. Does not
 * invent materials.
 */
export function pinColorOnlyUnlitBasicMaterialName(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialName(mesh.material);
  return mesh;
}

/**
 * After leftover Material `userData` is pinned to a fresh empty plain
 * object (procedural create / packaged detect), pin leftover Material
 * `name` to `''` on every packed color-only unlit MeshBasic visual
 * material (shared wood / brass / steel stand-ins; body LOD leaves +
 * lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `name`. Skip geometries shared with a collider, an interleaved
 * mesh, or a mapped / lit mesh so a visual that shares that geometry
 * does not pin its material. Color-only leftover `material.name !==
 * ''` is pinned. Does not invent materials. Does not replace the
 * material, the geometry, attributes, or typed arrays. Does not touch
 * Material `userData` (v1.1.0). Does not touch prior material
 * program-cache / flag pins. Does not touch BufferGeometry `userData`
 * (v1.0.0) or BufferGeometry `name` (v0.99). Does not touch Mesh /
 * Object3D `userData`. Does not touch BufferAttribute `version`
 * (v0.98) / `name` (v0.97) / `gpuType` (v0.96). Does not call
 * `setUsage` (v0.94). Does not reassign `normalized` (v0.95). Does
 * not touch `onUpload` / `onUploadCallback` (v0.43). Does not touch
 * `updateRange` (v0.90). Does not touch `updateRanges` (v0.91). Does
 * not touch geometry `boundingBox` / `boundingSphere` (v0.92). Does
 * not touch Mesh / Object3D `boundingSphere` (v0.93). Does not delete
 * `skinIndex` / `skinWeight`. Does not touch `drawRange`. Does not
 * touch `groups`. Does not touch `morphAttributes` /
 * `morphTargetsRelative`. Does not touch Mesh
 * `morphTargetInfluences` / `morphTargetDictionary`. Does not touch
 * Object3D `animations`. Does not change `frustumCulled`. Does not
 * pin `mesh.visible`. Does not rename the Mesh (v1.3.0
 * `pinColorOnlyVisualMeshName` runs after this helper and leaves
 * this material `name` pin alone). Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMaterialName(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMaterialName(mesh);
  }
  return entity;
}

/**
 * Studio-named interactables and collider hulls. The v1.3.0 mesh-name
 * pin must not clear these. `collider_*` is also skipped by
 * `isColliderMesh` before the assign.
 */
const COLOR_ONLY_VISUAL_MESH_NAME_KEEP = new Set(["lidMesh", "latchMesh", "fastenerMesh"]);

function colorOnlyVisualMeshNameKept(name) {
  if (name === "lidMesh" || name === "latchMesh" || name === "fastenerMesh") return true;
  return typeof name === "string" && name.startsWith("collider_");
}

/**
 * Pin leftover Mesh / Object3D `name` to the r170 constructor default
 * empty string in place. Do not replace the mesh. Do not touch
 * Material `name` or Material `userData`. Do not touch Mesh /
 * Object3D `userData` or BufferGeometry `userData` / `name`.
 *
 * Keep `lidMesh` / `latchMesh` / `fastenerMesh` and any `collider_*`
 * name. Already-empty `mesh.name` is left as-is.
 *
 * **Checked installed three@0.170.0:** the Object3D constructor
 * assigns `this.name = ''`. `Mesh` does not override `name`.
 * `Object3D.toJSON` writes `object.name` only when `this.name !== ''`.
 * `Object3D.copy` copies `source.name`. `ObjectLoader.parseObject`
 * assigns `object.name = data.name` when `data.name !== undefined`.
 * Stock GLTFLoader assigns `mesh.name` from the mesh definition and,
 * when the node has a name, assigns `node.name` (a single-primitive
 * node is the mesh). `WebGLRenderer` does not read `mesh.name`.
 * `WebGLPrograms.getParameters` copies `shaderName: material.name`,
 * not the mesh name.
 */
function pinColorOnlyMeshObjectName(mesh) {
  if (mesh.name === "") return;
  if (COLOR_ONLY_VISUAL_MESH_NAME_KEEP.has(mesh.name)) return;
  if (colorOnlyVisualMeshNameKept(mesh.name)) return;
  mesh.name = "";
}

/**
 * Pin Quest-safe Mesh / Object3D `name` on a packed color-only unlit
 * MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the Object3D
 * constructor assigns `this.name = ''`. `Mesh` does not override
 * `name`. `Object3D.toJSON` writes `object.name` only when
 * `this.name !== ''`. `Object3D.copy` copies `source.name`.
 * `ObjectLoader.parseObject` assigns `object.name = data.name` when
 * `data.name !== undefined`. Stock GLTFLoader `loadMesh` assigns
 * `mesh.name = parser.createUniqueName(meshDef.name || ('mesh_' +
 * meshIndex))`, then `_loadNodeShallow` assigns `node.name` from
 * `createUniqueName(nodeDef.name)` when the node has a name. When
 * the node has one object, that object is the mesh, so the node name
 * replaces the primitive name. `WebGLRenderer` does not read
 * `mesh.name` (no `.name` access). `WebGLPrograms.getParameters`
 * copies `shaderName: material.name`, not the mesh name, so a
 * leftover mesh name does not fork the program cache or change the
 * draw. v1.2.0 pins `material.name` and does not clear `mesh.name`,
 * so DCC / glTF node and mesh names can still sit on the packed
 * color-only visuals. This helper assigns `mesh.name = ''` only when
 * the field is not already `''` and is not a reserved name
 * (`lidMesh`, `latchMesh`, `fastenerMesh`, or a `collider_*` prefix).
 * It does **not** replace the mesh, the material, the geometry, the
 * attributes, or the typed arrays. It does **not** touch Material
 * `name` (v1.2.0 empty string stays). It does **not** touch Material
 * `userData` (v1.1.0 empty plain object stays). It does **not** touch
 * prior material program-cache / flag pins. It does **not** touch
 * BufferGeometry `userData` (v1.0.0) or BufferGeometry `name` (v0.99).
 * It does **not** touch Mesh / Object3D `userData` (studio metadata
 * stays). It does **not** touch BufferAttribute `version` / `name` /
 * `gpuType` / `normalized` / `usage` / `updateRange` / `updateRanges`
 * / `onUpload` / `onUploadCallback`. It does **not** touch geometry
 * `boundingBox` / `boundingSphere` or Mesh `boundingSphere`. It does
 * **not** change `frustumCulled`, `matrixAutoUpdate`, or
 * `mesh.visible`. Load-time only — not per-frame. Clearing the string
 * does not change draws, tris, or attrBytes.
 *
 * Already-empty `mesh.name` is left as-is. Reserved names are left
 * as-is. Does not pin Mesh `userData` (v1.4.0
 * `pinColorOnlyVisualMeshUserData` runs after the visual helper and
 * leaves this mesh `name` pin alone).
 *
 * Same `isColorOnlyUnlitBasic` gate as the material-name pin. Skip
 * colliders. Skip interleaved geometries. Mapped / lit stay authored.
 * This helper pins leftover `mesh.name` on color-only stand-ins —
 * that is the pulse, so a color-only mesh is not skipped merely
 * because its `name` is still non-empty, unless that name is
 * reserved. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicMeshName(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshObjectName(mesh);
  return mesh;
}

/**
 * After leftover Material `name` is pinned to `''` (procedural create
 * / packaged detect), pin leftover Mesh / Object3D `name` to `''` on
 * every packed color-only unlit MeshBasic visual mesh (body LOD
 * leaves + lid/latch/tool + fastener) except the reserved names
 * `lidMesh`, `latchMesh`, `fastenerMesh`, and any `collider_*` name.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a visual that shares
 * that geometry does not pin its mesh name. Color-only leftover
 * `mesh.name !== ''` is pinned unless the name is reserved. Does not
 * invent meshes. Does not replace the mesh, the material, the
 * geometry, attributes, or typed arrays. Does not touch Material
 * `name` (v1.2.0) or Material `userData` (v1.1.0). Does not touch
 * prior material program-cache / flag pins. Does not touch
 * BufferGeometry `userData` (v1.0.0) or BufferGeometry `name` (v0.99).
 * Does not pin Mesh `userData` (v1.4.0
 * `pinColorOnlyVisualMeshUserData` runs after this helper and leaves
 * this mesh `name` pin alone). Does not touch
 * BufferAttribute `version` (v0.98) / `name` (v0.97) / `gpuType`
 * (v0.96). Does not call `setUsage` (v0.94). Does not reassign
 * `normalized` (v0.95). Does not touch `onUpload` / `onUploadCallback`
 * (v0.43). Does not touch `updateRange` (v0.90). Does not touch
 * `updateRanges` (v0.91). Does not touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Does not touch Mesh / Object3D
 * `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does not
 * touch Mesh `morphTargetInfluences` / `morphTargetDictionary`. Does
 * not touch Object3D `animations`. Does not change `frustumCulled`.
 * Does not pin `mesh.visible`. Does not change `matrixAutoUpdate`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMeshName(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMeshName(mesh);
  }
  return entity;
}

/**
 * Pin leftover Mesh / Object3D `userData` to a fresh empty plain
 * object in place. Do not replace the mesh. Do not touch `mesh.name`.
 * Do not touch Material `name` or Material `userData`. Do not touch
 * BufferGeometry `userData` / `name`.
 *
 * **Checked installed three@0.170.0:** the Object3D constructor
 * assigns `this.userData = {}`. `Mesh` does not override `userData`.
 * `Object3D.toJSON` writes `object.userData` only when
 * `Object.keys(this.userData).length > 0`. `Object3D.copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone). `ObjectLoader.parseObject` assigns
 * `object.userData = data.userData` when `data.userData !==
 * undefined`. Stock GLTFLoader `loadMesh` calls
 * `assignExtrasToUserData(mesh, meshDef)`, and `_loadNodeShallow`
 * calls `assignExtrasToUserData(node, nodeDef)`. A single-primitive
 * node is the mesh, so node extras land on `mesh.userData`.
 * `assignExtrasToUserData` `Object.assign`s object extras onto
 * `userData`. `WebGLRenderer` does not read `mesh.userData`.
 */
function pinColorOnlyMeshObjectUserData(mesh) {
  if (isEmptyPlainObject(mesh.userData)) return;
  mesh.userData = {};
}

/**
 * Pin Quest-safe Mesh / Object3D `userData` on a packed color-only
 * unlit MeshBasic visual mesh.
 *
 * **Checked installed three@0.170.0 in this repo:** the Object3D
 * constructor assigns `this.userData = {}`. `Mesh` does not override
 * `userData`. `Object3D.toJSON` writes `object.userData` only when
 * `Object.keys(this.userData).length > 0`. `Object3D.copy` assigns
 * `this.userData = JSON.parse(JSON.stringify(source.userData))`
 * (a clone, not a shared reference). `ObjectLoader.parseObject`
 * assigns `object.userData = data.userData` when `data.userData !==
 * undefined`. Stock GLTFLoader `loadMesh` calls
 * `assignExtrasToUserData(mesh, meshDef)` after naming the mesh, and
 * `_loadNodeShallow` calls `assignExtrasToUserData(node, nodeDef)`.
 * When the node has one object, that object is the mesh, so node
 * extras land on `mesh.userData`. `assignExtrasToUserData`
 * `Object.assign`s an object `extras` onto `userData`.
 * `WebGLRenderer` does not read `mesh.userData`, so leftover DCC
 * extras do not change these static color-only draws. v1.3.0 pins
 * `mesh.name` and does not clear `mesh.userData`, so those extras
 * can survive ingest on the packed color-only visuals. This helper
 * assigns `mesh.userData = {}` (a fresh plain object, not a shared
 * module-level `{}`) only when the field is missing, non-object, or
 * not already an empty plain object (own string or symbol keys, or a
 * prototype other than `Object.prototype`). It does **not** replace
 * the mesh, the material, the geometry, the attributes, or the typed
 * arrays. It does **not** touch Mesh / Object3D `name` (v1.3.0
 * reserved `lidMesh` / `latchMesh` / `fastenerMesh` stay). It does
 * **not** touch Material `name` (v1.2.0 empty string stays) or
 * Material `userData` (v1.1.0 empty plain object stays). It does
 * **not** touch prior material program-cache / flag pins. It does
 * **not** touch BufferGeometry `userData` (v1.0.0) or BufferGeometry
 * `name` (v0.99). It does **not** touch entity / root `userData` or
 * tool Group `userData` (this helper only receives a mesh). It does
 * **not** touch BufferAttribute `version` / `name` / `gpuType` /
 * `normalized` / `usage` / `updateRange` / `updateRanges` /
 * `onUpload` / `onUploadCallback`. It does **not** touch geometry
 * `boundingBox` / `boundingSphere` or Mesh `boundingSphere`. It does
 * **not** change `frustumCulled`, `matrixAutoUpdate`, or
 * `mesh.visible`. Load-time only — not per-frame. Replacing leftover
 * extras does not change draws, tris, or attrBytes.
 *
 * Already-empty plain `mesh.userData` is left as-is (same object),
 * including when two meshes already share that empty object. Two
 * meshes that need a replacement each get their own `{}`.
 *
 * Same `isColorOnlyUnlitBasic` gate as the mesh-name pin. Skip
 * colliders. Skip interleaved geometries. Mapped / lit stay authored.
 * This helper pins leftover `mesh.userData` on color-only stand-ins —
 * that is the pulse, so a color-only mesh is not skipped merely
 * because its `userData` still has extras. Does not invent meshes.
 */
export function pinColorOnlyUnlitBasicMeshUserData(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshObjectUserData(mesh);
  return mesh;
}

/**
 * After leftover Mesh / Object3D `name` is pinned (procedural create
 * / packaged detect), pin leftover Mesh / Object3D `userData` to a
 * fresh empty plain object on every packed color-only unlit MeshBasic
 * visual mesh (body LOD leaves + lid/latch/tool + fastener).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a visual that shares
 * that geometry does not pin its mesh `userData`. Color-only leftover
 * non-empty `mesh.userData` is pinned. Does not invent meshes. Does
 * not replace the mesh, the material, the geometry, attributes, or
 * typed arrays. Does not touch Mesh / Object3D `name` (v1.3.0
 * reserved names stay). Does not touch Material `name` (v1.2.0) or
 * Material `userData` (v1.1.0). Does not touch prior material
 * program-cache / flag pins. Does not touch BufferGeometry `userData`
 * (v1.0.0) or BufferGeometry `name` (v0.99). Does not touch entity /
 * root `userData` or non-mesh tool Group `userData`. Does not touch
 * BufferAttribute `version` (v0.98) / `name` (v0.97) / `gpuType`
 * (v0.96). Does not call `setUsage` (v0.94). Does not reassign
 * `normalized` (v0.95). Does not touch `onUpload` / `onUploadCallback`
 * (v0.43). Does not touch `updateRange` (v0.90). Does not touch
 * `updateRanges` (v0.91). Does not touch geometry `boundingBox` /
 * `boundingSphere` (v0.92). Does not touch Mesh / Object3D
 * `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does not
 * touch Mesh `morphTargetInfluences` / `morphTargetDictionary`. Does
 * not touch Object3D `animations`. Does not change `frustumCulled`.
 * Does not pin `mesh.visible`. Does not change `matrixAutoUpdate`.
 * Does not pin Material `version` (v1.5.0
 * `pinColorOnlyVisualMaterialVersion` runs after this helper and
 * leaves this mesh `userData` pin alone). Load-time only — not
 * per-frame.
 */
export function pinColorOnlyVisualMeshUserData(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMeshUserData(mesh);
  }
  return entity;
}

/**
 * Pin leftover Material `version` to the r170 constructor default `0`
 * in place. Do not replace the material. Do not call
 * `material.needsUpdate = true` (that increments `version`). Do not
 * touch Material `name` or Material `userData`. Do not touch Mesh /
 * Object3D `name` / `userData` or BufferGeometry `userData` / `name`.
 * Do not touch BufferAttribute fields.
 *
 * Already-zero `material.version` is left as-is. A shared material
 * instance is pinned once.
 *
 * **Checked installed three@0.170.0:** the Material constructor
 * assigns `this.version = 0`. The `needsUpdate` setter increments
 * `version` when `value === true`. The `alphaTest` setter also
 * increments `version` when the test crosses zero. `Material.copy`
 * does not copy `version`. `Material.toJSON` does not write
 * `material.version` (`metadata.version` 4.6 is the JSON format
 * version). `WebGLRenderer.setProgram` sets `needsProgramChange` and
 * stores `materialProperties.__version = material.version` when
 * `material.version !== materialProperties.__version`, then calls
 * `getProgram`, which builds parameters via
 * `WebGLPrograms.getParameters`. `getProgramCacheKey` does not include
 * `material.version`, so a leftover number does not fork a second
 * program. A leftover non-zero `material.version` on a static packed
 * color-only MeshBasic is a dirty counter. The mismatch still
 * allocates program parameters on the JS thread before the fast path
 * (`version === __version`) can skip `getProgram`. On Quest 3 TBDR
 * that load-time parameter rebuild is packaging waste. Direct
 * assignment does not go through `needsUpdate`, so it does not
 * increment. Pinning to `0` does not change draws, tris, or attrBytes.
 */
function pinColorOnlyMeshBasicMaterialVersion(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (material.version === 0) return;
  material.version = 0;
}

/**
 * After leftover Mesh / Object3D `userData` is pinned to a fresh empty
 * plain object (procedural create / packaged detect), pin leftover
 * Material `version` to `0` on one packed color-only unlit MeshBasic
 * visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper pins leftover `material.version` on color-only
 * stand-ins — that is the pulse, so a color-only material is not
 * skipped merely because its `version` is still non-zero. Does not
 * invent materials. Does not call `needsUpdate`.
 *
 * Already-zero `material.version` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the mesh-userData pin.
 */
export function pinColorOnlyUnlitBasicMaterialVersion(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialVersion(mesh.material);
  return mesh;
}

/**
 * After leftover Mesh / Object3D `userData` is pinned (procedural
 * create / packaged detect), pin leftover Material `version` to the
 * r170 constructor default `0` (`material.version === 0`) on every
 * packed color-only unlit MeshBasic visual material (shared wood /
 * brass / steel stand-ins; body LOD leaves + lid/latch/tool +
 * fastener; unique MeshBasic stays 3).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `version`. Skip geometries shared with a collider, an interleaved
 * mesh, or a mapped / lit mesh so a visual that shares that geometry
 * does not pin its material. Color-only leftover `material.version !==
 * 0` is pinned. Assign `material.version = 0` in place only when it
 * is not already `0`. Pin once per shared material instance. Does not
 * invent materials. Does not replace the material, the mesh, the
 * geometry, attributes, or typed arrays. Does not call
 * `material.needsUpdate = true`. Does not touch Material `name`
 * (v1.2.0 material-name-empty stays) or Material `userData` (v1.1.0
 * material-userData-empty stays). Does not touch Mesh / Object3D
 * `userData` (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D
 * `name` (v1.3.0 mesh-name-empty stays; reserved names `lidMesh` /
 * `latchMesh` / `fastenerMesh` and any `collider_*` stay). Does not
 * touch prior material program-cache / flag pins. Does not touch
 * BufferGeometry `userData` (v1.0.0) or BufferGeometry `name` (v0.99).
 * Does not touch BufferAttribute `version` (v0.98) / `name` (v0.97) /
 * `gpuType` (v0.96). Does not call `setUsage` (v0.94). Does not
 * reassign `normalized` (v0.95). Does not touch `onUpload` /
 * `onUploadCallback` (v0.43). Does not touch `updateRange` (v0.90).
 * Does not touch `updateRanges` (v0.91). Does not touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh /
 * Object3D `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does not
 * touch Mesh `morphTargetInfluences` / `morphTargetDictionary`. Does
 * not touch Object3D `animations`. Does not change `frustumCulled`.
 * Does not pin `mesh.visible`. Does not change `matrixAutoUpdate`.
 * Does not pin `matrixWorldNeedsUpdate` (v1.6.0
 * `pinColorOnlyVisualMatrixWorldNeedsUpdate` runs after this helper
 * and leaves this material `version` pin alone). Does not change
 * `matrixWorldAutoUpdate`.
 * Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMaterialVersion(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMaterialVersion(mesh);
  }
  return entity;
}

/**
 * Pin leftover Object3D / Mesh `matrixWorldNeedsUpdate` to the r170
 * constructor default `false` in place. Do not replace the mesh. Do
 * not call `updateMatrix` or `updateMatrixWorld` (load-time flag
 * clear only; `updateMatrix` assigns the flag `true`). Do not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Do not touch Material
 * `version` / `name` / `userData` or Mesh `name` / `userData`.
 *
 * Already-false `mesh.matrixWorldNeedsUpdate` is left as-is (no
 * assign).
 *
 * **Checked installed three@0.170.0:** the Object3D constructor
 * assigns `this.matrixWorldNeedsUpdate = false`. `Mesh` does not
 * override it. `updateMatrix()` composes the local matrix and assigns
 * `this.matrixWorldNeedsUpdate = true`. `updateMatrixWorld(force)`
 * calls `updateMatrix()` when `matrixAutoUpdate` is true, then
 * recomputes `matrixWorld` when `this.matrixWorldNeedsUpdate || force`
 * (and `matrixWorldAutoUpdate === true`), then assigns
 * `this.matrixWorldNeedsUpdate = false`. `updateWorldMatrix` does not
 * read or clear the flag; when `matrixAutoUpdate` is true it calls
 * `updateMatrix()`, which sets the flag `true`. `Object3D.copy`
 * copies `source.matrixWorldNeedsUpdate`. `applyMatrix4` calls
 * `updateMatrix()` when `matrixAutoUpdate` is true, so a glTF node
 * matrix leaves the flag `true` on a live node.
 * `WebGLRenderer.render` calls `scene.updateMatrixWorld()` when
 * `scene.matrixWorldAutoUpdate === true`. That call passes no
 * `force`, so `multiplyMatrices` runs only when the flag is `true`.
 * A leftover `true` on a static packed color-only visual
 * (`matrixAutoUpdate === false` from v0.45, so `updateMatrix` is not
 * called first) forces that world-matrix multiply on the JS thread
 * before the flag is cleared. On Quest 3 TBDR that load-time /
 * first-frame rebuild is packaging waste. Pinning to `false` does
 * not change draws, tris, or attrBytes.
 */
function pinColorOnlyMeshMatrixWorldNeedsUpdate(mesh) {
  if (mesh.matrixWorldNeedsUpdate === false) return;
  mesh.matrixWorldNeedsUpdate = false;
}

/**
 * After leftover Material `version` is pinned to `0` (procedural
 * create / packaged detect), pin leftover Object3D / Mesh
 * `matrixWorldNeedsUpdate` to `false` on one packed color-only unlit
 * MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper pins leftover `matrixWorldNeedsUpdate` on
 * color-only stand-ins — that is the pulse, so a color-only mesh is
 * not skipped merely because the flag is still `true`. Does not
 * invent meshes. Does not call `updateMatrix` or `updateMatrixWorld`.
 *
 * Already-false `mesh.matrixWorldNeedsUpdate` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the material-version pin.
 */
export function pinColorOnlyUnlitBasicMatrixWorldNeedsUpdate(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshMatrixWorldNeedsUpdate(mesh);
  return mesh;
}

/**
 * After leftover Material `version` is pinned (procedural create /
 * packaged detect), pin leftover Object3D / Mesh
 * `matrixWorldNeedsUpdate` to the r170 constructor default `false`
 * (`mesh.matrixWorldNeedsUpdate === false`) on every packed
 * color-only unlit MeshBasic visual mesh (body LOD leaves +
 * lid/latch/tool + fastener; the same 13 visuals).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material's mesh keeps its authored
 * flag. Skip geometries shared with a collider, an interleaved mesh,
 * or a mapped / lit mesh so a visual that shares that geometry does
 * not pin its flag. Color-only leftover
 * `mesh.matrixWorldNeedsUpdate !== false` is pinned. Assign
 * `mesh.matrixWorldNeedsUpdate = false` in place only when it is not
 * already `false`. Does not invent meshes. Does not replace the mesh,
 * the material, the geometry, attributes, or typed arrays. Does not
 * call `updateMatrix` or `updateMatrixWorld`. Does not change
 * `matrixAutoUpdate` (v0.45 freeze on static body LOD leaves stays;
 * lid/latch/tool/fastener stay live). Does not change
 * `matrixWorldAutoUpdate` (v0.69 stays). Does not touch Material
 * `version` (v1.5.0 material-version-zero stays) or Material `name`
 * (v1.2.0 material-name-empty stays) or Material `userData` (v1.1.0
 * material-userData-empty stays). Does not touch Mesh / Object3D
 * `userData` (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D
 * `name` (v1.3.0 mesh-name-empty stays; reserved names `lidMesh` /
 * `latchMesh` / `fastenerMesh` and any `collider_*` stay). Does not
 * touch prior material program-cache / flag pins. Does not touch
 * BufferGeometry `userData` (v1.0.0) or BufferGeometry `name` (v0.99).
 * Does not touch BufferAttribute `version` (v0.98) / `name` (v0.97) /
 * `gpuType` (v0.96). Does not call `setUsage` (v0.94). Does not
 * reassign `normalized` (v0.95). Does not touch `onUpload` /
 * `onUploadCallback` (v0.43). Does not touch `updateRange` (v0.90).
 * Does not touch `updateRanges` (v0.91). Does not touch geometry
 * `boundingBox` / `boundingSphere` (v0.92). Does not touch Mesh /
 * Object3D `boundingSphere` (v0.93). Does not delete `skinIndex` /
 * `skinWeight`. Does not delete `color` (v1.7.0
 * `pinColorOnlyVisualColorAttribute` runs after this helper). Does
 * not touch `drawRange`. Does not touch `groups`.
 * Does not touch `morphAttributes` / `morphTargetsRelative`. Does not
 * touch Mesh `morphTargetInfluences` / `morphTargetDictionary`. Does
 * not touch Object3D `animations`. Does not change `frustumCulled`.
 * Does not pin `mesh.visible`. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualMatrixWorldNeedsUpdate(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicMatrixWorldNeedsUpdate(mesh);
  }
  return entity;
}

/**
 * After leftover Object3D / Mesh `matrixWorldNeedsUpdate` is pinned
 * to `false` (procedural create / packaged detect), delete leftover
 * BufferGeometry `color` on one packed color-only unlit MeshBasic
 * visual when `material.vertexColors === false`.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper deletes leftover `color` on color-only
 * stand-ins — that is the pulse, so a color-only geometry is not
 * skipped merely because it still has `color`. Does not invent
 * meshes or a replacement attribute. Does not assign `null`. Does
 * not enable or rewrite `vertexColors` (v0.57 stays). Does not
 * delete `position` or the index.
 *
 * An already-absent `color` is left as-is (`deleteAttribute` is not
 * called). Same `isColorOnlyUnlitBasic` gate as the
 * matrixWorldNeedsUpdate pin.
 */
export function pinColorOnlyUnlitBasicColorAttribute(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  stripUnusedColorOnlyColorAttributes(mesh.geometry, mesh.material);
  return mesh;
}

/**
 * After leftover Object3D / Mesh `matrixWorldNeedsUpdate` is pinned
 * (procedural create / packaged detect), strip leftover BufferGeometry
 * `color` so the attribute is absent
 * (`geometry.getAttribute('color')` is missing and
 * `geometry.hasAttribute('color') === false`) on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves +
 * lid/latch/tool + fastener; the same 13 visuals) when the material
 * already has `vertexColors === false` (v0.57 pin stays).
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * keeps its authored `color`. Color-only leftover `color` is deleted
 * only when `vertexColors === false`. Prefer
 * `geometry.deleteAttribute('color')` when present. Does not invent
 * a replacement attribute. Does not assign `null`. Does not enable
 * `material.vertexColors`. Does not rewrite `vertexColors`. Does not
 * replace the mesh, the material, the geometry, other attributes, or
 * typed arrays. Does not delete `position`. Does not delete the
 * index. Does not touch Material `version` (v1.5.0
 * material-version-zero stays) or Material `name` (v1.2.0
 * material-name-empty stays) or Material `userData` (v1.1.0
 * material-userData-empty stays). Does not touch Mesh / Object3D
 * `userData` (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D
 * `name` (v1.3.0 mesh-name-empty stays; reserved names `lidMesh` /
 * `latchMesh` / `fastenerMesh` and any `collider_*` stay). Does not
 * touch Mesh `matrixWorldNeedsUpdate` (v1.6.0
 * matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch other
 * BufferAttribute fields (`version` / `name` / `gpuType` /
 * `normalized` / `usage` / `updateRange` / `updateRanges` /
 * `onUpload` / `onUploadCallback`). Does not touch prior material
 * program-cache / flag pins. Does not touch bounds, morphs,
 * animations, shadows, `frustumCulled`, or `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** a fresh `BufferGeometry`
 * assigns `this.attributes = {}` and has no `color` attribute.
 * `deleteAttribute(name)` does `delete this.attributes[name]` and
 * does not assign `null`. `hasAttribute` is
 * `this.attributes[name] !== undefined`. `WebGLPrograms.getParameters`
 * copies `vertexColors: material.vertexColors` and enables the
 * vertex-color program layer only when `parameters.vertexColors` is
 * true. `WebGLProgram` emits `#define USE_COLOR` and
 * `attribute vec3 color` (or `attribute vec4 color` when
 * `USE_COLOR_ALPHA`) only then. A leftover `color` BufferAttribute
 * on a color-only MeshBasic with `vertexColors === false` is never
 * read by the MeshBasic shader path. `WebGLGeometries.update` still
 * uploads every `geometry.attributes` entry, so the leftover inflates
 * pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static
 * props. Deleting it is load-time packaging. `GLTFLoader` maps
 * `COLOR_0` → `color`. On clean procedural meshes (no `color` attr)
 * draws, tris, and attrBytes stay unchanged vs v1.6.0. A fixture
 * with a leftover Float32 `color` may drop measured attrBytes
 * (`count * itemSize * 4` bytes). Load-time only — not per-frame.
 */
export function pinColorOnlyVisualColorAttribute(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicColorAttribute(mesh);
  }
  return entity;
}

/**
 * Install the v0.43 `releaseCpuArray` hook on one existing
 * BufferAttribute. Does not invent the attribute. Does not replace
 * the attribute or its typed array. Does not call the callback, so
 * `.array` stays. Does not recompute bounds. Does not call
 * `setUsage`. Does not assign `version`, `name`, `gpuType`,
 * `normalized`, `updateRange`, or `updateRanges`.
 *
 * An already-correct hook stamped to this geometry is left as-is.
 * A rogue callback, a hook stamped to another geometry, or the r170
 * empty prototype `onUploadCallback` is replaced.
 */
function pinColorOnlyBufferAttributeOnUpload(attribute, geometry, sharedRelease) {
  if (!attribute?.isBufferAttribute) return sharedRelease;
  if (attribute.isInterleavedBufferAttribute) return sharedRelease;
  if (isCpuArrayReleaseOnUpload(attribute.onUploadCallback, geometry)) return sharedRelease;
  const releaseArray = sharedRelease || createCpuArrayReleaseOnUpload(geometry);
  attribute.onUpload(releaseArray);
  return releaseArray;
}

/**
 * Pin leftover `onUpload` / `onUploadCallback` on the remaining
 * BufferAttributes of one color-only geometry (every non-interleaved
 * attribute, at least `position`, plus `geometry.index` when it is a
 * BufferAttribute). Does not invent attributes. Morph geometries and
 * interleaved geometries stay authored — same early return as
 * `releaseCpuArraysOnGpuUpload` — so this pin does not install a
 * hook that would later null arrays those paths still read.
 */
function pinColorOnlyGeometryOnUpload(geometry) {
  if (!geometry) return;
  if (Object.keys(geometry.morphAttributes || {}).length) return;
  const names = Object.keys(geometry.attributes);
  for (const name of names) {
    if (geometry.getAttribute(name)?.isInterleavedBufferAttribute) return;
  }
  const index = geometry.getIndex();
  if (index?.isInterleavedBufferAttribute) return;
  let sharedRelease = null;
  for (const name of names) {
    sharedRelease = pinColorOnlyBufferAttributeOnUpload(geometry.getAttribute(name), geometry, sharedRelease);
  }
  pinColorOnlyBufferAttributeOnUpload(index, geometry, sharedRelease);
}

/**
 * After leftover BufferGeometry `color` is stripped (procedural
 * create / packaged detect), pin leftover BufferAttribute `onUpload`
 * / `onUploadCallback` on one packed color-only unlit MeshBasic
 * visual so the v0.43 CPU-array-release hook is the sole upload
 * callback.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Does not invent attributes. Does not null `.array`.
 * Does not call the callback. Does not recompute bounds.
 *
 * Same `isColorOnlyUnlitBasic` gate as the color-attribute pin.
 */
export function pinColorOnlyUnlitBasicOnUpload(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyGeometryOnUpload(mesh.geometry);
  return mesh;
}

/**
 * After leftover BufferGeometry `color` is stripped (procedural
 * create / packaged detect), pin leftover BufferAttribute `onUpload`
 * / `onUploadCallback` so the v0.43 `releaseCpuArray` hook is the
 * sole upload callback on the remaining attributes (at least
 * `position`, and `index` when present) of every packed color-only
 * unlit MeshBasic visual geometry (body LOD leaves + lid/latch/tool
 * + fastener; the same 13 visuals). Measured onUpload-release 13.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * keeps its authored `onUploadCallback`. Does not invent attributes.
 * Does not replace the mesh, the material, the geometry, the
 * attributes, or the typed arrays. Does not null `.array` inside the
 * pin (the hook does that later, after GPU upload). Does not call
 * the callback. Does not recompute bounds inside the pin. Does not
 * call `setUsage` (v0.94 usage-static stays). Does not touch
 * BufferAttribute `version` / `name` / `gpuType` / `normalized` /
 * `usage` / `updateRange` / `updateRanges`. Does not delete `color`
 * (v1.7.0 colorAttribute-absent stays). Does not touch Material
 * `version` / `name` / `userData`. Does not touch Mesh / Object3D
 * `userData` / `name` (reserved names `lidMesh` / `latchMesh` /
 * `fastenerMesh` and any `collider_*` stay). Does not touch Mesh
 * `matrixWorldNeedsUpdate` (v1.6.0 stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch bounds, morphs,
 * animations, shadows, `frustumCulled`, or `mesh.visible`. An
 * already-correct `releaseCpuArray` hook stamped to that geometry is
 * left in place. A non-empty `morphAttributes` map is left authored
 * (v0.43 returns before installing the hook).
 *
 * **Checked installed three@0.170.0:** `BufferAttribute` declares
 * `onUploadCallback() {}` on the prototype (the constructor does not
 * assign an own property). `onUpload(callback)` assigns
 * `this.onUploadCallback = callback` and does not null `.array` and
 * does not bump `version`. `BufferAttribute.copy` copies `name`,
 * `array`, `itemSize`, `count`, `normalized`, `usage`, and `gpuType`;
 * it does not copy `onUploadCallback`, so a copied attribute falls
 * back to the empty prototype method. `WebGLAttributes.createBuffer`
 * copies `attribute.array` into a local, calls
 * `gl.bufferData(bufferType, array, usage)`, then calls
 * `attribute.onUploadCallback()`. The callback runs after the GPU
 * upload, and the local `array` is what `bufferData` already used, so
 * nulling `.array` inside the hook is safe. `updateBuffer` calls
 * `onUploadCallback` after `gl.bufferSubData`. A leftover non-release
 * callback (or the empty prototype method) skips the Quest 3
 * CPU-array release, so static packed color-only props keep their
 * Float16 / Uint16 CPU arrays after upload on a TBDR headset. The
 * pin only installs the hook. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualOnUpload(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicOnUpload(mesh);
  }
  return entity;
}

/**
 * After leftover BufferAttribute `onUpload` is pinned (procedural
 * create / packaged detect), delete leftover unused MeshBasic
 * channels (`normal` / `uv` / `uv1` / `uv2` / `uv3` / `tangent`) on
 * one packed color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Prefer `geometry.deleteAttribute(name)` when present.
 * Does not invent a replacement attribute. Does not assign `null`.
 * Does not delete `position` or the index. Does not delete
 * `skinIndex` / `skinWeight` (v0.89 pin). Does not delete `color`
 * (v1.7.0 pin).
 *
 * An already-absent channel is left as-is (`deleteAttribute` is not
 * called). Same `isColorOnlyUnlitBasic` gate as the onUpload pin.
 */
export function pinColorOnlyUnlitBasicUnusedAttributes(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  stripUnusedColorOnlyChannelAttributes(mesh.geometry, mesh.material);
  return mesh;
}

/**
 * After leftover BufferAttribute `onUpload` is pinned (procedural
 * create / packaged detect), strip leftover unused MeshBasic
 * channels so none of `normal` / `uv` / `uv1` / `uv2` / `uv3` /
 * `tangent` remain (`geometry.getAttribute(name)` is missing and
 * `geometry.hasAttribute(name) === false`) on every packed
 * color-only unlit MeshBasic visual geometry (body LOD leaves +
 * lid/latch/tool + fastener; the same 13 visuals). Measured
 * unusedAttributes-absent 13.
 *
 * Names come from `COLOR_ONLY_UNUSED_CHANNEL_ATTRS`, derived from
 * `COLOR_ONLY_UNUSED_ATTRS` (source of truth). Does not re-run the
 * skin pin or the color pin.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * keeps its authored channels. Prefer `geometry.deleteAttribute(name)`
 * when present. Does not invent a replacement attribute. Does not
 * assign `null`. Does not delete `position`. Does not delete the
 * index. Does not delete `skinIndex` / `skinWeight` (v0.89 stays).
 * Does not delete `color` (v1.7.0 colorAttribute-absent stays). Does
 * not touch BufferAttribute `onUpload` / `onUploadCallback` (v1.8.0
 * onUpload-release stays). Does not touch Material `version` (v1.5.0
 * material-version-zero stays) or Material `name` (v1.2.0
 * material-name-empty stays) or Material `userData` (v1.1.0
 * material-userData-empty stays). Does not touch Mesh / Object3D
 * `userData` (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D
 * `name` (v1.3.0 mesh-name-empty stays; reserved names `lidMesh` /
 * `latchMesh` / `fastenerMesh` and any `collider_*` stay). Does not
 * touch Mesh `matrixWorldNeedsUpdate` (v1.6.0
 * matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch other
 * BufferAttribute fields (`version` / `name` / `gpuType` /
 * `normalized` / `usage` / `updateRange` / `updateRanges`). Does not
 * touch prior material program-cache / flag pins. Does not touch
 * bounds, morphs, animations, shadows, `frustumCulled`, or
 * `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** `WebGLProgram` prefix always
 * emits `attribute vec3 position`, `attribute vec3 normal`, and
 * `attribute vec2 uv`. `uv1` / `uv2` / `uv3` are behind
 * `#ifdef USE_UV1` / `USE_UV2` / `USE_UV3` (from map channels).
 * `tangent` is behind `#ifdef USE_TANGENT`
 * (`vertexTangents && flatShading === false`; `vertexTangents` needs
 * a tangent attribute plus a normal map or anisotropy).
 * `meshbasic.glsl.js` reads `normal` only inside
 * `#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )`.
 * `uv_vertex.glsl.js` reads `uv` only under
 * `#if defined( USE_UV ) || defined( USE_ANISOTROPY )`. Color-only
 * (`isColorOnlyUnlitBasic` is false when any map or `envMap` is set)
 * does not enable those defines, and skinning is only when
 * `object.isSkinnedMesh === true`. `WebGLGeometries.update` still
 * walks every `geometry.attributes` entry, so leftover channels
 * inflate pre-upload attrBytes and GPU buffer work on Quest 3 TBDR
 * even when the color-only program does not sample them. Deleting
 * them is load-time packaging. `deleteAttribute(name)` does
 * `delete this.attributes[name]` and does not assign `null`.
 * `GLTFLoader` maps `NORMAL` → `normal`, `TANGENT` → `tangent`,
 * `TEXCOORD_0` → `uv`, `TEXCOORD_1` → `uv1`, `TEXCOORD_2` → `uv2`,
 * `TEXCOORD_3` → `uv3`. On clean procedural meshes (no those attrs)
 * draws, tris, and attrBytes stay unchanged vs v1.8.0. A fixture
 * with a leftover Float32 channel drops measured attrBytes by
 * `count * itemSize * 4` bytes. Load-time only — not per-frame.
 */
export function pinColorOnlyVisualUnusedAttributes(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicUnusedAttributes(mesh);
  }
  return entity;
}

/**
 * After leftover unused MeshBasic channels are stripped, pin leftover
 * BufferGeometry `indirect` to the r170 constructor default `null`
 * (`geometry.indirect === null`) on one packed color-only unlit
 * MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Call `setIndirect(null)` only when `indirect` is not
 * already `null`. Does not invent a replacement buffer. Does not
 * call `delete`. Does not delete attributes.
 *
 * An already-null `indirect` is left as-is (`setIndirect` is not
 * called). Same `isColorOnlyUnlitBasic` gate as the unused-channel pin.
 */
export function pinColorOnlyUnlitBasicIndirect(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  if (mesh.geometry.indirect !== null) mesh.geometry.setIndirect(null);
  return mesh;
}

/**
 * After leftover unused MeshBasic channels are stripped (procedural
 * create / packaged detect), pin leftover BufferGeometry `indirect`
 * to the r170 constructor default `null` (`geometry.indirect === null`)
 * on every packed color-only unlit MeshBasic visual geometry (body
 * LOD leaves + lid/latch/tool + fastener; the same 13 visuals).
 * Measured indirect-null 13.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a shared BufferGeometry
 * keeps its authored `indirect`. Call `setIndirect(null)` only when
 * `indirect` is not already `null`. Does not invent a replacement
 * buffer. Does not call `delete` on unrelated fields. Does not
 * re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
 * stays). Does not delete `position` or the index. Does not delete
 * `skinIndex` / `skinWeight` (v0.89 stays). Does not delete `color`
 * (v1.7.0 colorAttribute-absent stays). Does not touch BufferAttribute
 * `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release stays).
 * Does not touch Material `version` (v1.5.0 material-version-zero
 * stays) or Material `name` (v1.2.0 material-name-empty stays) or
 * Material `userData` (v1.1.0 material-userData-empty stays). Does
 * not touch Mesh / Object3D `userData` (v1.4.0 mesh-userData-empty
 * stays) or Mesh / Object3D `name` (v1.3.0 mesh-name-empty stays;
 * reserved names `lidMesh` / `latchMesh` / `fastenerMesh` and any
 * `collider_*` stay). Does not touch Mesh `matrixWorldNeedsUpdate`
 * (v1.6.0 matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch other
 * BufferAttribute fields (`version` / `name` / `gpuType` /
 * `normalized` / `usage` / `updateRange` / `updateRanges`). Does not
 * touch `drawRange`, `groups`, bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** the BufferGeometry constructor
 * assigns `this.indirect = null`. `setIndirect(indirect)` assigns
 * `this.indirect = indirect` and returns `this`. `getIndirect()`
 * returns `this.indirect`. `BufferGeometry.copy` does not copy
 * `indirect`, so a cloned merge survivor stays at the constructor
 * `null` unless something assigns it later. In
 * `src/renderers/common/Geometries.js`, when
 * `renderObject.geometry.indirect !== null`, the renderer calls
 * `updateAttribute(indirect, AttributeType.INDIRECT)`. Leftover
 * indirect storage forces extra GPU attribute upload / binding work.
 * Color-only static MeshBasic props do not use multi-draw /
 * BatchedMesh indirect indexing. Clearing a leftover `indirect` to
 * `null` is load-time packaging for Quest 3 TBDR. On clean procedural
 * meshes (constructor `null` already) draws, tris, and attrBytes stay
 * unchanged vs v1.9.0. Load-time only — not per-frame. No invented
 * headset ms.
 */
export function pinColorOnlyVisualIndirect(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    pinColorOnlyUnlitBasicIndirect(mesh);
  }
  return entity;
}

/**
 * After leftover BufferGeometry `indirect` is pinned to `null`, delete
 * a leftover own-property Material `extensions` so the r170 MeshBasic
 * absence remains (`material.extensions === undefined` and
 * `Object.hasOwn(material, 'extensions') === false`) on one packed
 * color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Prefer `delete material.extensions` when the own property
 * is present. Does not assign `null`. Does not assign a sentinel
 * `{ clipCullDistance: false, multiDraw: false }`. Does not convert
 * MeshBasic to ShaderMaterial. Does not invent an extension map.
 * Does not enable `multiDraw` or `clipCullDistance`.
 *
 * An already-absent `extensions` is left alone (`delete` is not
 * called). Same `isColorOnlyUnlitBasic` gate as the indirect pin.
 */
function pinColorOnlyMeshBasicMaterialExtensions(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (!Object.hasOwn(material, "extensions")) return;
  delete material.extensions;
}

/**
 * After leftover BufferGeometry `indirect` is pinned (procedural
 * create / packaged detect), delete leftover Material `extensions`
 * on one packed color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper deletes leftover `extensions` on color-only
 * stand-ins — that is the pulse, so a color-only material is not
 * skipped merely because it still has an own `extensions` object.
 * Does not invent materials. Does not assign `null` or a sentinel.
 *
 * An already-absent `extensions` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the indirect pin.
 */
export function pinColorOnlyUnlitBasicMaterialExtensions(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialExtensions(mesh.material);
  return mesh;
}

/**
 * After leftover BufferGeometry `indirect` is pinned (procedural
 * create / packaged detect), delete leftover Material `extensions`
 * so the r170 MeshBasic absence remains
 * (`material.extensions === undefined` and
 * `Object.hasOwn(material, 'extensions') === false`) on every packed
 * color-only unlit MeshBasic visual material (shared wood / brass /
 * steel stand-ins; body LOD leaves + lid/latch/tool + fastener;
 * unique MeshBasic stays 3). Measured extensions-absent 3.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `extensions`. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a visual that shares
 * that geometry does not pin its material. Prefer
 * `delete material.extensions` when the own property is present.
 * An already-absent `extensions` is left alone. Pin once per shared
 * material instance. Does not assign `null`. Does not assign a
 * sentinel `{ clipCullDistance: false, multiDraw: false }`. Does not
 * convert MeshBasic to ShaderMaterial. Does not invent extension
 * maps. Does not enable multi-draw or clip-cull-distance. Does not
 * touch BufferGeometry `indirect` (v1.10.0 indirect-null stays).
 * Does not re-run the unused-channel strip (v1.9.0
 * unusedAttributes-absent stays). Does not touch `onUpload` /
 * `onUploadCallback` (v1.8.0 onUpload-release stays). Does not delete
 * `color` (v1.7.0 colorAttribute-absent stays). Does not touch
 * Material `version` (v1.5.0 material-version-zero stays) or
 * Material `name` (v1.2.0 material-name-empty stays) or Material
 * `userData` (v1.1.0 material-userData-empty stays). Does not touch
 * Mesh / Object3D `userData` (v1.4.0 mesh-userData-empty stays) or
 * Mesh / Object3D `name` (v1.3.0 mesh-name-empty stays; reserved
 * names `lidMesh` / `latchMesh` / `fastenerMesh` and any
 * `collider_*` stay). Does not touch Mesh `matrixWorldNeedsUpdate`
 * (v1.6.0 matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch BufferAttribute
 * fields. Does not touch prior material program-cache / flag pins.
 * Does not touch bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `extensions`
 * (`extensions === undefined` and `Object.hasOwn` is false).
 * `ShaderMaterial` assigns
 * `this.extensions = { clipCullDistance: false, multiDraw: false }`
 * and `ShaderMaterial.copy` copies
 * `this.extensions = Object.assign({}, source.extensions)`.
 * `WebGLPrograms.getParameters` sets
 * `HAS_EXTENSIONS = !! material.extensions`, then
 * `extensionClipCullDistance: HAS_EXTENSIONS && material.extensions.clipCullDistance === true && extensions.has('WEBGL_clip_cull_distance')`
 * and
 * `extensionMultiDraw: (HAS_EXTENSIONS && material.extensions.multiDraw === true || IS_BATCHEDMESH) && extensions.has('WEBGL_multi_draw')`.
 * A leftover own `extensions` object on MeshBasic (DCC /
 * ShaderMaterial.copy bleed / `Object.assign`) keeps
 * `HAS_EXTENSIONS` true even when both flags are false, so those
 * parameter forks still read the object. A sentinel
 * `{ clipCullDistance: false, multiDraw: false }` keeps
 * `HAS_EXTENSIONS` true (`!!` of any object is true). `delete
 * material.extensions` removes the own property so the r170 absence
 * remains and `!! material.extensions` is false. Do not assign
 * `null`: that leaves an own property and is not the constructor
 * absence. On clean procedural materials (constructor absence
 * already) draws, tris, and attrBytes stay unchanged vs v1.10.0.
 * Load-time only — not per-frame. No invented headset ms.
 */
export function pinColorOnlyVisualMaterialExtensions(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  const seenMaterials = new Set();
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    if (seenMaterials.has(mesh.material)) continue;
    seenMaterials.add(mesh.material);
    pinColorOnlyUnlitBasicMaterialExtensions(mesh);
  }
  return entity;
}

/**
 * After leftover Material `extensions` are deleted, delete a leftover
 * own-property Material `depthPacking` so the r170 MeshBasic absence
 * remains (`material.depthPacking === undefined` and
 * `Object.hasOwn(material, 'depthPacking') === false`) on one packed
 * color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Prefer `delete material.depthPacking` when the own
 * property is present. Does not assign `null`, `undefined`, or `0`.
 * Does not convert MeshBasic to MeshDepthMaterial. Does not invent
 * depth packing.
 *
 * An already-absent `depthPacking` is left alone (`delete` is not
 * called). Same `isColorOnlyUnlitBasic` gate as the extensions pin.
 */
function pinColorOnlyMeshBasicMaterialDepthPacking(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (!Object.hasOwn(material, "depthPacking")) return;
  delete material.depthPacking;
}

/**
 * After leftover Material `extensions` are deleted (procedural create
 * / packaged detect), delete leftover Material `depthPacking` on one
 * packed color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper deletes leftover `depthPacking` on color-only
 * stand-ins — that is the pulse, so a color-only material is not
 * skipped merely because it still has an own `depthPacking` number.
 * Does not invent materials. Does not assign `null`, `undefined`, or
 * `0`.
 *
 * An already-absent `depthPacking` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the extensions pin.
 */
export function pinColorOnlyUnlitBasicMaterialDepthPacking(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialDepthPacking(mesh.material);
  return mesh;
}

/**
 * After leftover Material `extensions` are deleted (procedural create
 * / packaged detect), delete leftover Material `depthPacking` so the
 * r170 MeshBasic absence remains
 * (`material.depthPacking === undefined` and
 * `Object.hasOwn(material, 'depthPacking') === false`) on every packed
 * color-only unlit MeshBasic visual material (shared wood / brass /
 * steel stand-ins; body LOD leaves + lid/latch/tool + fastener;
 * unique MeshBasic stays 3). Measured depthPacking-absent 3.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `depthPacking`. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a visual that shares
 * that geometry does not pin its material. Prefer
 * `delete material.depthPacking` when the own property is present.
 * An already-absent `depthPacking` is left alone. Pin once per shared
 * material instance. Does not assign `null`, `undefined`, or `0`.
 * Does not convert MeshBasic to MeshDepthMaterial. Does not invent
 * depth packing. Does not touch Material `extensions` (v1.11.0
 * extensions-absent stays). Does not touch BufferGeometry `indirect`
 * (v1.10.0 indirect-null stays). Does not re-run the unused-channel
 * strip (v1.9.0 unusedAttributes-absent stays). Does not touch
 * `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release stays).
 * Does not delete `color` (v1.7.0 colorAttribute-absent stays). Does
 * not touch Material `version` (v1.5.0 material-version-zero stays) or
 * Material `name` (v1.2.0 material-name-empty stays) or Material
 * `userData` (v1.1.0 material-userData-empty stays). Does not touch
 * Mesh / Object3D `userData` (v1.4.0 mesh-userData-empty stays) or
 * Mesh / Object3D `name` (v1.3.0 mesh-name-empty stays; reserved
 * names `lidMesh` / `latchMesh` / `fastenerMesh` and any
 * `collider_*` stay). Does not touch Mesh `matrixWorldNeedsUpdate`
 * (v1.6.0 matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch BufferAttribute
 * fields. Does not touch prior material program-cache / flag pins.
 * Does not pin Material `index0AttributeName` (left for a later
 * pulse). Does not touch bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign `depthPacking`
 * (`depthPacking === undefined` and `Object.hasOwn` is false).
 * `MeshDepthMaterial` assigns `this.depthPacking = BasicDepthPacking`
 * and `copy` assigns `this.depthPacking = source.depthPacking`.
 * `WebGLPrograms.getParameters` sets
 * `useDepthPacking: material.depthPacking >= 0` and
 * `depthPacking: material.depthPacking || 0`.
 * `getProgramCacheKeyParameters` pushes `parameters.depthPacking`.
 * `getProgramCacheKeyBooleans` enables program layer 13 when
 * `parameters.useDepthPacking` is true. `WebGLProgram` emits
 * `#define DEPTH_PACKING ` plus `parameters.depthPacking` when
 * `useDepthPacking` is true. A leftover `BasicDepthPacking` (3200) or
 * `RGBADepthPacking` (3201) pushes a different cache-key number than
 * the absent-material fallback `0`. A leftover `0` still sets
 * `useDepthPacking` (`0 >= 0`), so the boolean program mask forks and
 * the define is emitted. Assigning `null` also sets `useDepthPacking`
 * (`null >= 0`). `delete material.depthPacking` removes the own
 * property so the r170 absence remains. On clean procedural materials
 * (constructor absence already) draws, tris, and attrBytes stay
 * unchanged vs v1.11.0. Load-time only — not per-frame. No invented
 * headset ms.
 */
export function pinColorOnlyVisualMaterialDepthPacking(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  const seenMaterials = new Set();
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    if (seenMaterials.has(mesh.material)) continue;
    seenMaterials.add(mesh.material);
    pinColorOnlyUnlitBasicMaterialDepthPacking(mesh);
  }
  return entity;
}

/**
 * After leftover Material `depthPacking` is deleted, delete a leftover
 * own-property Material `index0AttributeName` so the r170 MeshBasic
 * absence remains (`material.index0AttributeName === undefined` and
 * `Object.hasOwn(material, 'index0AttributeName') === false`) on one
 * packed color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. Prefer `delete material.index0AttributeName` when the own
 * property is present. Does not assign `null`, `undefined`, or `''`.
 * Does not invent a replacement attribute name.
 *
 * An already-absent `index0AttributeName` is left alone (`delete` is
 * not called). Same `isColorOnlyUnlitBasic` gate as the depthPacking
 * pin.
 */
function pinColorOnlyMeshBasicMaterialIndex0AttributeName(material) {
  if (!isColorOnlyUnlitBasic(material)) return;
  if (!Object.hasOwn(material, "index0AttributeName")) return;
  delete material.index0AttributeName;
}

/**
 * After leftover Material `depthPacking` is deleted (procedural create
 * / packaged detect), delete leftover Material `index0AttributeName`
 * on one packed color-only unlit MeshBasic visual.
 *
 * Skip colliders. Skip interleaved geometries. Mapped / lit stay
 * authored. This helper deletes leftover `index0AttributeName` on
 * color-only stand-ins — that is the pulse, so a color-only material
 * is not skipped merely because it still has an own
 * `index0AttributeName` string. Does not invent a replacement
 * attribute name. Does not assign `null`, `undefined`, or `''`.
 *
 * An already-absent `index0AttributeName` is left as-is.
 *
 * Same `isColorOnlyUnlitBasic` gate as the depthPacking pin.
 */
export function pinColorOnlyUnlitBasicMaterialIndex0AttributeName(mesh) {
  if (!mesh?.isMesh) return mesh;
  if (isColliderMesh(mesh)) return mesh;
  if (!isColorOnlyUnlitBasic(mesh.material)) return mesh;
  if (!mesh.geometry) return mesh;
  if (colorOnlyGeometryInterleaved(mesh.geometry)) return mesh;
  pinColorOnlyMeshBasicMaterialIndex0AttributeName(mesh.material);
  return mesh;
}

/**
 * After leftover Material `depthPacking` is deleted (procedural create
 * / packaged detect), delete leftover Material `index0AttributeName`
 * so the r170 MeshBasic absence remains
 * (`material.index0AttributeName === undefined` and
 * `Object.hasOwn(material, 'index0AttributeName') === false`) on every
 * packed color-only unlit MeshBasic visual material (shared wood /
 * brass / steel stand-ins; body LOD leaves + lid/latch/tool +
 * fastener; unique MeshBasic stays 3). Measured
 * index0AttributeName-absent 3.
 *
 * Skip colliders (even MeshBasic debug hulls). Skip mapped / lit.
 * Skip interleaved geometries (same pack-pipeline interleaved gate).
 * Skip meshes whose material is shared with a blocked collider or
 * interleaved mesh so that shared material keeps its authored
 * `index0AttributeName`. Skip geometries shared with a collider, an
 * interleaved mesh, or a mapped / lit mesh so a visual that shares
 * that geometry does not pin its material. Prefer
 * `delete material.index0AttributeName` when the own property is
 * present. An already-absent `index0AttributeName` is left alone. Pin
 * once per shared material instance. Does not assign `null`,
 * `undefined`, or `''`. Does not invent a replacement attribute name.
 * Does not touch Material `depthPacking` (v1.12.0 depthPacking-absent
 * stays). Does not touch Material `extensions` (v1.11.0
 * extensions-absent stays). Does not touch BufferGeometry `indirect`
 * (v1.10.0 indirect-null stays). Does not re-run the unused-channel
 * strip (v1.9.0 unusedAttributes-absent stays). Does not touch
 * `onUpload` / `onUploadCallback` (v1.8.0 onUpload-release stays).
 * Does not delete `color` (v1.7.0 colorAttribute-absent stays). Does
 * not touch Material `version` (v1.5.0 material-version-zero stays) or
 * Material `name` (v1.2.0 material-name-empty stays) or Material
 * `userData` (v1.1.0 material-userData-empty stays). Does not touch
 * Mesh / Object3D `userData` (v1.4.0 mesh-userData-empty stays) or
 * Mesh / Object3D `name` (v1.3.0 mesh-name-empty stays; reserved
 * names `lidMesh` / `latchMesh` / `fastenerMesh` and any
 * `collider_*` stay). Does not touch Mesh `matrixWorldNeedsUpdate`
 * (v1.6.0 matrixWorldNeedsUpdate-false stays). Does not change
 * `matrixAutoUpdate` or `matrixWorldAutoUpdate`. Does not touch
 * BufferGeometry `userData` / `name`. Does not touch BufferAttribute
 * fields. Does not touch prior material program-cache / flag pins.
 * Does not touch bounds, morphs, animations, shadows,
 * `frustumCulled`, or `mesh.visible`.
 *
 * **Checked installed three@0.170.0:** fresh `Material` /
 * `MeshBasicMaterial` constructors do not assign
 * `index0AttributeName` (`index0AttributeName === undefined` and
 * `Object.hasOwn` is false). `ShaderMaterial` assigns
 * `this.index0AttributeName = undefined` (an own property whose value
 * is still `undefined`). `ShaderMaterial.copy` does not copy
 * `index0AttributeName`. `WebGLPrograms.getParameters` copies
 * `index0AttributeName: material.index0AttributeName`.
 * `getProgramCacheKey`, `getProgramCacheKeyParameters`, and
 * `getProgramCacheKeyBooleans` do not push that name (no cache-key
 * token and no program-layer bit). `WebGLProgram` emits no `#define`
 * for it. Before `gl.linkProgram`, when
 * `parameters.index0AttributeName !== undefined`, it calls
 * `gl.bindAttribLocation(program, 0, parameters.index0AttributeName)`;
 * otherwise, if `morphTargets` is true, it binds `'position'`. A
 * leftover string (`'position'`, `'color'`) or empty string `''` is
 * not `undefined`, so it binds attribute 0 to that name, while the
 * program cache key stays identical to constructor absence. The first
 * material to compile bakes that binding into a program every later
 * material with the same other parameters will reuse. Assigning
 * `null` also binds (`null !== undefined`). Assigning `undefined`
 * skips the bind but, stored as an own property, is not the r170
 * MeshBasic absence. `delete material.index0AttributeName` removes
 * the own property so the r170 absence remains. On clean procedural
 * materials (constructor absence already) draws, tris, and attrBytes
 * stay unchanged vs v1.12.0. Load-time only — not per-frame. No
 * invented headset ms.
 */
export function pinColorOnlyVisualMaterialIndex0AttributeName(entity) {
  if (!entity) return entity;
  const blockedMaterials = new Set();
  const blockedGeometries = new Set();
  const meshes = [];
  entity.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    const collider = isColliderMesh(o);
    const interleaved = colorOnlyGeometryInterleaved(o.geometry);
    const colorOnly = isColorOnlyUnlitBasic(o.material);
    if (colorOnly && (collider || interleaved) && o.material) blockedMaterials.add(o.material);
    if ((!colorOnly || collider || interleaved) && o.geometry) blockedGeometries.add(o.geometry);
  });
  const seenMaterials = new Set();
  for (const mesh of meshes) {
    if (isColliderMesh(mesh)) continue;
    if (!isColorOnlyUnlitBasic(mesh.material)) continue;
    if (!mesh.geometry) continue;
    if (colorOnlyGeometryInterleaved(mesh.geometry)) continue;
    if (blockedMaterials.has(mesh.material)) continue;
    if (blockedGeometries.has(mesh.geometry)) continue;
    if (seenMaterials.has(mesh.material)) continue;
    seenMaterials.add(mesh.material);
    pinColorOnlyUnlitBasicMaterialIndex0AttributeName(mesh);
  }
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
 * unused `uv` / `normal` / `skinIndex` / `skinWeight` / `color`
 * (and other unused channels) when the material is color-only
 * unlit MeshBasic (v0.40; skinning attrs are the v0.89 extension
 * of that strip; `color` is the v1.7.0 extension, only when
 * `vertexColors === false` and the geometry is not interleaved),
 * then compact a
 * 32-bit index to Uint16 when verts fit (v0.41), then quantize
 * Float32 `position` to Float16 (v0.44), then hook post-GPU-upload
 * CPU array release on those packed geos (v0.43). A named source
 * keeps its name on the survivor. Colliders and the fastener
 * (`fastener` / `fastenerMesh`) are skipped. Direct mesh children
 * only — nested Groups (pivots) stay. Load-time only — not
 * per-frame. Shared by procedural create (v0.37) and packaged
 * ingest (v0.38); weld is the v0.39 upgrade on the same helper;
 * unused-attr strip is the v0.40 upgrade (v0.89 adds
 * `skinIndex` / `skinWeight` to that strip); Uint16 index compact is
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
    note: "procedural color-only stand-in; LOD0/1/2 color-only unlit MeshBasic (no map; wood/brass/steel midtones). v0.37 woodDark/handleMat alias wood within a LOD; v0.42 one shared wood instance across LOD0/1/2 and one shared brass across LOD0/1 (+ fastener) when midtone hex matches (steel stays LOD0-only). same-material merge within each lodGroup (v0.37; not across body/lid/latch/tool) then coincident-vertex weld (v0.39) then unused uv/normal strip on color-only MeshBasic (v0.40) then Uint16 index compact (v0.41) then Float16 position quantize (v0.44) then StaticDrawUsage + onUpload CPU-array release (v0.43); fastener (not an LOD mesh) gets the same unused-attr strip + compact + Float16 + upload-release. v0.45 freezes matrixAutoUpdate on static color-only MeshBasic body LOD leaves after one updateMatrixWorld(true); lid/latch/tool/fastener stay live. v0.46 disables Mesh.raycast on packed color-only MeshBasic visuals (body + lid/latch/tool + fastener); colliders keep Mesh.prototype.raycast. v0.47 pins fog = false and toneMapped = false on packed color-only unlit MeshBasic materials (3 unique shared instances; mapped/lit/colliders stay r170 defaults). v0.48 also pins opaque FrontSide draw-state (transparent = false, opacity = 1, depthWrite = true, depthTest = true, side = FrontSide) on those same materials. v0.49 pins castShadow = false and receiveShadow = false on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.50 pins frustumCulled = true on those same visual meshes (colliders stay r170 Mesh defaults). v0.51 also pins NormalBlending / premultipliedAlpha false / alphaTest 0 (plus dithering false / alphaToCoverage false) on those same materials. v0.52 also pins wireframe false / colorWrite true / depthFunc LessEqualDepth / polygonOffset off on those same materials. v0.53 also pins r170 stencil defaults (stencilWrite false / AlwaysStencilFunc / Keep ops) on those same materials. v0.54 also pins r170 clipping defaults (clippingPlanes null / clipIntersection false / clipShadows false) on those same materials. v0.55 also pins r170 alphaHash / forceSinglePass defaults (alphaHash false / forceSinglePass false) on those same materials. v0.56 also pins r170 NormalBlending factor/equation companions (blendSrc SrcAlphaFactor / blendDst OneMinusSrcAlphaFactor / blendEquation AddEquation / blendSrcAlpha null / blendDstAlpha null / blendEquationAlpha null) on those same materials. v0.57 also pins r170 vertexColors false on those same materials. v0.58 also pins r170 precision null on those same materials. v0.59 also pins r170 shadowSide null on those same materials. v0.60 pins renderOrder = 0 on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults). v0.61 also pins r170 Material visible true on those same materials (does not pin mesh.visible — LOD visibility uses it). v0.62 also pins r170 MeshBasic envMap companions (combine MultiplyOperation / reflectivity 1 / refractionRatio 0.98) on those same materials (does not force envMap or attach maps). v0.63 also pins r170 MeshBasic map-intensity companions (lightMapIntensity 1 / aoMapIntensity 1) on those same materials (does not force lightMap / aoMap or attach maps). v0.64 also pins r170 MeshBasic wireframeLinewidth 1 on those same materials (does not enable wireframe; does not pin mesh.visible). v0.65 also pins r170 MeshBasic wireframeLinecap round / wireframeLinejoin round on those same materials (does not enable wireframe; does not pin mesh.visible). v0.66 also pins r170 MeshBasic envMapRotation (0, 0, 0) / order XYZ on those same materials (keeps the existing Euler instance; does not force envMap or attach maps; does not enable wireframe; does not pin mesh.visible). v0.67 pins r170 Object3D layers default (layer 0 only / mask 1) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Layers instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixWorldAutoUpdate / matrixAutoUpdate). v0.68 also pins r170 Material CustomBlending color/alpha companions (blendColor (0, 0, 0) / blendAlpha 0) on those same materials (keeps the existing Color instance; does not enable CustomBlending or change blending away from NormalBlending; does not pin mesh.visible). v0.69 pins r170 Object3D matrixWorldAutoUpdate true (DEFAULT_MATRIX_WORLD_AUTO_UPDATE) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / layers / blendColor / blendAlpha). v0.70 pins r170 Object3D up (0, 1, 0) (DEFAULT_UP) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Vector3 instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / blendColor / blendAlpha). v0.71 pins r170 Object3D scale (1, 1, 1) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Vector3 instance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / blendColor / blendAlpha). v0.72 also pins r170 Material dithering false / alphaToCoverage false on those same materials as first-class measured flags (v0.51 already assigned them as blending/alpha companions; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / blendColor / blendAlpha). v0.73 pins r170 Object3D rotation.order XYZ on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; keeps the existing Euler instance; does not rewrite rotation.xyz; does not touch quaternion; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / blendColor / blendAlpha / dithering / A2C). v0.74 also pins r170 Material polygonOffsetFactor 0 / polygonOffsetUnits 0 on those same materials as first-class measured flags (v0.52 already assigned them as polygonOffset companions; does not enable polygonOffset; does not invent non-zero factors/units; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / blendColor / blendAlpha / dithering / A2C). v0.75 also pins r170 Material stencilRef 0 / stencilWriteMask 0xff / stencilFuncMask 0xff / stencilZFail KeepStencilOp / stencilZPass KeepStencilOp on those same materials as first-class measured flags (v0.53 already assigned the full stencil suite and measured stencilWrite / stencilFunc / stencilFail in the short form; does not enable stencil write; does not invent non-Always func / non-Keep ops / non-zero ref / non-0xff masks; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including polygonOffset companions / dithering / A2C / blendColor / blendAlpha). v0.76 pins r170 Mesh customDepthMaterial / customDistanceMaterial absence (undefined/absent) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not invent replacement materials; does not enable castShadow / receiveShadow; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha). v0.77 pins r170 Object3D/Mesh onBeforeRender / onAfterRender instance absence (delete leftover own-property stubs so the r170 Object3D prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not enable shadows or touch customDepth/Distance; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear). v0.78 pins r170 Material onBeforeCompile / onBeforeRender instance absence (delete leftover own-property stubs so the r170 Material.prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks or custom shaders) on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances; does not touch Mesh onBeforeRender / onAfterRender; does not touch onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / the v0.77 Mesh render-callback clear). v0.79 pins r170 Object3D/Mesh onBeforeShadow / onAfterShadow instance absence (delete leftover own-property stubs so the r170 Object3D prototype empty no-ops remain; does not assign undefined; does not invent replacement callbacks) on packed color-only MeshBasic visual meshes (body + lid/latch/tool + fastener; does not enable shadows or touch customDepth/Distance; does not touch Mesh onBeforeRender / onAfterRender or Material onBeforeCompile / onBeforeRender; colliders stay r170 Mesh defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / the v0.77 Mesh render-callback clear / the v0.78 Material compile/render callback clear). v0.80 pins r170 Material customProgramCacheKey instance absence (delete leftover own-property stubs so the r170 Material.prototype method remains; does not assign undefined; does not invent a replacement function) on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender; does not touch Mesh onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / the v0.79 Mesh shadow-callback clear). v0.81 pins r170 Material defines absence (delete leftover defines objects so defines === undefined remains; does not invent a replacement #define map; does not assign a sentinel empty {} — r170 WebGLPrograms treats parameters.defines !== undefined as present) on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances; does not touch Material customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender; does not touch Mesh onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha / customDepth/Distance clear / Mesh+Material render-callback clears / Mesh shadow-callback clear / the v0.80 customProgramCacheKey clear). v0.82 pins Material flatShading = false on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances; first-class measured flatShading-off; fresh r170 Material / MeshBasicMaterial leave flatShading unset so a fresh instance is undefined; WebGLPrograms copies flatShading: material.flatShading === true into program parameters and the program cache key and WebGLProgram emits #define FLAT_SHADED when that parameter is true; does not invent custom shaders; does not enable flat shading; does not touch Material defines; does not touch Material customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender; does not touch Mesh onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha). v0.83 pins Material glslVersion absence (delete leftover glslVersion so glslVersion === undefined remains; does not assign a sentinel string; does not assign GLSL3 / GLSL1 / '300 es' / '100'; does not convert MeshBasic to ShaderMaterial — ShaderMaterial assigns glslVersion = null in its own constructor; fresh r170 Material / MeshBasicMaterial leave glslVersion unset so a fresh instance is undefined and Object.hasOwn is false; WebGLPrograms copies glslVersion: material.glslVersion into program parameters; WebGLProgram emits #version ${parameters.glslVersion} when that parameter is truthy and branches the GLSL3 layout / gl_FragColor defines when parameters.glslVersion === GLSL3 ('300 es'); does not invent custom shaders; does not touch Material flatShading; does not touch Material defines; does not touch Material customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender; does not touch Mesh onBeforeShadow / onAfterShadow; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha) on packed color-only MeshBasic materials (3 unique shared wood/brass/steel instances). v0.84 clears leftover Object3D animations to the r170 empty list (Array.isArray && length === 0; mutate the existing array via animations.length = 0 when Array.isArray, otherwise assign animations = []; does not invent AnimationClips; does not create an AnimationMixer; does not call AnimationMixer.update; fresh r170 Object3D constructor assigns this.animations = []; GLTFLoader / DCC paths can leave non-empty AnimationClip arrays on nodes even when lid/latch/tool/fastener motion is procedural L4/L5 pivot mutation via tryUse / tryDriveFastener; does not touch Material glslVersion; does not touch Material flatShading; does not touch Material defines; does not touch Material customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender; does not touch Mesh onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including glslVersion / flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha) on packed color-only MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener; 13 animations-empty). v0.85 clears leftover Mesh morphTargetInfluences / morphTargetDictionary to the r170 absence (both === undefined and Object.hasOwn false; delete when present; does not assign null or empty [] / {}; does not invent morph targets; does not call updateMorphTargets(); does not add morphAttributes; does not enable morphing; fresh r170 Mesh constructor calls updateMorphTargets() which assigns both only when Object.keys(geometry.morphAttributes).length > 0; Mesh.copy copies them when defined; GLTFLoader / DCC paths can leave non-empty influence arrays and/or dictionaries on nodes even when color-only stand-ins have no morphAttributes and lid/latch/tool/fastener motion is procedural via tryUse / tryDriveFastener; does not touch Object3D animations; does not touch Material glslVersion / flatShading / defines / customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender / onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; mapped/lit/colliders stay authored / r170 defaults; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including glslVersion / flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha; 13 morphTargets-absent). v0.86 clears leftover BufferGeometry morphAttributes to the r170 empty object (Object.keys(geometry.morphAttributes).length === 0; mutate the existing plain object by deleting own keys; dispose a leftover BufferAttribute only when dispose exists and the attribute is not a live geometry attribute/index or still used by a skipped mesh; if morphAttributes is missing or not a plain object, assign {}; does not reassign null or undefined) and pins morphTargetsRelative to the r170 default false only when it is not already false on packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 morphAttributes-empty). Fresh r170 BufferGeometry assigns this.morphAttributes = {} and this.morphTargetsRelative = false. r170 WebGLRenderer calls WebGLMorphtargets.update when geometry.morphAttributes.position, .normal, or .color is not undefined (an empty array or empty BufferAttribute under the key still counts). Does not invent morph targets; does not call updateMorphTargets(); does not add morphAttributes; does not enable morphing; does not touch Mesh morphTargetInfluences / morphTargetDictionary; does not touch Object3D animations; does not touch Material glslVersion / flatShading / defines / customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender / onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; mapped/lit/interleaved/colliders stay authored; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins including glslVersion / flatShading / defines / customProgramCacheKey / stencil companions / polygonOffset companions / dithering / A2C / blendColor / blendAlpha. v0.87 clears leftover BufferGeometry groups to the r170 empty array (Array.isArray(geometry.groups) && geometry.groups.length === 0; mutate the existing array via groups.length = 0; if groups is missing or not an array, assign groups = []; r170 clearGroups() assigns a new [] and is not used) on packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 groups-empty). Fresh r170 BufferGeometry assigns this.groups = []. r170 WebGLRenderer.projectObject pushes one render item per geometry.groups entry only when Array.isArray(material); a single MeshBasicMaterial pushes one item with group null, so leftover groups do not multiply draws while the material stays a single MeshBasicMaterial. Clearing the list keeps a later material-array binding or BufferGeometry.copy round-trip from reviving per-group draws. Does not invent groups; does not assign a material array; does not change materials-per-group; does not touch drawRange; does not touch morphAttributes / morphTargetsRelative; does not touch Mesh morphTargetInfluences / morphTargetDictionary; does not touch Object3D animations; does not touch Material glslVersion / flatShading / defines / customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender / onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; mapped/lit/interleaved/colliders stay authored; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins. v0.88 pins leftover BufferGeometry drawRange to the r170 default (start === 0 && count === Infinity; mutate the existing object in place; if drawRange is missing or not an object, assign { start: 0, count: Infinity }; r170 setDrawRange writes a caller span and is not used) on packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 drawRange-default). Fresh r170 BufferGeometry assigns this.drawRange = { start: 0, count: Infinity }. r170 WebGLRenderer.renderBufferDirect draws geometry.drawRange when the render item's group is null; a single MeshBasicMaterial pushes group null, so a leftover partial drawRange clips or under-draws the color-only stand-in. Pinning the default span keeps the full index/position draw. Does not call setDrawRange; does not invent a partial range; does not replace the geometry; does not touch groups; does not touch morphAttributes / morphTargetsRelative; does not touch Mesh morphTargetInfluences / morphTargetDictionary; does not touch Object3D animations; does not touch Material glslVersion / flatShading / defines / customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender / onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; mapped/lit/interleaved/colliders stay authored; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins. v0.89 strips leftover skinIndex/skinWeight (COLOR_ONLY_UNUSED_SKIN_ATTRS, also listed on COLOR_ONLY_UNUSED_ATTRS) on packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 skinAttributes-absent). stripUnusedColorOnlyAttributes drops them during pack after weld; pinColorOnlyUnlitBasicSkinAttributes / pinColorOnlyVisualSkinAttributes run after pinColorOnlyVisualDrawRange so packaged ingest and fail-soft paths strip DCC leftovers too. Fresh procedural meshes have no skin attributes, so draws/tris/verts/attrBytes stay the v0.88 envelope. Verified three@0.170.0: WebGLPrograms sets skinning only when object.isSkinnedMesh === true; WebGLProgram emits #define USE_SKINNING and attribute vec4 skinIndex / skinWeight only then; a plain Mesh + MeshBasic never reads those attributes. WebGLGeometries.update uploads every geometry.attributes entry, so leftover skin attrs inflate pre-upload attrBytes. GLTFLoader maps JOINTS_0 to skinIndex and WEIGHTS_0 to skinWeight and builds a SkinnedMesh only when the node has a skin. This pulse deletes the leftover attributes via deleteAttribute. It does not invent a SkinnedMesh, enable skinning, or touch bones / skeleton / bindMatrix / bindMatrixInverse. It does not delete position. Mapped / lit stay authored. Interleaved geometries stay authored. Does not touch drawRange; does not touch groups; does not touch morphAttributes / morphTargetsRelative; does not touch Mesh morphTargetInfluences / morphTargetDictionary; does not touch Object3D animations; does not touch Material glslVersion / flatShading / defines / customProgramCacheKey; does not touch Material onBeforeCompile / onBeforeRender; does not touch Mesh onBeforeRender / onAfterRender / onBeforeShadow / onAfterShadow; does not touch customDepthMaterial / customDistanceMaterial; does not enable shadows; does not pin mesh.visible; does not change matrixAutoUpdate / matrixWorldAutoUpdate / layers / up / scale / rotation.order / prior material pins. Collider CPU arrays stay. lod.stats.attrBytes is the pre-upload envelope. v0.90 pins leftover BufferAttribute updateRange to { offset: 0, count: -1 } on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 updateRange-default). pinColorOnlyUnlitBasicUpdateRange / pinColorOnlyVisualUpdateRange run after pinColorOnlyVisualSkinAttributes. Mutate the existing object (offset = 0, count = -1); if missing or non-object, assign { offset: 0, count: -1 }. Checked installed three@0.170.0: the BufferAttribute constructor assigns this.updateRanges = [] and does not assign updateRange. WebGLAttributes.updateBuffer full-uploads when updateRanges.length === 0 and partial-uploads each { start, count } otherwise. addUpdateRange pushes a partial range and is not called. This pulse does not rewrite updateRanges or usage (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete skinIndex / skinWeight. Does not touch drawRange / groups / morphAttributes. Clean procedural draws/tris/attrBytes stay the v0.89 envelope. Quest 3 90Hz / 72 fallback requested, not measured; headset ms / FFR still TODO v0.91 clears leftover BufferAttribute updateRanges to the r170 empty array (Array.isArray && length === 0; mutate via updateRanges.length = 0; if missing or non-array, assign []) on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 updateRanges-empty). pinColorOnlyUnlitBasicUpdateRanges / pinColorOnlyVisualUpdateRanges run after pinColorOnlyVisualUpdateRange. Does not call addUpdateRange or clearUpdateRanges. Does not touch updateRange (v0.90). Does not change usage (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete skinIndex / skinWeight. Does not touch drawRange / groups / morphAttributes. Mapped / lit / interleaved / colliders stay authored. Clean procedural draws/tris/attrBytes stay the v0.90 envelope. Quest 3 90Hz / 72 fallback requested, not measured; headset ms / FFR still TODO v0.92 pins leftover BufferGeometry boundingBox/boundingSphere to the r170 constructor null (boundingBox === null && boundingSphere === null; assign null; do not invent Box3/Sphere; do not call computeBoundingBox/computeBoundingSphere in the pin) on packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 bounds-null). pinColorOnlyUnlitBasicBounds / pinColorOnlyVisualBounds run after pinColorOnlyVisualUpdateRanges. Checked installed three@0.170.0: BufferGeometry constructor assigns both null. Frustum.intersectsObject uses geometry.boundingSphere when the Mesh has no own boundingSphere and calls computeBoundingSphere only when that sphere is null; a leftover non-null sphere is tested as-is while frustumCulled stays true (v0.50). Does not touch updateRanges (v0.91). Does not touch updateRange (v0.90). Does not change usage (v0.43 StaticDrawUsage stays). Does not replace attributes or geometry. Does not delete skinIndex / skinWeight. Does not touch drawRange / groups / morphAttributes. Does not change frustumCulled. Mapped / lit / interleaved / colliders stay authored. The v0.43 onUpload callback recomputes bounds when they are null while CPU arrays are still present, then releases the arrays. Clean procedural pre-upload draws/tris/attrBytes stay the v0.91 envelope. Quest 3 90Hz / 72 fallback requested, not measured; headset ms / FFR still TODO. Do not require 207/240 Hz. v0.93 deletes leftover Mesh/Object3D boundingSphere so the property is absent (mesh.boundingSphere === undefined; delete; do not assign null; null !== undefined so a null own property still takes the Frustum object branch) on packed color-only MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener; 13 mesh-boundingSphere-absent). pinColorOnlyUnlitBasicMeshBoundingSphere / pinColorOnlyVisualMeshBoundingSphere run after pinColorOnlyVisualBounds. Checked installed three@0.170.0: Frustum.intersectsObject uses object.boundingSphere when that property is not undefined; a Mesh does not assign object.boundingSphere, so the else branch copies geometry.boundingSphere and calls geometry.computeBoundingSphere only when that sphere is null (v0.92 restores that path). A leftover non-undefined mesh.boundingSphere short-circuits past the geometry path while frustumCulled stays true (v0.50). Does not invent a Sphere. Does not call computeBoundingSphere on the mesh. Does not touch geometry.boundingBox / geometry.boundingSphere (v0.92). Does not touch updateRanges (v0.91). Does not touch updateRange (v0.90). Does not change usage (v0.43 StaticDrawUsage stays). Does not touch skinIndex / skinWeight, drawRange, groups, morphAttributes, Mesh morph targets, or Object3D animations. Does not change frustumCulled, mesh.visible, or matrixAutoUpdate. Mapped / lit / interleaved / colliders keep authored object spheres. Clean procedural pre-upload draws/tris/attrBytes stay the v0.92 envelope. bounds-null 13 stays. Quest 3 90Hz / 72 fallback requested, not measured; headset ms / FFR still TODO. Do not require 207/240 Hz. v0.94 pins leftover BufferAttribute usage to the r170 constructor default StaticDrawUsage (usage === StaticDrawUsage) on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 usage-static). pinColorOnlyUnlitBasicUsage / pinColorOnlyVisualUsage run after pinColorOnlyVisualMeshBoundingSphere. Checked installed three@0.170.0: the BufferAttribute constructor assigns this.usage = StaticDrawUsage. setUsage assigns that value in place and does not replace the attribute. WebGLAttributes.createBuffer passes attribute.usage to gl.bufferData. A leftover DynamicDrawUsage (or other non-static usage) on static packed color-only props is a wasteful buffer hint on Quest 3 TBDR. Does not touch updateRange (v0.90). Does not touch updateRanges (v0.91). Does not touch geometry.boundingBox / geometry.boundingSphere (v0.92). Does not touch Mesh boundingSphere (v0.93). Does not replace attributes or the geometry. Does not change frustumCulled. Does not delete skinIndex / skinWeight. Does not touch drawRange, groups, morphAttributes, Mesh morph targets, or Object3D animations. Mapped / lit / interleaved / colliders keep authored usage. Clean procedural pre-upload draws/tris/attrBytes stay the v0.93 envelope. mesh-boundingSphere-absent 13 stays. bounds-null 13 stays. updateRanges-empty 13 stays. updateRange-default 13 stays. skinAttributes-absent 13 stays. drawRange-default 13 stays.  v1.13.0 pins leftover Material index0AttributeName to the r170 MeshBasic absence (material.index0AttributeName === undefined and Object.hasOwn(material, 'index0AttributeName') === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured index0AttributeName-absent 3) after the v1.12.0 depthPacking pin. pinColorOnlyUnlitBasicMaterialIndex0AttributeName / pinColorOnlyVisualMaterialIndex0AttributeName run after pinColorOnlyVisualMaterialDepthPacking on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete material.index0AttributeName when the own property is present. Do not assign null, undefined, or ''. An already-absent index0AttributeName is left alone. Pin once per shared material instance. Do not invent a replacement attribute name. Do not touch depthPacking (v1.12.0 depthPacking-absent 3 stays). Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0 unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData, BufferAttribute fields, bounds, morphs, animations, shadows, frustumCulled, mesh.visible, or prior Material program-cache / flag pins. Mapped / lit / interleaved keep authored index0AttributeName. Collider meshes stay untouched. ShaderMaterial keeps its constructor index0AttributeName. Checked installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign index0AttributeName (index0AttributeName === undefined and Object.hasOwn is false). ShaderMaterial assigns this.index0AttributeName = undefined (an own property whose value is still undefined). ShaderMaterial.copy does not copy index0AttributeName. WebGLPrograms.getParameters copies index0AttributeName: material.index0AttributeName. getProgramCacheKey, getProgramCacheKeyParameters, and getProgramCacheKeyBooleans do not push that name (no cache-key token and no program-layer bit). WebGLProgram emits no #define for it. Before gl.linkProgram, when parameters.index0AttributeName !== undefined, it calls gl.bindAttribLocation(program, 0, parameters.index0AttributeName); otherwise, if morphTargets is true, it binds 'position'. A leftover string ('position', 'color') or empty string '' is not undefined, so it binds attribute 0 to that name, while the program cache key stays identical to constructor absence. The first material to compile bakes that binding into a program every later material with the same other parameters will reuse. Assigning null also binds (null !== undefined). Assigning undefined skips the bind but, stored as an own property, is not the r170 MeshBasic absence. delete material.index0AttributeName removes the own property so the r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, depthPacking-absent 3, extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.12.0. index0AttributeName-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.12.0 pins leftover Material depthPacking to the r170 MeshBasic absence (material.depthPacking === undefined and Object.hasOwn(material, 'depthPacking') === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured depthPacking-absent 3) after the v1.11.0 extensions pin. pinColorOnlyUnlitBasicMaterialDepthPacking / pinColorOnlyVisualMaterialDepthPacking run after pinColorOnlyVisualMaterialExtensions on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete material.depthPacking when the own property is present. Do not assign null, undefined, or 0. An already-absent depthPacking is left alone. Pin once per shared material instance. Do not convert MeshBasic to MeshDepthMaterial. Do not invent depth packing. Do not touch extensions (v1.11.0 extensions-absent 3 stays). Do not touch indirect (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0 unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData, BufferAttribute fields, bounds, morphs, animations, shadows, frustumCulled, mesh.visible, or prior Material program-cache / flag pins. Do not pin Material index0AttributeName (left for a later pulse). Mapped / lit / interleaved keep authored depthPacking. Collider meshes stay untouched. MeshDepthMaterial keeps authored depthPacking. Checked installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign depthPacking (depthPacking === undefined and Object.hasOwn is false). MeshDepthMaterial assigns this.depthPacking = BasicDepthPacking and copy assigns this.depthPacking = source.depthPacking. WebGLPrograms.getParameters sets useDepthPacking: material.depthPacking >= 0 and depthPacking: material.depthPacking || 0. getProgramCacheKeyParameters pushes parameters.depthPacking. getProgramCacheKeyBooleans enables program layer 13 when parameters.useDepthPacking is true. WebGLProgram emits #define DEPTH_PACKING plus parameters.depthPacking when useDepthPacking is true. A leftover BasicDepthPacking (3200) or RGBADepthPacking (3201) pushes a different cache-key number than the absent-material fallback 0. A leftover 0 still sets useDepthPacking because 0 >= 0, so the boolean program mask forks and the define is emitted. Assigning null also sets useDepthPacking because null >= 0. delete material.depthPacking removes the own property so the r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, extensions-absent 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.11.0. depthPacking-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.11.0 pins leftover Material extensions to the r170 MeshBasic absence (material.extensions === undefined and Object.hasOwn(material, 'extensions') === false) on the 3 shared color-only MeshBasic materials (wood / brass / steel; measured extensions-absent 3) after the v1.10.0 indirect pin. pinColorOnlyUnlitBasicMaterialExtensions / pinColorOnlyVisualMaterialExtensions run after pinColorOnlyVisualIndirect on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer delete material.extensions when the own property is present. Do not assign null. Do not assign a sentinel { clipCullDistance: false, multiDraw: false }. An already-absent extensions is left alone. Pin once per shared material instance. Do not convert MeshBasic to ShaderMaterial. Do not invent extension maps. Do not enable multi-draw or clip-cull-distance. Do not touch indirect (v1.10.0 indirect-null 13 stays). Do not re-run the unused-channel strip (v1.9.0 unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData, BufferAttribute fields, bounds, morphs, animations, shadows, frustumCulled, mesh.visible, or prior Material program-cache / flag pins. Mapped / lit / interleaved keep authored extensions. Collider meshes stay untouched. ShaderMaterial keeps authored extensions. Checked installed three@0.170.0: fresh Material / MeshBasicMaterial constructors do not assign extensions (extensions === undefined and Object.hasOwn is false). ShaderMaterial assigns this.extensions = { clipCullDistance: false, multiDraw: false } and ShaderMaterial.copy copies via Object.assign({}, source.extensions). WebGLPrograms.getParameters sets HAS_EXTENSIONS = !! material.extensions, then extensionClipCullDistance: HAS_EXTENSIONS && material.extensions.clipCullDistance === true && extensions.has('WEBGL_clip_cull_distance') and extensionMultiDraw: (HAS_EXTENSIONS && material.extensions.multiDraw === true || IS_BATCHEDMESH) && extensions.has('WEBGL_multi_draw'). A leftover own extensions object on MeshBasic keeps HAS_EXTENSIONS true even when both flags are false, so those parameter forks still read the object. A sentinel { clipCullDistance: false, multiDraw: false } keeps HAS_EXTENSIONS true. delete material.extensions removes the own property so the r170 absence remains. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, indirect-null 13, unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.10.0. extensions-absent 3 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.10.0 pins leftover BufferGeometry indirect to the r170 constructor default null (geometry.indirect === null) on the 13 packed color-only unlit MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; measured indirect-null 13) after the v1.9.0 unused-channel strip. pinColorOnlyUnlitBasicIndirect / pinColorOnlyVisualIndirect run after pinColorOnlyVisualUnusedAttributes on procedural create and packaged ingest, including fail-soft (no lod groups) and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Call setIndirect(null) only when indirect is not already null. Do not invent a replacement buffer. Do not call delete on unrelated fields. Do not re-run the unused-channel strip (v1.9.0 unusedAttributes-absent 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version / name / userData, Mesh / Object3D name / userData (reserved lidMesh / latchMesh / fastenerMesh / collider_* stay), BufferGeometry name / userData, other BufferAttribute fields, bounds, morphs, animations, shadows, frustumCulled, mesh.visible, drawRange, groups, skinIndex / skinWeight, position, or the index. Mapped / lit / interleaved keep authored indirect. Collider meshes stay untouched. Checked installed three@0.170.0: the BufferGeometry constructor assigns this.indirect = null. setIndirect(indirect) assigns this.indirect = indirect. getIndirect() returns this.indirect. In src/renderers/common/Geometries.js, when renderObject.geometry.indirect !== null, the renderer calls updateAttribute(indirect, AttributeType.INDIRECT). Leftover indirect storage forces extra GPU attribute upload / binding work. Color-only static MeshBasic props do not use multi-draw / BatchedMesh indirect indexing. Clearing a leftover indirect to null is load-time packaging for Quest 3 TBDR. Clean procedural pre-upload draws 6 / 4 / 2, tris 240 / 96 / 24, attrBytes 2820 / 1176 / 432 + fastener 216, unique MeshBasic 3, unusedAttributes-absent 13, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.9.0. indirect-null 13 is the new count (LOD0 6 / LOD1 4 / LOD2 2 + fastener 1). Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.9.0 strips leftover normal / uv / uv1 / uv2 / uv3 / tangent so none of those channels remain (geometry.getAttribute(name) is missing and geometry.hasAttribute(name) === false) on the 13 packed color-only unlit MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; measured unusedAttributes-absent 13) after the v1.8.0 onUpload pin. COLOR_ONLY_UNUSED_CHANNEL_ATTRS is derived from COLOR_ONLY_UNUSED_ATTRS (source of truth) and excludes skinIndex / skinWeight (v0.89 pin) and color (v1.7.0 pin). pinColorOnlyUnlitBasicUnusedAttributes / pinColorOnlyVisualUnusedAttributes run after pinColorOnlyVisualOnUpload on procedural create and packaged ingest, including fail-soft and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer geometry.deleteAttribute(name) when present. Do not invent a replacement attribute. Do not assign null. Do not delete position or the index. Do not delete skinIndex / skinWeight. Do not delete color. Do not touch onUpload / onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version (v1.5.0 material-version-zero 3 stays) or Material name (v1.2.0 material-name-empty 3 stays) or Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch Mesh / Object3D userData (v1.4.0 mesh-userData-empty 13 stays) or Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch BufferGeometry name / userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges. Do not touch bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Checked installed three@0.170.0: WebGLProgram prefix always emits attribute vec3 normal and attribute vec2 uv. uv1 / uv2 / uv3 / tangent are behind USE_UV1 / USE_UV2 / USE_UV3 / USE_TANGENT, which stay off without maps. meshbasic.glsl.js reads normal only inside USE_ENVMAP or USE_SKINNING. uv_vertex.glsl.js reads uv only under USE_UV or USE_ANISOTROPY. Color-only MeshBasic does not enable those defines. WebGLGeometries.update still uploads every geometry.attributes entry, so leftover channels inflate pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static props. GLTFLoader maps NORMAL to normal, TANGENT to tangent, TEXCOORD_0 to uv, TEXCOORD_1 to uv1, TEXCOORD_2 to uv2, TEXCOORD_3 to uv3. Draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, LOD attrBytes 2820 / 1176 / 432, fastener attrBytes 216, drawCallsEstimate 7, unique MeshBasic 3, onUpload-release 13, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.8.0. unusedAttributes-absent 13 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.8.0 pins leftover BufferAttribute onUpload / onUploadCallback so the v0.43 CPU-array-release-on-GPU-upload hook (releaseCpuArray) is the sole upload callback on the remaining attributes (at least position, and index when present) of the 13 packed color-only unlit MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; measured onUpload-release 13) after the v1.7.0 color strip. pinColorOnlyUnlitBasicOnUpload / pinColorOnlyVisualOnUpload run after pinColorOnlyVisualColorAttribute on procedural create and packaged ingest, including fail-soft and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. The pin calls BufferAttribute.onUpload and does not invoke the callback. Do not null .array inside the pin. Do not recompute bounds inside the pin. Do not call setUsage. Do not replace the mesh, the material, the geometry, the attributes, or the typed arrays. Do not invent attributes. An already-correct releaseCpuArray hook stamped to that geometry is left in place. A rogue callback, a hook stamped to another geometry, or the r170 empty prototype onUploadCallback is replaced. BufferAttribute.copy does not copy onUploadCallback, so a copied attribute falls back to the empty prototype method and the pin restores the release hook. Do not touch color (v1.7.0 colorAttribute-absent 13 stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material version (v1.5.0 material-version-zero 3 stays) or Material name (v1.2.0 material-name-empty 3 stays) or Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch Mesh / Object3D userData (v1.4.0 mesh-userData-empty 13 stays) or Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch BufferGeometry name / userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges. Do not touch bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Checked installed three@0.170.0: BufferAttribute declares onUploadCallback() {} on the prototype. onUpload(callback) assigns this.onUploadCallback = callback and does not null .array and does not bump version. WebGLAttributes.createBuffer copies attribute.array into a local, calls gl.bufferData, then calls attribute.onUploadCallback(). The callback runs after the GPU upload. updateBuffer calls onUploadCallback after gl.bufferSubData. A leftover non-release callback skips the Quest 3 CPU-array release, so static packed color-only props keep Float16 / Uint16 CPU arrays after upload on a TBDR headset. Draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, LOD attrBytes 2820 / 1176 / 432, fastener attrBytes 216, drawCallsEstimate 7, unique MeshBasic 3, colorAttribute-absent 13, matrixWorldNeedsUpdate-false 13, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.7.0. onUpload-release 13 is the new count. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.7.0 strips leftover BufferGeometry color so the attribute is absent (geometry.getAttribute('color') is missing and geometry.hasAttribute('color') === false) on the 13 packed color-only unlit MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; measured colorAttribute-absent 13) when the material already has vertexColors === false (v0.57 stays). COLOR_ONLY_UNUSED_COLOR_ATTRS is ['color'] and is listed on COLOR_ONLY_UNUSED_ATTRS. stripUnusedColorOnlyColorAttributes deletes it from stripUnusedColorOnlyAttributes on the pack/weld path and skips interleaved geometries. pinColorOnlyUnlitBasicColorAttribute / pinColorOnlyVisualColorAttribute run after pinColorOnlyVisualMatrixWorldNeedsUpdate on procedural create and packaged ingest, including fail-soft and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Prefer geometry.deleteAttribute('color') when present. Do not invent a replacement attribute. Do not assign null. Do not enable material.vertexColors. Do not rewrite vertexColors. Do not replace the mesh, the material, the geometry, other attributes, or typed arrays. Do not delete position. Do not delete index. Do not touch Material version (v1.5.0 material-version-zero 3 stays) or Material name (v1.2.0 material-name-empty 3 stays) or Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch Mesh / Object3D userData (v1.4.0 mesh-userData-empty 13 stays) or Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false 13 stays). Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch BufferGeometry name / userData or other BufferAttribute fields. Checked installed three@0.170.0: a fresh BufferGeometry assigns this.attributes = {} and has no color attribute. deleteAttribute(name) deletes this.attributes[name] and does not assign null. WebGLPrograms copies vertexColors: material.vertexColors and enables the vertex-color program layer only when parameters.vertexColors is true. WebGLProgram emits #define USE_COLOR and attribute vec3 color only then. A leftover color BufferAttribute on a color-only MeshBasic with vertexColors === false is never read by the MeshBasic shader path. WebGLGeometries.update still uploads every geometry.attributes entry, so a leftover color attribute inflates pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static props. Deleting it is load-time packaging. GLTFLoader maps COLOR_0 to color. On clean procedural meshes (no color attr) draws / tris / attrBytes stay unchanged vs v1.6.0. A fixture with a leftover Float32 color may drop measured attrBytes: itemSize 3 is count * 3 * 4 bytes (24-vert BoxGeometry drops 288; 3-vert fixture drops 36); itemSize 4 is count * 4 * 4 bytes (3-vert fixture drops 48). Draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, LOD attrBytes 2820 / 1176 / 432, fastener attrBytes 216, drawCallsEstimate 7, unique MeshBasic 3, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13, matrixWorldNeedsUpdate-false 13 stay vs v1.6.0. colorAttribute-absent 13 is the new count. Mapped / lit / interleaved keep authored color. Collider meshes stay untouched. Quest 3 90 Hz (~11.1 ms) / 72 Hz fallback are requested, not measured. No invented headset ms. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.6.0 pins leftover Object3D / Mesh matrixWorldNeedsUpdate to the r170 constructor default false (mesh.matrixWorldNeedsUpdate === false) on the 13 packed color-only unlit MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener; measured matrixWorldNeedsUpdate-false 13). pinColorOnlyUnlitBasicMatrixWorldNeedsUpdate / pinColorOnlyVisualMatrixWorldNeedsUpdate run after pinColorOnlyVisualMaterialVersion on procedural create and packaged ingest, including fail-soft and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign mesh.matrixWorldNeedsUpdate = false in place only when it is not already false. Do not call updateMatrix or updateMatrixWorld inside the pin (load-time flag clear only). Do not replace the mesh, the material, the geometry, the attributes, or the typed arrays. Do not change matrixAutoUpdate (v0.45 freeze on static body LOD leaves stays; lid/latch/tool/fastener stay live). Do not change matrixWorldAutoUpdate (v0.69 stays). Do not touch Material version (v1.5.0 material-version-zero 3 stays) or Material name (v1.2.0 material-name-empty 3 stays) or Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch Mesh / Object3D userData (v1.4.0 mesh-userData-empty 13 stays) or Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch BufferGeometry userData / name. Do not touch BufferAttribute fields, prior material program-cache / flag pins, bounds, morphs, animations, shadows, frustumCulled, or mesh.visible. Checked installed three@0.170.0: the Object3D constructor assigns this.matrixWorldNeedsUpdate = false. Mesh does not override it. updateMatrix() assigns this.matrixWorldNeedsUpdate = true. updateMatrixWorld(force) recomputes matrixWorld when this.matrixWorldNeedsUpdate || force (and matrixWorldAutoUpdate === true), then assigns this.matrixWorldNeedsUpdate = false. updateWorldMatrix does not read or clear matrixWorldNeedsUpdate; when matrixAutoUpdate is true it calls updateMatrix(), which sets the flag true. Object3D.copy copies source.matrixWorldNeedsUpdate. applyMatrix4 calls updateMatrix() when matrixAutoUpdate is true, so a glTF node matrix leaves the flag true on a live node. WebGLRenderer.render calls scene.updateMatrixWorld() when scene.matrixWorldAutoUpdate === true. The fast path inside updateMatrixWorld skips multiplyMatrices only when the flag is false and force is false. A leftover true on a static packed color-only visual (matrixAutoUpdate === false from v0.45, so updateMatrix is not called first) forces that world-matrix multiply on the JS thread before the flag is cleared. On Quest 3 TBDR that load-time / first-frame rebuild is packaging waste; it does not change draws, tris, or attrBytes. Draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, LOD attrBytes 2820 / 1176 / 432, fastener attrBytes 216, drawCallsEstimate 7, unique MeshBasic 3, material-version-zero 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.5.0. matrixWorldNeedsUpdate-false 13 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.5.0 pins leftover Material version to the r170 constructor default 0 (material.version === 0) on the 3 shared color-only MeshBasic materials (wood / brass / steel; unique MeshBasic stays 3; measured material-version-zero 3). pinColorOnlyUnlitBasicMaterialVersion / pinColorOnlyVisualMaterialVersion run after pinColorOnlyVisualMeshUserData on procedural create and packaged ingest, including fail-soft and the fastener. Same isColorOnlyUnlitBasic gate and the same collider / interleaved / mapped / lit / shared-material / shared-geometry skip rules. Assign material.version = 0 in place only when it is not already 0. Do not call material.needsUpdate = true (that increments version). Do not replace the material, the mesh, the geometry, the attributes, or the typed arrays. Do not invent materials. Pin once per shared material instance. Do not touch Material name (v1.2.0 material-name-empty 3 stays) or Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch Mesh / Object3D userData (v1.4.0 mesh-userData-empty 13 stays) or Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch BufferGeometry userData / name. Do not touch BufferAttribute fields, prior material program-cache / flag pins, bounds, morphs, animations, shadows, frustumCulled, matrixAutoUpdate, or mesh.visible. Checked installed three@0.170.0: the Material constructor assigns this.version = 0. The needsUpdate setter increments version when value === true. The alphaTest setter also increments version when the test crosses zero. Material.copy does not copy version. Material.toJSON does not write material.version (metadata.version 4.6 is the JSON format version). WebGLRenderer.setProgram sets needsProgramChange and stores materialProperties.__version = material.version when material.version !== materialProperties.__version, then calls getProgram, which builds parameters via WebGLPrograms.getParameters. getProgramCacheKey does not include material.version, so a leftover number does not fork a second program. A leftover non-zero material.version on a static packed color-only MeshBasic is a dirty counter that does not describe a pending property change. The mismatch still allocates program parameters on the JS thread before the fast path (version === __version) can skip getProgram. On Quest 3 TBDR that load-time parameter rebuild is packaging waste; it does not change draws, tris, or attrBytes. Direct assignment does not go through needsUpdate, so it does not increment. Draws 6 / 4 / 2, tris 240 / 96 / 24, unique verts 230 / 100 / 48, LOD attrBytes 2820 / 1176 / 432, fastener attrBytes 216, drawCallsEstimate 7, unique MeshBasic 3, material-name-empty 3, material-userData-empty 3, geometry-userData-empty 13, geometry-name-empty 13, mesh-name-empty 10, mesh-userData-empty 13 stay vs v1.4.0. material-version-zero 3 is the new count. Quest 3 90 Hz / 72 fallback requested, not measured. Headset ms / FFR still TODO. Do not require 207/240 Hz. v1.4.0 pins leftover Mesh / Object3D userData to the r170 constructor default empty plain object (mesh.userData is a fresh {} with Object.prototype and no own keys) on packed color-only MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener; 13 mesh-userData-empty). pinColorOnlyUnlitBasicMeshUserData / pinColorOnlyVisualMeshUserData run after pinColorOnlyVisualMeshName. Assign a fresh mesh.userData = {} only when it is not already an empty plain object (missing, non-object, any own string or symbol keys, or a prototype other than Object.prototype). Do not share one {} across meshes. An already-empty plain object is left as-is. Do not replace the mesh, the material, the geometry, the attributes, or the typed arrays. Do not touch Mesh / Object3D name (v1.3.0 mesh-name-empty 10 stays; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay). Do not touch Material name (v1.2.0 material-name-empty 3 stays). Do not touch Material userData (v1.1.0 material-userData-empty 3 stays). Do not touch BufferGeometry userData (v1.0.0 geometry-userData-empty 13 stays) or BufferGeometry name (v0.99 geometry-name-empty 13 stays). Do not touch entity/root userData, tool Group userData, or collider mesh userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges / onUpload / onUploadCallback. Do not touch geometry boundingBox / boundingSphere or Mesh boundingSphere. Do not change frustumCulled, matrixAutoUpdate, or mesh.visible. Checked installed three@0.170.0: the Object3D constructor assigns this.userData = {}. Mesh does not override userData. Object3D.toJSON writes object.userData only when Object.keys(this.userData).length > 0. Object3D.copy assigns this.userData = JSON.parse(JSON.stringify(source.userData)) (a clone). ObjectLoader.parseObject assigns object.userData = data.userData when data.userData !== undefined. Stock GLTFLoader loadMesh calls assignExtrasToUserData(mesh, meshDef) and _loadNodeShallow calls assignExtrasToUserData(node, nodeDef) (a single-primitive node is the mesh, so node extras land on mesh.userData). WebGLRenderer does not read mesh.userData. Clearing leftover extras to a fresh {} is load-time packaging only: no draw / tri / attrBytes change. Draws / tris / attrBytes unchanged vs v1.3.0. mesh-name-empty 10 stays. unique MeshBasic 3 stays. material-name-empty 3 stays. v1.3.0 pins leftover Mesh / Object3D name to the r170 constructor default empty string (mesh.name === '') on packed color-only MeshBasic visual meshes (body LOD leaves + lid/latch/tool + fastener; reserved names lidMesh / latchMesh / fastenerMesh and any collider_* stay; 10 mesh-name-empty). pinColorOnlyUnlitBasicMeshName / pinColorOnlyVisualMeshName run after pinColorOnlyVisualMaterialName. Assign mesh.name = '' in place only when it is not already '' and the name is not reserved. Do not replace the mesh, material, geometry, attributes, or typed arrays. Do not touch Material name (v1.2.0 material-name-empty stays). Do not touch Material userData (v1.1.0 material-userData-empty stays). Do not touch BufferGeometry userData (v1.0.0 geometry-userData-empty stays) or BufferGeometry name (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges / onUpload / onUploadCallback. Do not touch geometry boundingBox / boundingSphere or Mesh boundingSphere. Do not change frustumCulled, matrixAutoUpdate, or mesh.visible. Checked installed three@0.170.0: the Object3D constructor assigns this.name = ''. Mesh does not override name. Object3D.toJSON writes object.name only when this.name !== ''. Object3D.copy copies source.name. ObjectLoader.parseObject assigns object.name = data.name when data.name !== undefined. Stock GLTFLoader loadMesh assigns mesh.name from meshDef.name (or mesh_ + index) and _loadNodeShallow assigns node.name from the node name when set (a single-primitive node is the mesh). WebGLRenderer does not read mesh.name. WebGLPrograms.getParameters copies shaderName: material.name, not the mesh name, so a leftover mesh name does not fork the program cache or change the draw. Clearing non-reserved names to '' is load-time packaging only: no draw / tri / attrBytes change. Draws / tris / attrBytes unchanged vs v1.2.0. material-name-empty 3 stays. unique MeshBasic 3 stays. v1.2.0 pins leftover Material name to the r170 constructor default empty string (material.name === '') on the shared color-only MeshBasic materials used by those same visuals (wood/brass/steel; unique MeshBasic stays 3; 3 material-name-empty). pinColorOnlyUnlitBasicMaterialName / pinColorOnlyVisualMaterialName run after pinColorOnlyVisualMaterialUserData. Assign material.name = '' in place only when it is not already ''. Do not replace the material, geometry, attributes, or typed arrays. Do not touch Material userData (v1.1.0 material-userData-empty stays). Do not touch prior material program-cache / flag pins (glslVersion / flatShading / defines / customProgramCacheKey / onBeforeCompile / onBeforeRender / fog). Do not touch BufferGeometry userData (v1.0.0 geometry-userData-empty stays) or BufferGeometry name (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges / onUpload / onUploadCallback. Do not touch geometry boundingBox / boundingSphere or Mesh boundingSphere. Checked installed three@0.170.0: the Material constructor assigns this.name = ''. toJSON writes data.name only when this.name !== ''. copy copies source.name. MaterialLoader assigns material.name = json.name when json.name !== undefined. ObjectLoader.parseMaterials uses that loader. Stock GLTFLoader loadMaterial assigns material.name = materialDef.name when materialDef.name is set. WebGLRenderer does not read material.name. WebGLPrograms.getParameters copies shaderName: material.name and WebGLProgram emits #define SHADER_NAME from that parameter, but getProgramCacheKey does not include shaderName, so a leftover name does not fork the program cache or change the draw. Clearing to '' is load-time packaging only: no draw / tri / attrBytes change; it drops leftover string retention on the 3 shared color-only MeshBasics. Does not rename the Mesh. Draws / tris / attrBytes unchanged vs v1.1.0. material-userData-empty 3 stays. unique MeshBasic 3 stays. v1.1.0 pins leftover Material userData to the r170 constructor default empty plain object (material.userData is a fresh {} with Object.prototype and no own keys) on the shared color-only MeshBasic materials used by those same visuals (wood/brass/steel; unique MeshBasic stays 3; 3 material-userData-empty). pinColorOnlyUnlitBasicMaterialUserData / pinColorOnlyVisualMaterialUserData run after pinColorOnlyVisualGeometryUserData. Assign material.userData = {} in place only when it is not already an empty plain object (each replacement is a fresh {} — no shared empty object across materials). Do not replace the material, geometry, attributes, or typed arrays. Do not touch Material name. Do not touch prior material program-cache / flag pins. Do not touch BufferGeometry userData (v1.0.0 geometry-userData-empty stays) or BufferGeometry name (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges / onUpload / onUploadCallback. Do not touch geometry boundingBox / boundingSphere or Mesh boundingSphere. Checked installed three@0.170.0: the Material constructor assigns this.userData = {}. toJSON writes data.userData only when Object.keys(this.userData).length > 0. copy assigns this.userData = JSON.parse(JSON.stringify(source.userData)) (a clone, not a shared reference). MaterialLoader assigns material.userData = json.userData when json.userData !== undefined. ObjectLoader.parseMaterials uses that loader. Stock GLTFLoader loadMaterial calls assignExtrasToUserData(material, materialDef), which Object.assigns material extras onto material.userData. WebGLRenderer does not read material.userData. Clearing leftover extras to a fresh {} is load-time packaging only: no draw / tri / attrBytes change. Does not rename the Mesh. Draws / tris / attrBytes unchanged vs v1.0.0. geometry-userData-empty 13 stays. unique MeshBasic 3 stays. v1.0.0 pins leftover BufferGeometry userData to the r170 constructor default empty plain object (geometry.userData is a fresh {} with Object.prototype and no own keys) on the same 13 packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 geometry-userData-empty). pinColorOnlyUnlitBasicGeometryUserData / pinColorOnlyVisualGeometryUserData run after pinColorOnlyVisualGeometryName. Assign geometry.userData = {} in place only when it is not already an empty plain object (each replacement is a fresh {} — no shared empty object across geometries). Do not replace the geometry, attributes, or typed arrays. Do not touch BufferGeometry name (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D userData. Do not touch BufferAttribute version / name / gpuType / normalized / usage / updateRange / updateRanges / onUpload / onUploadCallback. Do not touch geometry boundingBox / boundingSphere or Mesh boundingSphere. Checked installed three@0.170.0: the BufferGeometry constructor assigns this.userData = {}. toJSON writes data.userData only when Object.keys(this.userData).length > 0. copy assigns this.userData = source.userData (shared reference). BufferGeometryLoader assigns geometry.userData = json.userData when json.userData is truthy. ObjectLoader.parseGeometries assigns geometry.userData = data.userData when data.userData !== undefined. Stock GLTFLoader addPrimitiveAttributes calls assignExtrasToUserData(geometry, primitiveDef), which Object.assigns primitive extras onto geometry.userData. WebGLRenderer does not read geometry.userData. Clearing leftover extras to a fresh {} is load-time packaging only: no draw / tri / attrBytes change. Does not rename the Mesh. Draws / tris / attrBytes unchanged vs v0.99. geometry-name-empty 13 stays. version-zero 13 stays. v0.99 pins leftover BufferGeometry name to the r170 constructor default empty string (geometry.name === '') on the same 13 packed color-only MeshBasic visual geometries (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 geometry-name-empty). pinColorOnlyUnlitBasicGeometryName / pinColorOnlyVisualGeometryName run after pinColorOnlyVisualVersion. Assign geometry.name = '' in place only when it is not already ''. Do not replace the geometry, attributes, or typed arrays. Do not touch BufferAttribute version (v0.98 version-zero stays). Do not touch BufferAttribute name (v0.97 name-empty stays). Do not touch gpuType. Do not call setUsage. Do not reassign normalized. Do not touch onUpload / onUploadCallback. Do not touch updateRange, updateRanges, geometry boundingBox / boundingSphere, or Mesh boundingSphere. Checked installed three@0.170.0: the BufferGeometry constructor assigns this.name = ''. toJSON writes data.name only when this.name !== ''. copy copies source.name. BufferGeometryLoader assigns geometry.name from json.name when present. ObjectLoader.parseGeometries assigns geometry.name from data.name when data.name !== undefined. Stock GLTFLoader names the Mesh and copies primitive extras onto geometry.userData; it does not assign geometry.name. WebGLRenderer does not read geometry.name. DCC exporters and JSON round-trips still leave mesh or primitive names on the geometry. Clearing to '' is load-time packaging only: no draw / tri / attrBytes change; it drops leftover string retention on Quest 3 TBDR static props. Does not rename the Mesh. Draws / tris / attrBytes unchanged vs v0.98. version-zero 13 stays. name-empty 13 stays. v0.98 pins leftover BufferAttribute version to the r170 constructor default 0 (version === 0) on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 version-zero). pinColorOnlyUnlitBasicVersion / pinColorOnlyVisualVersion run after pinColorOnlyVisualName. Assign attribute.version = 0 in place only when it is not already 0. Do not replace the attribute, the typed array, or the geometry. Do not touch name (v0.97 name-empty stays). Do not touch gpuType (v0.96 gpuType-float stays). Do not call setUsage (v0.94 usage-static stays). Do not reassign normalized (v0.95 normalized-default stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns this.version = 0. The needsUpdate setter increments version when value === true. Float16BufferAttribute does not override version. WebGLAttributes.update stores attribute.version on the first upload and calls updateBuffer (gl.bufferSubData, then onUploadCallback) when the stored buffer version is less than attribute.version. A leftover non-zero version on static packed color-only props before first upload forces extra TBDR buffer work. Pinning to 0 is load-time packaging only: no draw / tri / attrBytes change. Does not touch onUpload / onUploadCallback (v0.43 CPU-release hook stays). Does not touch updateRange (v0.90). Does not touch updateRanges (v0.91). Does not touch geometry boundingBox / boundingSphere (v0.92). Does not touch Mesh boundingSphere (v0.93). Does not change frustumCulled. Mapped / lit / interleaved keep authored version. Collider meshes stay untouched. v0.97 pins leftover BufferAttribute name to the r170 constructor default empty string (name === '') on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 name-empty). pinColorOnlyUnlitBasicName / pinColorOnlyVisualName run after pinColorOnlyVisualGpuType. Assign attribute.name = '' in place only when it is not already ''. Do not replace the attribute, the typed array, or the geometry. Do not touch gpuType (v0.96 gpuType-float stays). Do not call setUsage (v0.94 usage-static stays). Do not reassign normalized (v0.95 normalized-default stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns this.name = ''. Float16BufferAttribute does not override name. BufferAttribute.toJSON writes data.name only when this.name !== ''. BufferGeometryLoader copies a JSON attribute name onto the BufferAttribute. WebGLAttributes and WebGLBindingStates do not read attribute.name. GLTF / DCC ingest often leaves accessor or exporter names on attributes and the index. Clearing them to '' is load-time packaging only: no draw / tri / attrBytes change; it drops leftover string retention on Quest 3 TBDR static props. Does not touch updateRange (v0.90). Does not touch updateRanges (v0.91). Does not touch geometry boundingBox / boundingSphere (v0.92). Does not touch Mesh boundingSphere (v0.93). Does not change frustumCulled. Mapped / lit / interleaved keep authored name. Collider meshes stay untouched. v0.96 pins leftover BufferAttribute gpuType to the r170 constructor default FloatType (gpuType === FloatType) on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 gpuType-float). pinColorOnlyUnlitBasicGpuType / pinColorOnlyVisualGpuType run after pinColorOnlyVisualNormalized. Assign attribute.gpuType = FloatType in place only when it is not already FloatType. Do not replace the attribute, the typed array, or the geometry. Do not call setUsage (v0.94 usage-static stays). Do not reassign normalized (v0.95 normalized-default stays). Checked installed three@0.170.0: the BufferAttribute constructor assigns this.gpuType = FloatType (1015). Float16BufferAttribute does not override gpuType. WebGLAttributes.createBuffer chooses the GL component type from the typed array and does not read gpuType. WebGLBindingStates.setupVertexAttributes calls gl.vertexAttribIPointer when geometryAttribute.gpuType === IntType (1013). A leftover IntType on Float16/Float32 position (or the index) mis-types static packed color-only props and breaks Quest 3 TBDR draws. Does not touch updateRange (v0.90). Does not touch updateRanges (v0.91). Does not touch geometry boundingBox / boundingSphere (v0.92). Does not touch Mesh boundingSphere (v0.93). Does not change frustumCulled. Mapped / lit / interleaved keep authored gpuType. Collider meshes stay untouched. v0.95 pins leftover BufferAttribute normalized to the r170 constructor default false (normalized === false) on every non-interleaved BufferAttribute plus geometry.index when it is a BufferAttribute (body LOD leaves + lid/latch/tool + fastener; one geometry per visual; 13 normalized-default). pinColorOnlyUnlitBasicNormalized / pinColorOnlyVisualNormalized run after pinColorOnlyVisualUsage. Assign attribute.normalized = false in place only when it is not already false. Do not replace the attribute, the typed array, or the geometry. Do not call setUsage (v0.94 usage-static stays). Checked installed three@0.170.0: the BufferAttribute constructor is (array, itemSize, normalized = false) and assigns this.normalized = normalized. Omitting the argument leaves normalized === false. Float16BufferAttribute forwards that flag. WebGLAttributes.createBuffer does not read normalized. WebGLBindingStates.setupVertexAttributes passes geometryAttribute.normalized to gl.vertexAttribPointer. A leftover normalized === true on Float16/Float32 position (or the index) incorrectly normalizes static packed color-only props and breaks Quest 3 TBDR draws. Does not touch updateRange (v0.90). Does not touch updateRanges (v0.91). Does not touch geometry.boundingBox / geometry.boundingSphere (v0.92). Does not touch Mesh boundingSphere (v0.93). Does not change usage beyond leaving the v0.94 pin. Does not change frustumCulled. Does not delete skinIndex / skinWeight. Does not touch drawRange, groups, morphAttributes, Mesh morph targets, or Object3D animations. Mapped / lit / interleaved / colliders keep authored normalized. Clean procedural pre-upload draws/tris/attrBytes stay the v0.94 envelope. usage-static 13 stays. mesh-boundingSphere-absent 13 stays. bounds-null 13 stays. updateRanges-empty 13 stays. updateRange-default 13 stays. skinAttributes-absent 13 stays. drawRange-default 13 stays. groups-empty 13 stays. Quest 3 90Hz / 72 fallback requested, not measured; headset ms / FFR still TODO. Do not require 207/240 Hz.",
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
  // v0.80: after that Mesh
  // shadow-callback clear (and after
  // the v0.78 Material compile/render
  // callback clear), delete leftover
  // own-property Material
  // customProgramCacheKey so the
  // r170 Material.prototype method
  // remains on the 3 shared
  // color-only MeshBasics (wired
  // through pinColorOnlyUnlitBasicFlags
  // / pinColorOnlyVisualMaterialFlags,
  // same place the v0.78 Material
  // render-callback clear runs).
  // Does not invent a replacement
  // function; does not assign
  // undefined; does not touch
  // Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender; does not touch
  // Mesh onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // stencil companions /
  // polygonOffset companions /
  // dithering / A2C / blendColor /
  // blendAlpha / customDepth/Distance
  // clear / Mesh+Material
  // render-callback clears / the
  // v0.79 Mesh shadow-callback
  // clear.
  // v0.81: after that customProgramCacheKey
  // clear (and after the v0.78 Material
  // compile/render callback clear),
  // delete leftover Material defines so
  // the r170 MeshBasicMaterial /
  // Material default absence remains
  // (defines === undefined) on the 3
  // shared color-only MeshBasics (wired
  // through pinColorOnlyUnlitBasicFlags
  // / pinColorOnlyVisualMaterialFlags,
  // same place the v0.80
  // customProgramCacheKey clear and
  // v0.78 Material render-callback
  // clear run). Does not invent a
  // replacement #define map; does not
  // assign a sentinel empty {}; does
  // not touch Material
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender; does not touch
  // Mesh onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // stencil companions /
  // polygonOffset companions /
  // dithering / A2C / blendColor /
  // blendAlpha / customDepth/Distance
  // clear / Mesh+Material
  // render-callback clears / Mesh
  // shadow-callback clear / the
  // v0.80 customProgramCacheKey
  // clear.
  // v0.82: after that Material defines
  // clear (and after the long Material
  // flag fence through v0.80
  // customProgramCacheKey / v0.78
  // onBeforeCompile+onBeforeRender /
  // v0.75 stencil companions), pin
  // Material flatShading = false on
  // the 3 shared color-only MeshBasics
  // (wired through
  // pinColorOnlyUnlitBasicFlags /
  // pinColorOnlyVisualMaterialFlags,
  // same place the v0.81 defines
  // clear and the other color-only
  // MeshBasic material pins run).
  // Fresh r170 Material /
  // MeshBasicMaterial leave
  // flatShading unset (undefined);
  // WebGLPrograms copies
  // flatShading: material.flatShading
  // === true into program parameters
  // and the program cache key.
  // Does not invent custom shaders;
  // does not enable flat shading;
  // does not touch Material defines;
  // does not touch Material
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender; does not touch
  // Mesh onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // defines / customProgramCacheKey /
  // stencil companions /
  // polygonOffset companions /
  // dithering / A2C / blendColor /
  // blendAlpha.
  // v0.83: after that Material
  // flatShading pin (and after the
  // Material program-cache fence
  // through v0.81 defines / v0.80
  // customProgramCacheKey / v0.78
  // onBeforeCompile+onBeforeRender),
  // delete leftover Material
  // glslVersion so the r170
  // MeshBasicMaterial / Material
  // default absence remains
  // (glslVersion === undefined) on
  // the 3 shared color-only MeshBasics
  // (wired through
  // pinColorOnlyUnlitBasicFlags /
  // pinColorOnlyVisualMaterialFlags,
  // same place the v0.82 flatShading
  // pin and the other color-only
  // MeshBasic material pins run).
  // Fresh r170 Material /
  // MeshBasicMaterial leave
  // glslVersion unset (undefined;
  // Object.hasOwn false).
  // ShaderMaterial assigns
  // glslVersion = null in its own
  // constructor — do not convert
  // MeshBasic to ShaderMaterial.
  // WebGLPrograms copies
  // glslVersion: material.glslVersion
  // into program parameters.
  // Does not assign a sentinel string;
  // does not assign GLSL3 / GLSL1 /
  // '300 es' / '100'; does not invent
  // custom shaders; does not touch
  // Material flatShading; does not
  // touch Material defines; does not
  // touch Material
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender; does not touch
  // Mesh onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins including
  // flatShading / defines /
  // customProgramCacheKey / stencil
  // companions / polygonOffset
  // companions / dithering / A2C /
  // blendColor / blendAlpha.
  // v0.84: after that Material
  // glslVersion clear (and after the
  // Mesh callback fence through
  // v0.79 onBeforeShadow /
  // onAfterShadow / v0.77
  // onBeforeRender / onAfterRender /
  // v0.76 customDepth/Distance),
  // clear leftover Object3D
  // animations so the r170 empty
  // list remains (Array.isArray &&
  // length === 0) on the 13 packed
  // color-only MeshBasic visual
  // meshes (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicAnimations
  // / pinColorOnlyVisualAnimations
  // run after
  // pinColorOnlyVisualShadowCallbacks
  // (same place as the other
  // color-only visual Mesh pins,
  // after material flags + raycast
  // disable). When animations is an
  // array, mutate it
  // (animations.length = 0); if
  // missing or non-array, assign
  // animations = []. Fresh r170
  // Object3D assigns
  // this.animations = []. Does not
  // invent AnimationClips; does not
  // create an AnimationMixer; does
  // not call AnimationMixer.update;
  // does not touch Material
  // glslVersion / flatShading /
  // defines / customProgramCacheKey;
  // does not touch Material
  // onBeforeCompile / onBeforeRender;
  // does not touch Mesh
  // onBeforeRender / onAfterRender /
  // onBeforeShadow / onAfterShadow;
  // does not enable shadows or pin
  // mesh.visible; does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.85: after that Object3D animations
  // clear, delete leftover Mesh
  // morphTargetInfluences /
  // morphTargetDictionary so the r170
  // absence remains (both undefined;
  // Object.hasOwn false) on the 13
  // packed color-only MeshBasic visual
  // meshes (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicMorphTargets
  // / pinColorOnlyVisualMorphTargets
  // run after
  // pinColorOnlyVisualAnimations
  // (same place as the other
  // color-only visual Mesh pins,
  // after material flags + raycast
  // disable). Prefer delete when
  // present. Does not assign null or
  // empty [] / {}. Fresh r170 Mesh
  // calls updateMorphTargets(), which
  // assigns both properties only when
  // geometry.morphAttributes has keys.
  // Does not invent morph targets;
  // does not call updateMorphTargets();
  // does not add morphAttributes;
  // does not enable morphing; does
  // not touch Object3D animations;
  // does not touch Material
  // glslVersion / flatShading /
  // defines / customProgramCacheKey;
  // does not touch Material
  // onBeforeCompile / onBeforeRender;
  // does not touch Mesh
  // onBeforeRender / onAfterRender /
  // onBeforeShadow / onAfterShadow;
  // does not enable shadows or pin
  // mesh.visible; does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.86: after that Mesh morph-target
  // absence, clear leftover
  // BufferGeometry morphAttributes
  // (delete own keys in place; leave
  // the r170 empty {}) and pin
  // morphTargetsRelative to false
  // when it is not already false on
  // the 13 packed color-only MeshBasic
  // visual geometries (body LOD leaves
  // + lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicMorphAttributes
  // / pinColorOnlyVisualMorphAttributes
  // run after
  // pinColorOnlyVisualMorphTargets.
  // Fresh r170 BufferGeometry assigns
  // this.morphAttributes = {} and
  // this.morphTargetsRelative = false.
  // Does not reassign null/undefined;
  // does not invent morph targets;
  // does not call updateMorphTargets();
  // does not add morphAttributes;
  // does not enable morphing; does
  // not touch Mesh
  // morphTargetInfluences /
  // morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.87: after that morphAttributes
  // clear, clear leftover
  // BufferGeometry groups so the
  // r170 empty array remains
  // (Array.isArray && length === 0)
  // on the 13 packed color-only
  // MeshBasic visual geometries
  // (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicGroups
  // / pinColorOnlyVisualGroups
  // run after
  // pinColorOnlyVisualMorphAttributes.
  // Mutate the existing array
  // (groups.length = 0). If missing
  // or non-array, assign groups = [].
  // Fresh r170 BufferGeometry assigns
  // this.groups = []. r170
  // clearGroups() assigns a new []
  // and is not used. r170
  // WebGLRenderer.projectObject
  // issues one render item per group
  // only when the material is an
  // array; a single MeshBasicMaterial
  // pushes one item with group null.
  // Does not invent groups; does not
  // assign a material array; does not
  // touch drawRange (v0.88 pins it
  // next); does not touch
  // morphAttributes /
  // morphTargetsRelative; does not
  // touch Mesh morphTargetInfluences
  // / morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.88: after that groups clear,
  // pin leftover BufferGeometry
  // drawRange to the r170 default
  // (start === 0 && count === Infinity)
  // on the 13 packed color-only
  // MeshBasic visual geometries
  // (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicDrawRange
  // / pinColorOnlyVisualDrawRange
  // run after
  // pinColorOnlyVisualGroups.
  // Mutate the existing object
  // (start = 0, count = Infinity).
  // If missing or non-object, assign
  // { start: 0, count: Infinity }.
  // Fresh r170 BufferGeometry assigns
  // this.drawRange = { start: 0,
  // count: Infinity }. r170
  // setDrawRange writes a caller span
  // and is not used. r170
  // renderBufferDirect draws
  // geometry.drawRange when the
  // render item's group is null; a
  // single MeshBasicMaterial pushes
  // group null. Does not invent a
  // partial range; does not replace
  // the geometry; does not touch
  // groups; does not touch
  // morphAttributes /
  // morphTargetsRelative; does not
  // touch Mesh morphTargetInfluences
  // / morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.89: after that drawRange pin,
  // strip leftover skinIndex /
  // skinWeight on the 13 packed
  // color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicSkinAttributes
  // / pinColorOnlyVisualSkinAttributes
  // run after
  // pinColorOnlyVisualDrawRange.
  // COLOR_ONLY_UNUSED_ATTRS includes
  // those names; stripUnusedColorOnlySkinAttributes
  // deletes them (pack path calls
  // it from stripUnusedColorOnlyAttributes
  // after weld). Verified r170:
  // WebGLPrograms sets skinning only
  // when object.isSkinnedMesh;
  // MeshBasic on a plain Mesh does
  // not declare skinIndex /
  // skinWeight. WebGLGeometries.update
  // still uploads every attribute.
  // GLTFLoader maps JOINTS_0 /
  // WEIGHTS_0 onto those names and
  // builds a SkinnedMesh only when
  // the node has a skin. This pulse
  // deletes the leftover attributes.
  // Does not invent a SkinnedMesh;
  // does not enable skinning; does
  // not touch bones / skeleton /
  // bindMatrix; does not delete
  // position; does not touch
  // drawRange; does not touch
  // groups; does not touch
  // morphAttributes /
  // morphTargetsRelative; does not
  // touch Mesh morphTargetInfluences
  // / morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.90: after that skin strip,
  // pin leftover BufferAttribute
  // updateRange to { offset: 0,
  // count: -1 } on every
  // non-interleaved BufferAttribute
  // plus geometry.index when it is
  // a BufferAttribute, on the 13
  // packed color-only MeshBasic
  // visual geometries (body LOD
  // leaves + lid/latch/tool +
  // fastener).
  // pinColorOnlyUnlitBasicUpdateRange
  // / pinColorOnlyVisualUpdateRange
  // run after
  // pinColorOnlyVisualSkinAttributes.
  // Mutate the existing object
  // (offset = 0, count = -1). If
  // missing or non-object, assign
  // { offset: 0, count: -1 }.
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor
  // assigns this.updateRanges = []
  // and does not assign updateRange.
  // WebGLAttributes.updateBuffer
  // full-uploads when
  // updateRanges.length === 0 and
  // partial-uploads each
  // { start, count } otherwise.
  // addUpdateRange pushes a partial
  // range and is not used. This
  // pulse does not rewrite
  // updateRanges or usage (v0.43
  // StaticDrawUsage stays). Does not
  // replace attributes or the
  // geometry; does not delete
  // skinIndex / skinWeight; does not
  // touch drawRange; does not touch
  // groups; does not touch
  // morphAttributes /
  // morphTargetsRelative; does not
  // touch Mesh morphTargetInfluences
  // / morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.91: after that updateRange pin,
  // clear leftover BufferAttribute
  // updateRanges to the r170 empty
  // array (Array.isArray && length === 0)
  // on every non-interleaved
  // BufferAttribute plus geometry.index
  // when it is a BufferAttribute, on
  // the 13 packed color-only MeshBasic
  // visual geometries (body LOD
  // leaves + lid/latch/tool +
  // fastener).
  // pinColorOnlyUnlitBasicUpdateRanges
  // / pinColorOnlyVisualUpdateRanges
  // run after
  // pinColorOnlyVisualUpdateRange.
  // Mutate the existing array
  // (length = 0). If missing or
  // non-array, assign []. Checked
  // installed three@0.170.0:
  // WebGLAttributes.updateBuffer
  // full-uploads when
  // updateRanges.length === 0 and
  // partial-uploads each
  // { start, count } otherwise.
  // addUpdateRange and
  // clearUpdateRanges are not used.
  // This pulse does not touch
  // updateRange (v0.90) or usage
  // (v0.43 StaticDrawUsage stays).
  // Does not replace attributes or
  // the geometry; does not delete
  // skinIndex / skinWeight; does not
  // touch drawRange; does not touch
  // groups; does not touch
  // morphAttributes /
  // morphTargetsRelative; does not
  // touch Mesh morphTargetInfluences
  // / morphTargetDictionary; does not
  // touch Object3D animations; does
  // not touch Material glslVersion /
  // flatShading / defines /
  // customProgramCacheKey; does not
  // touch Material onBeforeCompile /
  // onBeforeRender; does not touch
  // Mesh onBeforeRender /
  // onAfterRender / onBeforeShadow /
  // onAfterShadow; does not enable
  // shadows or pin mesh.visible;
  // does not change
  // matrixAutoUpdate /
  // matrixWorldAutoUpdate / layers /
  // up / scale / rotation.order /
  // prior material pins.
  // v0.92: after that updateRanges clear,
  // pin leftover BufferGeometry
  // boundingBox and boundingSphere
  // to the r170 constructor null on
  // the 13 packed color-only MeshBasic
  // visual geometries (body LOD
  // leaves + lid/latch/tool +
  // fastener).
  // pinColorOnlyUnlitBasicBounds
  // / pinColorOnlyVisualBounds
  // run after
  // pinColorOnlyVisualUpdateRanges.
  // Assign null. Do not invent Box3
  // or Sphere. Do not call
  // computeBoundingBox /
  // computeBoundingSphere in the pin.
  // Checked installed three@0.170.0:
  // the BufferGeometry constructor
  // assigns both null.
  // Frustum.intersectsObject uses
  // geometry.boundingSphere when the
  // Mesh has no own boundingSphere,
  // and calls computeBoundingSphere
  // only when that sphere is null.
  // A leftover non-null sphere is
  // tested as-is while frustumCulled
  // stays true (v0.50). This pulse
  // does not touch updateRanges
  // (v0.91), updateRange (v0.90), or
  // usage (v0.43). Does not replace
  // attributes or the geometry. Does
  // not change frustumCulled. The
  // v0.43 onUpload callback recomputes
  // bounds if they are null while CPU
  // arrays are still present, then
  // releases the arrays.
  // v0.93: after that geometry bounds
  // pin, delete leftover Mesh /
  // Object3D boundingSphere so the
  // property is absent
  // (mesh.boundingSphere === undefined)
  // on the same 13 packed color-only
  // MeshBasic visual meshes (body LOD
  // leaves + lid/latch/tool +
  // fastener).
  // pinColorOnlyUnlitBasicMeshBoundingSphere
  // / pinColorOnlyVisualMeshBoundingSphere
  // run after pinColorOnlyVisualBounds.
  // Prefer delete. Do not assign null
  // (null !== undefined, so a null
  // own property still takes the
  // Frustum object branch and calls
  // object.computeBoundingSphere,
  // which Mesh does not implement).
  // Do not invent a Sphere. Do not
  // call computeBoundingSphere on the
  // mesh. Do not touch
  // geometry.boundingBox /
  // geometry.boundingSphere (v0.92).
  // Checked installed three@0.170.0:
  // Frustum.intersectsObject uses
  // object.boundingSphere when that
  // property is not undefined. A Mesh
  // does not assign it, so the else
  // branch copies
  // geometry.boundingSphere and calls
  // geometry.computeBoundingSphere
  // only when that sphere is null.
  // A leftover non-undefined
  // mesh.boundingSphere short-circuits
  // that path while frustumCulled
  // stays true (v0.50). This pulse
  // does not touch updateRanges,
  // updateRange, usage, skin
  // attributes, drawRange, groups,
  // morphAttributes, Mesh morph
  // targets, or Object3D animations.
  // Does not change frustumCulled,
  // mesh.visible, or matrixAutoUpdate.
  // v0.94: after that object-sphere
  // clear, pin leftover BufferAttribute
  // (+ index) usage to the r170
  // constructor default StaticDrawUsage
  // on every non-interleaved
  // BufferAttribute plus the index
  // BufferAttribute, on the same 13
  // packed color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicUsage /
  // pinColorOnlyVisualUsage run after
  // pinColorOnlyVisualMeshBoundingSphere.
  // setUsage assigns in place. Do not
  // replace the attribute or the
  // geometry. Do not touch updateRange
  // (v0.90), updateRanges (v0.91),
  // geometry boundingBox /
  // boundingSphere (v0.92), or Mesh
  // boundingSphere (v0.93).
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor
  // assigns this.usage = StaticDrawUsage.
  // WebGLAttributes.createBuffer passes
  // attribute.usage to gl.bufferData.
  // A leftover DynamicDrawUsage (or any
  // other non-static usage) on static
  // packed color-only props is a
  // wasteful buffer hint on Quest 3
  // TBDR. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes.
  // v0.95: after that usage pin, pin
  // leftover BufferAttribute (+ index)
  // normalized to the r170 constructor
  // default false (normalized === false)
  // on every non-interleaved
  // BufferAttribute plus the index
  // BufferAttribute, on the same 13
  // packed color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicNormalized /
  // pinColorOnlyVisualNormalized run
  // after pinColorOnlyVisualUsage.
  // Assign attribute.normalized = false
  // in place only when it is not already
  // false. Do not replace the attribute,
  // the typed array, or the geometry.
  // Do not call setUsage (v0.94
  // usage-static stays). Do not touch
  // updateRange (v0.90), updateRanges
  // (v0.91), geometry boundingBox /
  // boundingSphere (v0.92), or Mesh
  // boundingSphere (v0.93).
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor is
  // (array, itemSize, normalized = false)
  // and assigns this.normalized =
  // normalized. Float16BufferAttribute
  // forwards that flag. WebGLAttributes
  // .createBuffer does not read
  // normalized. WebGLBindingStates
  // passes geometryAttribute.normalized
  // to gl.vertexAttribPointer. A leftover
  // normalized === true on Float16 /
  // Float32 position (or the index)
  // incorrectly normalizes static packed
  // color-only props and breaks Quest 3
  // TBDR draws. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes.
  // v0.96: after that normalized pin, pin
  // leftover BufferAttribute (+ index)
  // gpuType to the r170 constructor
  // default FloatType (gpuType === FloatType)
  // on every non-interleaved
  // BufferAttribute plus the index
  // BufferAttribute, on the same 13
  // packed color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicGpuType /
  // pinColorOnlyVisualGpuType run after
  // pinColorOnlyVisualNormalized.
  // Assign attribute.gpuType = FloatType
  // in place only when it is not already
  // FloatType. Do not replace the
  // attribute, the typed array, or the
  // geometry. Do not call setUsage
  // (v0.94 usage-static stays). Do not
  // reassign normalized (v0.95
  // normalized-default stays). Do not
  // touch updateRange (v0.90),
  // updateRanges (v0.91), geometry
  // boundingBox / boundingSphere
  // (v0.92), or Mesh boundingSphere
  // (v0.93).
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor
  // assigns this.gpuType = FloatType.
  // Float16BufferAttribute does not
  // override gpuType. WebGLAttributes
  // .createBuffer chooses the GL type
  // from the typed array and does not
  // read gpuType. WebGLBindingStates
  // calls gl.vertexAttribIPointer when
  // geometryAttribute.gpuType === IntType.
  // A leftover IntType on Float16 /
  // Float32 position (or the index)
  // mis-types static packed color-only
  // props and breaks Quest 3 TBDR draws.
  // Does not change frustumCulled. Does
  // not hex-dedupe or invent meshes.
  // v0.97: after that gpuType pin, pin
  // leftover BufferAttribute (+ index)
  // name to the r170 constructor
  // default empty string (name === '')
  // on every non-interleaved
  // BufferAttribute plus the index
  // BufferAttribute, on the same 13
  // packed color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicName /
  // pinColorOnlyVisualName run after
  // pinColorOnlyVisualGpuType.
  // Assign attribute.name = '' in place
  // only when it is not already ''.
  // Do not replace the attribute, the
  // typed array, or the geometry. Do
  // not touch gpuType (v0.96
  // gpuType-float stays). Do not call
  // setUsage (v0.94 usage-static stays).
  // Do not reassign normalized (v0.95
  // normalized-default stays). Do not
  // touch updateRange (v0.90),
  // updateRanges (v0.91), geometry
  // boundingBox / boundingSphere
  // (v0.92), or Mesh boundingSphere
  // (v0.93).
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor
  // assigns this.name = ''.
  // Float16BufferAttribute does not
  // override name. BufferAttribute
  // .toJSON writes data.name only when
  // this.name !== ''. BufferGeometryLoader
  // copies a JSON attribute name onto
  // the BufferAttribute. WebGLAttributes
  // and WebGLBindingStates do not read
  // attribute.name. GLTF / DCC ingest
  // often leaves accessor or exporter
  // names on attributes and the index.
  // Clearing them to '' is load-time
  // packaging only: no draw / tri /
  // attrBytes change; it drops leftover
  // string retention on Quest 3 TBDR
  // static props. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes. Does not rename
  // the Mesh.
  // v0.98: after that name pin, pin
  // leftover BufferAttribute (+ index)
  // version to the r170 constructor
  // default 0 (version === 0) on every
  // non-interleaved BufferAttribute plus
  // the index BufferAttribute, on the
  // same 13 packed color-only MeshBasic
  // visual geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicVersion /
  // pinColorOnlyVisualVersion run after
  // pinColorOnlyVisualName.
  // Assign attribute.version = 0 in place
  // only when it is not already 0.
  // Do not replace the attribute, the
  // typed array, or the geometry. Do
  // not touch name (v0.97 name-empty
  // stays). Do not touch gpuType (v0.96
  // gpuType-float stays). Do not call
  // setUsage (v0.94 usage-static stays).
  // Do not reassign normalized (v0.95
  // normalized-default stays). Do not
  // touch onUpload / onUploadCallback
  // (v0.43 CPU-release hook stays). Do
  // not touch updateRange (v0.90),
  // updateRanges (v0.91), geometry
  // boundingBox / boundingSphere
  // (v0.92), or Mesh boundingSphere
  // (v0.93).
  // Checked installed three@0.170.0:
  // the BufferAttribute constructor
  // assigns this.version = 0. The
  // needsUpdate setter increments
  // version when value === true.
  // Float16BufferAttribute does not
  // override version. WebGLAttributes
  // .update stores attribute.version on
  // the first upload and calls
  // updateBuffer (gl.bufferSubData, then
  // onUploadCallback) when the stored
  // buffer version is less than
  // attribute.version. A leftover
  // non-zero version on static packed
  // color-only props before first upload
  // forces extra TBDR buffer work.
  // Pinning to 0 is load-time packaging
  // only: no draw / tri / attrBytes
  // change. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes. Does not rename
  // the Mesh.
  // v0.99: after that version pin, pin
  // leftover BufferGeometry name to the
  // r170 constructor default empty string
  // (geometry.name === '') on the same 13
  // packed color-only MeshBasic visual
  // geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicGeometryName /
  // pinColorOnlyVisualGeometryName run
  // after pinColorOnlyVisualVersion.
  // Assign geometry.name = '' in place
  // only when it is not already ''.
  // Do not replace the geometry, the
  // attributes, or the typed arrays. Do
  // not touch BufferAttribute version
  // (v0.98 version-zero stays). Do not
  // touch BufferAttribute name (v0.97
  // name-empty stays). Do not touch
  // gpuType (v0.96 gpuType-float stays).
  // Do not call setUsage (v0.94
  // usage-static stays). Do not reassign
  // normalized (v0.95 normalized-default
  // stays). Do not touch onUpload /
  // onUploadCallback (v0.43 CPU-release
  // hook stays). Do not touch updateRange
  // (v0.90), updateRanges (v0.91),
  // geometry boundingBox / boundingSphere
  // (v0.92), or Mesh boundingSphere
  // (v0.93).
  // Checked installed three@0.170.0:
  // the BufferGeometry constructor
  // assigns this.name = ''.
  // BufferGeometry.toJSON writes
  // data.name only when this.name !== ''.
  // BufferGeometry.copy copies source.name.
  // BufferGeometryLoader assigns
  // geometry.name = json.name when
  // json.name is present. ObjectLoader
  // .parseGeometries assigns
  // geometry.name = data.name when
  // data.name !== undefined. Stock
  // GLTFLoader names the Mesh and copies
  // primitive extras onto
  // geometry.userData; it does not assign
  // geometry.name. WebGLRenderer does not
  // read geometry.name. DCC exporters and
  // JSON round-trips still leave mesh or
  // primitive names on the geometry.
  // Clearing them to '' is load-time
  // packaging only: no draw / tri /
  // attrBytes change; it drops leftover
  // string retention on Quest 3 TBDR
  // static props. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes. Does not rename
  // the Mesh (lidMesh / latchMesh /
  // fastenerMesh stay).
  // v1.0.0: after that geometry-name pin, pin
  // leftover BufferGeometry userData to a fresh
  // empty plain object (geometry.userData = {})
  // on the same 13 packed color-only MeshBasic
  // visual geometries (body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicGeometryUserData /
  // pinColorOnlyVisualGeometryUserData run
  // after pinColorOnlyVisualGeometryName.
  // Assign a fresh {} only when userData is
  // missing, non-object, or not already an
  // empty plain object (own keys, or a
  // prototype other than Object.prototype).
  // Do not share one {} across geometries.
  // Do not replace the geometry, the
  // attributes, or the typed arrays. Do not
  // touch BufferGeometry name (v0.99
  // geometry-name-empty stays). Do not touch
  // Mesh / Object3D userData. Do not touch
  // BufferAttribute version (v0.98
  // version-zero stays). Do not touch
  // BufferAttribute name (v0.97 name-empty
  // stays). Do not touch gpuType (v0.96
  // gpuType-float stays). Do not call
  // setUsage (v0.94 usage-static stays). Do
  // not reassign normalized (v0.95
  // normalized-default stays). Do not touch
  // onUpload / onUploadCallback (v0.43
  // CPU-release hook stays). Do not touch
  // updateRange (v0.90), updateRanges
  // (v0.91), geometry boundingBox /
  // boundingSphere (v0.92), or Mesh
  // boundingSphere (v0.93).
  // Checked installed three@0.170.0:
  // the BufferGeometry constructor assigns
  // this.userData = {}. toJSON writes
  // data.userData only when
  // Object.keys(this.userData).length > 0.
  // copy assigns this.userData =
  // source.userData (shared reference).
  // BufferGeometryLoader assigns
  // geometry.userData = json.userData when
  // json.userData is truthy. ObjectLoader
  // .parseGeometries assigns
  // geometry.userData = data.userData when
  // data.userData !== undefined. Stock
  // GLTFLoader addPrimitiveAttributes calls
  // assignExtrasToUserData(geometry,
  // primitiveDef), which Object.assigns
  // primitive extras onto geometry.userData.
  // WebGLRenderer does not read
  // geometry.userData. Clearing leftover
  // extras to a fresh {} is load-time
  // packaging only: no draw / tri /
  // attrBytes change. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent meshes. Does not rename
  // the Mesh (lidMesh / latchMesh /
  // fastenerMesh stay).
  // v1.1.0: after that geometry-userData pin, pin
  // leftover Material userData to a fresh empty
  // plain object (material.userData = {}) on the
  // shared color-only MeshBasic materials used by
  // those same visuals (wood / brass / steel;
  // unique MeshBasic stays 3; body LOD leaves +
  // lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicMaterialUserData /
  // pinColorOnlyVisualMaterialUserData run after
  // pinColorOnlyVisualGeometryUserData.
  // Assign a fresh {} only when userData is
  // missing, non-object, or not already an empty
  // plain object (own string or symbol keys, or a
  // prototype other than Object.prototype).
  // Do not share one {} across materials.
  // Do not replace the material, the geometry,
  // the attributes, or the typed arrays. Do not
  // touch Material name. Do not touch prior
  // material program-cache / flag pins. Do not
  // touch BufferGeometry userData (v1.0.0
  // geometry-userData-empty stays) or
  // BufferGeometry name (v0.99
  // geometry-name-empty stays). Do not touch
  // Mesh / Object3D userData. Do not touch
  // BufferAttribute version / name / gpuType /
  // normalized / usage / updateRange /
  // updateRanges / onUpload / onUploadCallback.
  // Do not touch geometry bounds or Mesh
  // boundingSphere.
  // Checked installed three@0.170.0:
  // the Material constructor assigns
  // this.userData = {}. toJSON writes
  // data.userData only when
  // Object.keys(this.userData).length > 0.
  // copy assigns this.userData =
  // JSON.parse(JSON.stringify(source.userData))
  // (a clone, not a shared reference).
  // MaterialLoader assigns
  // material.userData = json.userData when
  // json.userData !== undefined. ObjectLoader
  // .parseMaterials uses that loader. Stock
  // GLTFLoader loadMaterial calls
  // assignExtrasToUserData(material,
  // materialDef), which Object.assigns
  // material extras onto material.userData.
  // WebGLRenderer does not read
  // material.userData. Clearing leftover
  // extras to a fresh {} is load-time
  // packaging only: no draw / tri /
  // attrBytes change. Does not change
  // frustumCulled. Does not hex-dedupe
  // or invent materials. Does not rename
  // the Mesh (lidMesh / latchMesh /
  // fastenerMesh stay).
  // v1.2.0: after that material-userData pin, pin leftover Material
  // name to the r170 constructor default empty string
  // (material.name === '') on the shared color-only MeshBasic
  // materials used by those same visuals (wood / brass / steel;
  // unique MeshBasic stays 3; body LOD leaves + lid/latch/tool +
  // fastener).
  // pinColorOnlyUnlitBasicMaterialName /
  // pinColorOnlyVisualMaterialName run after
  // pinColorOnlyVisualMaterialUserData.
  // Assign material.name = '' in place only when it is not already
  // ''. Do not replace the material, the geometry, the attributes,
  // or the typed arrays. Do not touch Material userData (v1.1.0
  // material-userData-empty stays). Do not touch prior material
  // program-cache / flag pins. Do not touch BufferGeometry userData
  // (v1.0.0 geometry-userData-empty stays) or BufferGeometry name
  // (v0.99 geometry-name-empty stays). Do not touch Mesh / Object3D
  // userData. Do not touch BufferAttribute version / name / gpuType /
  // normalized / usage / updateRange / updateRanges / onUpload /
  // onUploadCallback. Do not touch geometry bounds or Mesh
  // boundingSphere.
  // Checked installed three@0.170.0:
  // the Material constructor assigns this.name = ''.
  // Material.toJSON writes data.name only when this.name !== ''.
  // Material.copy copies source.name. MaterialLoader assigns
  // material.name = json.name when json.name !== undefined.
  // ObjectLoader.parseMaterials uses that loader. Stock GLTFLoader
  // loadMaterial assigns material.name = materialDef.name when
  // materialDef.name is set. WebGLRenderer does not read
  // material.name. WebGLPrograms.getParameters copies
  // shaderName: material.name and WebGLProgram emits
  // #define SHADER_NAME from that parameter, but getProgramCacheKey
  // does not include shaderName, so a leftover name does not fork
  // the program cache or change the draw. Clearing to '' is
  // load-time packaging only: no draw / tri / attrBytes change; it
  // drops leftover string retention on the 3 shared color-only
  // MeshBasics. Does not change frustumCulled. Does not hex-dedupe
  // or invent materials. Does not rename the Mesh (lidMesh /
  // latchMesh / fastenerMesh stay).
  // v1.3.0: after that material-name pin, pin leftover Mesh /
  // Object3D name to the r170 constructor default empty string
  // (mesh.name === '') on packed color-only MeshBasic visual meshes
  // (body LOD leaves + lid/latch/tool + fastener).
  // pinColorOnlyUnlitBasicMeshName /
  // pinColorOnlyVisualMeshName run after
  // pinColorOnlyVisualMaterialName.
  // Assign mesh.name = '' in place only when it is not already ''
  // and the name is not reserved. Reserved names stay: lidMesh,
  // latchMesh, fastenerMesh, and any collider_* mesh name.
  // Do not replace the mesh, the material, the geometry, the
  // attributes, or the typed arrays. Do not touch Material name
  // (v1.2.0 material-name-empty stays). Do not touch Material
  // userData (v1.1.0 material-userData-empty stays). Do not touch
  // prior material program-cache / flag pins. Do not touch
  // BufferGeometry userData (v1.0.0 geometry-userData-empty stays)
  // or BufferGeometry name (v0.99 geometry-name-empty stays). Do not
  // touch Mesh / Object3D userData. Do not touch BufferAttribute
  // version / name / gpuType / normalized / usage / updateRange /
  // updateRanges / onUpload / onUploadCallback. Do not touch geometry
  // bounds or Mesh boundingSphere. Do not change frustumCulled,
  // matrixAutoUpdate, or mesh.visible.
  // Checked installed three@0.170.0:
  // the Object3D constructor assigns this.name = ''.
  // Mesh does not override name. Object3D.toJSON writes object.name
  // only when this.name !== ''. Object3D.copy copies source.name.
  // ObjectLoader.parseObject assigns object.name = data.name when
  // data.name !== undefined. Stock GLTFLoader loadMesh assigns
  // mesh.name from meshDef.name (or mesh_ + index) and
  // _loadNodeShallow assigns node.name from the node name when set
  // (a single-primitive node is the mesh). WebGLRenderer does not
  // read mesh.name. WebGLPrograms.getParameters copies
  // shaderName: material.name, not the mesh name, so a leftover mesh
  // name does not fork the program cache or change the draw.
  // Clearing non-reserved names to '' is load-time packaging only:
  // no draw / tri / attrBytes change. Does not hex-dedupe or invent
  // meshes. Reserved named meshes stay named.
  // v1.4.0: after that mesh-name pin, pin leftover Mesh /
  // Object3D userData to the r170 constructor default empty plain
  // object (mesh.userData is a fresh {} with Object.prototype and no
  // own keys) on packed color-only MeshBasic visual meshes (body LOD
  // leaves + lid/latch/tool + fastener; 13 mesh-userData-empty).
  // pinColorOnlyUnlitBasicMeshUserData /
  // pinColorOnlyVisualMeshUserData run after
  // pinColorOnlyVisualMeshName.
  // Assign a fresh mesh.userData = {} only when it is not already an
  // empty plain object (missing, non-object, any own string or symbol
  // keys, or a prototype other than Object.prototype). Do not share
  // one {} across meshes. An already-empty plain object is left as-is.
  // Do not replace the mesh, the material, the geometry, the
  // attributes, or the typed arrays. Do not touch Mesh / Object3D name
  // (v1.3.0 mesh-name-empty stays; reserved names lidMesh / latchMesh /
  // fastenerMesh and any collider_* stay). Do not touch Material name
  // (v1.2.0 material-name-empty stays) or Material userData (v1.1.0
  // material-userData-empty stays). Do not touch BufferGeometry
  // userData (v1.0.0 geometry-userData-empty stays) or BufferGeometry
  // name (v0.99 geometry-name-empty stays). Do not touch entity/root
  // userData, tool Group userData, or collider mesh userData. Do not
  // touch BufferAttribute version / name / gpuType / normalized /
  // usage / updateRange / updateRanges / onUpload / onUploadCallback.
  // Do not touch geometry bounds or Mesh boundingSphere. Do not change
  // frustumCulled, matrixAutoUpdate, or mesh.visible.
  // Checked installed three@0.170.0:
  // the Object3D constructor assigns this.userData = {}.
  // Mesh does not override userData. Object3D.toJSON writes
  // object.userData only when Object.keys(this.userData).length > 0.
  // Object3D.copy assigns this.userData =
  // JSON.parse(JSON.stringify(source.userData)) (a clone).
  // ObjectLoader.parseObject assigns object.userData = data.userData
  // when data.userData !== undefined. Stock GLTFLoader loadMesh calls
  // assignExtrasToUserData(mesh, meshDef) and _loadNodeShallow calls
  // assignExtrasToUserData(node, nodeDef). A single-primitive node is
  // the mesh, so node extras land on mesh.userData.
  // assignExtrasToUserData Object.assigns extras onto userData.
  // WebGLRenderer does not read mesh.userData. Clearing leftover
  // extras to a fresh {} is load-time packaging only: no draw / tri /
  // attrBytes change. Draws / tris / attrBytes unchanged vs v1.3.0.
  // mesh-name-empty 10 stays. unique MeshBasic 3 stays.
  // v1.5.0: after that mesh-userData pin, pin leftover Material
  // version to the r170 constructor default 0 (material.version === 0)
  // on the 3 shared color-only MeshBasic materials (wood / brass /
  // steel; unique MeshBasic stays 3; measured material-version-zero 3).
  // pinColorOnlyUnlitBasicMaterialVersion /
  // pinColorOnlyVisualMaterialVersion run after
  // pinColorOnlyVisualMeshUserData.
  // Assign material.version = 0 in place only when it is not already 0.
  // Do not call material.needsUpdate = true (that increments version).
  // Do not replace the material, the mesh, the geometry, the
  // attributes, or the typed arrays. Do not invent materials. Pin once
  // per shared material instance. Do not touch Material name (v1.2.0
  // material-name-empty stays) or Material userData (v1.1.0
  // material-userData-empty stays). Do not touch Mesh / Object3D
  // userData (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D name
  // (v1.3.0 mesh-name-empty stays; reserved names lidMesh / latchMesh /
  // fastenerMesh and any collider_* stay). Do not touch BufferGeometry
  // userData / name. Do not touch BufferAttribute fields, prior
  // material program-cache / flag pins, bounds, morphs, animations,
  // shadows, frustumCulled, matrixAutoUpdate, or mesh.visible.
  // Checked installed three@0.170.0:
  // the Material constructor assigns this.version = 0.
  // The needsUpdate setter increments version when value === true.
  // The alphaTest setter also increments version when the test crosses
  // zero. Material.copy does not copy version. Material.toJSON does not
  // write material.version (metadata.version 4.6 is the JSON format
  // version). WebGLRenderer.setProgram sets needsProgramChange and
  // stores materialProperties.__version = material.version when
  // material.version !== materialProperties.__version, then calls
  // getProgram, which builds parameters via WebGLPrograms.getParameters.
  // getProgramCacheKey does not include material.version, so a leftover
  // number does not fork a second program. A leftover non-zero
  // material.version on a static packed color-only MeshBasic is a dirty
  // counter that does not describe a pending property change. The
  // mismatch still allocates program parameters on the JS thread before
  // the fast path (version === __version) can skip getProgram. On
  // Quest 3 TBDR that load-time parameter rebuild is packaging waste;
  // it does not change draws, tris, or attrBytes. Direct assignment
  // does not go through needsUpdate, so it does not increment.
  // Draws / tris / attrBytes unchanged vs v1.4.0.
  // mesh-userData-empty 13 stays. mesh-name-empty 10 stays.
  // unique MeshBasic 3 stays. material-version-zero 3 is the new count.
  // v1.6.0: after that material-version pin, pin leftover Object3D /
  // Mesh matrixWorldNeedsUpdate to the r170 constructor default false
  // (mesh.matrixWorldNeedsUpdate === false) on the 13 packed
  // color-only unlit MeshBasic visual meshes (body LOD leaves +
  // lid/latch/tool + fastener; measured matrixWorldNeedsUpdate-false
  // 13).
  // pinColorOnlyUnlitBasicMatrixWorldNeedsUpdate /
  // pinColorOnlyVisualMatrixWorldNeedsUpdate run after
  // pinColorOnlyVisualMaterialVersion.
  // Assign mesh.matrixWorldNeedsUpdate = false in place only when it
  // is not already false. Do not call updateMatrix or
  // updateMatrixWorld inside the pin (load-time flag clear only;
  // updateMatrix assigns the flag true). Do not replace the mesh, the
  // material, the geometry, the attributes, or the typed arrays. Do
  // not change matrixAutoUpdate (v0.45 freeze on static body LOD
  // leaves stays; lid/latch/tool/fastener stay live). Do not change
  // matrixWorldAutoUpdate (v0.69 stays). Do not touch Material version
  // (v1.5.0 material-version-zero stays) or Material name (v1.2.0
  // material-name-empty stays) or Material userData (v1.1.0
  // material-userData-empty stays). Do not touch Mesh / Object3D
  // userData (v1.4.0 mesh-userData-empty stays) or Mesh / Object3D name
  // (v1.3.0 mesh-name-empty stays; reserved names lidMesh / latchMesh /
  // fastenerMesh and any collider_* stay). Do not touch BufferGeometry
  // userData / name. Do not touch BufferAttribute fields, prior
  // material program-cache / flag pins, bounds, morphs, animations,
  // shadows, frustumCulled, or mesh.visible.
  // Checked installed three@0.170.0:
  // the Object3D constructor assigns this.matrixWorldNeedsUpdate = false.
  // Mesh does not override it. updateMatrix() assigns
  // this.matrixWorldNeedsUpdate = true. updateMatrixWorld(force)
  // recomputes matrixWorld when this.matrixWorldNeedsUpdate || force
  // (and matrixWorldAutoUpdate === true), then assigns
  // this.matrixWorldNeedsUpdate = false. updateWorldMatrix does not
  // read or clear the flag; when matrixAutoUpdate is true it calls
  // updateMatrix(), which sets the flag true. Object3D.copy copies
  // source.matrixWorldNeedsUpdate. applyMatrix4 calls updateMatrix()
  // when matrixAutoUpdate is true, so a glTF node matrix leaves the
  // flag true on a live node. WebGLRenderer.render calls
  // scene.updateMatrixWorld() when scene.matrixWorldAutoUpdate === true.
  // The fast path inside updateMatrixWorld skips multiplyMatrices only
  // when the flag is false and force is false. A leftover true on a
  // static packed color-only visual (matrixAutoUpdate === false from
  // v0.45, so updateMatrix is not called first) forces that
  // world-matrix multiply on the JS thread before the flag is cleared.
  // On Quest 3 TBDR that load-time / first-frame rebuild is packaging
  // waste; it does not change draws, tris, or attrBytes.
  // Draws / tris / attrBytes unchanged vs v1.5.0.
  // material-version-zero 3 stays. mesh-userData-empty 13 stays.
  // mesh-name-empty 10 stays. unique MeshBasic 3 stays.
  // matrixWorldNeedsUpdate-false 13 is the new count.
  // v1.7.0: after that matrixWorldNeedsUpdate pin, strip leftover
  // BufferGeometry color so the attribute is absent
  // (geometry.getAttribute('color') is missing and
  // geometry.hasAttribute('color') === false) on the 13 packed
  // color-only unlit MeshBasic visual geometries (body LOD leaves +
  // lid/latch/tool + fastener; measured colorAttribute-absent 13)
  // when the material already has vertexColors === false (v0.57
  // stays).
  // COLOR_ONLY_UNUSED_COLOR_ATTRS is ['color'] and is listed on
  // COLOR_ONLY_UNUSED_ATTRS. stripUnusedColorOnlyColorAttributes
  // deletes it from stripUnusedColorOnlyAttributes on the pack/weld
  // path (after weld) and skips interleaved geometries.
  // pinColorOnlyUnlitBasicColorAttribute /
  // pinColorOnlyVisualColorAttribute run after
  // pinColorOnlyVisualMatrixWorldNeedsUpdate.
  // Prefer geometry.deleteAttribute('color') when present. Do not
  // invent a replacement attribute. Do not assign null. Do not enable
  // material.vertexColors. Do not rewrite vertexColors. Do not replace
  // the mesh, the material, the geometry, other attributes, or typed
  // arrays. Do not delete position. Do not delete index. Do not touch
  // Material version (v1.5.0 material-version-zero stays) or Material
  // name or Material userData. Do not touch Mesh / Object3D userData
  // or Mesh / Object3D name (reserved lidMesh / latchMesh /
  // fastenerMesh and any collider_* stay). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 matrixWorldNeedsUpdate-false stays).
  // Do not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not
  // touch BufferGeometry name / userData, other BufferAttribute
  // fields, prior material program-cache / flag pins, bounds, morphs,
  // animations, shadows, frustumCulled, or mesh.visible.
  // Checked installed three@0.170.0:
  // a fresh BufferGeometry assigns this.attributes = {} and has no
  // color attribute. deleteAttribute(name) deletes
  // this.attributes[name] and does not assign null. WebGLPrograms
  // copies vertexColors: material.vertexColors and enables the
  // vertex-color program layer only when parameters.vertexColors is
  // true. WebGLProgram emits #define USE_COLOR and attribute vec3
  // color only then. A leftover color BufferAttribute on a color-only
  // MeshBasic with vertexColors === false is never read by the
  // MeshBasic shader path. WebGLGeometries.update still uploads every
  // geometry.attributes entry, so a leftover color attribute inflates
  // pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static
  // props. Deleting it is load-time packaging. GLTFLoader maps
  // COLOR_0 to color. On clean procedural meshes (no color attr)
  // draws / tris / attrBytes stay unchanged vs v1.6.0. A fixture with
  // a leftover Float32 color may drop measured attrBytes (itemSize 3
  // is count * 3 * 4 bytes; itemSize 4 is count * 4 * 4 bytes). A
  // 24-vert BoxGeometry itemSize-3 fixture drops 288 pre-upload
  // attrBytes. A 3-vert itemSize-3 fixture drops 36; itemSize 4 drops
  // 48. No invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.6.0 on clean procedural
  // meshes. matrixWorldNeedsUpdate-false 13 stays.
  // material-version-zero 3 stays. mesh-userData-empty 13 stays.
  // mesh-name-empty 10 stays. unique MeshBasic 3 stays.
  // colorAttribute-absent 13 is the new count.
  // v1.8.0: after that color strip, pin leftover BufferAttribute
  // onUpload / onUploadCallback so the v0.43 releaseCpuArray hook is
  // the sole upload callback on the remaining attributes (at least
  // position, and index when present) of the 13 packed color-only
  // unlit MeshBasic visual geometries (body LOD leaves +
  // lid/latch/tool + fastener; measured onUpload-release 13).
  // pinColorOnlyUnlitBasicOnUpload / pinColorOnlyVisualOnUpload run
  // after pinColorOnlyVisualColorAttribute.
  // The pin calls BufferAttribute.onUpload and does not invoke the
  // callback. Do not null .array inside the pin. Do not recompute
  // bounds inside the pin. Do not call setUsage. Do not replace the
  // mesh, the material, the geometry, the attributes, or typed
  // arrays. Do not invent attributes. An already-correct
  // releaseCpuArray hook stamped to that geometry is left in place.
  // A rogue callback or the r170 empty prototype onUploadCallback is
  // replaced. Do not touch color (v1.7.0 colorAttribute-absent 13
  // stays). Do not touch matrixWorldNeedsUpdate (v1.6.0 stays). Do
  // not change matrixAutoUpdate or matrixWorldAutoUpdate. Do not
  // touch Material version / name / userData or Mesh name / userData
  // or BufferGeometry name / userData. Do not touch BufferAttribute
  // version / name / gpuType / normalized / usage / updateRange /
  // updateRanges. Do not touch bounds, morphs, animations, shadows,
  // frustumCulled, or mesh.visible.
  // Checked installed three@0.170.0:
  // BufferAttribute declares onUploadCallback() {} on the prototype.
  // onUpload(callback) assigns this.onUploadCallback = callback and
  // does not null .array and does not bump version.
  // BufferAttribute.copy does not copy onUploadCallback, so a copied
  // attribute falls back to the empty prototype method.
  // WebGLAttributes.createBuffer copies attribute.array into a local,
  // calls gl.bufferData, then calls attribute.onUploadCallback().
  // The callback runs after the GPU upload. A leftover non-release
  // callback skips the Quest 3 CPU-array release, so static packed
  // color-only props keep Float16 / Uint16 CPU arrays after upload
  // on a TBDR headset. The pin only installs the hook.
  // Draws / tris / attrBytes unchanged vs v1.7.0 on clean procedural
  // meshes. colorAttribute-absent 13 stays.
  // matrixWorldNeedsUpdate-false 13 stays. material-version-zero 3
  // stays. mesh-userData-empty 13 stays. mesh-name-empty 10 stays.
  // unique MeshBasic 3 stays. onUpload-release 13 is the new count.
  // v1.9.0: after that onUpload pin, strip leftover normal / uv /
  // uv1 / uv2 / uv3 / tangent so none of those channels remain
  // (geometry.getAttribute(name) is missing and
  // geometry.hasAttribute(name) === false) on the 13 packed
  // color-only unlit MeshBasic visual geometries (body LOD leaves +
  // lid/latch/tool + fastener; measured unusedAttributes-absent 13).
  // COLOR_ONLY_UNUSED_CHANNEL_ATTRS is derived from
  // COLOR_ONLY_UNUSED_ATTRS (source of truth) and excludes skinIndex /
  // skinWeight (v0.89 pin) and color (v1.7.0 pin).
  // stripUnusedColorOnlyChannelAttributes deletes them from
  // stripUnusedColorOnlyAttributes on the pack/weld path and skips
  // interleaved geometries. Fail-soft packaged paths that never enter
  // the pack helper still hit pinColorOnlyVisualUnusedAttributes.
  // pinColorOnlyUnlitBasicUnusedAttributes /
  // pinColorOnlyVisualUnusedAttributes run after
  // pinColorOnlyVisualOnUpload.
  // Prefer geometry.deleteAttribute(name) when present. Do not invent
  // a replacement attribute. Do not assign null. Do not delete
  // position. Do not delete index. Do not delete skinIndex /
  // skinWeight. Do not delete color. Do not touch onUpload /
  // onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 stays). Do not change
  // matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material
  // version / name / userData or Mesh name / userData or
  // BufferGeometry name / userData. Do not touch BufferAttribute
  // version / name / gpuType / normalized / usage / updateRange /
  // updateRanges. Do not touch bounds, morphs, animations, shadows,
  // frustumCulled, or mesh.visible.
  // Checked installed three@0.170.0:
  // WebGLProgram prefix always emits attribute vec3 normal and
  // attribute vec2 uv. uv1 / uv2 / uv3 / tangent are behind USE_UV1 /
  // USE_UV2 / USE_UV3 / USE_TANGENT, which stay off without maps.
  // meshbasic.glsl.js reads normal only inside USE_ENVMAP or
  // USE_SKINNING. uv_vertex.glsl.js reads uv only under USE_UV or
  // USE_ANISOTROPY. Color-only MeshBasic does not enable those
  // defines. WebGLGeometries.update still uploads every
  // geometry.attributes entry, so leftover channels inflate
  // pre-upload attrBytes and GPU buffer work on Quest 3 TBDR static
  // props. Deleting them is load-time packaging. GLTFLoader maps
  // NORMAL to normal, TANGENT to tangent, TEXCOORD_0 to uv,
  // TEXCOORD_1 to uv1, TEXCOORD_2 to uv2, TEXCOORD_3 to uv3. On clean
  // procedural meshes (no those attrs) draws / tris / attrBytes stay
  // unchanged vs v1.8.0. A fixture with a leftover Float32 uv drops
  // count * 2 * 4 bytes; a leftover Float32 normal drops count * 3 *
  // 4 bytes; a leftover Float32 tangent drops count * 4 * 4 bytes. A
  // 24-vert BoxGeometry with both uv and normal drops 480 pre-upload
  // attrBytes. A 3-vert fixture drops 24 (uv) or 36 (normal). No
  // invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.8.0 on clean procedural
  // meshes. onUpload-release 13 stays. colorAttribute-absent 13 stays.
  // matrixWorldNeedsUpdate-false 13 stays. material-version-zero 3
  // stays. mesh-userData-empty 13 stays. mesh-name-empty 10 stays.
  // unique MeshBasic 3 stays. unusedAttributes-absent 13 is the new
  // count.
  // v1.10.0: after that unused-channel strip, pin leftover
  // BufferGeometry indirect to the r170 constructor default null
  // (geometry.indirect === null) on the 13 packed color-only unlit
  // MeshBasic visual geometries (body LOD leaves + lid/latch/tool +
  // fastener; measured indirect-null 13).
  // pinColorOnlyUnlitBasicIndirect / pinColorOnlyVisualIndirect run
  // after pinColorOnlyVisualUnusedAttributes.
  // Call setIndirect(null) only when indirect is not already null.
  // Do not invent a replacement buffer. Do not call delete on
  // unrelated fields. Do not re-run the unused-channel strip (v1.9.0
  // unusedAttributes-absent 13 stays). Do not touch onUpload /
  // onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch
  // color (v1.7.0 colorAttribute-absent 13 stays). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 stays). Do not change
  // matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material
  // version / name / userData or Mesh name / userData or
  // BufferGeometry name / userData. Do not touch BufferAttribute
  // version / name / gpuType / normalized / usage / updateRange /
  // updateRanges. Do not touch drawRange, groups, skinIndex /
  // skinWeight, position, or index. Do not touch bounds, morphs,
  // animations, shadows, frustumCulled, or mesh.visible.
  // Checked installed three@0.170.0:
  // BufferGeometry constructor assigns this.indirect = null.
  // setIndirect(indirect) assigns this.indirect = indirect.
  // getIndirect() returns this.indirect.
  // src/renderers/common/Geometries.js calls
  // updateAttribute(indirect, AttributeType.INDIRECT) when
  // renderObject.geometry.indirect !== null. Color-only static
  // MeshBasic props do not use multi-draw / BatchedMesh indirect
  // indexing. Clearing a leftover indirect to null is load-time
  // packaging for Quest 3 TBDR. On clean procedural meshes draws /
  // tris / attrBytes stay unchanged vs v1.9.0. No invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.9.0 on clean procedural
  // meshes. unusedAttributes-absent 13 stays. onUpload-release 13
  // stays. colorAttribute-absent 13 stays. matrixWorldNeedsUpdate-false
  // 13 stays. material-version-zero 3 stays. mesh-userData-empty 13
  // stays. mesh-name-empty 10 stays. unique MeshBasic 3 stays.
  // indirect-null 13 is the new count.
  // v1.11.0: after that indirect pin, delete leftover Material
  // extensions so the r170 MeshBasic absence remains
  // (material.extensions === undefined and
  // Object.hasOwn(material, 'extensions') === false) on the 3 shared
  // color-only MeshBasic materials (wood / brass / steel; measured
  // extensions-absent 3).
  // pinColorOnlyUnlitBasicMaterialExtensions /
  // pinColorOnlyVisualMaterialExtensions run after
  // pinColorOnlyVisualIndirect.
  // Prefer delete material.extensions when the own property is
  // present. Do not assign null. Do not assign a sentinel
  // { clipCullDistance: false, multiDraw: false }. An already-absent
  // extensions is left alone. Pin once per shared material instance.
  // Do not convert MeshBasic to ShaderMaterial. Do not invent
  // extension maps. Do not enable multi-draw or clip-cull-distance.
  // Do not touch indirect (v1.10.0 indirect-null 13 stays). Do not
  // re-run the unused-channel strip (v1.9.0 unusedAttributes-absent
  // 13 stays). Do not touch onUpload / onUploadCallback (v1.8.0
  // onUpload-release 13 stays). Do not touch color (v1.7.0
  // colorAttribute-absent 13 stays). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 stays). Do not change
  // matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material
  // version / name / userData or Mesh name / userData or
  // BufferGeometry name / userData. Do not touch BufferAttribute
  // fields. Do not touch prior Material program-cache / flag pins.
  // Do not touch bounds, morphs, animations, shadows, frustumCulled,
  // or mesh.visible.
  // Checked installed three@0.170.0:
  // Fresh Material / MeshBasicMaterial constructors do not assign
  // extensions. ShaderMaterial assigns this.extensions =
  // { clipCullDistance: false, multiDraw: false } and copies via
  // Object.assign. WebGLPrograms.getParameters sets
  // HAS_EXTENSIONS = !! material.extensions, then
  // extensionClipCullDistance and extensionMultiDraw from that
  // object. A leftover own extensions object on MeshBasic keeps
  // HAS_EXTENSIONS true even when both flags are false. Deleting the
  // own property restores the r170 absence. On clean procedural
  // materials draws / tris / attrBytes stay unchanged vs v1.10.0.
  // No invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.10.0 on clean procedural
  // meshes. indirect-null 13 stays. unusedAttributes-absent 13 stays.
  // onUpload-release 13 stays. colorAttribute-absent 13 stays.
  // matrixWorldNeedsUpdate-false 13 stays. material-version-zero 3
  // stays. mesh-userData-empty 13 stays. mesh-name-empty 10 stays.
  // unique MeshBasic 3 stays. extensions-absent 3 is the new count.
  // v1.12.0: after that extensions pin, delete leftover Material
  // depthPacking so the r170 MeshBasic absence remains
  // (material.depthPacking === undefined and
  // Object.hasOwn(material, 'depthPacking') === false) on the 3 shared
  // color-only MeshBasic materials (wood / brass / steel; measured
  // depthPacking-absent 3).
  // pinColorOnlyUnlitBasicMaterialDepthPacking /
  // pinColorOnlyVisualMaterialDepthPacking run after
  // pinColorOnlyVisualMaterialExtensions.
  // Prefer delete material.depthPacking when the own property is
  // present. Do not assign null, undefined, or 0. An already-absent
  // depthPacking is left alone. Pin once per shared material instance.
  // Do not convert MeshBasic to MeshDepthMaterial. Do not invent
  // depth packing. Do not touch extensions (v1.11.0 extensions-absent
  // 3 stays). Do not touch indirect (v1.10.0 indirect-null 13 stays).
  // Do not re-run the unused-channel strip (v1.9.0
  // unusedAttributes-absent 13 stays). Do not touch onUpload /
  // onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch
  // color (v1.7.0 colorAttribute-absent 13 stays). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 stays). Do not change
  // matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material
  // version / name / userData or Mesh name / userData or
  // BufferGeometry name / userData. Do not touch BufferAttribute
  // fields. Do not touch prior Material program-cache / flag pins.
  // Do not pin Material index0AttributeName (left for a later pulse).
  // Do not touch bounds, morphs, animations, shadows, frustumCulled,
  // or mesh.visible.
  // Checked installed three@0.170.0:
  // Fresh Material / MeshBasicMaterial constructors do not assign
  // depthPacking. MeshDepthMaterial assigns this.depthPacking =
  // BasicDepthPacking and copy assigns this.depthPacking =
  // source.depthPacking. WebGLPrograms.getParameters sets
  // useDepthPacking: material.depthPacking >= 0 and
  // depthPacking: material.depthPacking || 0.
  // getProgramCacheKeyParameters pushes parameters.depthPacking.
  // getProgramCacheKeyBooleans enables program layer 13 when
  // useDepthPacking is true. WebGLProgram emits #define DEPTH_PACKING
  // plus parameters.depthPacking when useDepthPacking is true. A
  // leftover BasicDepthPacking (3200) or RGBADepthPacking (3201)
  // pushes a different cache-key number than the absent-material
  // fallback 0. A leftover 0 still sets useDepthPacking (0 >= 0), so
  // the boolean program mask forks and the define is emitted.
  // Assigning null also sets useDepthPacking (null >= 0). Deleting
  // the own property restores the r170 absence. On clean procedural
  // materials draws / tris / attrBytes stay unchanged vs v1.11.0.
  // No invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.11.0 on clean procedural
  // meshes. extensions-absent 3 stays. indirect-null 13 stays.
  // unusedAttributes-absent 13 stays. onUpload-release 13 stays.
  // colorAttribute-absent 13 stays. matrixWorldNeedsUpdate-false 13
  // stays. material-version-zero 3 stays. mesh-userData-empty 13
  // stays. mesh-name-empty 10 stays. unique MeshBasic 3 stays.
  // depthPacking-absent 3 is the new count.
  // v1.13.0: after that depthPacking pin, delete leftover Material
  // index0AttributeName so the r170 MeshBasic absence remains
  // (material.index0AttributeName === undefined and
  // Object.hasOwn(material, 'index0AttributeName') === false) on the
  // 3 shared color-only MeshBasic materials (wood / brass / steel;
  // measured index0AttributeName-absent 3).
  // pinColorOnlyUnlitBasicMaterialIndex0AttributeName /
  // pinColorOnlyVisualMaterialIndex0AttributeName run after
  // pinColorOnlyVisualMaterialDepthPacking.
  // Prefer delete material.index0AttributeName when the own property
  // is present. Do not assign null, undefined, or ''. An
  // already-absent index0AttributeName is left alone. Pin once per
  // shared material instance. Do not invent a replacement attribute
  // name. Do not touch depthPacking (v1.12.0 depthPacking-absent 3
  // stays). Do not touch extensions (v1.11.0 extensions-absent 3
  // stays). Do not touch indirect (v1.10.0 indirect-null 13 stays).
  // Do not re-run the unused-channel strip (v1.9.0
  // unusedAttributes-absent 13 stays). Do not touch onUpload /
  // onUploadCallback (v1.8.0 onUpload-release 13 stays). Do not touch
  // color (v1.7.0 colorAttribute-absent 13 stays). Do not touch
  // matrixWorldNeedsUpdate (v1.6.0 stays). Do not change
  // matrixAutoUpdate or matrixWorldAutoUpdate. Do not touch Material
  // version / name / userData or Mesh name / userData or
  // BufferGeometry name / userData. Do not touch BufferAttribute
  // fields. Do not touch prior Material program-cache / flag pins.
  // Do not touch bounds, morphs, animations, shadows, frustumCulled,
  // or mesh.visible.
  // Checked installed three@0.170.0:
  // Fresh Material / MeshBasicMaterial constructors do not assign
  // index0AttributeName. ShaderMaterial assigns
  // this.index0AttributeName = undefined (own property, value still
  // undefined). ShaderMaterial.copy does not copy it.
  // WebGLPrograms.getParameters copies
  // index0AttributeName: material.index0AttributeName.
  // getProgramCacheKey / getProgramCacheKeyParameters /
  // getProgramCacheKeyBooleans do not push that name (no cache-key
  // token and no program-layer bit). WebGLProgram emits no #define
  // for it. Before gl.linkProgram, when
  // parameters.index0AttributeName !== undefined, it calls
  // gl.bindAttribLocation(program, 0, parameters.index0AttributeName).
  // A leftover string ('position', 'color') or empty string '' binds
  // attribute 0 to that name while the program cache key stays
  // identical to constructor absence, so the first material to compile
  // bakes that binding for every later material that shares the other
  // parameters. Assigning null also binds (null !== undefined).
  // Deleting the own property restores the r170 absence. On clean
  // procedural materials draws / tris / attrBytes stay unchanged vs
  // v1.12.0. No invented headset ms.
  // Draws / tris / attrBytes unchanged vs v1.12.0 on clean procedural
  // meshes. depthPacking-absent 3 stays. extensions-absent 3 stays.
  // indirect-null 13 stays. unusedAttributes-absent 13 stays.
  // onUpload-release 13 stays. colorAttribute-absent 13 stays.
  // matrixWorldNeedsUpdate-false 13 stays. material-version-zero 3
  // stays. mesh-userData-empty 13 stays. mesh-name-empty 10 stays.
  // unique MeshBasic 3 stays. index0AttributeName-absent 3 is the new
  // count.
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

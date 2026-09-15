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
 * and packaged ingest.
 */
export function packColorOnlyGeometry(geometry, material) {
  stripUnusedColorOnlyAttributes(geometry, material);
  compactIndexToUint16(geometry);
  quantizePositionToFloat16(geometry, material);
  releaseCpuArraysOnGpuUpload(geometry, material);
  return geometry;
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
    note: "procedural color-only stand-in; LOD0/1/2 color-only unlit MeshBasic (no map; wood/brass/steel midtones). v0.37 woodDark/handleMat alias wood within a LOD; v0.42 one shared wood instance across LOD0/1/2 and one shared brass across LOD0/1 (+ fastener) when midtone hex matches (steel stays LOD0-only). same-material merge within each lodGroup (v0.37; not across body/lid/latch/tool) then coincident-vertex weld (v0.39) then unused uv/normal strip on color-only MeshBasic (v0.40) then Uint16 index compact (v0.41) then Float16 position quantize (v0.44) then StaticDrawUsage + onUpload CPU-array release (v0.43); fastener (not an LOD mesh) gets the same unused-attr strip + compact + Float16 + upload-release. Collider CPU arrays stay. lod.stats.attrBytes is the pre-upload envelope",
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

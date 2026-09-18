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

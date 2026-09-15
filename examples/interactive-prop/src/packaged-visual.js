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
 */

import {
  attachToolboxLod,
  compactIndexToUint16,
  mergeSameMaterialMeshes,
  stripUnusedColorOnlyAttributes,
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
  if (fastener?.isMesh && fastener.geometry) {
    stripUnusedColorOnlyAttributes(fastener.geometry, fastener.material);
    compactIndexToUint16(fastener.geometry);
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

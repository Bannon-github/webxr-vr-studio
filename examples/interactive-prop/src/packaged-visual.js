/**
 * Prefer a packaged GLB (KTX2 / meshopt) when the URL exists.
 * Missing file → null (caller keeps procedural canvases: 512² LOD0 +
 * 256² LOD1/LOD2 albedo). Does not strip or downsample maps at ingest.
 * Loaders are dynamic-imported only after a successful probe.
 */

const REQUIRED_COLLIDERS = [
  "collider_grab",
  "collider_latch",
  "collider_lid",
  "collider_tool",
];

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

function ingestPackagedRoot(root, sidecar) {
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
  return root;
}

/** @returns {Promise<import("three").Group|null>} */
export async function tryLoadPackagedToolbox(renderer, sidecar) {
  const url = resolvePackagedUrl(sidecar);
  if (sidecar?.source?.preferPackaged === false) return null;
  const found = await probePackagedUrl(url);
  if (!found) {
    console.info("[crate-toolbox] no packaged GLB at", url, "— procedural canvases");
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

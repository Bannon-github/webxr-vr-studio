/**
 * Quest 3 present-path texture anisotropy clamp.
 *
 * After v0.20, present-path lighting is ambient-only (pixel-ratio / MSAA /
 * tone / IBL / directional / hemisphere already gated). Three.js / WebGL
 * can still request high anisotropic filtering on textures — lookdev or a
 * packaged GLB may use the GPU max (`renderer.capabilities.getMaxAnisotropy()`,
 * often 16). On Quest 3 TBDR that is extra texture bandwidth for little
 * gain at present-path pixel ratio 1 + FFR 0.75. Studio docs: mipmaps on;
 * do not assume 16× anisotropy.
 *
 * Procedural crate canvases already author at anisotropy 1 (`pbr-maps.js`).
 * Packaged GLB materials and any lookdev max still need a session gate.
 *
 * Present-path policy: walk known material maps, dedupe by texture
 * identity, save each `.anisotropy`, write `QUEST3_XR_TEXTURE_ANISOTROPY`
 * (1). On `sessionend` restore the saved lookdev values. Do **not** set
 * `needsUpdate` (that would re-upload). Do not dispose textures.
 *
 * Session events only — never call from the XR animation loop.
 * No THREE / WebXR types. Safe in Node.
 */

/** Present-path texture anisotropy — bilinear / no AF. */
export const QUEST3_XR_TEXTURE_ANISOTROPY = 1;

/**
 * MeshStandard / MeshPhysical map slots that bind a sampler.
 * Crate-toolbox procedural materials use map + ORM (roughness/metalness)
 * + optional normalMap. Packaged GLB may bind the rest.
 */
export const PRESENT_ANISOTROPY_MAP_KEYS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "bumpMap",
  "displacementMap",
  "alphaMap",
  "lightMap",
  "envMap",
  "specularMap",
  "specularIntensityMap",
  "specularColorMap",
  "clearcoatMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "transmissionMap",
  "thicknessMap",
  "iridescenceMap",
  "iridescenceThicknessMap",
  "anisotropyMap",
];

/** Always `QUEST3_XR_TEXTURE_ANISOTROPY` (1). `requested` is ignored. */
export function resolveQuest3PresentAnisotropy(_requested) {
  return QUEST3_XR_TEXTURE_ANISOTROPY;
}

export function normalizeAnisotropy(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) return value;
  return null;
}

export function readTextureAnisotropy(texture, fallback = QUEST3_XR_TEXTURE_ANISOTROPY) {
  return normalizeAnisotropy(texture?.anisotropy) ?? fallback;
}

function materialsOf(obj) {
  const m = obj?.material;
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

function walkObject(root, visit) {
  if (!root) return;
  if (typeof root.traverse === "function") {
    root.traverse(visit);
    return;
  }
  const stack = [root];
  while (stack.length) {
    const obj = stack.pop();
    visit(obj);
    const kids = obj?.children;
    if (Array.isArray(kids)) {
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  }
}

function collectInto(material, into, seen) {
  if (!material || typeof material !== "object") return;
  for (let i = 0; i < PRESENT_ANISOTROPY_MAP_KEYS.length; i++) {
    const tex = material[PRESENT_ANISOTROPY_MAP_KEYS[i]];
    if (!tex || typeof tex !== "object") continue;
    if (seen.has(tex)) continue;
    seen.add(tex);
    into.push(tex);
  }
}

/** Dedupe by texture identity from one material or a material list. */
export function collectTexturesFromMaterials(materials) {
  const into = [];
  const seen = new Set();
  const list = Array.isArray(materials) ? materials : materials ? [materials] : [];
  for (let i = 0; i < list.length; i++) collectInto(list[i], into, seen);
  return into;
}

/**
 * Walk `root` (Three `traverse` or a `children` tree) and collect bound
 * maps. Multi-materials and shared ORM (roughness + metalness) are
 * identity-deduped. Invisible LOD meshes still contribute — they stay
 * in the graph.
 */
export function collectTexturesFromObject(root) {
  const into = [];
  const seen = new Set();
  walkObject(root, (obj) => {
    const mats = materialsOf(obj);
    for (let i = 0; i < mats.length; i++) collectInto(mats[i], into, seen);
  });
  return into;
}

function collectFromOpts(opts) {
  if (Array.isArray(opts.textures)) {
    const into = [];
    const seen = new Set();
    for (let i = 0; i < opts.textures.length; i++) {
      const tex = opts.textures[i];
      if (!tex || typeof tex !== "object" || seen.has(tex)) continue;
      seen.add(tex);
      into.push(tex);
    }
    return into;
  }
  const roots = [];
  if (opts.root) roots.push(opts.root);
  if (Array.isArray(opts.roots)) {
    for (let i = 0; i < opts.roots.length; i++) {
      if (opts.roots[i]) roots.push(opts.roots[i]);
    }
  }
  const into = [];
  const seen = new Set();
  for (let r = 0; r < roots.length; r++) {
    const found = collectTexturesFromObject(roots[r]);
    for (let i = 0; i < found.length; i++) {
      if (seen.has(found[i])) continue;
      seen.add(found[i]);
      into.push(found[i]);
    }
  }
  return into;
}

function isHandle(value) {
  return Boolean(value && Array.isArray(value.entries));
}

function savedAnisotropyByTexture(handle) {
  const map = new Map();
  if (!isHandle(handle)) return map;
  for (let i = 0; i < handle.entries.length; i++) {
    const entry = handle.entries[i];
    if (entry?.texture) map.set(entry.texture, entry.savedAnisotropy);
  }
  return map;
}

/**
 * Apply or restore the present-path anisotropy clamp.
 *
 * `{ presenting: true, root | roots | textures }` — remember each
 * texture’s current (or handle-saved) anisotropy, then write 1.
 * `{ presenting: false, handle }` — write saved lookdev values back.
 *
 * Re-applying with the same `handle` keeps the original saved values
 * (does not re-save the already-clamped 1).
 *
 * Returns `{ presenting, handle, anisotropy, count }`.
 */
export function applyPresentAnisotropy(opts = {}) {
  if (opts.presenting === false) {
    return restorePresentAnisotropy(opts.handle);
  }
  const anisotropy = resolveQuest3PresentAnisotropy(opts.anisotropy);
  const textures = collectFromOpts(opts);
  const priorSaved = savedAnisotropyByTexture(opts.handle);
  const entries = [];
  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i];
    const savedAnisotropy = priorSaved.has(texture)
      ? (normalizeAnisotropy(priorSaved.get(texture)) ?? QUEST3_XR_TEXTURE_ANISOTROPY)
      : readTextureAnisotropy(texture);
    texture.anisotropy = anisotropy;
    entries.push({ texture, savedAnisotropy });
  }
  return {
    presenting: true,
    handle: { entries, anisotropy },
    anisotropy,
    count: entries.length,
  };
}

export function restorePresentAnisotropy(handle) {
  const entries = isHandle(handle) ? handle.entries : [];
  for (let i = 0; i < entries.length; i++) {
    const texture = entries[i]?.texture;
    if (!texture) continue;
    texture.anisotropy =
      normalizeAnisotropy(entries[i].savedAnisotropy) ?? QUEST3_XR_TEXTURE_ANISOTROPY;
  }
  return {
    presenting: false,
    handle: isHandle(handle) ? handle : { entries: [], anisotropy: QUEST3_XR_TEXTURE_ANISOTROPY },
    anisotropy: isHandle(handle) ? handle.anisotropy : QUEST3_XR_TEXTURE_ANISOTROPY,
    count: entries.length,
  };
}

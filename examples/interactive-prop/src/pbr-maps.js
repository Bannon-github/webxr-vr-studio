import * as THREE from "three";

/** Shared L2 stand-in maps. 256² as of v0.31 (was 512² through v0.30), mipmapped. Not photoreal desktop 4K. */
export const L2_TEXTURE_SIZE = 256;

/**
 * Historical LOD1/LOD2 albedo authoring size (half of the pre-v0.31
 * `L2_TEXTURE_SIZE` of 512). v0.26–v0.28 bound 256² maps on mid/far;
 * v0.29 dropped the LOD2 map; v0.30 drops the LOD1 map too (color-only
 * MeshBasic). Kept as the documented half-res constant / GLB authoring
 * cap if a future packaged mid LOD uses a tiny albedo. Procedural path
 * no longer allocates these canvases. v0.31 drops LOD0 hero maps from
 * 512² → 256² (`L2_TEXTURE_SIZE`); v0.32 drops LOD0 `normalMap` (albedo
 * + ORM only); v0.33 drops LOD0 packed ORM (albedo-only MeshStandard,
 * constant roughness/metalness); v0.34 switches LOD0 to unlit MeshBasic
 * with the same 256² albedo `map`s (no roughness/metalness); v0.35
 * drops the LOD0 albedo `map` (color-only MeshBasic, same mid/far
 * step as v0.29/v0.30). This constant stays 256 so historical docs
 * stay accurate. Not a headset-measured ms claim.
 */
export const L3_LOD_ALBEDO_SIZE = 256;

function hash2(ix, iy) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, octaves) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += noise2(x * f, y * f) * a;
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function fillRgba(size, writePixel) {
  const c = canvas(size);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) * inv;
      const i = (y * size + x) * 4;
      writePixel(u, v, d, i);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function texFromCanvas(c, srgb, repeatX, repeatY) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 1;
  t.needsUpdate = true;
  return t;
}

/**
 * Height fields stay aligned with albedo grain / wear so lighting matches color.
 * Values are roughly 0..1; only relative slopes matter for the normal bake.
 */
export function woodHeight(u, v) {
  const grain = u * 14 + fbm(u * 3.2, v * 22, 4) * 3.2 + fbm(u * 18, v * 40, 2) * 0.45;
  const stripe = 0.5 + 0.5 * Math.sin(grain * Math.PI);
  const pore = fbm(u * 48, v * 64, 2);
  const knot = Math.max(0, 0.55 - Math.hypot((u - 0.62) * 3.2, (v - 0.28) * 1.4) - fbm(u * 8, v * 8, 2) * 0.15);
  return stripe * 0.55 + pore * 0.18 + knot * 0.35;
}

export function brassHeight(u, v) {
  const n = fbm(u * 6, v * 6, 4);
  const scratch = Math.abs(Math.sin((u * 40 + v * 3 + n) * Math.PI));
  const tarnish = Math.max(0, fbm(u * 4.5, v * 5.5, 3) - 0.42);
  return n * 0.35 - tarnish * 0.25 + scratch * 0.12;
}

export function steelHeight(u, v) {
  const brush = 0.5 + 0.5 * Math.sin((v * 90 + fbm(u * 2, v * 40, 3) * 2.5) * Math.PI);
  const n = fbm(u * 10, v * 10, 3);
  return brush * 0.55 + n * 0.2;
}

/**
 * OpenGL tangent-space normal (Three.js +Y) from four height samples.
 * Neighbors are along canvas +X / +Y (y increases downward, same as +V).
 * `hYMinus` is y-1 (toward the top of the image); `hYPlus` is y+1.
 * Higher height toward y-1 encodes G > 128. RGB 0–255.
 */
export function heightToNormalRgb(hLeft, hRight, hYMinus, hYPlus, strength = 2.5) {
  const dx = (hRight - hLeft) * strength;
  const dy = (hYPlus - hYMinus) * strength;
  let nx = -dx;
  let ny = -dy;
  let nz = 1;
  const inv = 1 / Math.hypot(nx, ny, nz);
  nx *= inv;
  ny *= inv;
  nz *= inv;
  return [Math.round((nx * 0.5 + 0.5) * 255), Math.round((ny * 0.5 + 0.5) * 255), Math.round((nz * 0.5 + 0.5) * 255)];
}

function heightField(size, heightFn) {
  const h = new Float32Array(size * size);
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) * inv;
    for (let x = 0; x < size; x++) {
      h[y * size + x] = heightFn((x + 0.5) * inv, v);
    }
  }
  return h;
}

function normalFromHeightField(size, heights, strength) {
  return fillRgba(size, (_u, _v, d, i) => {
    const p = i >> 2;
    const x = p % size;
    const y = (p - x) / size;
    const xL = (x + size - 1) % size;
    const xR = (x + 1) % size;
    const yMinus = (y + size - 1) % size;
    const yPlus = (y + 1) % size;
    const [r, g, b] = heightToNormalRgb(
      heights[y * size + xL],
      heights[y * size + xR],
      heights[yMinus * size + x],
      heights[yPlus * size + x],
      strength
    );
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  });
}

function normalCanvas(size, heightFn, strength) {
  return normalFromHeightField(size, heightField(size, heightFn), strength);
}

function woodAlbedo(size) {
  return fillRgba(size, (u, v, d, i) => {
    const grain = u * 14 + fbm(u * 3.2, v * 22, 4) * 3.2 + fbm(u * 18, v * 40, 2) * 0.45;
    const stripe = 0.5 + 0.5 * Math.sin(grain * Math.PI);
    const pore = fbm(u * 48, v * 64, 2);
    const knot = Math.max(0, 0.55 - Math.hypot((u - 0.62) * 3.2, (v - 0.28) * 1.4) - fbm(u * 8, v * 8, 2) * 0.15);
    const t = Math.min(1, Math.max(0, stripe * 0.78 + pore * 0.14 + knot * 0.45));
    const r = 72 + t * 58 + knot * 20;
    const g = 38 + t * 28;
    const b = 18 + t * 14;
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = 255;
  });
}

function woodOrm(size) {
  return fillRgba(size, (u, v, d, i) => {
    const grain = u * 14 + fbm(u * 3.2, v * 22, 4) * 3.2;
    const stripe = 0.5 + 0.5 * Math.sin(grain * Math.PI);
    const ao = 180 - stripe * 50;
    const rough = 200 + stripe * 40;
    d[i] = ao;
    d[i + 1] = Math.min(255, rough);
    d[i + 2] = 8;
    d[i + 3] = 255;
  });
}

function brassAlbedo(size) {
  return fillRgba(size, (u, v, d, i) => {
    const n = fbm(u * 6, v * 6, 4);
    const scratch = Math.abs(Math.sin((u * 40 + v * 3 + n) * Math.PI));
    const tarnish = Math.max(0, fbm(u * 4.5, v * 5.5, 3) - 0.42);
    const t = 0.55 + n * 0.28 - tarnish * 0.35 + scratch * 0.08;
    d[i] = 140 + t * 70;
    d[i + 1] = 98 + t * 42 - tarnish * 30;
    d[i + 2] = 36 + t * 18;
    d[i + 3] = 255;
  });
}

function brassOrm(size) {
  return fillRgba(size, (u, v, d, i) => {
    const n = fbm(u * 6, v * 6, 4);
    const tarnish = Math.max(0, fbm(u * 4.5, v * 5.5, 3) - 0.42);
    const rough = 70 + n * 50 + tarnish * 90;
    const metal = 230 - tarnish * 80;
    d[i] = 210 - tarnish * 40;
    d[i + 1] = Math.min(255, rough);
    d[i + 2] = Math.min(255, metal);
    d[i + 3] = 255;
  });
}

function steelAlbedo(size) {
  return fillRgba(size, (u, v, d, i) => {
    const brush = 0.5 + 0.5 * Math.sin((v * 90 + fbm(u * 2, v * 40, 3) * 2.5) * Math.PI);
    const n = fbm(u * 10, v * 10, 3);
    const t = 0.62 + brush * 0.22 + n * 0.1;
    const c = 150 + t * 55;
    d[i] = c;
    d[i + 1] = c + 2;
    d[i + 2] = c + 8;
    d[i + 3] = 255;
  });
}

function steelOrm(size) {
  return fillRgba(size, (u, v, d, i) => {
    const brush = 0.5 + 0.5 * Math.sin((v * 90 + fbm(u * 2, v * 40, 3) * 2.5) * Math.PI);
    const rough = 55 + brush * 45;
    d[i] = 220;
    d[i + 1] = rough;
    d[i + 2] = 235;
    d[i + 3] = 255;
  });
}

let cached = null;

/** Wood grain, brass wear, steel brush — OpenGL +Y, modest slope. */
export const L2_NORMAL_STRENGTH = { wood: 4.2, brass: 2.8, steel: 3.4 };
export const L2_NORMAL_SCALE = { wood: [0.62, 0.62], brass: [0.3, 0.3], steel: [0.38, 0.38] };

/**
 * v0.14 LOD1 (~2.4–4.5 m) `normalScale` vs LOD0. Kept as the documented
 * half-scale constant. v0.24 LOD1 drops `normalMap` entirely (`{ normalMap:
 * false }`); v0.25 also drops packed ORM (`{ ormMap: false }`); v0.26 binds
 * 256² albedo on LOD1/LOD2, so mid materials no longer apply this multiplier.
 * v0.27 switches LOD2 to MeshBasicMaterial (unlit); v0.28 does the same for
 * LOD1; v0.29 drops the LOD2 albedo map (color-only MeshBasic); v0.30 does
 * the same for LOD1; v0.32 drops LOD0 `normalMap` the same way LOD1 did in
 * v0.24 (`{ normalMap: false }`) while keeping packed ORM; v0.33 drops
 * LOD0 packed ORM the same way LOD1 did in v0.25 (`{ ormMap: false }`);
 * v0.34 switches LOD0 to MeshBasicMaterial (unlit) with the same 256²
 * albedo maps — the same mid/far MeshBasic step as v0.27/v0.28;
 * v0.35 drops the LOD0 albedo `map` (color-only MeshBasic — the same
 * mid/far color-only step as v0.29/v0.30).
 * These mid constants stay on the `mappedStandard` helper only.
 */
export const L3_LOD1_NORMAL_SCALE_MUL = 0.5;

/**
 * Wood-ORM-midtone constants (not headset-measured).
 * `woodOrm` G (roughness) = 200 + stripe×40; stripe mid 0.5 → 220.
 * `woodOrm` B (metalness) is authored as constant 8.
 * Historical v0.25 LOD1 wood MeshStandard defaults on `mappedStandard`
 * (`{ ormMap: false }`). v0.33 LOD0 wood / woodDark / handle reused these
 * same constants. Procedural LOD0 (v0.34+), LOD1 (v0.28+), and LOD2
 * (v0.27+) are MeshBasicMaterial — roughness/metalness do not apply.
 */
export const L3_LOD2_WOOD_ROUGHNESS = 220 / 255;
export const L3_LOD2_WOOD_METALNESS = 8 / 255;

/**
 * Wood-albedo midtone for color-only LOD1 / LOD2 MeshBasic (not headset-measured).
 * `woodAlbedo`: t = stripe×0.78 + pore×0.14 + knot×0.45
 *   stripe mid 0.5; pore mid 0.5 (same primary-term-mid convention as
 *   woodOrm stripe 0.5); knot overlay off (localized).
 *   t = 0.5×0.78 + 0.5×0.14 = 0.46
 *   r = 72 + 0.46×58 = 98.68 → 99
 *   g = 38 + 0.46×28 = 50.88 → 51
 *   b = 18 + 0.46×14 = 24.44 → 24
 * Hex `0x633318`. Matches a 256² `woodAlbedo` pixel average
 * (~98.75 / 50.65 / 24.33). LOD0 (v0.35), LOD1 (v0.30), and LOD2
 * (v0.29) share this wood card.
 */
export const L3_LOD2_WOOD_COLOR = 0x633318;

/** LOD1 wood mid / dark / handle cards use the same wood-albedo midtone as LOD2. */
export const L3_LOD1_WOOD_COLOR = L3_LOD2_WOOD_COLOR;

/** LOD0 wood / woodDark / handle cards use the same wood-albedo midtone as LOD1/LOD2. */
export const L3_LOD0_WOOD_COLOR = L3_LOD1_WOOD_COLOR;

/**
 * Brass-albedo midtone for color-only LOD1 MeshBasic (not headset-measured).
 * `brassAlbedo`: t = 0.55 + n×0.28 − tarnish×0.35 + scratch×0.08
 *   n mid 0.5 (same primary-term-mid convention as brassOrm);
 *   tarnish overlay off (localized, same as brassOrm); scratch mid 0.5
 *   (distributed like wood pore) → t = 0.73
 *   formula: r = 140+0.73×70 = 191.1 → 191; g = 98+0.73×42 = 128.66 → 129;
 *   b = 36+0.73×18 = 49.14 → 49 → `0xBF8131`
 * Hex `0xBE7E31` is the 256² `brassAlbedo` pixel average
 * (~189.92 / 126.31 / 48.84 → 190 / 126 / 49) so the color-only latch
 * matches the dropped map. Formula midtone `0xBF8131` is adjacent.
 * LOD0 (v0.35) reuses this brass card for latch + fastener.
 */
export const L3_LOD1_BRASS_COLOR = 0xbe7e31;

/** LOD0 brass / fastener card uses the same brass-albedo midtone as LOD1. */
export const L3_LOD0_BRASS_COLOR = L3_LOD1_BRASS_COLOR;

/** LOD1 wood mid uses the wood-ORM-midtone constants (historical LOD2 names). */
export const L3_LOD1_WOOD_ROUGHNESS = L3_LOD2_WOOD_ROUGHNESS;
export const L3_LOD1_WOOD_METALNESS = L3_LOD2_WOOD_METALNESS;

/**
 * Historical v0.25 LOD1 brass-latch constants matching brass ORM midtones
 * (not headset-measured). `brassOrm` G (roughness) = 70 + n×50 + tarnish×90;
 * n mid 0.5, tarnish 0 (wear overlay off — same primary-term-mid convention
 * as wood stripe 0.5) → 95. `brassOrm` B (metalness) = 230 − tarnish×80;
 * tarnish 0 → 230. Procedural LOD1 brass is color-only MeshBasic (v0.30);
 * v0.33 LOD0 brass / fastener reused these on albedo-only MeshStandard.
 * These stay on the `mappedStandard` helper. LOD1 has no steel mesh
 * (tool stub uses the wood midtone card). v0.34 LOD0 brass / fastener
 * are MeshBasic with the brass albedo map; v0.35 drops that map
 * (color-only brass midtone) — roughness/metalness do not apply.
 */
export const L3_LOD1_BRASS_ROUGHNESS = 95 / 255;
export const L3_LOD1_BRASS_METALNESS = 230 / 255;

/**
 * LOD0 steel-shaft / tip constants matching steel ORM midtones
 * (not headset-measured). `steelOrm` G (roughness) = 55 + brush×45;
 * brush mid 0.5 (same primary-term-mid convention as wood stripe 0.5
 * and brass n 0.5) → 77.5. `steelOrm` B (metalness) is authored as
 * constant 235. Used by v0.33 albedo-only LOD0 MeshStandard
 * (`{ normalMap: false, ormMap: false }`). v0.34 LOD0 steel is MeshBasic
 * with the steel albedo map; v0.35 is color-only MeshBasic — these
 * stay on the `mappedStandard` helper.
 */
export const L3_LOD0_STEEL_ROUGHNESS = 77.5 / 255;
export const L3_LOD0_STEEL_METALNESS = 235 / 255;

/**
 * Steel-albedo midtone for color-only LOD0 MeshBasic (not headset-measured).
 * `steelAlbedo`: t = 0.62 + brush×0.22 + n×0.1
 *   brush mid 0.5 (same primary-term-mid convention as wood stripe 0.5
 *   and brass n 0.5); n mid 0.5 → t = 0.78
 *   c = 150 + 0.78×55 = 192.9 → 193
 *   r = c; g = c+2; b = c+8 → 193 / 195 / 201 → `0xC1C3C9`
 * Hex `0xC1C3C9` matches the 256² `steelAlbedo` pixel average
 * (~192.53 / 194.53 / 200.53). Formula midtone is the same hex.
 */
export const L3_LOD0_STEEL_COLOR = 0xc1c3c9;

function materialMaps(albedo, orm, normal, normalScale) {
  return { albedo, orm, normal, normalScale };
}

/** Build once; reuse across toolbox instances. */
export function getCrateL2Maps() {
  if (cached) return cached;
  const s = L2_TEXTURE_SIZE;
  // v0.26 added dedicated 256² wood/brass albedos for LOD1/LOD2.
  // v0.29 dropped the LOD2 map; v0.30 drops LOD1 maps too — do not
  // allocate unused woodLod / brassLod canvases. v0.31 generates the
  // LOD0 albedo + ORM + normal canvases at 256² (was 512²). v0.32
  // drops the three LOD0 normal canvases (wood / brass / steel).
  // v0.33 drops the three LOD0 ORM canvases — albedo only.
  // v0.34 kept those three albedo canvases on MeshBasic.
  // v0.35 drops the three LOD0 albedo canvases (color-only MeshBasic
  // on LOD0/1/2 — no remaining procedural albedo canvases).
  cached = {
    size: s,
    lodAlbedoSize: 0,
    uniqueTextures: 0,
    wood: materialMaps(null, null, null, L2_NORMAL_SCALE.wood),
    brass: materialMaps(null, null, null, L2_NORMAL_SCALE.brass),
    steel: materialMaps(null, null, null, L2_NORMAL_SCALE.steel),
  };
  return cached;
}

/**
 * Shared MeshStandardMaterial. Historical helper — v0.33 was the last
 * procedural LOD0 MeshStandard (albedo-only, `{ normalMap: false,
 * ormMap: false }`, 256² albedo, constant wood / brass / steel
 * ORM-midtone roughness/metalness). Pass `{ normalScaleMul }` to keep a
 * bound map at reduced slope (v0.14 mid-LOD historical). Pass
 * `{ normalMap: false }` so the fragment shader skips tangent-space
 * sampling (same albedo + ORM unless `{ ormMap: false }`). Pass
 * `{ ormMap: false }` to skip packed ORM (`roughnessMap` /
 * `metalnessMap`) and use constant roughness/metalness so the material
 * stays lit under the present-path ambient fill. Defaults to wood-ORM
 * midtones (`L3_LOD2_WOOD_*` / `L3_LOD1_WOOD_*`); pass `roughness` /
 * `metalness` for another class (v0.33 LOD0 brass used `L3_LOD1_BRASS_*`;
 * v0.33 LOD0 steel used `L3_LOD0_STEEL_*`). Historical LOD1 MeshStandard
 * path used `{ normalMap: false, ormMap: false }` (albedo-only) at
 * `L3_LOD_ALBEDO_SIZE` (256²). Procedural LOD0 (v0.35), LOD1 (v0.30),
 * and LOD2 far wood (v0.29) are `mappedBasic` color-only (`{ map: false }`).
 */
export function mappedStandard(colorHex, maps, opts = {}) {
  const useNormal = opts.normalMap !== false && Boolean(maps.normal);
  const useOrm = opts.ormMap !== false && Boolean(maps.orm);
  const spec = {
    color: colorHex,
    map: maps.albedo,
    roughness: useOrm ? 1 : (opts.roughness ?? L3_LOD2_WOOD_ROUGHNESS),
    metalness: useOrm ? 1 : (opts.metalness ?? L3_LOD2_WOOD_METALNESS),
  };
  if (useOrm) {
    spec.roughnessMap = maps.orm;
    spec.metalnessMap = maps.orm;
  }
  if (useNormal) {
    const [nx, ny] = maps.normalScale ?? [0.5, 0.5];
    const mul = opts.normalScaleMul ?? 1;
    spec.normalMap = maps.normal;
    spec.normalScale = new THREE.Vector2(nx * mul, ny * mul);
  }
  return new THREE.MeshStandardMaterial(spec);
}

/**
 * Unlit card-like material. LOD0 hero meshes (v0.35), LOD1 body /
 * lid / latch / tool stub (v0.30), and LOD2 body + lid (v0.29) are
 * color-only: pass `{ map: false }` (or omit `maps`) so the fragment
 * skips a baseColor sample. Historical mapped-albedo MeshBasic
 * (v0.27/v0.28/v0.34) still binds `maps.albedo` when `opts.map` is
 * not false. Roughness / metalness / normalMap / ORM do not apply
 * to MeshBasic.
 */
export function mappedBasic(colorHex, maps, opts = {}) {
  const spec = { color: colorHex };
  if (opts.map !== false && maps?.albedo) {
    spec.map = maps.albedo;
  }
  return new THREE.MeshBasicMaterial(spec);
}

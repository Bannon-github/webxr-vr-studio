import * as THREE from "three";

/** Shared L2 stand-in maps. 512², mipmapped. Not photoreal desktop 4K. */
export const L2_TEXTURE_SIZE = 512;

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

function materialMaps(albedo, orm, normal, normalScale) {
  return { albedo, orm, normal, normalScale };
}

/** Build once; reuse across toolbox instances. */
export function getCrateL2Maps() {
  if (cached) return cached;
  const s = L2_TEXTURE_SIZE;
  const woodAlb = texFromCanvas(woodAlbedo(s), true, 2, 2);
  const woodOrmTex = texFromCanvas(woodOrm(s), false, 2, 2);
  const woodNrm = texFromCanvas(normalCanvas(s, woodHeight, L2_NORMAL_STRENGTH.wood), false, 2, 2);
  const brassAlb = texFromCanvas(brassAlbedo(s), true, 1, 1);
  const brassOrmTex = texFromCanvas(brassOrm(s), false, 1, 1);
  const brassNrm = texFromCanvas(normalCanvas(s, brassHeight, L2_NORMAL_STRENGTH.brass), false, 1, 1);
  const steelAlb = texFromCanvas(steelAlbedo(s), true, 2, 4);
  const steelOrmTex = texFromCanvas(steelOrm(s), false, 2, 4);
  const steelNrm = texFromCanvas(normalCanvas(s, steelHeight, L2_NORMAL_STRENGTH.steel), false, 2, 4);
  cached = {
    size: s,
    uniqueTextures: 9,
    wood: materialMaps(woodAlb, woodOrmTex, woodNrm, L2_NORMAL_SCALE.wood),
    brass: materialMaps(brassAlb, brassOrmTex, brassNrm, L2_NORMAL_SCALE.brass),
    steel: materialMaps(steelAlb, steelOrmTex, steelNrm, L2_NORMAL_SCALE.steel),
  };
  return cached;
}

/**
 * Shared MeshStandardMaterial. LOD0 / LOD1 bind v0.12 normalMap.
 * Pass `{ normalMap: false }` for far LODs so the fragment shader skips
 * tangent-space sampling (same albedo + ORM, no extra texture bind).
 */
export function mappedStandard(colorHex, maps, opts = {}) {
  const useNormal = opts.normalMap !== false && Boolean(maps.normal);
  const spec = {
    color: colorHex,
    map: maps.albedo,
    roughness: 1,
    metalness: 1,
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
  };
  if (useNormal) {
    const [nx, ny] = maps.normalScale ?? [0.5, 0.5];
    spec.normalMap = maps.normal;
    spec.normalScale = new THREE.Vector2(nx, ny);
  }
  return new THREE.MeshStandardMaterial(spec);
}

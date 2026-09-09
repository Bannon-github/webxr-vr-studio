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

/** Build once; reuse across toolbox instances. */
export function getCrateL2Maps() {
  if (cached) return cached;
  const s = L2_TEXTURE_SIZE;
  const woodAlb = texFromCanvas(woodAlbedo(s), true, 2, 2);
  const woodOrmTex = texFromCanvas(woodOrm(s), false, 2, 2);
  const brassAlb = texFromCanvas(brassAlbedo(s), true, 1, 1);
  const brassOrmTex = texFromCanvas(brassOrm(s), false, 1, 1);
  const steelAlb = texFromCanvas(steelAlbedo(s), true, 2, 4);
  const steelOrmTex = texFromCanvas(steelOrm(s), false, 2, 4);
  cached = {
    size: s,
    uniqueTextures: 6,
    wood: { albedo: woodAlb, orm: woodOrmTex },
    brass: { albedo: brassAlb, orm: brassOrmTex },
    steel: { albedo: steelAlb, orm: steelOrmTex },
  };
  return cached;
}

export function mappedStandard(colorHex, maps) {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    map: maps.albedo,
    roughness: 1,
    metalness: 1,
    roughnessMap: maps.orm,
    metalnessMap: maps.orm,
  });
}

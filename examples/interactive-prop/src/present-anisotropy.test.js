import assert from "node:assert/strict";
import { test } from "node:test";
import { CanvasTexture, MeshStandardMaterial, Texture } from "three";
import {
  PRESENT_ANISOTROPY_MAP_KEYS,
  QUEST3_XR_TEXTURE_ANISOTROPY,
  applyPresentAnisotropy,
  collectTexturesFromMaterials,
  collectTexturesFromObject,
  normalizeAnisotropy,
  readTextureAnisotropy,
  resolveQuest3PresentAnisotropy,
  restorePresentAnisotropy,
} from "./present-anisotropy.js";

function fakeTexture(anisotropy = 8) {
  return { anisotropy };
}

function fakeMaterial(maps = {}) {
  return { ...maps };
}

function fakeMesh(material, children = []) {
  return { material, children };
}

function fakeRoot(children) {
  return { children };
}

test("QUEST3_XR_TEXTURE_ANISOTROPY is 1", () => {
  assert.equal(QUEST3_XR_TEXTURE_ANISOTROPY, 1);
});

test("resolveQuest3PresentAnisotropy always returns 1", () => {
  assert.equal(resolveQuest3PresentAnisotropy(), 1);
  assert.equal(resolveQuest3PresentAnisotropy(16), 1);
  assert.equal(resolveQuest3PresentAnisotropy(8), 1);
  assert.equal(resolveQuest3PresentAnisotropy(undefined), 1);
});

test("Three r170 Texture default anisotropy is 1, not GPU max", () => {
  const tex = new Texture();
  assert.equal(tex.anisotropy, 1);
  assert.equal(new CanvasTexture(undefined).anisotropy, 1);
});

test("lookdev may request GPU-max anisotropy (16) on a Texture", () => {
  const tex = new Texture();
  tex.anisotropy = 16;
  assert.equal(tex.anisotropy, 16);
});

test("normalizeAnisotropy accepts finite values >= 1", () => {
  assert.equal(normalizeAnisotropy(1), 1);
  assert.equal(normalizeAnisotropy(8), 8);
  assert.equal(normalizeAnisotropy(16), 16);
  assert.equal(normalizeAnisotropy(0), null);
  assert.equal(normalizeAnisotropy(-2), null);
  assert.equal(normalizeAnisotropy(Number.NaN), null);
  assert.equal(normalizeAnisotropy("8"), null);
  assert.equal(normalizeAnisotropy(undefined), null);
});

test("readTextureAnisotropy uses texture.anisotropy when valid", () => {
  assert.equal(readTextureAnisotropy(fakeTexture(8)), 8);
  assert.equal(readTextureAnisotropy(fakeTexture(1)), 1);
  assert.equal(readTextureAnisotropy(null), 1);
  assert.equal(readTextureAnisotropy({}), 1);
  assert.equal(readTextureAnisotropy({ anisotropy: 0 }), 1);
  assert.equal(readTextureAnisotropy({ anisotropy: Number.NaN }), 1);
});

test("PRESENT_ANISOTROPY_MAP_KEYS includes crate-toolbox + packaged GLB slots", () => {
  for (const key of [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "aoMap",
    "emissiveMap",
  ]) {
    assert.ok(PRESENT_ANISOTROPY_MAP_KEYS.includes(key), key);
  }
});

test("collectTexturesFromMaterials walks map / normal / ORM and dedupes ORM", () => {
  const albedo = fakeTexture(4);
  const orm = fakeTexture(8);
  const normal = fakeTexture(16);
  const found = collectTexturesFromMaterials(
    fakeMaterial({
      map: albedo,
      normalMap: normal,
      roughnessMap: orm,
      metalnessMap: orm,
    })
  );
  assert.equal(found.length, 3);
  assert.ok(found.includes(albedo));
  assert.ok(found.includes(orm));
  assert.ok(found.includes(normal));
});

test("collectTexturesFromObject walks children and multi-materials", () => {
  const albedo = fakeTexture(4);
  const orm = fakeTexture(8);
  const extra = fakeTexture(2);
  const root = fakeRoot([
    fakeMesh(
      fakeMaterial({
        map: albedo,
        roughnessMap: orm,
        metalnessMap: orm,
      })
    ),
    fakeMesh([fakeMaterial({ map: albedo }), fakeMaterial({ emissiveMap: extra })]),
    fakeMesh(fakeMaterial({ color: 0x4a3424 })),
  ]);
  const found = collectTexturesFromObject(root);
  assert.equal(found.length, 3);
  assert.ok(found.includes(albedo));
  assert.ok(found.includes(orm));
  assert.ok(found.includes(extra));
});

test("collectTexturesFromObject uses traverse when present", () => {
  const tex = fakeTexture(16);
  const mesh = fakeMesh(fakeMaterial({ map: tex }));
  const root = {
    traverse(visit) {
      visit(this);
      visit(mesh);
    },
  };
  const found = collectTexturesFromObject(root);
  assert.deepEqual(found, [tex]);
});

test("applyPresentAnisotropy presenting saves per-texture anisotropy and sets 1", () => {
  const a = fakeTexture(16);
  const b = fakeTexture(8);
  const result = applyPresentAnisotropy({ presenting: true, textures: [a, b, a] });
  assert.equal(result.presenting, true);
  assert.equal(result.anisotropy, 1);
  assert.equal(result.count, 2);
  assert.equal(a.anisotropy, 1);
  assert.equal(b.anisotropy, 1);
  assert.equal(result.handle.entries[0].savedAnisotropy, 16);
  assert.equal(result.handle.entries[1].savedAnisotropy, 8);
  assert.equal(result.handle.entries[0].texture, a);
  assert.equal(result.handle.entries[1].texture, b);
});

test("applyPresentAnisotropy presenting walks a root when textures are omitted", () => {
  const tex = fakeTexture(16);
  const root = fakeRoot([fakeMesh(fakeMaterial({ map: tex, normalMap: tex }))]);
  const result = applyPresentAnisotropy({ presenting: true, root });
  assert.equal(result.count, 1);
  assert.equal(tex.anisotropy, 1);
  assert.equal(result.handle.entries[0].savedAnisotropy, 16);
});

test("applyPresentAnisotropy presenting unions roots and dedupes", () => {
  const shared = fakeTexture(8);
  const onlyScene = fakeTexture(4);
  const toolbox = fakeRoot([fakeMesh(fakeMaterial({ map: shared }))]);
  const scene = fakeRoot([
    toolbox,
    fakeMesh(fakeMaterial({ map: onlyScene })),
  ]);
  const result = applyPresentAnisotropy({ presenting: true, roots: [toolbox, scene] });
  assert.equal(result.count, 2);
  assert.equal(shared.anisotropy, 1);
  assert.equal(onlyScene.anisotropy, 1);
});

test("applyPresentAnisotropy presenting keeps handle-saved values on re-apply", () => {
  const tex = fakeTexture(16);
  const first = applyPresentAnisotropy({ presenting: true, textures: [tex] });
  assert.equal(first.handle.entries[0].savedAnisotropy, 16);
  assert.equal(tex.anisotropy, 1);
  const second = applyPresentAnisotropy({
    presenting: true,
    textures: [tex],
    handle: first.handle,
  });
  assert.equal(second.handle.entries[0].savedAnisotropy, 16);
  assert.equal(tex.anisotropy, 1);
});

test("restorePresentAnisotropy writes saved lookdev values back", () => {
  const a = fakeTexture(1);
  const b = fakeTexture(1);
  const handle = {
    anisotropy: 1,
    entries: [
      { texture: a, savedAnisotropy: 16 },
      { texture: b, savedAnisotropy: 8 },
    ],
  };
  const result = restorePresentAnisotropy(handle);
  assert.equal(result.presenting, false);
  assert.equal(result.count, 2);
  assert.equal(a.anisotropy, 16);
  assert.equal(b.anisotropy, 8);
});

test("applyPresentAnisotropy presenting false restores via the same helper", () => {
  const tex = fakeTexture(16);
  const start = applyPresentAnisotropy({ presenting: true, textures: [tex] });
  const end = applyPresentAnisotropy({ presenting: false, handle: start.handle });
  assert.equal(end.presenting, false);
  assert.equal(tex.anisotropy, 16);
});

test("restorePresentAnisotropy is a no-op without a handle", () => {
  assert.deepEqual(restorePresentAnisotropy(null), {
    presenting: false,
    handle: { entries: [], anisotropy: 1 },
    anisotropy: 1,
    count: 0,
  });
});

test("helpers do not throw without textures or a root", () => {
  assert.deepEqual(applyPresentAnisotropy({ presenting: true }), {
    presenting: true,
    handle: { entries: [], anisotropy: 1 },
    anisotropy: 1,
    count: 0,
  });
  assert.deepEqual(applyPresentAnisotropy({ presenting: false }), {
    presenting: false,
    handle: { entries: [], anisotropy: 1 },
    anisotropy: 1,
    count: 0,
  });
});

test("sessionstart then sessionend restores lookdev anisotropy on Three textures", () => {
  const albedo = new Texture();
  const orm = new Texture();
  const normal = new Texture();
  albedo.anisotropy = 16;
  orm.anisotropy = 8;
  normal.anisotropy = 4;
  const mat = new MeshStandardMaterial({
    map: albedo,
    roughnessMap: orm,
    metalnessMap: orm,
    normalMap: normal,
  });
  const root = fakeRoot([fakeMesh(mat)]);
  const start = applyPresentAnisotropy({ presenting: true, root });
  assert.equal(start.count, 3);
  assert.equal(albedo.anisotropy, 1);
  assert.equal(orm.anisotropy, 1);
  assert.equal(normal.anisotropy, 1);
  applyPresentAnisotropy({ presenting: false, handle: start.handle });
  assert.equal(albedo.anisotropy, 16);
  assert.equal(orm.anisotropy, 8);
  assert.equal(normal.anisotropy, 4);
});

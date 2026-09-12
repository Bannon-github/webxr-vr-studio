import * as THREE from "three";
import behaviorTemplate from "./behavior.json" with { type: "json" };
import {
  getCrateL2Maps,
  L3_LOD1_NORMAL_SCALE_MUL,
  L3_LOD2_WOOD_METALNESS,
  L3_LOD2_WOOD_ROUGHNESS,
  mappedStandard,
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

function countGroupStats(group) {
  let tris = 0;
  let draws = 0;
  group.traverse((o) => {
    if (!o.isMesh || o.userData.collider) return;
    const geo = o.geometry;
    if (!geo) return;
    const idx = geo.index;
    const pos = geo.getAttribute("position");
    if (idx) tris += idx.count / 3;
    else if (pos) tris += pos.count / 3;
    draws += 1;
  });
  return { tris, draws };
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
  // LOD0 keeps the five v0.12 materials (512² albedo+ORM+normal, full scale).
  const wood = mappedStandard(0xffffff, l2.wood);
  const woodDark = mappedStandard(0x7a5840, l2.wood);
  const brass = mappedStandard(0xffffff, l2.brass);
  const steel = mappedStandard(0xffffff, l2.steel);
  const handleMat = mappedStandard(0xe8b42a, l2.wood);
  // LOD1 mid crate: same canvases, half normalScale (no extra draws/textures).
  const mid = { normalScaleMul: L3_LOD1_NORMAL_SCALE_MUL };
  const woodMid = mappedStandard(0xffffff, l2.wood, mid);
  const woodDarkMid = mappedStandard(0x7a5840, l2.wood, mid);
  const brassMid = mappedStandard(0xffffff, l2.brass, mid);
  const handleMatMid = mappedStandard(0xe8b42a, l2.wood, mid);
  // LOD2 far crate + lid: albedo-only (no normalMap, no ORM). Constant
  // wood-ORM-midtone roughness/metalness keeps MeshStandardMaterial lit.
  const far = { normalMap: false, ormMap: false };
  const woodFar = mappedStandard(0xffffff, l2.wood, far);

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
  const fastener = boxMesh(0.028, 0.028, 0.02, brass, -0.12, 0.07, 0.131);
  fastener.name = "fastenerMesh";
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
    uniqueTextures: l2.uniqueTextures,
    maps: "albedo+ORM+normal",
    lodNormalMaps: { 0: true, 1: true, 2: false },
    lodOrmMaps: { 0: true, 1: true, 2: false },
    lodNormalScaleMul: { 0: 1, 1: L3_LOD1_NORMAL_SCALE_MUL, 2: 0 },
    lod2Constants: { roughness: L3_LOD2_WOOD_ROUGHNESS, metalness: L3_LOD2_WOOD_METALNESS },
    note: "procedural canvas stand-in; LOD1 half normalScale; LOD2 albedo-only (no normalMap, no ORM)",
  };
  root.userData.materials = {
    lod0: { wood, woodDark, brass, steel, handleMat },
    lod1: { wood: woodMid, woodDark: woodDarkMid, brass: brassMid, handleMat: handleMatMid },
    lod2: { wood: woodFar },
  };
  root.userData.packaging = {
    source: "procedural-canvas",
    probedUrl: studio.source?.packagedUrl ?? "/packaged/crate-toolbox.glb",
    found: false,
  };
  root.userData.lod = {
    current: 0,
    mode: "auto",
    distances: { lod1: 2.4, lod2: 4.5, hysteresis: 0.2 },
    groups: {
      0: [bodyL0, lidL0, latchL0, toolL0],
      1: [bodyL1, lidL1, latchL1, toolL1],
      2: [bodyL2, lidL2, latchL2, toolL2],
    },
    stats: {
      0: mergeStats([bodyL0, lidL0, latchL0, toolL0]),
      1: mergeStats([bodyL1, lidL1, latchL1, toolL1]),
      2: mergeStats([bodyL2, lidL2, latchL2, toolL2]),
    },
  };

  applyActivityVisual(root, 1);
  setToolboxLod(root, 0);

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

function mergeStats(groups) {
  return groups.reduce(
    (acc, g) => {
      const s = countGroupStats(g);
      acc.tris += s.tris;
      acc.draws += s.draws;
      return acc;
    },
    { tris: 0, draws: 0 }
  );
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

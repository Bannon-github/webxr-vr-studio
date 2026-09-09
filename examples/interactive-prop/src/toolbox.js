import * as THREE from "three";
import behaviorTemplate from "./behavior.json";

/**
 * Procedural crate that follows ADR 0004: visual meshes, collider_* hulls,
 * and extras.studio-equivalent metadata on userData.studio.
 * Production swaps this for a GLB + sidecar; the component split stays.
 */

const WOOD = { color: 0x6b4226, roughness: 0.88, metalness: 0.02 };
const WOOD_DARK = { color: 0x3d2616, roughness: 0.92, metalness: 0.02 };
const BRASS = { color: 0xb08a3e, roughness: 0.38, metalness: 0.85 };
const STEEL = { color: 0x8a9199, roughness: 0.32, metalness: 0.9 };
const HANDLE = { color: 0x2a241c, roughness: 0.7, metalness: 0.08 };

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

function makeCollider(name, w, h, d, x, y, z) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x5dffb0,
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
  return mesh;
}

export function createToolbox() {
  const studio = structuredClone(behaviorTemplate);
  studio.components.activity.current = studio.components.activity.initial;

  const root = new THREE.Group();
  root.name = "toolbox";
  root.userData.studio = studio;
  root.userData.kind = "entity";

  const wood = std(WOOD);
  const woodDark = std(WOOD_DARK);
  const brass = std(BRASS);
  const steel = std(STEEL);
  const handleMat = std(HANDLE);

  const body = new THREE.Group();
  body.name = "body";
  // Outer shell + visible plank cuts (still cheap; one material reused).
  body.add(boxMesh(0.36, 0.16, 0.24, wood, 0, 0.08, 0));
  body.add(boxMesh(0.34, 0.02, 0.22, woodDark, 0, 0.015, 0));
  body.add(boxMesh(0.355, 0.012, 0.03, woodDark, 0, 0.155, -0.04));
  body.add(boxMesh(0.355, 0.012, 0.03, woodDark, 0, 0.155, 0.05));
  root.add(body);

  const lidPivot = new THREE.Group();
  lidPivot.name = "lid";
  lidPivot.position.set(0, 0.16, -0.12);
  const lid = boxMesh(0.36, 0.025, 0.24, wood, 0, 0.012, 0.12);
  lid.name = "lidMesh";
  lidPivot.add(lid);
  lidPivot.add(boxMesh(0.12, 0.02, 0.04, brass, 0, 0.028, 0.22));
  root.add(lidPivot);

  const latchPivot = new THREE.Group();
  latchPivot.name = "latch";
  latchPivot.position.set(0, 0.1, 0.125);
  const latch = boxMesh(0.04, 0.07, 0.012, brass, 0, 0, 0);
  latch.name = "latchMesh";
  latchPivot.add(latch);
  root.add(latchPivot);

  const tool = new THREE.Group();
  tool.name = "tool";
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 12), steel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0.02, 0, 0);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.07, 12), handleMat);
  grip.rotation.z = Math.PI / 2;
  grip.position.set(-0.07, 0, 0);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.012), steel);
  tip.position.set(0.105, 0, 0);
  tool.add(shaft, grip, tip);
  tool.position.set(0, 0.06, 0);
  tool.userData.restLocal = tool.position.clone();
  root.add(tool);

  const colliderGrab = makeCollider("collider_grab", 0.38, 0.15, 0.24, 0, 0.075, 0);
  const colliderLatch = makeCollider("collider_latch", 0.08, 0.1, 0.06, 0, 0.1, 0.15);
  const colliderLid = makeCollider("collider_lid", 0.38, 0.06, 0.26, 0, 0.012, 0.12);
  const colliderTool = makeCollider("collider_tool", 0.2, 0.04, 0.04, 0, 0, 0);
  colliderGrab.userData.layer = "grab";
  colliderLatch.userData.layer = "use";
  colliderLid.userData.layer = "use";
  colliderTool.userData.layer = "grab";
  colliderTool.userData.part = "tool";
  // Hulls live with the part they represent; they are never the render mesh.
  root.add(colliderGrab, colliderLatch);
  lidPivot.add(colliderLid);
  tool.add(colliderTool);

  const highlightables = {
    body,
    lid: lidPivot,
    latch: latchPivot,
    tool,
  };

  root.userData.parts = { body, lidPivot, latchPivot, tool };
  root.userData.highlightables = highlightables;
  root.userData.colliders = [colliderGrab, colliderLatch, colliderLid, colliderTool];

  applyActivityVisual(root, 1);

  return root;
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

  const toolCollider = entity.userData.colliders?.find((c) => c.name === "collider_tool");
  if (toolCollider) {
    // Hidden contents must not receive rays (interactive-objects.md).
    // Once the tool is taken out, it stays pickable even if the crate is closed.
    const nested = tool.parent === entity;
    toolCollider.userData.pickable = state === "open" || !nested;
  }
  if (tool) tool.visible = state === "open" || tool.parent !== entity;
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
  tool.userData.velocity = new THREE.Vector3();
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

export function updateStatePlaque(plaque, state) {
  const { ctx, canvas, tex } = plaque.userData;
  ctx.fillStyle = "#121820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3a4660";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = "#8aa0c0";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("ACTIVITY", 28, 52);
  ctx.fillStyle = "#e8ecf5";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.fillText(String(state).toUpperCase(), 28, 118);
  tex.needsUpdate = true;
}

import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";

/**
 * Minimal immersive-vr demo:
 * - navigator.xr gated via Three WebXRManager / VRButton
 * - local-floor when available (Three requests sensible defaults)
 * - controllers with rays; select recolors the hit cube
 * APIs used match MDN WebXR + Three.js helpers (no invented methods).
 */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10141c);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Lights
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x2a1e14, 1.1));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(2, 4, 1);
scene.add(dir);

// Floor grid (visual stand-in for local-floor)
const grid = new THREE.GridHelper(12, 24, 0x3a4660, 0x222833);
scene.add(grid);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.95, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

// Interactable cubes
const cubes = [];
const cubeMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x4f8cff, roughness: 0.35, metalness: 0.15 });
for (let i = 0; i < 5; i++) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), cubeMat());
  const angle = (i / 5) * Math.PI * 2;
  mesh.position.set(Math.cos(angle) * 1.4, 1.15, Math.sin(angle) * 1.4 - 0.5);
  mesh.userData.baseColor = mesh.material.color.getHex();
  scene.add(mesh);
  cubes.push(mesh);
}

const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffe08a })
);
marker.visible = false;
scene.add(marker);

// Controllers
const controllerModelFactory = new XRControllerModelFactory();
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

function setupController(index) {
  const controller = renderer.xr.getController(index);
  controller.addEventListener("selectstart", () => onSelect(controller, true));
  controller.addEventListener("selectend", () => onSelect(controller, false));
  controller.addEventListener("connected", (event) => {
    controller.add(buildRayLine(event.data?.targetRayMode));
  });
  controller.addEventListener("disconnected", () => {
    controller.clear();
  });
  scene.add(controller);

  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerModelFactory.createControllerModel(grip));
  scene.add(grip);
  return controller;
}

function buildRayLine() {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9ad1ff }));
  line.name = "ray";
  line.scale.z = 2;
  return line;
}

const controllers = [setupController(0), setupController(1)];

function onSelect(controller, pressed) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  const hits = raycaster.intersectObjects(cubes, false);
  if (hits.length) {
    const cube = hits[0].object;
    cube.material.color.setHex(pressed ? 0xff7a59 : 0x5dffb0);
    marker.position.copy(hits[0].point);
    marker.visible = true;
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  for (let i = 0; i < cubes.length; i++) {
    cubes[i].rotation.y = t * 0.6 + i;
    cubes[i].position.y = 1.15 + Math.sin(t * 1.5 + i) * 0.05;
  }
  // Hover highlight via continuous ray when in XR
  if (renderer.xr.isPresenting) {
    for (const controller of controllers) {
      tempMatrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      const hits = raycaster.intersectObjects(cubes, false);
      const ray = controller.getObjectByName("ray");
      if (ray) ray.scale.z = hits.length ? hits[0].distance : 2;
    }
  }
  renderer.render(scene, camera);
});

// Helpful console signal for emulator / headset debugging
if (navigator.xr) {
  navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
    console.info("[webxr-starter] immersive-vr supported:", ok);
  });
} else {
  console.warn("[webxr-starter] navigator.xr missing — use a WebXR browser or emulator");
}

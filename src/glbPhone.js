import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { roundedPlane } from './phone.js';

// "iPhone 14 Pro" by mister dude (https://sketchfab.com/misterdude), CC BY 4.0.
// https://sketchfab.com/3d-models/iphone-14-pro-5cb0778041a34f09b409a38c687bb1d4
const MODEL_URL = `${import.meta.env.BASE_URL}models/iphone-14-pro.glb`;

// Measurements of the model in its own mesh units (front glass faces -z).
const M = {
  height: 35.893, // body height
  centerZ: 0.009, // midway between front (-0.889) and back (0.907) glass
  frontZ: -0.889,
  screen: { width: 16.13, height: 34.77, centerY: 0.0084, radius: 2.19 },
  glass: { width: 17.13, height: 35.73, radius: 2.7 },
};
const REAL_HEIGHT = 1.475; // 147.5 mm, in scene units (1 unit = 100 mm)

// The model's own texture is Space Black; other finishes tint it (values > 1 brighten the grey texture).
const COLORS = {
  spaceBlack: { name: 'Space Black', tint: [1, 1, 1] },
  silver: { name: 'Silver', tint: [7, 7, 7] },
  gold: { name: 'Gold', tint: [6.5, 5.2, 3.4] },
  deepPurple: { name: 'Deep Purple', tint: [2.4, 1.9, 2.7] },
};

let gltfPromise = null;
function loadModel() {
  gltfPromise ??= new GLTFLoader().loadAsync(MODEL_URL);
  return gltfPromise;
}

export async function createGlbPhone() {
  const gltf = await loadModel();
  let source = null;
  gltf.scene.traverse((o) => { if (o.isMesh && !source) source = o; });

  const s = REAL_HEIGHT / M.height;
  const group = new THREE.Group();
  // Turn the model so the screen faces +z and centre it on the origin.
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI;
  inner.scale.setScalar(s);
  inner.position.z = M.centerZ * s;
  group.add(inner);

  const material = source.material.clone();
  material.depthWrite = true;
  const body = new THREE.Mesh(source.geometry, material);
  body.castShadow = true;
  inner.add(body);

  // Screen, island and glare are drawn over the model's own screen, in scene units.
  const frontZ = (-M.frontZ + M.centerZ) * s;
  const sw = M.screen.width * s;
  const sh = M.screen.height * s;

  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(roundedPlane(sw, sh, M.screen.radius * s), screenMat);
  screen.position.set(0, M.screen.centerY * s, frontZ + 0.0004);
  group.add(screen);

  const island = new THREE.Mesh(roundedPlane(sw * 0.19, sh * 0.026, sh * 0.013), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, screen.position.y + sh / 2 - sh * 0.0384, frontZ + 0.0008);
  group.add(island);

  const reflectMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.03,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const reflection = new THREE.Mesh(roundedPlane(M.glass.width * s, M.glass.height * s, M.glass.radius * s), reflectMat);
  reflection.position.z = frontZ + 0.0012;
  group.add(reflection);

  return {
    group,
    screenMat,
    island,
    reflection,
    size: { width: M.glass.width * s, height: REAL_HEIGHT },
    screenAspect: sw / sh,
    colors: Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.name])),
    setColor(name) {
      material.color.setRGB(...COLORS[name].tint);
    },
  };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Phone models the user loads from their own .glb files. Files are kept only in this browser
// (IndexedDB), never uploaded, so licensed models can be used without publishing them.
//
// The model is expected to face +z with y up (glTF convention). Its screen is found by material
// name ("screen" or "display"), or failing that by an emissive texture. A model with an animation
// (such as a foldable opening and closing) is offered in its first and last poses.

const DB_NAME = 'iphone-mockups';
const STORE = 'models';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const storedModels = () => withStore('readonly', (s) => s.getAll()).catch(() => []);
export const storeModel = (name, data) => withStore('readwrite', (s) => s.add({ name, data }));
export const deleteStoredModel = (id) => withStore('readwrite', (s) => s.delete(id)).catch(() => {});

const isScreen = (m) => /screen|display/i.test(m.name) || (m.emissiveMap && /screen|display|lcd/i.test(m.name || ''));

// Colour families, matched against the model's title or file name. [name, frame, back] as in models.js.
const PALETTES = [
  [/duo|fold/i, {
    nightSky: ['Night Sky', 0x2a3243, 0x262e3e],
    starWhite: ['Star White', 0xdcdcd8, 0xefeee9],
  }],
  [/air/i, {
    spaceBlack: ['Space Black', 0x2c2c2e, 0x2f2f32],
    cloudWhite: ['Cloud White', 0xe4e3df, 0xf4f4f2],
    lightGold: ['Light Gold', 0xdcc8a4, 0xe6d6b8],
    skyBlue: ['Sky Blue', 0xb5c9dd, 0xc0d3e6],
  }],
  [/./, {
    black: ['Black', 0x2b2b2d, 0x2e2e31],
    silver: ['Silver', 0xd6d7d8, 0xe2e3e4],
    glacier: ['Glacier', 0xbfcfdb, 0xcad8e3],
    burgundy: ['Burgundy', 0x5a1f2b, 0x652633],
    cosmicOrange: ['Cosmic Orange', 0xe0672e, 0xdc6a30],
    deepBlue: ['Deep Blue', 0x2f3b55, 0x35425f],
  }],
];

const luminance = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

// Parse a .glb and work out the variants it offers: one per pose, each with its own front screen.
export async function parseModel(data, fileName) {
  const gltf = await new GLTFLoader().parseAsync(data.slice(0), '');
  const title = gltf.asset?.extras?.title || fileName.replace(/\.glb$/i, '').replace(/[_-]+/g, ' ');
  const clip = gltf.animations[0];
  const measure = (time) => {
    const root = pose(cloneScene(gltf.scene), clip, time);
    const box = new THREE.Box3().setFromObject(root, true);
    return { time, width: box.max.x - box.min.x, screen: frontScreen(root) };
  };
  let variants = [measure(null)];
  if (clip) {
    // A foldable's animation may run open → closed → open, so find its narrowest and widest poses.
    const poses = Array.from({ length: 13 }, (_, i) => measure((clip.duration * i) / 12)).filter((v) => v.screen);
    const closed = poses.reduce((a, b) => (b.width < a.width ? b : a), poses[0]);
    const open = poses.reduce((a, b) => (b.width > a.width ? b : a), poses[0]);
    if (closed && open.width > closed.width * 1.3) variants = [{ ...closed, label: 'closed' }, { ...open, label: 'open' }];
  }
  variants = variants.filter((v) => v.screen);
  if (!variants.length) throw new Error('No screen found. The screen material needs "screen" in its name.');
  const colors = PALETTES.find(([re]) => re.test(title))[1];
  return { title, gltf, clip, colors, variants };
}

function pose(root, clip, time) {
  if (clip && time !== null) {
    const mixer = new THREE.AnimationMixer(root);
    mixer.clipAction(clip).play();
    mixer.setTime(Math.min(time, clip.duration - 1e-4));
  }
  root.updateMatrixWorld(true);
  return root;
}

// The screen facing the camera (+z) with the largest area. Measured from the posed triangles, so a
// folded (skinned) screen, whose halves face opposite ways, doesn't count.
function frontScreen(root) {
  let best = null;
  let bestArea = 0;
  const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const cross = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || !isScreen(o.material)) return;
    const { index, attributes } = o.geometry;
    const count = index ? index.count : attributes.position.count;
    const vertex = (i, v) => o.getVertexPosition(index ? index.getX(i) : i, v).applyMatrix4(o.matrixWorld);
    let front = 0;
    let total = 0;
    for (let i = 0; i < count; i += 3) {
      vertex(i, a); vertex(i + 1, b); vertex(i + 2, c);
      cross.crossVectors(b.sub(a), c.sub(a));
      front += cross.z / 2;
      total += cross.length() / 2;
    }
    if (front > total * 0.6 && front > bestArea) { bestArea = front; best = o.name || o.uuid; }
  });
  return best;
}

// Build a phone object with the same interface as createPhone() in phone.js.
export function createCustomPhone(model, variant) {
  const root = pose(cloneScene(model.gltf.scene), model.clip, variant.time);

  // Own copies of the materials, so each phone can have its own colour.
  const materials = new Map();
  let screen = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!materials.has(o.material)) materials.set(o.material, o.material.clone());
    o.material = materials.get(o.material);
    // Models are often built from open surfaces (screen, glass, back panel), which the shadow map
    // skips when it draws back faces only, letting light through. Both sides block light.
    o.material.shadowSide = THREE.DoubleSide;
    o.castShadow = true;
    if ((o.name || o.uuid) === variant.screen && !screen) screen = o;
  });

  // Scale to scene units (1 unit = 100 mm), guessing the file's units from the phone's size, and centre it.
  const box = new THREE.Box3().setFromObject(root, true);
  const sizeV = box.getSize(new THREE.Vector3());
  const longest = Math.max(sizeV.x, sizeV.y);
  const metres = longest / 10 ** Math.round(Math.log10(longest / 0.15));
  const scale = (metres / longest) * 10;
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center.multiplyScalar(scale));
  root.scale.setScalar(scale);
  const group = new THREE.Group();
  group.add(root);

  // The screenshot goes on the screen with an unlit material, like the procedural phones. glTF
  // texture coordinates start at the top, so flip them for an ordinary (flipY) texture.
  const geometry = screen.geometry.clone();
  const uv = geometry.attributes.uv;
  if (uv) for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  screen.geometry = geometry;
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  screenMat.shadowSide = THREE.DoubleSide;
  screen.material = screenMat;

  // Glass reflection layer on the screen, as in phone.js.
  const reflection = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.03, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }));
  reflection.renderOrder = 1;
  screen.add(reflection);

  const screenBox = new THREE.Box3().setFromObject(screen, true);
  group.updateMatrixWorld(true);
  const outer = new THREE.Box3().setFromObject(group, true);

  // Recolour: materials named after the finish (COLOUR_Silver_…, C_StarWhite_…, C_SW_…) are the
  // coloured parts. Each keeps its brightness relative to the frame, so shading detail survives.
  const tinted = [...materials.values()].filter((m) => m !== screenMat && /^(colou?r|c)_/i.test(m.name) && m.color);
  const original = new Map(tinted.map((m) => [m, m.color.clone()]));
  const frameRef = tinted.find((m) => /side|frame|antenna/i.test(m.name) && !/back/i.test(m.name));
  const backRef = tinted.find((m) => /back/i.test(m.name));
  const colors = { original: 'Original', ...Object.fromEntries(Object.entries(model.colors).map(([k, v]) => [k, v[0]])) };

  return {
    group,
    screen,
    screenMat,
    island: new THREE.Group(), // the model has its own Dynamic Island / camera
    reflection,
    size: { width: outer.max.x - outer.min.x, height: outer.max.y - outer.min.y },
    screenAspect: (screenBox.max.x - screenBox.min.x) / (screenBox.max.y - screenBox.min.y),
    colors,
    setColor(name) {
      for (const m of tinted) {
        m.color.copy(original.get(m));
        if (name === 'original' || !model.colors[name]) continue;
        const [, frameHex, backHex] = model.colors[name];
        const isBack = /back/i.test(m.name) && !/inner/i.test(m.name);
        const ref = original.get(isBack ? backRef ?? m : frameRef ?? m);
        const target = new THREE.Color(isBack ? backHex : frameHex);
        // Same brightness ratio to the reference part as in the original finish.
        const k = luminance(ref) > 0 ? luminance(original.get(m)) / luminance(ref) : 1;
        m.color.copy(target).multiplyScalar(k);
      }
    },
  };
}

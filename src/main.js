import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPhone, placeholderCanvas, PHONE } from './phone.js';
import { createGlbPhone } from './glbPhone.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.blurSamples = 25;
key.shadow.bias = -0.0005;
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
scene.add(key);

// Surface the phone stands or lies on. It only shows the phone's shadow, so it works with transparent export too.
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial());
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// ---------- Render loop (on demand) ----------
let pending = false;
function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    renderer.render(scene, camera);
  });
}

let phone = createPhone();
scene.add(phone.group);

// ---------- Screen texture ----------
let screenTexture = null;
function setScreenImage(source) {
  if (screenTexture) screenTexture.dispose();
  screenTexture = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  screenTexture.needsUpdate = true;
  phone.screenMat.map = screenTexture;
  phone.screenMat.needsUpdate = true;
  applyFit();
}

function applyFit() {
  const t = screenTexture;
  if (!t) return;
  const img = t.image;
  t.repeat.set(1, 1);
  t.offset.set(0, 0);
  if ($('fit').value === 'cover') {
    const imgAspect = img.width / img.height;
    const screenAspect = phone.screenAspect;
    if (imgAspect > screenAspect) {
      t.repeat.x = screenAspect / imgAspect;
      t.offset.x = (1 - t.repeat.x) / 2;
    } else {
      t.repeat.y = imgAspect / screenAspect;
      t.offset.y = (1 - t.repeat.y) / 2;
    }
  }
  requestRender();
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    setScreenImage(img);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

setScreenImage(placeholderCanvas());

$('file').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('fit').addEventListener('change', applyFit);
$('island').addEventListener('change', (e) => {
  phone.island.visible = e.target.checked;
  requestRender();
});

// Drag & drop and paste.
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; stage.classList.add('dragging'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; stage.classList.remove('dragging'); } });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  stage.classList.remove('dragging');
  loadFile(e.dataTransfer.files[0]);
});
window.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
  if (item) loadFile(item.getAsFile());
});

// ---------- Rotation ----------
const axes = ['X', 'Y', 'Z'];
function updateRotation() {
  const [x, y, z] = axes.map((a) => +$(`rot${a}`).value);
  axes.forEach((a, i) => { $(`rot${a}Out`).textContent = `${Math.round([x, y, z][i])}°`; });
  phone.group.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z));
  updateSurface();
}
for (const a of axes) {
  const input = $(`rot${a}`);
  input.addEventListener('input', updateRotation);
  // Double-click the slider or its value to reset that axis.
  const reset = () => { input.value = 0; updateRotation(); };
  input.addEventListener('dblclick', reset);
  $(`rot${a}Out`).addEventListener('click', reset);
}
document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.dataset.preset.split(',').forEach((v, i) => { $(`rot${axes[i]}`).value = v; });
    updateRotation();
  });
});

// Drag the phone to rotate it: horizontal = Y, vertical = X, Shift + horizontal = Z.
const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  const speed = 0.4;
  const nudge = (axis, delta) => {
    const input = $(`rot${axis}`);
    input.value = wrap(+input.value + delta);
  };
  if (e.shiftKey) {
    nudge('Z', -dx * speed);
  } else {
    nudge('Y', dx * speed);
    nudge('X', dy * speed);
  }
  updateRotation();
});
const endDrag = () => { drag = null; canvas.classList.remove('dragging'); };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoom = $('zoom');
  zoom.value = Math.min(+zoom.max, Math.max(+zoom.min, +zoom.value - Math.sign(e.deltaY) * 5));
  zoom.dispatchEvent(new Event('input'));
}, { passive: false });

// ---------- Scene ----------
$('zoom').addEventListener('input', (e) => {
  $('zoomOut').textContent = `${e.target.value}%`;
  updateCamera();
});
$('frame').addEventListener('change', (e) => { phone.setColor(e.target.value); requestRender(); });

// ---------- Model ----------
function fillColorOptions() {
  $('frame').innerHTML = Object.entries(phone.colors)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

let modelRequest = 0;
async function setModel(kind) {
  const request = ++modelRequest;
  $('model').disabled = true;
  try {
    const next = kind === 'detailed' ? await createGlbPhone() : createPhone();
    if (request !== modelRequest) return;
    scene.remove(phone.group);
    next.group.rotation.copy(phone.group.rotation);
    phone = next;
    scene.add(phone.group);
    fillColorOptions();
    phone.setColor($('frame').value);
    phone.island.visible = $('island').checked;
    if (screenTexture) {
      phone.screenMat.map = screenTexture;
      phone.screenMat.needsUpdate = true;
      applyFit();
    }
    updateLight();
  } catch (err) {
    console.error(err);
    alert('Could not load the 3D model.');
  } finally {
    $('model').disabled = false;
  }
}
$('model').addEventListener('change', (e) => setModel(e.target.value));

function updateBackground() {
  const transparent = $('transparent').checked;
  stage.classList.toggle('transparent', transparent);
  renderer.setClearColor($('bg').value, transparent ? 0 : 1);
  stage.style.backgroundColor = transparent ? '' : $('bg').value;
  requestRender();
}
$('bg').addEventListener('input', updateBackground);
$('transparent').addEventListener('change', updateBackground);
updateBackground();

// ---------- Surface, light & shadow ----------
// Standing: the phone rests on a floor and the camera looks slightly down at it.
// Lying flat: the phone lies on a table and the camera looks down onto the table.
// Light direction and elevation are measured relative to that surface.
const MODES = {
  standing: {
    normal: new THREE.Vector3(0, 1, 0), side: new THREE.Vector3(1, 0, 0), forward: new THREE.Vector3(0, 0, 1),
    defaults: { lightAz: -40, lightEl: 40, camTilt: 20 },
  },
  flat: {
    normal: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), forward: new THREE.Vector3(0, 1, 0),
    defaults: { lightAz: -35, lightEl: 45, camTilt: 0 },
  },
};
const mode = () => document.querySelector('input[name="surface"]:checked').value;

const lightControls = {
  lightAz: (v) => `${v}°`,
  lightEl: (v) => `${v}°`,
  lightInt: (v) => `${v}%`,
  envInt: (v) => `${v}%`,
  exposure: (v) => `${v}%`,
  glare: (v) => `${v}%`,
  shadowOpacity: (v) => `${v}%`,
  shadowSoft: (v) => `${v}`,
  shadowDist: (v) => `${v} mm`,
};
const lightDefaults = Object.fromEntries(Object.keys(lightControls).map((id) => [id, $(id).value]));

// Keep the surface touching the phone's lowest point (plus the gap) whatever its rotation.
const box = new THREE.Box3();
function updateSurface() {
  phone.group.updateMatrixWorld(true);
  box.setFromObject(phone.group, true);
  const gap = +$('shadowDist').value / 100;
  if (mode() === 'standing') {
    shadowPlane.rotation.set(-Math.PI / 2, 0, 0);
    shadowPlane.position.set(0, box.min.y - gap, 0);
  } else {
    shadowPlane.rotation.set(0, 0, 0);
    shadowPlane.position.set(0, 0, box.min.z - gap);
  }
  requestRender();
}

function updateLight() {
  const v = Object.fromEntries(Object.keys(lightControls).map((id) => [id, +$(id).value]));
  for (const [id, fmt] of Object.entries(lightControls)) $(`${id}Out`).textContent = fmt(v[id]);
  const { normal, side, forward } = MODES[mode()];
  const az = THREE.MathUtils.degToRad(v.lightAz);
  const el = THREE.MathUtils.degToRad(v.lightEl);
  key.position.set(0, 0, 0)
    .addScaledVector(side, Math.sin(az) * Math.cos(el))
    .addScaledVector(forward, Math.cos(az) * Math.cos(el))
    .addScaledVector(normal, Math.sin(el))
    .multiplyScalar(8);
  // 100% key light = 3.0 intensity, strong enough to dominate the environment light.
  key.intensity = (v.lightInt / 100) * 3;
  scene.environmentIntensity = v.envInt / 100;
  renderer.toneMappingExposure = v.exposure / 100;
  phone.reflection.material.opacity = v.glare / 100;
  // Shadows come from the key light, so they fade out as it is dimmed.
  shadowPlane.material.opacity = (v.shadowOpacity / 100) * Math.min(1, v.lightInt / 100);
  key.shadow.radius = v.shadowSoft;
  shadowPlane.visible = $('shadow').checked;
  updateSurface();
}
for (const id of Object.keys(lightControls)) $(id).addEventListener('input', updateLight);
$('shadow').addEventListener('change', updateLight);

function applyModeDefaults() {
  for (const [id, val] of Object.entries(MODES[mode()].defaults)) $(id).value = val;
  updateLight();
  updateCamera();
}
document.querySelectorAll('input[name="surface"]').forEach((r) => r.addEventListener('change', applyModeDefaults));
$('resetLight').addEventListener('click', () => {
  for (const [id, val] of Object.entries(lightDefaults)) $(id).value = val;
  $('shadow').checked = true;
  applyModeDefaults();
});
$('camTilt').addEventListener('input', () => updateCamera());
applyModeDefaults();

// ---------- Camera / sizing ----------
function updateCamera(width = stage.clientWidth, height = stage.clientHeight) {
  camera.aspect = width / height;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const margin = 1.3;
  // Fit the phone (allowing for rotation) both vertically and horizontally.
  const fitH = (PHONE.height * margin) / 2 / Math.tan(halfFov);
  const fitW = (PHONE.height * 0.75 * margin) / 2 / Math.tan(halfFov) / camera.aspect;
  const dist = Math.max(fitH, fitW) / (+$('zoom').value / 100);
  const tilt = THREE.MathUtils.degToRad(+$('camTilt').value);
  $('camTiltOut').textContent = `${$('camTilt').value}°`;
  camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  requestRender();
}

function resize() {
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  updateCamera();
}
new ResizeObserver(resize).observe(stage);

// ---------- Export ----------
function exportSize() {
  const scale = +$('scale').value;
  const max = renderer.capabilities.maxTextureSize;
  let w = Math.round(stage.clientWidth * scale);
  let h = Math.round(stage.clientHeight * scale);
  const k = Math.min(1, max / w, max / h);
  return [Math.floor(w * k), Math.floor(h * k)];
}
function updateExportInfo() {
  const [w, h] = exportSize();
  $('exportInfo').textContent = `${w} × ${h} px`;
}
$('scale').addEventListener('change', updateExportInfo);
new ResizeObserver(updateExportInfo).observe(stage);

$('export').addEventListener('click', () => {
  const [w, h] = exportSize();
  const prevRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  updateCamera(w, h);
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `iphone-mockup-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
  renderer.setPixelRatio(prevRatio);
  resize();
});

setModel($('model').value);

// Expose for debugging / automated tests.
window.__mockup = { renderer, scene, camera, get phone() { return phone; }, loadFile };

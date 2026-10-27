import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPhone, placeholderCanvas, PHONE, SCREEN } from './phone.js';

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
key.shadow.mapSize.set(1024, 1024);
key.shadow.blurSamples = 25;
key.shadow.bias = -0.0005;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 10 });
scene.add(key);

// Backdrop that only shows the phone's shadow (works with transparent export too).
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial());
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

const phone = createPhone();
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
    const screenAspect = SCREEN.width / SCREEN.height;
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
  requestRender();
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

// ---------- Light & shadow ----------
const lightControls = {
  lightAz: (v) => `${v}°`,
  lightEl: (v) => `${v}°`,
  lightInt: (v) => `${v}%`,
  envInt: (v) => `${v}%`,
  exposure: (v) => `${v}%`,
  glare: (v) => `${v}%`,
  shadowOpacity: (v) => `${v}%`,
  shadowSoft: (v) => `${v}`,
  shadowDist: (v) => `${v}`,
};
const lightDefaults = Object.fromEntries(Object.keys(lightControls).map((id) => [id, $(id).value]));

function updateLight() {
  const v = Object.fromEntries(Object.keys(lightControls).map((id) => [id, +$(id).value]));
  for (const [id, fmt] of Object.entries(lightControls)) $(`${id}Out`).textContent = fmt(v[id]);
  const az = THREE.MathUtils.degToRad(v.lightAz);
  const el = THREE.MathUtils.degToRad(v.lightEl);
  key.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(4);
  key.intensity = v.lightInt / 100;
  scene.environmentIntensity = v.envInt / 100;
  renderer.toneMappingExposure = v.exposure / 100;
  phone.reflection.material.opacity = v.glare / 100;
  shadowPlane.material.opacity = v.shadowOpacity / 100;
  key.shadow.radius = v.shadowSoft;
  shadowPlane.position.z = -v.shadowDist / 100;
  shadowPlane.visible = $('shadow').checked;
  requestRender();
}
for (const id of Object.keys(lightControls)) $(id).addEventListener('input', updateLight);
$('shadow').addEventListener('change', updateLight);
$('resetLight').addEventListener('click', () => {
  for (const [id, val] of Object.entries(lightDefaults)) $(id).value = val;
  $('shadow').checked = true;
  updateLight();
});
updateLight();

// ---------- Camera / sizing ----------
function updateCamera(width = stage.clientWidth, height = stage.clientHeight) {
  camera.aspect = width / height;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const margin = 1.3;
  // Fit the phone (allowing for rotation) both vertically and horizontally.
  const fitH = (PHONE.height * margin) / 2 / Math.tan(halfFov);
  const fitW = (PHONE.height * 0.75 * margin) / 2 / Math.tan(halfFov) / camera.aspect;
  const dist = Math.max(fitH, fitW) / (+$('zoom').value / 100);
  camera.position.set(0, 0, dist);
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

// Expose for debugging / automated tests.
window.__mockup = { renderer, scene, camera, phone, loadFile };

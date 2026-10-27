import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPhone, placeholderCanvas } from './phone.js';
import { MODELS, MODEL_BY_ID } from './models.js';
import { createGlbPhone } from './glbPhone.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const frameBox = $('frame-box');
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
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial());
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

// ---------- Phones ----------
// Each phone has its own model, screenshot, rotation, colour and position. The sidebar edits the selected one.
const MAX_PHONES = 3;
const DETAILED = 'detailed';
const placeholder = placeholderCanvas();
const phones = []; // { model, obj, texture, rot: [x, y, z], color, offset: [side, forward] (mm) }
let selected = 0;
const sel = () => phones[selected];

$('model').innerHTML = [17, 16, 15, 14, 13].map((gen) => {
  const options = MODELS.filter((m) => m.name.startsWith(`iPhone ${gen}`) || (gen === 17 && m.id === 'air'))
    .map((m) => `<option value="${m.id}">${m.name}</option>`);
  if (gen === 14) options.unshift(`<option value="${DETAILED}">iPhone 14 Pro (detailed)</option>`);
  return `<optgroup label="iPhone ${gen}">${options.join('')}</optgroup>`;
}).join('');
$('model').value = DETAILED;

const buildPhone = (model) => (model === DETAILED ? createGlbPhone() : Promise.resolve(createPhone(MODEL_BY_ID[model])));

function makeTexture(source) {
  const t = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  return t;
}

function applyFit(p) {
  const t = p.texture;
  const img = t.image;
  t.repeat.set(1, 1);
  t.offset.set(0, 0);
  if ($('fit').value === 'cover') {
    const imgAspect = img.width / img.height;
    const screenAspect = p.obj.screenAspect;
    if (imgAspect > screenAspect) {
      t.repeat.x = screenAspect / imgAspect;
      t.offset.x = (1 - t.repeat.x) / 2;
    } else {
      t.repeat.y = imgAspect / screenAspect;
      t.offset.y = (1 - t.repeat.y) / 2;
    }
  }
}

// Apply a phone's screenshot, colour and the shared screen settings to its 3D object.
function dressPhone(p) {
  const { obj } = p;
  if (!(p.color in obj.colors)) p.color = Object.keys(obj.colors)[0];
  obj.setColor(p.color);
  obj.screenMat.map = p.texture;
  obj.screenMat.needsUpdate = true;
  obj.island.visible = $('island').checked;
  obj.reflection.material.opacity = +$('glare').value / 100;
  applyFit(p);
}

function setScreenImage(source) {
  const p = sel();
  p.texture.dispose();
  p.texture = makeTexture(source);
  dressPhone(p);
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

$('file').addEventListener('change', (e) => { loadFile(e.target.files[0]); e.target.value = ''; });
$('fit').addEventListener('change', () => { phones.forEach(applyFit); requestRender(); });
$('island').addEventListener('change', (e) => {
  for (const p of phones) p.obj.island.visible = e.target.checked;
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

// Model loads and adding phones are async; block other phone changes while one runs.
let busy = false;
async function whileBusy(fn) {
  if (busy) return;
  busy = true;
  renderPhoneUI();
  try {
    await fn();
  } catch (err) {
    console.error(err);
    alert('Could not load the 3D model.');
  } finally {
    busy = false;
    renderPhoneUI();
  }
}

function fillColorOptions() {
  $('frame').innerHTML = Object.entries(sel().obj.colors)
    .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

// Show the selected phone's settings in the sidebar.
function renderPhoneUI() {
  const multi = phones.length > 1;
  $('phoneTabs').innerHTML = phones
    .map((_, i) => `<button data-phone="${i}" class="${i === selected ? 'active' : ''}">Phone ${i + 1}</button>`).join('');
  document.querySelectorAll('.multi-only').forEach((el) => { el.hidden = !multi; });
  document.querySelectorAll('.phone-name').forEach((el) => { el.textContent = multi ? ` · Phone ${selected + 1}` : ''; });
  $('addPhone').disabled = busy || phones.length >= MAX_PHONES;
  $('removePhone').disabled = busy;
  $('model').disabled = busy;
  const p = sel();
  $('model').value = p.model;
  fillColorOptions();
  $('frame').value = p.color;
  axes.forEach((a, i) => { $(`rot${a}`).value = p.rot[i]; $(`rot${a}Out`).textContent = `${Math.round(p.rot[i])}°`; });
  $('offX').value = p.offset[0];
  $('offF').value = p.offset[1];
  $('offXOut').textContent = `${p.offset[0]} mm`;
  $('offFOut').textContent = `${p.offset[1]} mm`;
}

function selectPhone(i) {
  if (i === selected || !phones[i]) return;
  selected = i;
  renderPhoneUI();
}
$('phoneTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-phone]');
  if (btn) selectPhone(+btn.dataset.phone);
});

$('model').addEventListener('change', (e) => {
  const p = sel();
  const model = e.target.value;
  whileBusy(async () => {
    const obj = await buildPhone(model);
    scene.remove(p.obj.group);
    p.obj = obj;
    p.model = model;
    scene.add(obj.group);
    dressPhone(p);
    updateLayout();
    updateCamera();
  });
});
$('frame').addEventListener('change', (e) => {
  sel().color = e.target.value;
  sel().obj.setColor(e.target.value);
  requestRender();
});

$('addPhone').addEventListener('click', () => whileBusy(async () => {
  if (phones.length >= MAX_PHONES) return;
  const src = sel();
  const obj = await buildPhone(src.model);
  const p = { model: src.model, obj, texture: makeTexture(placeholder), rot: [...src.rot], color: src.color, offset: [0, 0] };
  phones.push(p);
  scene.add(obj.group);
  dressPhone(p);
  selected = phones.length - 1;
  updateLayout();
  updateCamera();
}));
$('removePhone').addEventListener('click', () => {
  if (busy || phones.length <= 1) return;
  const [p] = phones.splice(selected, 1);
  scene.remove(p.obj.group);
  p.texture.dispose();
  selected = Math.min(selected, phones.length - 1);
  renderPhoneUI();
  updateLayout();
  updateCamera();
});

function updateOffsets() {
  const p = sel();
  p.offset = [+$('offX').value, +$('offF').value];
  $('offXOut').textContent = `${p.offset[0]} mm`;
  $('offFOut').textContent = `${p.offset[1]} mm`;
  updateLayout();
  updateCamera();
}
$('offX').addEventListener('input', updateOffsets);
$('offF').addEventListener('input', updateOffsets);
$('spacing').addEventListener('input', (e) => {
  $('spacingOut').textContent = `${e.target.value}%`;
  updateLayout();
  updateCamera();
});

// ---------- Rotation ----------
const axes = ['X', 'Y', 'Z'];
function updateRotation() {
  const rot = axes.map((a) => +$(`rot${a}`).value);
  axes.forEach((a, i) => { $(`rot${a}Out`).textContent = `${Math.round(rot[i])}°`; });
  sel().rot = rot;
  updateLayout();
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

// Click a phone to select it, then drag to rotate it: horizontal = Y, vertical = X, Shift + horizontal = Z.
const wrap = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
const raycaster = new THREE.Raycaster();
function phoneAt(e) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(phones.map((p) => p.obj.group), true)[0];
  return hit ? phones.findIndex((p) => p.obj.group.getObjectById(hit.object.id)) : -1;
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (phones.length > 1) {
    const i = phoneAt(e);
    if (i >= 0) selectPhone(i);
  }
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

function updateBackground() {
  const transparent = $('transparent').checked;
  frameBox.classList.toggle('transparent', transparent);
  renderer.setClearColor($('bg').value, transparent ? 0 : 1);
  frameBox.style.backgroundColor = transparent ? '' : $('bg').value;
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

// Phones stand in a row along the surface. Each one is lowered onto the surface, which sits under the lowest phone.
function rowPositions() {
  const gap = +$('spacing').value / 100;
  const widths = phones.map((p) => p.obj.size.width);
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * widths[0] * (phones.length - 1);
  let x = -total / 2;
  return phones.map((p, i) => {
    const side = x + widths[i] / 2 + p.offset[0] / 100;
    x += widths[i] + gap * widths[0];
    return { side, forward: p.offset[1] / 100 };
  });
}

// Size of the row, used to frame the camera. Rotation is ignored so turning a phone doesn't change the zoom.
function rowExtent() {
  const pos = rowPositions();
  const span = (vals) => Math.max(...vals) - Math.min(...vals);
  const height = Math.max(...phones.map((p) => p.obj.size.height));
  return {
    width: span(pos.map((p) => p.side)) + height * 0.75,
    height: height + (mode() === 'flat' ? span(pos.map((p) => p.forward)) : 0),
  };
}

const box = new THREE.Box3();
function updateLayout() {
  const { normal, side, forward } = MODES[mode()];
  const pos = rowPositions();
  const mid = (vals) => (Math.max(...vals) + Math.min(...vals)) / 2;
  const cs = mid(pos.map((p) => p.side));
  const cf = mid(pos.map((p) => p.forward));
  const lows = phones.map((p, i) => {
    const g = p.obj.group;
    g.rotation.set(...p.rot.map((d) => THREE.MathUtils.degToRad(d)));
    g.position.set(0, 0, 0)
      .addScaledVector(side, pos[i].side - cs)
      .addScaledVector(forward, pos[i].forward - cf);
    g.updateMatrixWorld(true);
    box.setFromObject(g, true);
    return box.min.dot(normal);
  });
  const level = Math.min(...lows);
  phones.forEach((p, i) => p.obj.group.position.addScaledVector(normal, level - lows[i]));

  const gap = +$('shadowDist').value / 100;
  shadowPlane.position.set(0, 0, 0).addScaledVector(normal, level - gap);
  shadowPlane.rotation.set(mode() === 'standing' ? -Math.PI / 2 : 0, 0, 0);
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
  for (const p of phones) p.obj.reflection.material.opacity = v.glare / 100;
  // Shadows come from the key light, so they fade out as it is dimmed.
  shadowPlane.material.opacity = (v.shadowOpacity / 100) * Math.min(1, v.lightInt / 100);
  key.shadow.radius = v.shadowSoft;
  shadowPlane.visible = $('shadow').checked;
  updateLayout();
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

// ---------- Camera / sizing ----------
function updateCamera(width = frameBox.clientWidth, height = frameBox.clientHeight) {
  camera.aspect = width / height;
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const margin = 1.3;
  // Fit the phones (allowing for rotation) both vertically and horizontally.
  const extent = rowExtent();
  const fitH = (extent.height * margin) / 2 / Math.tan(halfFov);
  const fitW = (extent.width * margin) / 2 / Math.tan(halfFov) / camera.aspect;
  const dist = Math.max(fitH, fitW) / (+$('zoom').value / 100);
  const tilt = THREE.MathUtils.degToRad(+$('camTilt').value);
  $('camTiltOut').textContent = `${$('camTilt').value}°`;
  camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  requestRender();
}

// ---------- Export format ----------
// With a fixed format, the canvas is shown as a frame of that shape so the preview matches the export.
function formatSize() {
  const v = $('format').value;
  if (v === 'viewport') return null;
  if (v === 'custom') {
    const clamp = (n) => Math.min(8192, Math.max(16, Math.round(n) || 16));
    return [clamp(+$('customW').value), clamp(+$('customH').value)];
  }
  return v.split('x').map(Number);
}

function layoutFrame() {
  const fmt = formatSize();
  let w = stage.clientWidth;
  let h = stage.clientHeight;
  if (fmt) {
    const pad = 24;
    const k = Math.min((w - pad * 2) / fmt[0], (h - pad * 2) / fmt[1]);
    w = fmt[0] * k;
    h = fmt[1] * k;
  }
  w = Math.max(1, Math.floor(w));
  h = Math.max(1, Math.floor(h));
  stage.classList.toggle('framed', !!fmt);
  frameBox.style.width = `${w}px`;
  frameBox.style.height = `${h}px`;
  renderer.setSize(w, h, false);
  updateCamera(w, h);
  updateExportInfo();
}
new ResizeObserver(layoutFrame).observe(stage);

$('format').addEventListener('change', () => {
  $('customRow').hidden = $('format').value !== 'custom';
  // Fixed formats already have their exact size at 1×; the window size is small, so it defaults to 2×.
  $('scale').value = formatSize() ? '1' : '2';
  layoutFrame();
});
$('customW').addEventListener('input', layoutFrame);
$('customH').addEventListener('input', layoutFrame);

// ---------- Export ----------
function exportSize() {
  const scale = +$('scale').value;
  const max = renderer.capabilities.maxTextureSize;
  const [bw, bh] = formatSize() ?? [frameBox.clientWidth, frameBox.clientHeight];
  const w = Math.round(bw * scale);
  const h = Math.round(bh * scale);
  const k = Math.min(1, max / w, max / h);
  return [Math.floor(w * k), Math.floor(h * k)];
}
function updateExportInfo() {
  const [w, h] = exportSize();
  $('exportInfo').textContent = `${w} × ${h} px`;
}
$('scale').addEventListener('change', updateExportInfo);

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
  layoutFrame();
});

// ---------- Start ----------
// Show a quick procedural phone, then swap in the detailed model once it has loaded.
phones.push({
  model: '14pro', obj: createPhone(MODEL_BY_ID['14pro']), texture: makeTexture(placeholder), rot: [0, 0, 0], color: 'spaceBlack', offset: [0, 0],
});
scene.add(phones[0].obj.group);
dressPhone(phones[0]);
renderPhoneUI();
applyModeDefaults();
whileBusy(async () => {
  const p = phones[0];
  const obj = await createGlbPhone();
  scene.remove(p.obj.group);
  p.obj = obj;
  p.model = DETAILED;
  scene.add(obj.group);
  dressPhone(p);
  updateLayout();
});

// Expose for debugging / automated tests.
window.__mockup = { renderer, scene, camera, phones, loadFile };

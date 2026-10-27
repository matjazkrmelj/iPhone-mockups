import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Flat rounded rect with UVs normalised to 0..1 across its bounds.
export function roundedPlane(w, h, r, segments = 32) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), segments);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  return geo;
}

// Rounded slab centred on z = 0, with rounded (bevelled) edges.
function roundedSlab(w, h, r, depth, bevel, segments = 10) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, Math.max(r - bevel, 0.001)), {
    depth: Math.max(depth - bevel * 2, 0.0001),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: 32,
  });
  geo.translate(0, 0, -(depth / 2 - bevel));
  geo.computeVertexNormals();
  return geo;
}

// Lens barrel profile, revolved around the axis. Height grows along -z (out of the back).
function lensBarrel(rInner, rOuter, height) {
  const pts = [
    new THREE.Vector2(rOuter, 0),
    new THREE.Vector2(rOuter, height * 0.7),
    new THREE.Vector2(rOuter - 0.004, height),
    new THREE.Vector2(rInner + 0.003, height),
    new THREE.Vector2(rInner, height - 0.003),
    new THREE.Vector2(rInner, 0),
  ];
  const geo = new THREE.LatheGeometry(pts, 64);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

const FRAME_FINISH = {
  aluminium: { metalness: 0.9, roughness: 0.42, anisotropy: 0, clearcoat: 0.1, clearcoatRoughness: 0.4 },
  steel: { metalness: 1, roughness: 0.12, anisotropy: 0, clearcoat: 0.5, clearcoatRoughness: 0.05 },
  titanium: { metalness: 1, roughness: 0.3, anisotropy: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.2 },
};
const BACK_FINISH = {
  gloss: { roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 },
  matte: { roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.55 },
};

// Builds an iPhone procedurally from a model in models.js (1 unit = 100 mm).
export function createPhone(spec) {
  const mm = (v) => v / 100;
  const [W, H, D] = spec.size.map(mm);
  const R = W * 0.155;
  const bezel = mm(spec.bezel);
  const SH = H - bezel * 2;
  const SW = SH * (spec.screen[0] / spec.screen[1]);
  const SR = R - bezel * 0.9;
  const group = new THREE.Group();

  // ---------- Materials ----------
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, ...FRAME_FINISH[spec.frame] });
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0xc9c4ba, metalness: 0, ...BACK_FINISH[spec.back] });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x030303, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5,
  });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xa9a59d, roughness: 0.7 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const darkMetalMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, metalness: 1, roughness: 0.25 });
  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x020306, metalness: 0, roughness: 0.05, specularIntensity: 0.5,
    iridescence: 0.5, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 500],
  });
  const lensInnerMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0d16, metalness: 0.3, roughness: 0.2 });
  const flashMat = new THREE.MeshPhysicalMaterial({ color: 0xf3ecd9, roughness: 0.35, clearcoat: 1 });

  // ---------- Body ----------
  // Metal band with rounded edges.
  const frame = new THREE.Mesh(roundedSlab(W, H, R, D, 0.018), frameMat);
  group.add(frame);

  // Front cover glass, sitting slightly proud of the frame.
  const glassT = 0.006;
  const front = new THREE.Mesh(roundedSlab(W - 0.012, H - 0.012, R - 0.006, glassT, 0.0022, 4), glassMat);
  front.position.z = D / 2 - glassT / 2 + 0.0006;
  group.add(front);
  const frontZ = D / 2 + 0.0006;

  // Back glass.
  const back = new THREE.Mesh(roundedSlab(W - 0.012, H - 0.012, R - 0.006, glassT, 0.0022, 4), backMat);
  back.position.z = -(D / 2 - glassT / 2 + 0.0006);
  group.add(back);
  const backZ = -frontZ;

  // ---------- Front ----------
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(roundedPlane(SW, SH, SR), screenMat);
  screen.position.z = frontZ + 0.0003;
  group.add(screen);

  // Dynamic Island, or the notch on iPhone 13 / 14. The notch reaches up into the black border.
  const cutoutMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  let island;
  if (spec.cutout === 'notch') {
    const nw = 0.268, nh = 0.054, over = 0.02;
    island = new THREE.Mesh(roundedPlane(nw, nh + over, 0.02), cutoutMat);
    island.position.set(0, SH / 2 - nh + (nh + over) / 2, frontZ + 0.0006);
  } else {
    island = new THREE.Mesh(roundedPlane(0.125, 0.037, 0.0185), cutoutMat);
    island.position.set(0, SH / 2 - 0.0545, frontZ + 0.0006);
  }
  group.add(island);

  // Earpiece slit between screen and frame.
  const earpiece = new THREE.Mesh(roundedPlane(0.1, 0.0035, 0.00175), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  earpiece.position.set(0, H / 2 - 0.0095, frontZ + 0.0007);
  group.add(earpiece);

  // Glass reflection layer: adds only the environment specular on top of the screen.
  const reflectMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.03,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const reflection = new THREE.Mesh(roundedPlane(W - 0.016, H - 0.016, R - 0.008), reflectMat);
  reflection.position.z = frontZ + 0.001;
  group.add(reflection);

  // ---------- Antenna bands ----------
  const flatDepth = D - 0.036;
  const sideBand = new THREE.BoxGeometry(0.004, 0.0035, flatDepth);
  for (const sx of [-1, 1]) {
    for (const y of [H * 0.41, -H * 0.41]) {
      const b = new THREE.Mesh(sideBand, bandMat);
      b.position.set(sx * (W / 2 - 0.0016), y, 0);
      group.add(b);
    }
  }
  const endBand = new THREE.BoxGeometry(0.0035, 0.004, flatDepth);
  for (const [x, sy] of [[W * 0.28, 1], [-W * 0.28, 1], [W * 0.32, -1], [-W * 0.32, -1]]) {
    const b = new THREE.Mesh(endBand, bandMat);
    b.position.set(x, sy * (H / 2 - 0.0016), 0);
    group.add(b);
  }

  // ---------- Bottom edge: charging port, speaker and mic holes, screws ----------
  const bottom = new THREE.Group();
  bottom.rotation.x = Math.PI / 2; // shapes now face -y
  bottom.position.y = -H / 2 - 0.0003;
  group.add(bottom);
  if (spec.port === 'usbc') {
    bottom.add(new THREE.Mesh(roundedPlane(0.09, 0.03, 0.015), holeMat));
    const portInner = new THREE.Mesh(roundedPlane(0.07, 0.012, 0.006), darkMetalMat);
    portInner.position.z = 0.0002;
    bottom.add(portInner);
  } else {
    bottom.add(new THREE.Mesh(roundedPlane(0.078, 0.022, 0.011), holeMat));
  }
  const holeGeo = new THREE.CircleGeometry(0.0055, 20);
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const h = new THREE.Mesh(holeGeo, holeMat);
      h.position.set(sx * (0.098 + i * 0.019), 0, 0);
      bottom.add(h);
    }
    const screw = new THREE.Mesh(new THREE.CircleGeometry(0.0065, 20), darkMetalMat);
    screw.position.set(sx * 0.068, 0, 0);
    bottom.add(screw);
  }

  // ---------- Side buttons (positions measured from the top edge) ----------
  const button = (x, fromTop, len, mat = frameMat, depth = 0.03, out = 0.002) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.014, len, depth, 4, 0.006), mat);
    b.position.set(x + Math.sign(x) * out, H / 2 - fromTop, 0);
    group.add(b);
  };
  const left = -W / 2, right = W / 2;
  if (spec.button === 'action') button(left, 0.28, 0.06); // action button
  else button(left, 0.28, 0.045, frameMat, 0.022, 0.003); // mute switch
  button(left, 0.42, 0.1); // volume up
  button(left, 0.55, 0.1); // volume down
  button(right, 0.47, 0.16); // side button
  if (spec.cameraControl) {
    button(right, H * 0.66, 0.19, new THREE.MeshPhysicalMaterial({ color: 0x2a2a2c, metalness: 0.2, roughness: 0.1, clearcoat: 1 }), 0.024, -0.004);
  }

  // ---------- Cameras (back view: +x in model space is the left side seen from behind) ----------
  const bumpDepth = 0.012;
  const faceBack = (mesh, x, y, z) => {
    mesh.rotation.y = Math.PI;
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const addBump = (w, h, r, cx, cy, mat = backMat) => {
    const bump = new THREE.Mesh(roundedSlab(w, h, r, bumpDepth, 0.005, 6), mat);
    bump.position.set(cx, cy, backZ - bumpDepth / 2 + 0.0005);
    group.add(bump);
    return backZ - bumpDepth + 0.0005;
  };
  const lens = (x, y, z, rOuter) => {
    const k = rOuter / 0.068;
    const barrelH = 0.016;
    const barrel = new THREE.Mesh(lensBarrel(0.047 * k, rOuter, barrelH), frameMat);
    barrel.position.set(x, y, z);
    group.add(barrel);
    const lz = z - barrelH + 0.004;
    faceBack(new THREE.Mesh(new THREE.RingGeometry(0.034 * k, 0.0475 * k, 64), darkMetalMat), x, y, lz);
    faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.0345 * k, 64), lensGlassMat), x, y, lz - 0.0002);
    faceBack(new THREE.Mesh(new THREE.RingGeometry(0.014 * k, 0.019 * k, 48), lensInnerMat), x, y, lz - 0.0004);
    faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.008 * k, 32), holeMat), x, y, lz - 0.0005);
  };
  const flash = (x, y, z, r = 0.021) => faceBack(new THREE.Mesh(new THREE.CircleGeometry(r, 32), flashMat), x, y, z - 0.0004);
  const lidar = (x, y, z) => faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.019, 32), lensGlassMat), x, y, z - 0.0004);
  const mic = (x, y, z) => faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.005, 16), holeMat), x, y, z - 0.0004);

  // Pro triangle of three lenses with flash and LiDAR, in a square of side s centred on (cx, cy).
  const triple = (cx, cy, s, z) => {
    const k = s * 0.227;
    for (const [lx, ly] of [[k, k], [k, -k], [-k, 0]]) lens(cx + lx, cy + ly, z, s * 0.2);
    flash(cx - k, cy + s * 0.318, z);
    lidar(cx - k, cy - s * 0.318, z);
    mic(cx, cy, z);
  };

  const inset = 0.03;
  if (spec.camera === 'triple') {
    const s = W * 0.48;
    const cx = W / 2 - inset - s / 2, cy = H / 2 - inset - s / 2;
    triple(cx, cy, s, addBump(s, s, s * 0.26, cx, cy));
  } else if (spec.camera === 'diagonal' || spec.camera === 'vertical') {
    const s = W * 0.42;
    const cx = W / 2 - inset - s / 2, cy = H / 2 - inset - s / 2;
    const z = addBump(s, s, s * 0.27, cx, cy);
    const k = s * 0.24;
    if (spec.camera === 'diagonal') {
      lens(cx + k, cy + k, z, s * 0.21);
      lens(cx - k, cy - k, z, s * 0.21);
      flash(cx - k, cy + k, z, 0.018);
      mic(cx + k * 0.1, cy - k * 0.1, z);
    } else {
      lens(cx + k, cy + k, z, s * 0.21);
      lens(cx + k, cy - k, z, s * 0.21);
      flash(cx - k, cy + k, z, 0.018);
      mic(cx - k, cy - k, z);
    }
  } else if (spec.camera === 'pill') {
    const pw = W * 0.21, ph = W * 0.45;
    const cx = W / 2 - inset - pw / 2, cy = H / 2 - inset - ph / 2;
    const z = addBump(pw, ph, pw / 2, cx, cy);
    lens(cx, cy + ph / 2 - pw / 2, z, pw * 0.4);
    lens(cx, cy - ph / 2 + pw / 2, z, pw * 0.4);
    flash(cx - pw / 2 - 0.05, cy + ph / 2 - pw / 2, backZ - 0.0002, 0.018);
    mic(cx - pw / 2 - 0.05, cy, backZ - 0.0002);
  } else if (spec.camera === 'plateau') {
    // iPhone 17 Pro: a full-width aluminium plateau with the lenses on the left and flash and LiDAR on the right.
    const ph = H * 0.3;
    const cy = H / 2 - 0.004 - ph / 2;
    const z = addBump(W - 0.008, ph, R - 0.004, 0, cy, frameMat);
    const s = W * 0.46;
    const k = s * 0.227;
    const cx = W / 2 - 0.02 - s / 2;
    for (const [lx, ly] of [[k, k], [k, -k], [-k, 0]]) lens(cx + lx, cy + ly, z, s * 0.2);
    flash(-W / 2 + 0.09, cy + k * 0.8, z);
    lidar(-W / 2 + 0.09, cy - k * 0.8, z);
    mic(-W / 2 + 0.09, cy, z);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  reflection.castShadow = false;

  return {
    group,
    screenMat,
    island,
    reflection,
    size: { width: W, height: H },
    screenAspect: SW / SH,
    colors: Object.fromEntries(Object.entries(spec.colors).map(([k, v]) => [k, v[0]])),
    setColor(name) {
      const [, frameHex, backHex] = spec.colors[name];
      frameMat.color.setHex(frameHex);
      backMat.color.setHex(backHex);
      bandMat.color.setHex(frameHex).multiplyScalar(0.85);
    },
  };
}

// Placeholder lock screen shown until a screenshot is uploaded.
export function placeholderCanvas() {
  const c = document.createElement('canvas');
  c.width = 1179;
  c.height = 2556;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#4b6cb7');
  grad.addColorStop(0.5, '#7b5ea7');
  grad.addColorStop(1, '#e0739a');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.textAlign = 'center';
  g.font = '500 64px -apple-system, "Segoe UI", sans-serif';
  g.fillText('Tuesday, 9 September', c.width / 2, 470);
  g.font = '700 300px -apple-system, "Segoe UI", sans-serif';
  g.fillText('9:41', c.width / 2, 780);
  g.font = '500 54px -apple-system, "Segoe UI", sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillText('Upload a screenshot to replace this screen', c.width / 2, 2250);
  return c;
}

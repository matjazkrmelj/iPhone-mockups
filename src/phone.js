import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Approximate iPhone 15 Pro proportions (1 unit = 100 mm).
export const PHONE = { width: 0.706, height: 1.466, depth: 0.0825, radius: 0.11 };
// Screen matches the 1179 × 2556 screenshot aspect ratio.
export const SCREEN = { width: 0.655, height: 1.42, radius: 0.088 };

export const FRAME_COLORS = {
  natural: { frame: 0xbab5ab, back: 0xc9c4ba, band: 0xa9a59d },
  black: { frame: 0x3d3d40, back: 0x38383b, band: 0x2c2c2e },
  white: { frame: 0xe2e1dd, back: 0xefeeea, band: 0xcfcdc8 },
  blue: { frame: 0x3f4657, back: 0x495064, band: 0x343a48 },
};

const COLOR_NAMES = {
  natural: 'Natural Titanium',
  black: 'Black Titanium',
  white: 'White Titanium',
  blue: 'Blue Titanium',
};

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

export function createPhone() {
  const { width: W, height: H, depth: D, radius: R } = PHONE;
  const group = new THREE.Group();

  // ---------- Materials ----------
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: 0xbab5ab, metalness: 1, roughness: 0.3, anisotropy: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.2,
  });
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9c4ba, metalness: 0, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.55,
  });
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

  // ---------- Body ----------
  // Titanium band with rounded edges.
  const frame = new THREE.Mesh(roundedSlab(W, H, R, D, 0.018), frameMat);
  group.add(frame);

  // Front cover glass, sitting slightly proud of the frame.
  const glassT = 0.006;
  const front = new THREE.Mesh(roundedSlab(W - 0.012, H - 0.012, R - 0.006, glassT, 0.0022, 4), glassMat);
  front.position.z = D / 2 - glassT / 2 + 0.0006;
  group.add(front);
  const frontZ = D / 2 + 0.0006;

  // Frosted back glass.
  const back = new THREE.Mesh(roundedSlab(W - 0.012, H - 0.012, R - 0.006, glassT, 0.0022, 4), backMat);
  back.position.z = -(D / 2 - glassT / 2 + 0.0006);
  group.add(back);
  const backZ = -frontZ;

  // ---------- Front ----------
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(roundedPlane(SCREEN.width, SCREEN.height, SCREEN.radius), screenMat);
  screen.position.z = frontZ + 0.0003;
  group.add(screen);

  const island = new THREE.Mesh(roundedPlane(0.125, 0.037, 0.0185), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  island.position.set(0, SCREEN.height / 2 - 0.0545, frontZ + 0.0006);
  group.add(island);

  // Earpiece slit between screen and frame.
  const earpiece = new THREE.Mesh(roundedPlane(0.1, 0.0035, 0.00175), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
  earpiece.position.set(0, H / 2 - 0.0095, frontZ + 0.0003);
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
    for (const y of [0.6, -0.6]) {
      const b = new THREE.Mesh(sideBand, bandMat);
      b.position.set(sx * (W / 2 - 0.0016), y, 0);
      group.add(b);
    }
  }
  const endBand = new THREE.BoxGeometry(0.0035, 0.004, flatDepth);
  for (const [x, sy] of [[0.2, 1], [-0.2, 1], [0.225, -1], [-0.225, -1]]) {
    const b = new THREE.Mesh(endBand, bandMat);
    b.position.set(x, sy * (H / 2 - 0.0016), 0);
    group.add(b);
  }

  // ---------- Bottom edge: USB-C, speaker and mic holes, screws ----------
  const bottom = new THREE.Group();
  bottom.rotation.x = Math.PI / 2; // shapes now face -y
  bottom.position.y = -H / 2 - 0.0003;
  group.add(bottom);
  const port = new THREE.Mesh(roundedPlane(0.09, 0.03, 0.015), holeMat);
  bottom.add(port);
  const portInner = new THREE.Mesh(roundedPlane(0.07, 0.012, 0.006), darkMetalMat);
  portInner.position.z = 0.0002;
  bottom.add(portInner);
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

  // ---------- Side buttons ----------
  const button = (x, y, len) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.014, len, 0.03, 4, 0.006), frameMat);
    b.position.set(x, y, 0);
    group.add(b);
  };
  button(-W / 2 - 0.002, 0.45, 0.06); // action button
  button(-W / 2 - 0.002, 0.31, 0.1); // volume up
  button(-W / 2 - 0.002, 0.18, 0.1); // volume down
  button(W / 2 + 0.002, 0.26, 0.16); // side button

  // ---------- Camera plateau (top-left from the back = +x in model space) ----------
  const bumpSize = 0.34;
  const bumpDepth = 0.012;
  const bumpX = W / 2 - 0.03 - bumpSize / 2;
  const bumpY = H / 2 - 0.03 - bumpSize / 2;
  const bump = new THREE.Mesh(roundedSlab(bumpSize, bumpSize, 0.088, bumpDepth, 0.005, 6), backMat);
  bump.position.set(bumpX, bumpY, backZ - bumpDepth / 2 + 0.0005);
  group.add(bump);
  const bumpZ = backZ - bumpDepth + 0.0005;

  const faceBack = (mesh, x, y, z) => {
    mesh.rotation.y = Math.PI;
    mesh.position.set(bumpX + x, bumpY + y, z);
    group.add(mesh);
    return mesh;
  };

  const barrelH = 0.016;
  for (const [lx, ly] of [[0.077, 0.077], [0.077, -0.077], [-0.075, 0]]) {
    const barrel = new THREE.Mesh(lensBarrel(0.047, 0.068, barrelH), frameMat);
    barrel.position.set(bumpX + lx, bumpY + ly, bumpZ);
    group.add(barrel);
    const z = bumpZ - barrelH + 0.004;
    faceBack(new THREE.Mesh(new THREE.RingGeometry(0.034, 0.0475, 64), darkMetalMat), lx, ly, z);
    faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.0345, 64), lensGlassMat), lx, ly, z - 0.0002);
    faceBack(new THREE.Mesh(new THREE.RingGeometry(0.014, 0.019, 48), lensInnerMat), lx, ly, z - 0.0004);
    faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.008, 32), holeMat), lx, ly, z - 0.0005);
  }
  // Flash, LiDAR and microphone.
  faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.021, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xf3ecd9, roughness: 0.35, clearcoat: 1 })), -0.075, 0.108, bumpZ - 0.0004);
  faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.019, 32), lensGlassMat), -0.075, -0.108, bumpZ - 0.0004);
  faceBack(new THREE.Mesh(new THREE.CircleGeometry(0.005, 16), holeMat), 0.0, 0.0, bumpZ - 0.0004);

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  reflection.castShadow = false;

  return {
    group,
    screenMat,
    island,
    reflection,
    screenAspect: SCREEN.width / SCREEN.height,
    colors: COLOR_NAMES,
    setColor(name) {
      const c = FRAME_COLORS[name];
      frameMat.color.setHex(c.frame);
      backMat.color.setHex(c.back);
      bandMat.color.setHex(c.band);
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

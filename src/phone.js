import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Approximate iPhone 15 Pro proportions (1 unit = 100 mm).
export const PHONE = { width: 0.706, height: 1.466, depth: 0.0825, radius: 0.11 };
// Screen matches the 1179 × 2556 screenshot aspect ratio.
export const SCREEN = { width: 0.655, height: 1.42, radius: 0.088 };

export const FRAME_COLORS = {
  natural: { frame: 0xbab5ab, back: 0xc9c4ba },
  black: { frame: 0x3d3d40, back: 0x38383b },
  white: { frame: 0xe2e1dd, back: 0xefeeea },
  blue: { frame: 0x3f4657, back: 0x495064 },
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
function roundedPlane(w, h, r, segments = 24) {
  const geo = new THREE.ShapeGeometry(roundedRectShape(w, h, r), segments);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  return geo;
}

function roundedSlab(w, h, r, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, r - bevel), {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 8,
    curveSegments: 24,
  });
  geo.translate(0, 0, -(depth / 2 - bevel));
  return geo;
}

export function createPhone() {
  const { width: W, height: H, depth: D, radius: R } = PHONE;
  const group = new THREE.Group();

  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, metalness: 1, roughness: 0.32 });
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0xc9c4ba, metalness: 0, roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });
  const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Body: extrude caps get the glass material, sides get the metal frame.
  const body = new THREE.Mesh(roundedSlab(W, H, R, D, 0.014), [glassMat, frameMat]);
  group.add(body);

  // Display.
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = new THREE.Mesh(roundedPlane(SCREEN.width, SCREEN.height, SCREEN.radius), screenMat);
  screen.position.z = D / 2 + 0.0004;
  group.add(screen);

  // Glass reflection layer: adds only the environment specular on top of the screen.
  const reflectMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.04,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const reflection = new THREE.Mesh(roundedPlane(W - 0.03, H - 0.03, R - 0.015), reflectMat);
  reflection.position.z = D / 2 + 0.0012;
  group.add(reflection);

  // Dynamic Island.
  const island = new THREE.Mesh(roundedPlane(0.125, 0.037, 0.0185), blackMat);
  island.position.set(0, SCREEN.height / 2 - 0.0545, D / 2 + 0.0008);
  group.add(island);

  // Back glass panel.
  const back = new THREE.Mesh(roundedPlane(W - 0.03, H - 0.03, R - 0.015), backMat);
  back.rotation.y = Math.PI;
  back.position.z = -D / 2 - 0.0004;
  group.add(back);

  // Camera plateau (top-left when viewed from the back = +x in model space).
  const bumpSize = 0.34;
  const bumpDepth = 0.014;
  const bumpX = W / 2 - 0.028 - bumpSize / 2;
  const bumpY = H / 2 - 0.028 - bumpSize / 2;
  const bump = new THREE.Mesh(roundedSlab(bumpSize, bumpSize, 0.085, bumpDepth, 0.005), backMat);
  bump.position.set(bumpX, bumpY, -D / 2 - bumpDepth / 2 + 0.001);
  group.add(bump);

  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2a2c, metalness: 1, roughness: 0.25 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x06070c, metalness: 0.2, roughness: 0.02, clearcoat: 1, iridescence: 0.6 });
  const lensZ = -D / 2 - bumpDepth;
  const lenses = [[0.075, 0.075], [0.075, -0.075], [-0.07, 0]];
  for (const [lx, ly] of lenses) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.066, 0.016, 48), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(bumpX + lx, bumpY + ly, lensZ - 0.006);
    group.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.046, 48), lensMat);
    lens.rotation.y = Math.PI;
    lens.position.set(bumpX + lx, bumpY + ly, lensZ - 0.0142);
    group.add(lens);
  }
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.02, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xf2ead8, roughness: 0.3 }));
  flash.rotation.y = Math.PI;
  flash.position.set(bumpX - 0.07, bumpY + 0.105, lensZ - 0.0005);
  group.add(flash);
  const lidar = new THREE.Mesh(new THREE.CircleGeometry(0.018, 32), lensMat);
  lidar.rotation.y = Math.PI;
  lidar.position.set(bumpX - 0.07, bumpY - 0.105, lensZ - 0.0005);
  group.add(lidar);

  // Side buttons.
  const button = (x, y, len) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.012, len, 0.03, 3, 0.005), frameMat);
    b.position.set(x, y, 0);
    group.add(b);
  };
  button(-W / 2 - 0.002, 0.45, 0.06); // action button
  button(-W / 2 - 0.002, 0.31, 0.1); // volume up
  button(-W / 2 - 0.002, 0.18, 0.1); // volume down
  button(W / 2 + 0.002, 0.26, 0.16); // side button

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  reflection.castShadow = false;

  return {
    group,
    screenMat,
    island,
    reflection,
    setColor(name) {
      const c = FRAME_COLORS[name];
      frameMat.color.setHex(c.frame);
      backMat.color.setHex(c.back);
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

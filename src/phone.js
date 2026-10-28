import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// iPhone 17 lineup, built procedurally from the measurements in models.js. 1 unit = 100 mm.
// Model space: the screen faces +z, the top of the phone is +y. Seen from behind, +x is on the left.

// Rounded rectangle with a radius per corner: [top right, top left, bottom left, bottom right].
function roundedRectShape(w, h, r) {
  const [tr, tl, bl, br] = Array.isArray(r) ? r : [r, r, r, r];
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  s.quadraticCurveTo(x + w, y, x + w, y + br);
  s.lineTo(x + w, y + h - tr);
  s.quadraticCurveTo(x + w, y + h, x + w - tr, y + h);
  s.lineTo(x + tl, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - tl);
  s.lineTo(x, y + bl);
  s.quadraticCurveTo(x, y, x + bl, y);
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
  const radius = Array.isArray(r) ? r.map((v) => Math.max(v - bevel, 0.001)) : Math.max(r - bevel, 0.001);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - bevel * 2, h - bevel * 2, radius), {
    depth: Math.max(depth - bevel * 2, 0.0001),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: 48,
  });
  geo.translate(0, 0, -(depth / 2 - bevel));
  geo.computeVertexNormals();
  return geo;
}

// Points around a rounded rect, counter-clockwise, with a fixed count per corner so rings of
// different sizes line up point for point.
function outlinePoints(w, h, r, perCorner = 24) {
  const pts = [];
  const corners = [
    [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= perCorner; i++) {
      const a = a0 + (i / perCorner) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return pts;
}

// Body shell: a cross-section profile swept around the phone's outline.
// `profile` is a list of [inset, z] from the front edge to the back edge.
function sweptBody(W, H, R, profile) {
  const rings = profile.map(([d, z]) => ({ pts: outlinePoints(W - d * 2, H - d * 2, Math.max(R - d, 0.002)), z }));
  const n = rings[0].pts.length;
  const pos = [];
  const uv = [];
  const index = [];
  rings.forEach((ring, j) => {
    ring.pts.forEach((p, i) => {
      pos.push(p.x, p.y, ring.z);
      uv.push(i / n, j / (rings.length - 1));
    });
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * n + i, b = j * n + ((i + 1) % n), c = (j + 1) * n + i, d = (j + 1) * n + ((i + 1) % n);
      index.push(a, c, b, b, c, d);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  side.setIndex(index);
  side.computeVertexNormals();

  const cap = (ring, back) => {
    const geo = new THREE.ShapeGeometry(new THREE.Shape(ring.pts));
    if (back) geo.rotateY(Math.PI); // the outline is symmetric, so this just turns it to face -z
    geo.translate(0, 0, ring.z);
    return geo;
  };
  return { side, front: cap(rings[0], false), back: cap(rings[rings.length - 1], true) };
}

// Fine random grain, used to break up reflections on bead-blasted metal and frosted glass.
let grainTexture = null;
function grain() {
  if (grainTexture) return grainTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTexture = new THREE.CanvasTexture(c);
  grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
  grainTexture.repeat.set(6, 6);
  return grainTexture;
}

// Apple logo outline in a 100 × 120 box (y down), centred and scaled to `height`.
function appleLogoShapes(height) {
  const k = height / 120;
  const P = (x, y) => [(x - 50) * k, (60 - y) * k];
  const body = new THREE.Shape();
  const seg = (s, pts) => {
    for (let i = 0; i < pts.length; i += 3) s.bezierCurveTo(...P(...pts[i]), ...P(...pts[i + 1]), ...P(...pts[i + 2]));
  };
  body.moveTo(...P(50, 33));
  seg(body, [
    [58, 33], [68, 25], [79, 25], // right shoulder
    [88, 25], [96, 29], [100, 36],
    [90, 42], [85, 51], [85, 62], // bite
    [85, 74], [92, 83], [101, 87],
    [97, 99], [91, 110], [83, 117], // bottom right
    [77, 122], [71, 123], [65, 120],
    [59, 117], [55, 116], [50, 116], // bottom dip
    [45, 116], [41, 117], [35, 120],
    [29, 123], [23, 122], [17, 117],
    [7, 107], [0, 90], [0, 72], // left side
    [0, 48], [13, 25], [32, 25],
    [41, 25], [44, 33], [50, 33],
  ]);
  const leaf = new THREE.Shape();
  leaf.moveTo(...P(51, 26));
  seg(leaf, [
    [50, 15], [57, 5], [68, 1],
    [70, 12], [62, 24], [51, 26],
  ]);
  return [body, leaf];
}

const FRAME_FINISH = {
  aluminium: { metalness: 0.85, roughness: 0.38, clearcoat: 0.15, clearcoatRoughness: 0.35 },
  titanium: { metalness: 1, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.05 },
};

// Points on an elliptical arc in the (inset, z) cross-section plane, for body profiles.
function arcPoints(cd, cz, rd, rz, a0, a1, steps = 8) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / steps);
    pts.push([cd + rd * Math.cos(a), cz + rz * Math.sin(a)]);
  }
  return pts;
}

export function createPhone(spec) {
  const mm = (v) => v / 100;
  const [W, H, D] = spec.size.map(mm);
  const R = spec.radius ? mm(spec.radius) : W * 0.16;
  const bezel = mm(spec.bezel);
  const SH = H - bezel * 2;
  const SW = SH * (spec.screen[0] / spec.screen[1]);
  const SR = R - bezel * 0.95;
  const group = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  // Flat parts on the back face -z, so they are seen from behind.
  const addBack = (geo, mat, x, y, z) => {
    const m = add(geo, mat, x, y, z);
    m.rotation.y = Math.PI;
    return m;
  };

  // ---------- Materials ----------
  const metal = spec.frame === 'aluminium';
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, ...FRAME_FINISH[spec.frame], roughnessMap: metal ? grain() : null });
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9c4ba, metalness: 0, roughness: 0.55, roughnessMap: grain(), specularIntensity: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.45, envMapIntensity: 0.7,
  });
  const bumpGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xc9c4ba, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const plateauMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, metalness: 0.9, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const logoMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x030303, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.5,
  });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xa9a59d, roughness: 0.65 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x040404 });
  const darkMetalMat = new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, metalness: 1, roughness: 0.3 });
  const anodizedBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0c, metalness: 0.6, roughness: 0.45 });
  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05070f, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 0.8,
    iridescence: 0.8, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 550],
  });
  const lensElementMat = new THREE.MeshPhysicalMaterial({
    color: 0x16204a, metalness: 0.5, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 700],
  });
  const sapphireMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, clearcoat: 1, clearcoatRoughness: 0,
    transparent: true, opacity: 0.08, depthWrite: false,
  });
  const flashMat = new THREE.MeshPhysicalMaterial({ color: 0xf1ead7, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xe4c779, roughness: 0.6 });
  const hingeMat = new THREE.MeshPhysicalMaterial({ color: 0xbab5ab, metalness: 0.9, roughness: 0.5, roughnessMap: grain() });
  const controlMat = new THREE.MeshPhysicalMaterial({ color: 0x1d1d20, metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 });

  // ---------- Body ----------
  // Cross-section of the side, front edge to back edge. Flat sides have small rounded edges; the
  // 17 Pro unibody curves into the back.
  const lip = metal ? 0.005 : 0.004;
  const profile = arcPoints(lip, D / 2 - lip, lip, lip, 90, 180, 6);
  let flatBottom, backInset;
  if (spec.sides === 'rounded') {
    backInset = 0.03;
    const b = D * 0.5;
    profile.push(...arcPoints(backInset, -D / 2 + b, backInset, b, 180, 270, 14).slice(1));
    flatBottom = -D / 2 + b;
  } else {
    backInset = lip;
    profile.push(...arcPoints(lip, -D / 2 + lip, lip, lip, 180, 270, 6).slice(1));
    flatBottom = -D / 2 + lip;
  }
  const flatTop = D / 2 - lip;
  const edgeZ = (flatTop + flatBottom) / 2;
  const edgeDepth = flatTop - flatBottom;
  const shell = sweptBody(W, H, R, profile);
  add(shell.side, frameMat);
  add(shell.front, frameMat);
  add(shell.back, frameMat);

  // Front cover glass with 2.5D edges, sitting just proud of the frame.
  const glassT = 0.006;
  add(roundedSlab(W - 0.007, H - 0.007, R - 0.0035, glassT, 0.0026, 6), glassMat, 0, 0, D / 2 - glassT / 2 + 0.0005);
  const frontZ = D / 2 + 0.0005;

  // ---------- Front ----------
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  add(roundedPlane(SW, SH, SR), screenMat, 0, 0, frontZ + 0.0003);

  // Dynamic Island with the front camera and Face ID sensors faintly visible inside it, or a
  // hole-punch camera (iPhone Duo outer screen). The open Duo's inner camera is under the display.
  const island = new THREE.Group();
  group.add(island);
  const sensor = (x, r, color) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 0, 0.0001);
    island.add(m);
  };
  if (spec.cutout === 'island') {
    island.position.set(0, SH / 2 - 0.0545, frontZ + 0.0006);
    island.add(new THREE.Mesh(roundedPlane(0.126, 0.037, 0.0185), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    sensor(0.039, 0.0062, 0x0d1120);
    sensor(0.039, 0.0025, 0x1b2340);
    sensor(-0.03, 0.0035, 0x08080b);
  } else if (spec.cutout === 'hole') {
    island.position.set(0, SH / 2 - 0.042, frontZ + 0.0006);
    island.add(new THREE.Mesh(new THREE.CircleGeometry(0.017, 48), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    sensor(0, 0.0065, 0x0d1120);
    sensor(0, 0.0025, 0x1b2340);
  }
  if (spec.fold === 'open') {
    // Faint crease down the middle of the inner display.
    const crease = add(new THREE.PlaneGeometry(0.008, SH - 0.01), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false,
    }), 0, 0, frontZ + 0.0005);
    crease.castShadow = false;
  }

  // Earpiece slit in the border above the screen.
  add(roundedPlane(0.09, 0.0032, 0.0016), new THREE.MeshBasicMaterial({ color: 0x1b1b1d }), 0, H / 2 - 0.0088, frontZ + 0.0006);

  // Glass reflection layer: adds only the environment specular on top of the screen.
  const reflectMat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.03,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const reflection = add(roundedPlane(W - 0.016, H - 0.016, R - 0.008), reflectMat, 0, 0, frontZ + 0.001);

  // ---------- Back ----------
  let backZ; // outer surface of the back
  let logoY = 0;
  // The open Duo's back is in two halves: the camera half (+x) and the outer display (-x).
  const camHalf = spec.fold === 'open' ? { cx: W / 4, w: W / 2 } : { cx: 0, w: W };
  const backGlassZ = -(D / 2 - glassT / 2 + 0.0005);
  if (spec.sides === 'rounded') {
    backZ = -D / 2;
  } else if (spec.fold === 'open') {
    const hw = W / 2 - 0.0035 - 0.002;
    add(roundedSlab(hw, H - 0.007, [R - 0.0035, 0.008, 0.008, R - 0.0035], glassT, 0.0026, 6), backMat, W / 4 + 0.001, 0, backGlassZ);
    add(roundedSlab(hw, H - 0.007, [0.008, R - 0.0035, R - 0.0035, 0.008], glassT, 0.0026, 6), glassMat, -W / 4 - 0.001, 0, backGlassZ);
    backZ = -frontZ;
    // Hole-punch camera of the outer display, which faces backwards when the phone is open.
    const outerTop = H / 2 - 0.042 - mm(spec.bezel);
    addBack(new THREE.CircleGeometry(0.017, 48), holeMat, -W / 4, outerTop, backZ - 0.0002);
    addBack(new THREE.CircleGeometry(0.0065, 32), lensGlassMat, -W / 4, outerTop, backZ - 0.0003);
  } else {
    add(roundedSlab(W - 0.007, H - 0.007, R - 0.0035, glassT, 0.0026, 6), backMat, 0, 0, backGlassZ);
    backZ = -frontZ;
  }

  // ---------- Cameras ----------
  const lens = (x, y, z, rO, tele = false) => {
    const rI = rO * 0.78;
    const hB = 0.012;
    const pts = [
      [rO * 1.04, 0], [rO, 0.0015], [rO, hB * 0.72], [rO - 0.0012, hB * 0.92], [rO - 0.003, hB],
      [rI + 0.003, hB], [rI + 0.001, hB - 0.0008], [rI, hB - 0.0025], [rI, 0],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    const barrel = new THREE.LatheGeometry(pts, 96);
    barrel.rotateX(-Math.PI / 2); // height now grows along -z, out of the back
    add(barrel, frameMat, x, y, z);
    const top = z - hB;
    const floor = top + 0.0045;
    addBack(new THREE.RingGeometry(rO * 0.56, rI, 96), anodizedBlackMat, x, y, floor);
    addBack(new THREE.RingGeometry(rO * 0.52, rO * 0.56, 96), darkMetalMat, x, y, floor - 0.0001);
    if (tele) {
      // Tetraprism telephoto: a squarish element inside the round lens.
      addBack(new THREE.CircleGeometry(rO * 0.52, 96), lensGlassMat, x, y, floor - 0.0001);
      addBack(roundedPlane(rO * 0.62, rO * 0.62, rO * 0.1), lensElementMat, x, y, floor - 0.0003);
      addBack(roundedPlane(rO * 0.3, rO * 0.3, rO * 0.05), holeMat, x, y, floor - 0.0004);
    } else {
      addBack(new THREE.CircleGeometry(rO * 0.52, 96), lensGlassMat, x, y, floor - 0.0001);
      addBack(new THREE.RingGeometry(rO * 0.22, rO * 0.32, 64), lensElementMat, x, y, floor - 0.0003);
      addBack(new THREE.CircleGeometry(rO * 0.17, 64), lensGlassMat, x, y, floor - 0.0004);
      addBack(new THREE.CircleGeometry(rO * 0.075, 32), holeMat, x, y, floor - 0.0005);
    }
    addBack(new THREE.CircleGeometry(rI, 96), sapphireMat, x, y, top + 0.0012);
  };
  const flash = (x, y, z) => {
    addBack(new THREE.RingGeometry(0.0205, 0.0245, 64), darkMetalMat, x, y, z - 0.0002);
    addBack(new THREE.CircleGeometry(0.0205, 64), flashMat, x, y, z - 0.0002);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      addBack(roundedPlane(0.0055, 0.0055, 0.001), ledMat, x + dx * 0.0045, y + dy * 0.0045, z - 0.0003);
    }
  };
  const lidar = (x, y, z) => {
    addBack(new THREE.RingGeometry(0.019, 0.0225, 64), darkMetalMat, x, y, z - 0.0002);
    addBack(new THREE.CircleGeometry(0.019, 64), lensGlassMat, x, y, z - 0.0002);
    addBack(new THREE.CircleGeometry(0.0085, 48), lensElementMat, x + 0.004, y, z - 0.0003);
    addBack(new THREE.CircleGeometry(0.005, 32), lensElementMat, x - 0.007, y, z - 0.0003);
  };
  const mic = (x, y, z) => {
    addBack(new THREE.RingGeometry(0.0042, 0.0056, 32), darkMetalMat, x, y, z - 0.0002);
    addBack(new THREE.CircleGeometry(0.0042, 32), holeMat, x, y, z - 0.0002);
  };
  // Raised slab on the back; returns the z of its outer surface.
  const raise = (w, h, r, cx, cy, rise, mat, bevel = 0.005, embed = 0.004) => {
    add(roundedSlab(w, h, r, rise + embed, bevel, 8), mat, cx, cy, backZ - rise / 2 + embed / 2);
    return backZ - rise;
  };

  if (spec.camera === 'plateau') {
    // 17 Pro: aluminium plateau across the full width, three lenses on the left, flash and LiDAR on the right.
    const ph = H * 0.285;
    const cy = H / 2 - 0.006 - ph / 2;
    // It reaches down into the body so its sides continue the flat side walls.
    const z = raise(W - 0.002, ph, [R - 0.001, R - 0.001, 0.05, 0.05], 0, cy, 0.017, frameMat, 0.007, D / 2 + flatBottom + 0.002);
    const rO = W * 0.112;
    const k = rO * 1.13;
    const cx = W / 2 - 0.035 - k - rO;
    lens(cx + k, cy + k, z, rO);
    lens(cx + k, cy - k, z, rO, true);
    lens(cx - k, cy, z, rO);
    const fx = -W / 2 + 0.08;
    flash(fx, cy + 0.075, z);
    lidar(fx, cy - 0.075, z);
    mic(fx, cy, z);
    // Ceramic Shield glass panel below the plateau, with the logo centred on it.
    const top = cy - ph / 2 - 0.012;
    const bottom = -H / 2 + backInset + 0.012;
    const gw = W - backInset * 2 - 0.024;
    const gh = top - bottom;
    const t = 0.003;
    add(roundedSlab(gw, gh, [0.035, 0.035, R - backInset - 0.012, R - backInset - 0.012], t, 0.0012, 4), backMat,
      0, (top + bottom) / 2, -D / 2 + t / 2 - 0.0004);
    logoY = (top + bottom) / 2;
    backZ = -D / 2 - 0.0004;
  } else if (spec.camera === 'pill') {
    // 17: raised glass pill with two lenses, flash beside it.
    const pw = 0.16, ph = 0.34;
    const cx = W / 2 - 0.045 - pw / 2, cy = H / 2 - 0.045 - ph / 2;
    const z = raise(pw, ph, pw / 2, cx, cy, 0.011, bumpGlassMat, 0.0045);
    const ly = ph / 2 - pw / 2;
    lens(cx, cy + ly, z, 0.062);
    lens(cx, cy - ly, z, 0.062);
    flash(cx - pw / 2 - 0.05, cy + ly, backZ);
    mic(cx - pw / 2 - 0.05, cy + ly - 0.055, backZ);
  } else if (spec.camera === 'bar') {
    // Air: plateau bar across the top with one lens on the left and the flash on the right.
    const bh = H * 0.155;
    const bw = W - 0.07;
    const cy = H / 2 - 0.035 - bh / 2;
    const z = raise(bw, bh, bh / 2, 0, cy, 0.011, plateauMat, 0.0045);
    lens(bw / 2 - bh / 2, cy, z, 0.078);
    flash(-bw / 2 + bh / 2, cy, z);
    mic(-bw / 2 + bh / 2 + 0.055, cy, z);
  } else if (spec.camera === 'duo') {
    // iPhone Duo: plateau bar across the camera half with two lenses on the outer side and the flash.
    const bh = 0.2;
    const bw = camHalf.w - 0.07;
    const cy = H / 2 - 0.035 - bh / 2;
    const z = raise(bw, bh, bh / 2, camHalf.cx, cy, 0.011, plateauMat, 0.0045);
    const lx = camHalf.cx + bw / 2 - bh / 2;
    lens(lx, cy, z, 0.07);
    lens(lx - 0.165, cy, z, 0.07);
    flash(camHalf.cx - bw / 2 + bh / 2, cy, z);
    mic(camHalf.cx - bw / 2 + bh / 2 + 0.055, cy, z);
  }

  // Apple logo.
  const logo = new THREE.ShapeGeometry(appleLogoShapes(0.14), 24);
  addBack(logo, logoMat, camHalf.cx, logoY, backZ - 0.0002);

  // ---------- Fold ----------
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
  if (spec.fold === 'closed') {
    // Hinge spine along the left edge, and the gap between the two halves on the other edges.
    const hr = D / 2 - 0.002;
    add(new THREE.CylinderGeometry(hr, hr, H - R * 1.6, 48), hingeMat, -W / 2 + hr - 0.005, 0, 0);
    add(new THREE.BoxGeometry(0.0024, H - R * 2, 0.0025), seamMat, W / 2 - 0.0008, 0, 0);
    for (const sy of [1, -1]) add(new THREE.BoxGeometry(W - R * 2, 0.0024, 0.0025), seamMat, 0, sy * (H / 2 - 0.0008), 0);
  } else if (spec.fold === 'open') {
    for (const sy of [1, -1]) add(new THREE.BoxGeometry(0.004, 0.0024, D * 0.9), seamMat, 0, sy * (H / 2 - 0.0008), 0);
    addBack(new THREE.PlaneGeometry(0.003, H - 0.02), seamMat, 0, 0, backZ - 0.0002);
  }

  // ---------- Edges ----------
  // Antenna bands.
  const sideBand = new THREE.BoxGeometry(0.004, 0.0035, edgeDepth * 0.98);
  for (const sx of [-1, 1]) {
    for (const y of [H * 0.42, -H * 0.42]) add(sideBand, bandMat, sx * (W / 2 - 0.0016), y, edgeZ);
  }
  const endBand = new THREE.BoxGeometry(0.0035, 0.004, edgeDepth * 0.98);
  for (const [x, sy] of [[W * 0.28, 1], [-W * 0.28, 1], [W * 0.33, -1], [-W * 0.33, -1]]) {
    add(endBand, bandMat, x, sy * (H / 2 - 0.0016), edgeZ);
  }

  // Bottom edge: USB-C port, speaker and microphone grilles, screws. Shapes here face -y.
  const bottom = new THREE.Group();
  bottom.rotation.x = Math.PI / 2;
  bottom.position.set(0, -H / 2 - 0.0003, edgeZ);
  group.add(bottom);
  const onEdge = (parent, geo, mat, x, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    parent.add(m);
  };
  const portH = Math.min(0.031, edgeDepth * 0.8);
  onEdge(bottom, roundedPlane(0.089, portH, portH / 2), holeMat, 0);
  onEdge(bottom, roundedPlane(0.081, portH * 0.74, portH * 0.37), darkMetalMat, 0, 0.0001);
  onEdge(bottom, roundedPlane(0.07, portH * 0.5, portH * 0.25), holeMat, 0, 0.0002);
  onEdge(bottom, roundedPlane(0.062, portH * 0.2, portH * 0.1), darkMetalMat, 0, 0.0003);
  if (spec.speakers) {
    const holeGeo = new THREE.CircleGeometry(0.0055, 24);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) onEdge(bottom, holeGeo, holeMat, sx * (0.105 + i * 0.019));
      onEdge(bottom, new THREE.CircleGeometry(0.0065, 24), darkMetalMat, sx * 0.07);
      onEdge(bottom, new THREE.CircleGeometry(0.0025, 5), holeMat, sx * 0.07, 0.0001);
    }
  }
  // Top edge microphone.
  const topEdge = new THREE.Group();
  topEdge.rotation.x = -Math.PI / 2;
  topEdge.position.set(0, H / 2 + 0.0003, edgeZ);
  group.add(topEdge);
  onEdge(topEdge, new THREE.CircleGeometry(0.0045, 24), holeMat, -W * 0.18);

  // Side buttons, positioned from the top edge. Action button and volume on the left, side button
  // and Camera Control on the right.
  const btnDepth = Math.min(0.03, edgeDepth * 0.72);
  const button = (side, fromTop, len, mat = frameMat, depth = btnDepth, width = 0.014, out = 0.002) => {
    const b = add(new RoundedBoxGeometry(width, len, depth, 6, Math.min(depth, width) * 0.45), mat,
      side * (W / 2 + out), H / 2 - fromTop, edgeZ);
    return b;
  };
  let ccFromTop = H * 0.64;
  if (spec.buttons === 'duo') {
    // iPhone Duo: volume on the top edge, Touch ID side button and Camera Control on the right.
    for (const x of [W / 2 - 0.16, W / 2 - 0.28]) {
      add(new RoundedBoxGeometry(0.1, 0.014, btnDepth, 6, 0.006), frameMat, x, H / 2 + 0.002, edgeZ);
    }
    button(1, 0.22, 0.15);
    ccFromTop = H * 0.62;
  } else {
    button(-1, 0.27, 0.065);
    button(-1, 0.41, 0.1);
    button(-1, 0.545, 0.1);
    button(1, 0.47, 0.17);
  }
  // Camera Control: a flush sapphire button with a metal surround.
  button(1, ccFromTop, 0.21, frameMat, btnDepth + 0.006, 0.01, -0.0035);
  button(1, ccFromTop, 0.195, controlMat, btnDepth, 0.0105, -0.003);

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
      plateauMat.color.setHex(frameHex);
      hingeMat.color.setHex(frameHex);
      logoMat.color.setHex(frameHex);
      backMat.color.setHex(backHex);
      bumpGlassMat.color.setHex(backHex);
      bandMat.color.setHex(frameHex).multiplyScalar(0.85);
    },
  };
}

// Placeholder lock screen shown until a screenshot is uploaded.
export function placeholderCanvas() {
  const c = document.createElement('canvas');
  c.width = 1206;
  c.height = 2622;
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

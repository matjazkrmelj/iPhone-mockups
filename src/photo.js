import * as THREE from 'three';
import { WebGLPathTracer, ShapedAreaLight } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Path-traced "photo" render: true reflections, soft shadows and light bouncing between surfaces.
//
// The path tracer has no shadow catcher, so the shadow is found with three passes and composited
// over the chosen background (or transparency):
//   phones  phones only, the floor invisible to the camera but still lighting them (alpha = coverage)
//   lit     phones and floor
//   empty   floor only
// The floor's shadow is lit / empty, applied to the background colour.

let tracer = null;
function getTracer(renderer) {
  if (!tracer) {
    tracer = new WebGLPathTracer(renderer);
    tracer.renderToCanvas = false;
    tracer.renderDelay = 0;
    tracer.minSamples = 1;
    tracer.fadeDuration = 0;
    tracer.tiles.set(2, 2);
    tracer.filterGlossyFactor = 0.5;
    // Same random sequence in every pass, so the noise in the lit and empty floor passes matches
    // and cancels out when they are divided.
    tracer.stableNoise = true;
  }
  return tracer;
}

// Copies a texture as is, alpha included.
const copyQuad = new FullScreenQuad(new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.NoBlending }));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function trace(renderer, scene, camera, samples, onSample, isCancelled) {
  const pt = getTracer(renderer);
  pt.setScene(scene, camera);
  pt.reset();
  // The tracer only switches to alpha output after its first sample; switch it now so the
  // first sample keeps transparency too.
  pt._pathTracer.alpha = true;
  while (pt.samples < samples) {
    pt.renderSample();
    onSample(pt.samples);
    await nextFrame();
    if (isCancelled()) throw new Error('cancelled');
  }
  // Copy the result out, as the path tracer reuses its target for the next pass.
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.FloatType });
  copyQuad.material.map = pt.target.texture;
  renderer.setRenderTarget(target);
  copyQuad.render(renderer);
  renderer.setRenderTarget(null);
  return target;
}

const compositeMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tPhones: { value: null },
    tLit: { value: null },
    tEmpty: { value: null },
    background: { value: new THREE.Color() },
    transparent: { value: false },
    shadowStrength: { value: 1 },
    exposure: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tPhones, tLit, tEmpty;
    uniform vec3 background;
    uniform bool transparent;
    uniform float shadowStrength, exposure;
    varying vec2 vUv;

    // Khronos PBR Neutral tone mapping, the same curve as the live preview.
    vec3 neutral(vec3 color) {
      const float start = 0.8 - 0.04;
      const float desaturation = 0.15;
      float x = min(color.r, min(color.g, color.b));
      float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
      color -= offset;
      float peak = max(color.r, max(color.g, color.b));
      if (peak < start) return color;
      float d = 1.0 - start;
      float newPeak = 1.0 - d * d / (peak + d - start);
      color *= newPeak / peak;
      float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
      return mix(color, vec3(newPeak), g);
    }

    void main() {
      vec4 p = texture2D(tPhones, vUv);
      vec3 phone = p.a > 0.0 ? neutral(p.rgb / p.a * exposure) * p.a : vec3(0.0);
      const vec3 lum = vec3(0.2126, 0.7152, 0.0722);
      // Shadows are soft, so average a small neighbourhood to smooth out any remaining noise.
      float lit = 0.0, empty = 0.0;
      vec2 texel = 1.0 / vec2(textureSize(tLit, 0));
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 uv = vUv + vec2(x, y) * texel * 1.5;
          lit += dot(texture2D(tLit, uv).rgb, lum);
          empty += dot(texture2D(tEmpty, uv).rgb, lum);
        }
      }
      float shade = empty > 1e-4 ? clamp(lit / empty, 0.0, 1.0) : 1.0;
      float darken = min(1.0, (1.0 - shade) * shadowStrength);
      if (transparent) {
        gl_FragColor = vec4(phone, p.a + darken * (1.0 - p.a));
      } else {
        gl_FragColor = vec4(phone + background * (1.0 - darken) * (1.0 - p.a), 1.0);
      }
      #include <colorspace_fragment>
    }
  `,
  toneMapped: false,
});
const compositeQuad = new FullScreenQuad(compositeMaterial);

// Renders the scene to the renderer's canvas at its current size. `phones` are the phone objects
// from createPhone; `floor` is the surface mesh to light and catch shadows.
export async function renderPhoto({
  renderer, scene, camera, phones, floor, key, softness, samples, background, transparent,
  shadowStrength, exposure, onProgress = () => {}, isCancelled = () => false,
}) {
  // Swap in path-tracing friendly versions of a few materials, and restore them afterwards.
  const restore = [];
  const swap = (obj, prop, value) => {
    restore.push([obj, prop, obj[prop]]);
    obj[prop] = value;
  };
  const prevBackground = scene.background;
  const envIntensity = scene.environmentIntensity;
  swap(scene, 'background', null);
  for (const p of phones) {
    // The screen glows rather than being lit, and the real glass reflection replaces the overlay.
    const glare = p.reflection.material.opacity;
    swap(p.screen, 'material', new THREE.MeshPhysicalMaterial({
      color: 0x000000, emissive: 0xffffff, emissiveMap: p.screenMat.map, emissiveIntensity: 1,
      roughness: 0.04, metalness: 0, specularIntensity: Math.min(1, glare * 2.5),
    }));
    swap(p.reflection, 'visible', false);
  }
  const photoFloor = new THREE.Mesh(floor.geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  photoFloor.position.copy(floor.position);
  photoFloor.quaternion.copy(floor.quaternion);
  swap(floor, 'visible', false);

  // Soft key light: a round area light where the directional light is, sized by the softness slider.
  const diameter = Math.max(0.05, softness * 0.08);
  const area = new ShapedAreaLight(0xffffff, 1, diameter, diameter);
  area.isCircular = true;
  area.position.copy(key.position);
  area.lookAt(0, 0, 0);
  const distance = key.position.length();
  area.intensity = (key.intensity * distance * distance) / (Math.PI * (diameter / 2) ** 2);
  swap(key, 'visible', false);
  if (key.intensity > 0) scene.add(area);

  const targets = [];
  try {
    const passes = [
      ['phones', samples],
      ['lit', Math.max(16, samples / 2)],
      ['empty', Math.max(16, samples / 2)],
    ];
    const total = passes.reduce((sum, [, n]) => sum + n, 0);
    let done = 0;
    for (const [pass, n] of passes) {
      for (const p of phones) p.group.visible = pass !== 'empty';
      photoFloor.material.matte = pass === 'phones';
      // Long studio softboxes cast long, faint shadow streaks across the floor; dim the
      // environment in the shadow passes so the shadow comes mostly from the key light, plus
      // contact shadow where the phone meets the surface.
      scene.environmentIntensity = pass === 'phones' ? envIntensity : envIntensity * 0.35;
      photoFloor.material.needsUpdate = true;
      scene.add(photoFloor);
      targets.push(await trace(renderer, scene, camera, n, (s) => onProgress((done + Math.min(s, n)) / total), isCancelled));
      scene.remove(photoFloor);
      done += n;
    }
    compositeMaterial.uniforms.tPhones.value = targets[0].texture;
    compositeMaterial.uniforms.tLit.value = targets[1].texture;
    compositeMaterial.uniforms.tEmpty.value = targets[2].texture;
    compositeMaterial.uniforms.background.value.set(background);
    compositeMaterial.uniforms.transparent.value = transparent;
    compositeMaterial.uniforms.shadowStrength.value = shadowStrength;
    compositeMaterial.uniforms.exposure.value = exposure;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    compositeQuad.render(renderer);
  } finally {
    scene.remove(photoFloor, area);
    for (const p of phones) p.group.visible = true;
    for (const [obj, prop, value] of restore.reverse()) {
      if (prop === 'material' && obj[prop] !== value) obj[prop].dispose();
      obj[prop] = value;
    }
    scene.background = prevBackground;
    scene.environmentIntensity = envIntensity;
    photoFloor.material.dispose();
    targets.forEach((t) => t.dispose());
  }
}

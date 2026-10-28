# iPhone Mockup Generator

![Example export](docs/example-export.png)

A local web app that renders detailed 3D iPhones (the iPhone 17 and 18 lineups, iPhone Air and the foldable iPhone Duo) with your own screenshots on the display, lets you rotate them on the X/Y/Z axes, and exports the view as a PNG.

## Run it

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Live version: https://matjazkrmelj.github.io/iPhone-mockups/ (deployed by GitHub Actions on every push to `main`).

To build a static version: `npm run build` (output in `dist/`, serve with `npm run preview`).

## Features

- **Phones**: up to three phones in one scene, each with its own model, colour, screenshot, rotation and position. Click a phone (or its tab) to select it; the sidebar edits the selected phone. *Spacing* sets the gap between them.
- **Models**: iPhone 18 Pro, 18 Pro Max, iPhone Duo (closed and open), 17 Pro, 17 Pro Max, iPhone Air and iPhone 17, built procedurally from Apple's published dimensions and screen resolutions. Each has its own body profile (flat sides, or the Pro unibody that curves into the back), camera plateau or bump with layered lenses (the tetraprism telephoto on the Pros), flash, LiDAR, Apple logo, glass and metal finishes, antenna bands, buttons, Camera Control, USB-C port and speaker grilles, and its official colours. The iPhone Duo has its hole-punch outer screen and hinge when closed, and the inner screen with its crease when open. iPhone 18 Pro models use the 17 Pro body, which has the same dimensions.
- **Your own models**: *Load your own model (.glb)* adds a detailed 3D model you have the rights to use, such as one bought on Sketchfab. The file stays in your browser (it is remembered for your next visit, and never uploaded or published), so models whose license forbids redistribution can still be used. The screen is found by its material name (containing "screen" or "display") and gets your screenshot; colours tint the parts whose materials are named after the finish (`COLOUR_…`, `C_…`). A foldable with an open/close animation is offered both closed and open. *Remove model* deletes it from the browser.
- **Screenshot**: upload, drag & drop, or paste (Cmd/Ctrl+V) an image onto the selected phone. "Cover" crops to the screen's aspect ratio; "Stretch" fills it exactly. Native screenshots for that model fit perfectly. The Dynamic Island / notch overlay can be toggled off.
- **Rotation**: drag a phone to turn it (Shift+drag rolls on Z, scroll wheel zooms), or use the X, Y and Z sliders (−180° to 180°). Double-click a slider, or click its value, to reset that axis. Presets for common angles.
- **Scene**: zoom, background colour, transparent background.
- **Surface**: choose whether the phones are *Standing* on a floor or *Lying flat* on a table. Shadows are cast onto that surface, which always touches the phones' lowest point whatever their rotation.
- **Light**: a real-world lighting environment (studio, warehouse, lobby, apartment or city HDRI, which the phones reflect), key light direction and elevation (measured from the surface), strength, environment reflections, screen glare and exposure.
- **Shadow**: on/off, opacity, softness, and the gap between the phone and the surface.
- **Camera height**: look down at the scene (defaults to 20° when standing, 0° when lying flat).
- **Export**: choose a format (fit the window, Square 1:1, Portrait 4:5, Story 9:16, Landscape 16:9, App Store 6.9″ at 1290 × 2796, or a custom size). Fixed formats show a frame of that shape, so the preview matches the PNG. Size multiplies the format by 1×–4×. With "Transparent background" on, the PNG has an alpha channel. *Quality* picks how the PNG is rendered: *Fast* uses the live preview, while *Photo* (draft, high, best) path traces the scene for true reflections, soft shadows and light bouncing between surfaces. *Preview photo* renders that in the window first. Photo rendering takes from a few seconds to a minute or more depending on your GPU and the size.

## Files

- `src/models.js` lists the iPhone models: dimensions, screen resolution, design features and colours.
- `src/phone.js` builds an iPhone procedurally with Three.js from one of those models: a frame swept along a cross-section profile, cover glass with rounded edges, Dynamic Island or hole-punch camera, back glass, camera modules, Apple logo, antenna bands, port, grilles and buttons.
- `src/main.js` handles the scene, sidebar controls, and export.
- `src/customModel.js` loads your own .glb models, stores them in the browser (IndexedDB), finds the front screen and poses, and recolours them.
- `src/photo.js` renders the photo-quality image with [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer), compositing the floor shadow onto the background.

The lighting environments are CC0 HDRIs from [Poly Haven](https://polyhaven.com), via [@pmndrs/assets](https://github.com/pmndrs/assets).

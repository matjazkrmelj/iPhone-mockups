# iPhone Mockup Generator

![Example export](docs/example-export.png)

A local web app that renders a 3D iPhone (iPhone 15 Pro proportions) with your own screenshot on the display, lets you rotate it on the X/Y/Z axes, and exports the view as a PNG.

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

- **Screenshot**: upload, drag & drop, or paste (Cmd/Ctrl+V) an image. "Cover" crops to the screen's aspect ratio; "Stretch" fills it exactly. Native iPhone screenshots (e.g. 1179 × 2556) fit perfectly. The Dynamic Island overlay can be toggled off.
- **Rotation**: drag the phone to turn it (Shift+drag rolls on Z, scroll wheel zooms), or use the X, Y and Z sliders (−180° to 180°). Double-click a slider, or click its value, to reset that axis. Presets for common angles.
- **Scene**: zoom, frame colour (Natural / Black / White / Blue Titanium), background colour, transparent background.
- **Light**: key light direction, height and strength, environment reflections, screen glare and exposure.
- **Shadow**: on/off, opacity, softness and distance to the backdrop.
- **Export**: PNG at 1×–4× the viewport size. With "Transparent background" on, the PNG has an alpha channel.

## Files

- `src/phone.js` builds the iPhone model procedurally with Three.js (no external model files): rounded titanium frame, raised cover glass, antenna bands, USB-C port, speaker grilles, side buttons and a detailed camera plateau.
- `src/main.js` handles the scene, sidebar controls, and export.

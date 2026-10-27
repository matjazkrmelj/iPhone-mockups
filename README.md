# iPhone Mockup Generator

![Example export](docs/example-export.png)

A local web app that renders 3D iPhones (iPhone 13 to iPhone 17, in every size) with your own screenshots on the display, lets you rotate them on the X/Y/Z axes, and exports the view as a PNG.

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
- **Models**: iPhone 13, 14, 15, 16 and 17 in the regular, Plus, Pro and Pro Max sizes (13 Pro Max, not 13 Plus), built procedurally from Apple's published dimensions with each generation's notch or Dynamic Island, camera layout, port, buttons and colours. *iPhone 14 Pro (detailed)* is a full 3D model and is the default.
- **Screenshot**: upload, drag & drop, or paste (Cmd/Ctrl+V) an image onto the selected phone. "Cover" crops to the screen's aspect ratio; "Stretch" fills it exactly. Native screenshots for that model fit perfectly. The Dynamic Island / notch overlay can be toggled off.
- **Rotation**: drag a phone to turn it (Shift+drag rolls on Z, scroll wheel zooms), or use the X, Y and Z sliders (−180° to 180°). Double-click a slider, or click its value, to reset that axis. Presets for common angles.
- **Scene**: zoom, background colour, transparent background.
- **Surface**: choose whether the phones are *Standing* on a floor or *Lying flat* on a table. Shadows are cast onto that surface, which always touches the phones' lowest point whatever their rotation.
- **Light**: key light direction and elevation (measured from the surface), strength, environment reflections, screen glare and exposure.
- **Shadow**: on/off, opacity, softness, and the gap between the phone and the surface.
- **Camera height**: look down at the scene (defaults to 20° when standing, 0° when lying flat).
- **Export**: choose a format (fit the window, Square 1:1, Portrait 4:5, Story 9:16, Landscape 16:9, App Store 6.9″ at 1290 × 2796, or a custom size). Fixed formats show a frame of that shape, so the preview matches the PNG. Size multiplies the format by 1×–4×. With "Transparent background" on, the PNG has an alpha channel.

## Credits

The detailed model is ["iPhone 14 Pro"](https://sketchfab.com/3d-models/iphone-14-pro-5cb0778041a34f09b409a38c687bb1d4) by [mister dude](https://sketchfab.com/misterdude), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The screen, Dynamic Island overlay and colour tints are added by this app.

## Files

- `src/models.js` lists the iPhone models: dimensions, screen resolution, design features and colours.
- `src/phone.js` builds an iPhone procedurally with Three.js from one of those models: rounded frame, raised cover glass, notch or Dynamic Island, antenna bands, port, speaker grilles, side buttons and the camera layout.
- `src/glbPhone.js` loads the detailed model (`public/models/iphone-14-pro.glb`) and overlays the screenshot on its screen.
- `src/main.js` handles the scene, sidebar controls, and export.

// iPhone models from iPhone 13 onwards. Sizes are width × height × depth in mm (Apple tech specs);
// `screen` is the native screenshot resolution, which sets the screen's aspect ratio.

// Finish colours as [name, frame, back].
const COLORS = {
  13: {
    midnight: ['Midnight', 0x2b2f35, 0x232a31],
    starlight: ['Starlight', 0xe6ddd2, 0xf9f3ee],
    blue: ['Blue', 0x2a4a6b, 0x215e7c],
    pink: ['Pink', 0xf2c7c8, 0xfae0d8],
    green: ['Green', 0x3b4d3e, 0x394c38],
    red: ['(PRODUCT)RED', 0xb3121d, 0xbf0013],
  },
  '13pro': {
    graphite: ['Graphite', 0x50504e, 0x54524f],
    gold: ['Gold', 0xe9d3b0, 0xf8e8cf],
    silver: ['Silver', 0xe3e4e5, 0xf1f2ed],
    sierraBlue: ['Sierra Blue', 0x9bb5ce, 0xa7c1d9],
    alpineGreen: ['Alpine Green', 0x505f4e, 0x576856],
  },
  14: {
    midnight: ['Midnight', 0x2b2f35, 0x232a31],
    starlight: ['Starlight', 0xe6ddd2, 0xf9f3ee],
    blue: ['Blue', 0x9eb4c7, 0xa0b4c7],
    purple: ['Purple', 0xd8cde1, 0xe5ddea],
    yellow: ['Yellow', 0xf6e17b, 0xf9e479],
    red: ['(PRODUCT)RED', 0xb3121d, 0xbf0013],
  },
  '14pro': {
    spaceBlack: ['Space Black', 0x403e3d, 0x3b3a38],
    silver: ['Silver', 0xe3e4e5, 0xf1f2ed],
    gold: ['Gold', 0xf0dfbf, 0xf4e8ce],
    deepPurple: ['Deep Purple', 0x594f63, 0x635b6e],
  },
  15: {
    black: ['Black', 0x35393b, 0x3c4042],
    blue: ['Blue', 0xd5dde0, 0xcfdbe3],
    green: ['Green', 0xd0d9c6, 0xcad4c5],
    yellow: ['Yellow', 0xf2e9c7, 0xf0e6bf],
    pink: ['Pink', 0xe3c8ca, 0xebd0d3],
  },
  '15pro': {
    natural: ['Natural Titanium', 0xbab5ab, 0xc9c4ba],
    black: ['Black Titanium', 0x3d3d40, 0x38383b],
    white: ['White Titanium', 0xe2e1dd, 0xefeeea],
    blue: ['Blue Titanium', 0x3f4657, 0x495064],
  },
  16: {
    black: ['Black', 0x3c3c3d, 0x3c3c3d],
    white: ['White', 0xf0f0ef, 0xf5f5f3],
    pink: ['Pink', 0xe9a9c6, 0xf2adda],
    teal: ['Teal', 0x9fc8c4, 0xb0d4d2],
    ultramarine: ['Ultramarine', 0x7b8ae3, 0x9aadf6],
  },
  '16pro': {
    black: ['Black Titanium', 0x3d3d40, 0x3c3c3d],
    white: ['White Titanium', 0xe2e1dd, 0xf2f1ed],
    natural: ['Natural Titanium', 0xbab5ab, 0xc2bcb2],
    desert: ['Desert Titanium', 0xbfa48f, 0xc8ae98],
  },
  17: {
    black: ['Black', 0x353535, 0x353535],
    white: ['White', 0xeeeeec, 0xf3f3f1],
    mistBlue: ['Mist Blue', 0xa9bed6, 0xb3c4db],
    sage: ['Sage', 0xb7c0a7, 0xbbc5ab],
    lavender: ['Lavender', 0xcfbfe0, 0xd8c9e6],
  },
  air: {
    spaceBlack: ['Space Black', 0x2e2e30, 0x303033],
    cloudWhite: ['Cloud White', 0xe9e9e6, 0xf4f4f2],
    lightGold: ['Light Gold', 0xe6d6b8, 0xf0e4cc],
    skyBlue: ['Sky Blue', 0xc5d6e6, 0xd3e1ee],
  },
  '17pro': {
    silver: ['Silver', 0xd9d9d9, 0xe3e4e5],
    cosmicOrange: ['Cosmic Orange', 0xe2662c, 0xf07a35],
    deepBlue: ['Deep Blue', 0x313d58, 0x34405e],
  },
};

// Design of each generation.
//   frame: aluminium | steel | titanium      back: gloss | matte
//   camera: diagonal | vertical | pill | triple | plateau | bar
//   cutout: notch | island                   port: lightning | usbc
//   button: switch (mute switch) | action    cameraControl: has the Camera Control button
//   bezel: screen border in mm
const FAMILIES = {
  13: { frame: 'aluminium', back: 'gloss', camera: 'diagonal', cutout: 'notch', port: 'lightning', button: 'switch', bezel: 2.6 },
  '13pro': { frame: 'steel', back: 'matte', camera: 'triple', cutout: 'notch', port: 'lightning', button: 'switch', bezel: 2.3 },
  14: { frame: 'aluminium', back: 'gloss', camera: 'diagonal', cutout: 'notch', port: 'lightning', button: 'switch', bezel: 2.6 },
  '14pro': { frame: 'steel', back: 'matte', camera: 'triple', cutout: 'island', port: 'lightning', button: 'switch', bezel: 2.2 },
  15: { frame: 'aluminium', back: 'matte', camera: 'vertical', cutout: 'island', port: 'usbc', button: 'switch', bezel: 2.4 },
  '15pro': { frame: 'titanium', back: 'matte', camera: 'triple', cutout: 'island', port: 'usbc', button: 'action', bezel: 2.2 },
  16: { frame: 'aluminium', back: 'matte', camera: 'pill', cutout: 'island', port: 'usbc', button: 'action', cameraControl: true, bezel: 2.3 },
  '16pro': { frame: 'titanium', back: 'matte', camera: 'triple', cutout: 'island', port: 'usbc', button: 'action', cameraControl: true, bezel: 1.9 },
  17: { frame: 'aluminium', back: 'matte', camera: 'pill', cutout: 'island', port: 'usbc', button: 'action', cameraControl: true, bezel: 1.9 },
  air: { frame: 'titanium', back: 'matte', camera: 'bar', cutout: 'island', port: 'usbc', button: 'action', cameraControl: true, bezel: 1.9 },
  '17pro': { frame: 'aluminium', back: 'matte', camera: 'plateau', cutout: 'island', port: 'usbc', button: 'action', cameraControl: true, bezel: 1.9 },
};

const model = (id, name, family, size, screen) => ({
  id, name, family, size, screen, ...FAMILIES[family], colors: COLORS[family],
});

export const MODELS = [
  model('17promax', 'iPhone 17 Pro Max', '17pro', [78.0, 163.4, 8.75], [1320, 2868]),
  model('17pro', 'iPhone 17 Pro', '17pro', [71.9, 150.0, 8.75], [1206, 2622]),
  model('air', 'iPhone Air', 'air', [74.7, 156.2, 5.64], [1260, 2736]),
  model('17', 'iPhone 17', 17, [71.5, 149.6, 7.95], [1206, 2622]),
  model('16promax', 'iPhone 16 Pro Max', '16pro', [77.6, 163.0, 8.25], [1320, 2868]),
  model('16pro', 'iPhone 16 Pro', '16pro', [71.5, 149.6, 8.25], [1206, 2622]),
  model('16plus', 'iPhone 16 Plus', 16, [77.8, 160.9, 7.8], [1290, 2796]),
  model('16', 'iPhone 16', 16, [71.6, 147.6, 7.8], [1179, 2556]),
  model('15promax', 'iPhone 15 Pro Max', '15pro', [76.7, 159.9, 8.25], [1290, 2796]),
  model('15pro', 'iPhone 15 Pro', '15pro', [70.6, 146.6, 8.25], [1179, 2556]),
  model('15plus', 'iPhone 15 Plus', 15, [77.8, 160.9, 7.8], [1290, 2796]),
  model('15', 'iPhone 15', 15, [71.6, 147.6, 7.8], [1179, 2556]),
  model('14promax', 'iPhone 14 Pro Max', '14pro', [77.6, 160.7, 7.85], [1290, 2796]),
  model('14pro', 'iPhone 14 Pro', '14pro', [71.5, 147.5, 7.85], [1179, 2556]),
  model('14plus', 'iPhone 14 Plus', 14, [78.1, 160.8, 7.8], [1284, 2778]),
  model('14', 'iPhone 14', 14, [71.5, 146.7, 7.8], [1170, 2532]),
  model('13promax', 'iPhone 13 Pro Max', '13pro', [78.1, 160.8, 7.65], [1284, 2778]),
  model('13pro', 'iPhone 13 Pro', '13pro', [71.5, 146.7, 7.65], [1170, 2532]),
  model('13', 'iPhone 13', 13, [71.5, 146.7, 7.65], [1170, 2532]),
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

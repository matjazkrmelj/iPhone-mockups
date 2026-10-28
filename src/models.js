// The iPhone 17 and 18 lineups. Sizes are width × height × depth in mm (Apple tech specs);
// `screen` is the native screenshot resolution, which sets the screen's aspect ratio.

// Finish colours as [name, frame, back].
const COLORS = {
  17: {
    black: ['Black', 0x3a3a3c, 0x353537],
    white: ['White', 0xe6e6e3, 0xf2f2f0],
    mistBlue: ['Mist Blue', 0x8ea6c2, 0x97aecb],
    sage: ['Sage', 0x98a588, 0x9fae8f],
    lavender: ['Lavender', 0xb4a2c9, 0xbcaad2],
  },
  air: {
    spaceBlack: ['Space Black', 0x2c2c2e, 0x2f2f32],
    cloudWhite: ['Cloud White', 0xe4e3df, 0xf4f4f2],
    lightGold: ['Light Gold', 0xdcc8a4, 0xe6d6b8],
    skyBlue: ['Sky Blue', 0xb5c9dd, 0xc0d3e6],
  },
  pro18: {
    black: ['Black', 0x2b2b2d, 0x2e2e31],
    silver: ['Silver', 0xd6d7d8, 0xe2e3e4],
    glacier: ['Glacier', 0xbfcfdb, 0xcad8e3],
    burgundy: ['Burgundy', 0x5a1f2b, 0x652633],
  },
  duo: {
    nightSky: ['Night Sky', 0x2a3243, 0x262e3e],
    starWhite: ['Star White', 0xdcdcd8, 0xefeee9],
  },
  pro: {
    silver: ['Silver', 0xd6d7d8, 0xe2e3e4],
    cosmicOrange: ['Cosmic Orange', 0xe0672e, 0xdc6a30],
    deepBlue: ['Deep Blue', 0x2f3b55, 0x35425f],
  },
};

// Design of each model.
//   frame: aluminium (bead-blasted) | titanium (polished)
//   sides: flat | rounded (the 17 Pro unibody curves into the back)
//   camera: pill (17) | bar (Air) | plateau (17 and 18 Pro) | duo (iPhone Duo)
//   cutout: island (Dynamic Island) | hole (hole-punch camera) | none
//   fold: closed | open (iPhone Duo only)       buttons: standard | duo (volume on the top edge)
//   radius: corner radius in mm (default: 16% of the width)
//   speakers: whether the bottom edge has speaker and mic grilles (the Air has only the port)
//   bezel: screen border in mm
const FAMILIES = {
  17: { frame: 'aluminium', sides: 'flat', camera: 'pill', cutout: 'island', speakers: true, bezel: 1.9 },
  air: { frame: 'titanium', sides: 'flat', camera: 'bar', cutout: 'island', speakers: false, bezel: 1.95 },
  pro: { frame: 'aluminium', sides: 'rounded', camera: 'plateau', cutout: 'island', speakers: true, bezel: 1.9 },
  pro18: { frame: 'aluminium', sides: 'rounded', camera: 'plateau', cutout: 'island', speakers: true, bezel: 1.9 },
  duo: { frame: 'titanium', sides: 'flat', camera: 'duo', cutout: 'hole', fold: 'closed', buttons: 'duo', speakers: true, bezel: 2.2, radius: 11 },
  duoOpen: { frame: 'titanium', sides: 'flat', camera: 'duo', cutout: 'none', fold: 'open', buttons: 'duo', speakers: true, bezel: 2.4, radius: 11 },
};

const model = (id, name, family, size, screen) => ({
  id, name, family, size, screen, ...FAMILIES[family], colors: COLORS[family === 'duoOpen' ? 'duo' : family],
});

export const MODELS = [
  model('18promax', 'iPhone 18 Pro Max', 'pro18', [78.0, 163.4, 8.75], [1320, 2868]),
  model('18pro', 'iPhone 18 Pro', 'pro18', [71.9, 150.0, 8.75], [1206, 2622]),
  // iPhone Duo: closed it is 84.1 × 117.8 × 11.3 mm with a 1398 × 2034 outer screen; open it is
  // 164.6 × 117.8 × 5.2 mm with a 2670 × 1878 inner screen (landscape).
  model('duo', 'iPhone Duo (closed)', 'duo', [84.1, 117.8, 11.3], [1398, 2034]),
  model('duoopen', 'iPhone Duo (open)', 'duoOpen', [164.6, 117.8, 5.2], [2670, 1878]),
  model('17promax', 'iPhone 17 Pro Max', 'pro', [78.0, 163.4, 8.75], [1320, 2868]),
  model('17pro', 'iPhone 17 Pro', 'pro', [71.9, 150.0, 8.75], [1206, 2622]),
  model('air', 'iPhone Air', 'air', [74.7, 156.2, 5.64], [1260, 2736]),
  model('17', 'iPhone 17', 17, [71.5, 149.6, 7.95], [1206, 2622]),
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

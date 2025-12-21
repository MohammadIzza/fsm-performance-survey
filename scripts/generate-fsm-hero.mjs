// Editable vector masters for the FSM hero. No raster assets or font dependency.
import { writeFile } from 'node:fs/promises';
const palette = {
  pink: '#ffbaba',
  yellow: '#ffd37d',
  orange: '#ec5212',
  mint: '#77c6b3',
  blue: '#3658d3',
  sky: '#70a2e1',
};
const color = (hex) => [
  ...hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255),
  1,
];
const fixed = (k) => ({ a: 0, k });
const motion = (from, to, start = 18, end = 100) => ({
  a: 1,
  k: [
    {
      t: start,
      s: from,
      e: to,
      o: { x: [0.2], y: [0.8] },
      i: { x: [0.25], y: [1] },
    },
    { t: end, s: to },
  ],
});
function vector(commands) {
  const v = [],
    i = [],
    o = [];
  for (const c of commands) {
    if (c.length === 2) {
      v.push(c);
      i.push([0, 0]);
      o.push([0, 0]);
    } else {
      const last = v.at(-1);
      o[o.length - 1] = [c[0] - last[0], c[1] - last[1]];
      v.push(c.slice(4));
      i.push([c[2] - c[4], c[3] - c[5]]);
      o.push([0, 0]);
    }
  }
  return { c: true, v, i, o };
}
const rect = (x, y, w, h) =>
  vector([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
function layer(
  name,
  shape,
  fill,
  { anchor = [0, 0, 0], rotation, scale, mask } = {},
) {
  const result = {
    ty: 4,
    nm: name,
    sr: 1,
    ip: 0,
    op: 181,
    st: 0,
    bm: 0,
    ks: {
      o: fixed(100),
      r: rotation || fixed(0),
      p: fixed(anchor),
      a: fixed(anchor),
      s: scale || fixed([100, 100, 100]),
    },
    shapes: [
      { ty: 'sh', nm: name, ks: fixed(shape) },
      {
        ty: 'fl',
        nm: 'Solid color',
        c: fixed(color(fill)),
        o: fixed(100),
        r: 1,
      },
    ],
  };
  if (mask) result.hasMask = true;
  if (mask)
    result.masksProperties = [
      { inv: false, mode: 'a', pt: fixed(mask), o: fixed(100), x: fixed(0) },
    ];
  return result;
}
const s = vector([
  [240, 0],
  [112, 0],
  [40, 0, 0, 38, 0, 88],
  [0, 131, 28, 153, 94, 168],
  [151, 181],
  [168, 185, 176, 191, 176, 201],
  [176, 213, 166, 219, 150, 219],
  [0, 219],
  [0, 280],
  [150, 280],
  [209, 280, 240, 246, 240, 201],
  [240, 160, 215, 135, 154, 121],
  [96, 107],
  [74, 102, 64, 96, 64, 84],
  [64, 70, 78, 61, 99, 61],
  [240, 61],
]);
const m = vector([
  [0, 0],
  [72, 0],
  [150, 110],
  [228, 0],
  [300, 0],
  [300, 280],
  [224, 280],
  [224, 116],
  [150, 210],
  [76, 116],
  [76, 280],
  [0, 280],
]);
const letters = {
  f: {
    w: 240,
    layers: [
      layer(
        'F middle arm',
        vector([
          [72, 112],
          [208, 112],
          [208, 154, 180, 184, 138, 184],
          [72, 184],
        ]),
        palette.orange,
        {
          anchor: [72, 148, 0],
          scale: motion([0, 100, 100], [100, 100, 100], 35, 100),
        },
      ),
      layer(
        'F upper arm',
        vector([
          [72, 0],
          [240, 0],
          [240, 44, 207, 76, 164, 76],
          [72, 76],
        ]),
        palette.yellow,
        { anchor: [72, 76, 0], rotation: motion([-90], [0], 18, 108) },
      ),
      layer('F upright', rect(0, 0, 76, 280), palette.pink, {
        anchor: [38, 280, 0],
        scale: motion([100, 0, 100], [100, 100, 100], 5, 83),
      }),
    ],
  },
  s: {
    w: 240,
    layers: [
      layer('S upper curve', s, palette.mint, {
        anchor: [120, 140, 0],
        rotation: motion([-90], [0], 18, 112),
        mask: rect(-10, -10, 260, 150),
      }),
      layer('S lower curve', s, palette.orange, {
        anchor: [120, 140, 0],
        rotation: motion([90], [0], 18, 112),
        mask: rect(-10, 140, 260, 150),
      }),
    ],
  },
  m: {
    w: 300,
    layers: [
      layer('M left fold', m, palette.sky, {
        anchor: [150, 280, 0],
        rotation: motion([-25], [0], 10, 108),
        mask: rect(-10, -10, 160, 300),
      }),
      layer('M right fold', m, palette.blue, {
        anchor: [150, 280, 0],
        rotation: motion([25], [0], 20, 118),
        mask: rect(150, -10, 160, 300),
      }),
    ],
  },
};
for (const [key, value] of Object.entries(letters)) {
  // Padding allows the assembling pieces to rotate without clipping the canvas.
  const pad = 90;
  for (const [index, l] of value.layers.entries()) {
    l.ind = index + 1;
    l.ks.p.k = [l.ks.p.k[0] + pad, l.ks.p.k[1] + pad, 0];
  }
  const data = {
    v: '5.12.2',
    fr: 60,
    ip: 0,
    op: 181,
    w: value.w + pad * 2,
    h: 460,
    nm: `FSM ${key.toUpperCase()}`,
    ddd: 0,
    assets: [],
    layers: value.layers,
    markers: [],
  };
  await writeFile(
    new URL(`../public/assets/lottie/home-hero-${key}.json`, import.meta.url),
    JSON.stringify(data) + '\n',
  );
}

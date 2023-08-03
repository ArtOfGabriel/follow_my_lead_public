import seedrandom from 'seedrandom';
import { makeNoise2D } from 'open-simplex-noise';
import {
  Ctx,
  Point,
  Rng,
  circle,
  createCanvas,
  gauss,
  lerp,
  lerpPoint,
  line,
  pointsToPath,
  polarize,
  sample,
  shuffle,
  strokeCircle,
  weightedPick,
} from '../core';
import { createTexture } from '../shader-lib/glShared';

const TAU = 2 * Math.PI;

const grayscale = (pct: number, alpha = 1): string => {
  const i = ~~(pct * 255);
  return `rgba(${i},${i},${i},${alpha})`;
};

/**
 * This is now unused. I'd initially done all of my landscape texture creation
 * here using the canvas API, but found that there were very slight differences
 * on lots of things between different browsers. Because of how this texture
 * gets used, after 100s of steps of the algorithm, those differences got blown up
 * to be quite noticeable in the final image.
 */

export function createLandscaper(
  gl: WebGL2RenderingContext,
  extant: Point,
  rngOuter: Rng,
) {
  const rng = seedrandom((rngOuter() * 1000).toString());

  const debug = true;
  const [width, height] = extant;
  const ctx = createCanvas(
    width,
    height,
    {},
    debug ? document.body : undefined,
  );
  ctx.canvas.setAttribute('id', 'l');
  ctx.canvas.style.display = 'none';

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'white';

  const borderPct = 0.8;
  const hasBorder = rng() < borderPct;
  const borderWidth = hasBorder ? ~~(ctx.canvas.width * 0.03) : 0;

  const corners: Point[] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];

  const drawer = weightedPick(rng, [
    [
      10,
      // circle from center
      () => {
        const { width, height } = ctx.canvas;
        const towardsCenter = rng() < 0.5;
        ctx.fillStyle = towardsCenter ? 'black' : 'white';
        ctx.fillRect(0, 0, width, height);
        const numSteps = ~~(width * 0.5);
        for (let i = 0; i < numSteps; i++) {
          const pct = i / (numSteps - 1);
          ctx.fillStyle = grayscale(towardsCenter ? 1 - pct : Math.pow(pct, 1));
          circle(ctx, [width / 2, height / 2], lerp(0.7 * width, 0, pct));
        }
      },
    ],
    [
      20, // draw noise
      () => {
        const r = rng();
        const scale = lerp(1, 5, r);
        const noiseScale = [scale, scale];
        const maxNoise = lerp(0.3, 0.05, r);
        const { width, height } = ctx.canvas;
        const noise2D = makeNoise2D(rng() * 1000);
        const noise = (x: number, y: number, det = [1, 1]) =>
          (noise2D(x * det[0], y * det[1]) + 1) * 0.5 +
          (noise2D(x * det[0] * 2, y * det[1] * 2) + 1) * 0.25 +
          lerp(-1, 1, rng()) * 0.01;

        const size = 1;
        for (let x = 0; x < width; x += size) {
          for (let y = 0; y < height; y += size) {
            const val = noise(x / width, y / width, noiseScale) * maxNoise;
            ctx.fillStyle = grayscale(val);
            ctx.fillRect(x, y, size, size);
          }
        }
      },
    ],
    [
      8,
      // single stroked shape in the center
      () => {
        ctx.lineWidth = width * 0.04; //lerp(0.03, 0.08, rng());
        ctx.strokeStyle = grayscale(0.5);
        const shape = weightedPick(rng, [
          [8, 'circle'],
          [25, 'rect'],
        ]);

        const radius = 0.3 * width; //lerp(0.25, 0.4, rng()) * width;

        if (shape === 'circle') {
          strokeCircle(ctx, [width / 2, height / 2], radius);
        }
        if (shape === 'rect') {
          ctx.strokeRect(
            width * 0.5 - radius,
            height * 0.5 - radius,
            radius * 2,
            radius * 2,
          );
        }
      },
    ],
    [
      4,
      () => {
        // stroked circles in the corners
        ctx.lineWidth = width * lerp(0.03, 0.06, rng());
        ctx.strokeStyle = 'white';
        const radius = lerp(0.5, 0.9, rng()) * width;
        shuffle(rng, corners).forEach(pos => {
          strokeCircle(ctx, pos, radius);
        });
      },
    ],
    [
      10,
      () => {
        // draw some lines
        const pad = borderWidth;
        const numCells = ~~lerp(2, 12, Math.pow(rng(), 1.5));
        const cellSize = (width - 2 * pad) / numCells;
        const lw = 0.02; //lerp(0.002, 0.02, Math.pow(rng(), 2));
        ctx.lineWidth = width * lw;
        console.log(ctx.lineWidth);
        ctx.strokeStyle = grayscale(0.5);

        const horizontal = rng() < 0.5;

        for (let i = 1; i < numCells; i++) {
          if (horizontal) {
            line(ctx, [0, pad + i * cellSize], [width, pad + i * cellSize]);
          } else {
            line(ctx, [pad + i * cellSize, 0], [pad + i * cellSize, height]);
          }
        }
      },
    ],
    [
      20,
      () => {
        // grid - potentially asymmetric, potentially missing items
        const numCells: Point = [~~lerp(3, 15, rng()), ~~lerp(3, 15, rng())];
        if (rng() < 0.4) {
          numCells[1] = numCells[0];
        }

        const skipPct = rng() < 0.8 ? 0 : lerp(0.5, 0.8, rng());
        const pad = borderWidth;
        const cellX = (width - 2 * pad) / numCells[0];
        const cellY = (height - 2 * pad) / numCells[1];
        for (let i = 0; i < numCells[0]; i++) {
          for (let j = 0; j < numCells[1]; j++) {
            if (rng() < skipPct) {
              continue;
            }
            ctx.fillStyle = grayscale(0.5 * rng());

            const cellpad = 0;
            ctx.fillRect(
              pad + i * cellX + cellpad,
              pad + j * cellY + cellpad,
              cellX - 2 * cellpad,
              cellY - 2 * cellpad,
            );
          }
        }
      },
    ],
    [
      10,
      () => {
        // gradient - either diagonal or linear
        const [c1, c2] = shuffle(rng, corners);

        const grad = ctx.createLinearGradient(c1[0], c1[1], c2[0], c2[1]);
        grad.addColorStop(0, 'white');
        grad.addColorStop(1, 'black');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      },
    ],

    [
      10,
      () => {
        // a bunch of triangles
        const dir = sample(rng, [0, 1, null, null, null]);

        const numCells = ~~lerp(3, 15, rng());
        const cellSize = (width - borderWidth * 2) / numCells;
        for (let i = 0; i <= numCells; i++) {
          for (let j = 0; j <= numCells; j++) {
            const x = borderWidth + i * cellSize;
            const y = borderWidth + j * cellSize;

            let xCorners = [x, x + cellSize];
            if (dir === 1) {
              xCorners.reverse();
            }
            if (dir === null) {
              xCorners = shuffle(rng, xCorners);
            }

            const [x1, x2] = xCorners;
            [x1, x2].forEach(x => {
              const points: Point[] = [
                [x1, y],
                [x2, y + cellSize],
                [x, x === x1 ? y + cellSize : y],
              ];
              const path1 = pointsToPath(points, true);
              ctx.strokeStyle = grayscale(0.5 * rng());
              ctx.fillStyle = ctx.strokeStyle;
              ctx.stroke(path1);
              ctx.fill(path1);
            });
          }
        }
      },
    ],
    [
      10,
      () => {
        // grid of circles
        const numCells = ~~lerp(5, 25, rng());

        const pad = hasBorder ? borderWidth : 0;
        const cellX = (width - 2 * pad) / numCells;
        const cellY = cellX;
        const radius = cellX * 0.1; //lerp(0.1, 0.16, rng());

        ctx.strokeStyle = grayscale(0.15);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = radius;

        const jitterAmt = weightedPick(rng, [
          // [10, 0],
          [2, cellX * 0.3],
          // [2, radius * 0.5],
        ]);

        for (let i = 0; i < numCells; i++) {
          for (let j = 0; j < numCells; j++) {
            circle(
              ctx,
              [
                pad + i * cellX + cellX / 2 + gauss(rng, jitterAmt),
                pad + j * cellY + cellY / 2 + gauss(rng, jitterAmt),
              ],
              radius,
            );
          }
        }
      },
    ],
    [
      8,
      () => {
        // draw some sin waves
        const pad = borderWidth;
        const numCells = ~~lerp(3, 12, Math.pow(rng(), 2));

        const cellSize = (width - 2 * pad) / numCells;
        const lw = lerp(0.002, 0.01, Math.pow(rng(), 2));

        ctx.lineWidth = width * lw;
        ctx.strokeStyle = grayscale(0.5);

        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = ctx.lineWidth * lerp(0.25, 2, rng());

        const freq = ~~lerp(1, 5, rng());
        const amp = lerp(0.01, 0.05, Math.pow(rng(), 2)) * width;

        const horizontal = rng() < 0.5;

        for (let i = 1; i < numCells; i++) {
          const x = pad + i * cellSize;

          let points: Point[] = [[x, 0]];
          for (let y = 0; y < height; y++) {
            const angle = (y / height) * TAU * freq;
            points.push([x + Math.sin(angle) * amp, y]);
          }

          if (horizontal) {
            points = points.map(([x, y]) => [y, x]);
          }
          const path = pointsToPath(points, false);
          ctx.stroke(path);
        }
      },
    ],
    [
      12,
      () => {
        // draw a checkerboard, or potentially just side and bottoms of
        const pad = borderWidth;
        const numCells = ~~lerp(6, 10, rng());

        const cellSize = (width - 2 * pad) / numCells;
        ctx.lineWidth = cellSize * lerp(0.005, 0.04, Math.pow(rng(), 2));

        ctx.fillStyle = grayscale(0.5);
        ctx.strokeStyle = ctx.fillStyle;

        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = cellSize * 0.05;
        ctx.lineCap = 'round';

        const checkerboard = rng() < 0.4;

        // should horizontal line be top or bottom?
        const yOffset = sample(rng, [0, cellSize]);

        for (let i = 0; i < numCells; i++) {
          for (let j = 0; j < numCells; j++) {
            const x = pad + i * cellSize;
            const y = pad + j * cellSize;

            if ((i + j) % 2 === 0) {
              if (checkerboard) {
                ctx.fillRect(x, y, cellSize, cellSize);
              } else {
                line(ctx, [x, y + yOffset], [x + cellSize, y + yOffset]);
                line(ctx, [x + cellSize, y + cellSize], [x + cellSize, y]);
              }
            }
          }
        }
      },
    ],

    [
      0,
      () => {
        // bezier from corner to corner
        const c1: Point = sample(rng, corners);
        const c2: Point = [c1[0] === 0 ? width : 0, c1[1] === 0 ? height : 0];

        const grad = ctx.createLinearGradient(c1[0], c2[1], c2[0], c1[1]);
        grad.addColorStop(0, grayscale(0));
        grad.addColorStop(0.5, grayscale(0.2));
        grad.addColorStop(1, grayscale(0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        const center: Point = lerpPoint(c1, c2, 0.5);

        const mag = rng() < 0.15 ? 0 : lerp(0.1, 0.2, rng()) * width;
        const cp: Point = polarize(center, rng() * TAU, mag);

        ctx.lineWidth = width * lerp(0.02, 0.25, rng());
        ctx.strokeStyle = grayscale(0.5);
        ctx.shadowBlur = ctx.lineWidth * 1;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(...c1);
        ctx.bezierCurveTo(...cp, ...cp, ...c2);
        ctx.stroke();
      },
    ],
  ]);
  ctx.save();
  drawer();
  ctx.restore();
  if (hasBorder) {
    drawBorder(ctx, borderWidth);
  }

  const texture = createTexture(gl);
  // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA16F,
    width,
    height,
    0,
    gl.RGBA,
    gl.FLOAT,
    ctx.canvas,
  );

  return {
    get texture() {
      return texture;
    },
    write(_frame: number) {
      return;
    },
  };
}

function drawBorder(ctx: Ctx, radius: number = 100) {
  const { width, height } = ctx.canvas;
  const numSteps = radius;
  // ctx.fillStyle = 'white';
  // ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < numSteps; i++) {
    const pct = i / (numSteps - 1);
    ctx.fillStyle = grayscale(pct);
    const lineSize = lerp(radius, 0, pct);
    ctx.fillRect(0, 0, width, lineSize);
    ctx.fillRect(0, height, width, -lineSize);
    ctx.fillRect(0, 0, lineSize, height);
    ctx.fillRect(width, 0, -lineSize, height);
  }
}

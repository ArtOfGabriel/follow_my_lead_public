import seedrandom from 'seedrandom';
import { makeNoise2D } from 'open-simplex-noise';
import {
  Point,
  Rng,
  createCanvas,
  gauss,
  lerp,
  sample,
  weightedPick,
} from '../core';
import { createTexture } from '../shader-lib/glShared';

export function createLandscaperImage(
  gl: WebGL2RenderingContext,
  extant: Point,
) {
  const [width, height] = extant;
  const ctx = createCanvas(width, height, {});
  ctx.canvas.setAttribute('id', 'l');
  ctx.canvas.style.display = 'none';

  // TODO
  const { img } = window as any;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    let sum = 0;
    for (let j = 0; j < 3; j++) {
      sum += imgData.data[i + j];
    }
    for (let j = 0; j < 3; j++) {
      imgData.data[i + j] = sum / 3;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = createTexture(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
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
    // TODO: remove for prod
    debug() {
      // pass
      return '';
    },
  };
}

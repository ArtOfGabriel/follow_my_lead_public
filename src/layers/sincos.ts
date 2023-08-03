import { mod } from '../core';
import { createTexture } from '../shader-lib/glShared';
type vec3 = [number, number, number];

export function generateSinCos(
  gl: WebGL2RenderingContext,
  numSinBuckets = 512,
) {
  // I was seeing very slightly different values of sin/cos returned on different
  // hardwares. The nature of this project is that there is a high sensitivity
  // to slight differences, and these led to visible differences in the final
  // output. My strategy here is to create a texture with a fixed number of
  // possible outputs, and then grab the nearest one when calculating sin/cos.
  const sinCosData: vec3[] = Array.from({ length: numSinBuckets }, (_, i) => [
    Math.sin((i / (numSinBuckets - 1)) * 2 * Math.PI),
    Math.cos((i / (numSinBuckets - 1)) * 2 * Math.PI),
    0,
  ]);
  const texture = createDataTextureFromPoints(gl, sinCosData, numSinBuckets, 1);

  // Note: The funky coarse graining of PI/TAU constants seemed to be necessary
  // to get identical behavior on ipad in some cases.
  const glsl = /*glsl*/ `
    const float cgPI = ${numSinBuckets}.;
    const float TAU = floor(6.283185307179586 * cgPI) / cgPI;
    const float PI = floor(3.141592653589793 * cgPI) / cgPI;

    float sin2(float radians) {
      // initially I'd used fract instead of mod(x, 1), but that seemed to give
      // different precision for the result of negative numbers on different gpus
      // sometimes
      float pctTau = mod(radians / TAU, 1.);
      pctTau = (floor(pctTau * ${numSinBuckets}.) + 0.5) / ${numSinBuckets}.;
      return texture(u_sincos, vec2(pctTau, 0.)).x;
    }

    float sin_int(int index) {
      return texture(u_sincos, vec2(float(index) / ${numSinBuckets}., 0.)).x;
    }

    float cos2(float radians) {
      float pctTau = mod(radians / TAU, 1.);
      pctTau = (floor(pctTau * ${numSinBuckets}.) + 0.5) / ${numSinBuckets}.;
      return texture(u_sincos, vec2(pctTau, 0.)).y;
    }`;

  return {
    texture,
    glsl,
    numBuckets: numSinBuckets,
  };
}

function createDataTextureFromPoints(
  gl: WebGL2RenderingContext,
  points: [number, number, number][],
  cols: number,
  rows: number,
) {
  const data = new Float32Array(rows * cols * 4);
  for (let i = 0; i < points.length; i++) {
    const [x, y, angle] = points[i];
    data[i * 4 + 0] = x;
    data[i * 4 + 1] = y;
    data[i * 4 + 2] = mod(angle, 2 * Math.PI);
    // Could use this channel to vary something (such as sensor offset) by agent
    // I ended up not using it.
    data[i * 4 + 3] = 0;
  }

  gl.activeTexture(gl.TEXTURE0 + 0);
  const texture = createTexture(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    cols,
    rows,
    0,
    gl.RGBA,
    gl.FLOAT,
    data,
  );
  return texture;
}

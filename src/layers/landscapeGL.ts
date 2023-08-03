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
import {
  createFBO,
  createTexture,
  getUniformLocation,
  initShaderProgram,
} from '../shader-lib/glShared';
import { hashCode, log, logPixel, logPixels } from '../debugUtils';
import { generateSinCos } from './sincos';

// TODO: explore thicker lines for 'lines'

export type LandscapeType =
  | 'radial gradient'
  | 'noise'
  | 'central circle'
  | 'central square'
  | 'corner circles'
  | 'lines'
  | 'grid'
  | 'linear gradient'
  | 'triangles'
  | 'grid circles'
  | 'sin waves'
  | 'checkerboard'
  | 'steps';

// convert a number into a float for glsl, i.e. convert "1" to "1."
const glslFloat = (num: number) => {
  let str = num.toString();
  if (!str.includes('.')) {
    str += '.';
  }
  return str;
};
const glf = glslFloat;

const randFunc = /*glsl*/ `
  float rand(vec2 co){  
    return texture(u_random, fract(co)).x;
  }`;

const coarseGrain = (num: number, precision: number) =>
  Math.floor(num * precision) / precision;

export function createLandscaperGL(
  gl: WebGL2RenderingContext,
  extant: Point,
  rngOuter: Rng,
  landscapeType: LandscapeType,
  hasBorder: boolean,
) {
  // have a fresh rng for landscape
  const seed = (rngOuter() * 1000).toString();
  const rng = seedrandom(seed);

  const borderWidth = hasBorder ? 4 / 128 : 0;

  const sincos = generateSinCos(gl, 512);

  const vert = /*glsl*/ `#version 300 es
    precision highp float;
    in vec4 aPos;
    out vec2 v_uv;
    void main() {
      v_uv = (aPos.xy + 1.) / 2.;
      gl_Position = vec4(aPos.x, aPos.y, 0., 1.);
    }`;

  // Note: Some of these are perhaps oddly constructed, because I initially did
  // everyhting using the 2d canvas API, but that was resulting in very slight
  // differences, which unfortunately resulted in noticeable differences after
  // running the simulation for many steps.

  const landscapeTypeToFrag: Record<LandscapeType, () => string> = {
    'radial gradient': createRadialGradient(seed, borderWidth),
    'noise': createNoiseLandscape(seed, borderWidth),
    'central circle': createCentralCircle(seed, borderWidth),
    'central square': createCentralSquare(seed, borderWidth),
    'corner circles': createCornerCircles(seed, borderWidth),
    'lines': createLines(seed, borderWidth),
    'grid': createGrid(seed, borderWidth),
    'linear gradient': createLinearGradient(seed, borderWidth),
    'triangles': createTriangles(seed, borderWidth),
    'grid circles': createGridCircles(seed, borderWidth),
    'sin waves': createSinWaves(seed, borderWidth, sincos),
    'checkerboard': createCheckerboard(seed, borderWidth),
    'steps': createSteps(seed, borderWidth),
  };
  const frag = landscapeTypeToFrag[landscapeType]();

  const vbo = gl.createBuffer();
  const fbo = createFBO(gl, extant, null);

  const program = initShaderProgram(gl, vert, frag);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, 3, -1, -1, 3, -1]),
    gl.STATIC_DRAW,
  );

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  gl.useProgram(program);

  const locRnadom = getUniformLocation(gl, program, 'u_random', true);
  if (locRnadom) {
    gl.uniform1i(locRnadom, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(
      gl.TEXTURE_2D,
      createRandomTexture(gl, extant, (rng() * 10000).toString()),
    );
  }

  const locSincos = getUniformLocation(gl, program, 'u_sincos', true);
  if (locSincos) {
    gl.uniform1i(locSincos, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sincos.texture);
  }

  if (landscapeType === 'noise') {
    const locNoise = getUniformLocation(gl, program, 'u_noise');
    gl.uniform1i(locNoise, 2);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, createNoiseTexture(gl, extant, seed, 2));
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
  gl.viewport(0, 0, fbo.width, fbo.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // TODO: do i ship with this? i think no
  const displayableLandsape = true;
  if (displayableLandsape) {
    // Create an hidden canvas with id #l and draw our landscape to it (so that
    // we have the ability to see our landscape texture in isolation)
    const [width, height] = extant;
    const ctx = createCanvas(
      width,
      height,
      {},
      displayableLandsape ? document.body : undefined,
    );
    ctx.canvas.setAttribute('id', 'l');
    ctx.canvas.style.display = 'none';

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, fbo.width, fbo.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ctx.drawImage(gl.canvas, 0, 0);
  }

  return {
    get texture() {
      return fbo.texture;
    },
    // TODO: remove for prod
    debug() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      const pixels = new Float32Array(fbo.width * fbo.height * 4);
      gl.readPixels(0, 0, fbo.width, fbo.height, gl.RGBA, gl.FLOAT, pixels);
      const hash = hashCode(pixels.join(','));
      log(hash, 'land');

      // logPixels(pixels, 2_909_400, 4);
      // logPixel(pixels, 2_909_408);
      // logPixel(pixels, 4 * (100 * 1024 + 100));

      return hash;
    },
  };
}

function createRandomTexture(
  gl: WebGL2RenderingContext,
  extant: Point,
  seed: string,
) {
  const rng = seedrandom(seed);
  const data = new Float32Array(extant[0] * extant[1] * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = rng();
  }
  gl.activeTexture(gl.TEXTURE0 + 0);
  const texture = createTexture(gl);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    ...extant,
    0,
    gl.RGBA,
    gl.FLOAT,
    data,
  );
  return texture;
}

function createNoiseTexture(
  gl: WebGL2RenderingContext,
  extant: Point,
  seed: string,
  textureIndex: number,
): WebGLTexture {
  const rng = seedrandom(seed);
  const r = rng();
  const scale = lerp(1, 5, r);
  const maxNoise = lerp(0.3, 0.05, r);
  const snoise = makeNoise2D(rng() * 10000);

  const noiseSeed = ~~(rng() * 100);
  const noise = (x: number, y: number, det: number) => {
    return (
      (snoise(x * det + noiseSeed, y * det + noiseSeed) + 1) * 0.5 +
      (snoise(x * det * 2 + noiseSeed, y * det * 2 + noiseSeed) + 1) * 0.25 +
      lerp(-1, 1, rng()) * 0.03
    );
  };

  const data = new Float32Array(extant[0] * extant[1] * 4);
  for (let y = 0; y < extant[1]; y++) {
    for (let x = 0; x < extant[0]; x++) {
      const index = (y * extant[0] + x) * 4;
      const val = noise(x / extant[0], y / extant[1], scale) * maxNoise;

      data[index + 0] = val;
      data[index + 1] = val;
      data[index + 2] = val;
      data[index + 3] = 1;
    }
  }

  gl.activeTexture(gl.TEXTURE0 + textureIndex);
  const texture = createTexture(gl);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA32F,
    ...extant,
    0,
    gl.RGBA,
    gl.FLOAT,
    data,
  );

  return texture;
}

function createFragmentShader(borderWidth: number, genVal: string) {
  const hasBorder = borderWidth !== 0;

  let borderSnippet = /*glsl*/ `
    float borderWidth = ${glf(borderWidth)};
    vec2 uvr = uv;
    if (uv.x + uv.y > 1.) {
        uvr = vec2(1. - uv.y, 1.-uv.x);
    }
    float minxy = min(uvr.x, uvr.y);
    if (minxy < borderWidth) {
      float borderLeft = 1. - min(minxy / borderWidth, 1.);
      val = borderLeft;
    }
  `;
  if (!hasBorder) {
    borderSnippet = '';
  }

  // Create a fragment shader that deals with our border (if we have one)
  return /*glsl*/ `#version 300 es
    precision highp float;
    uniform sampler2D u_sincos;
    uniform sampler2D u_random;
    uniform sampler2D u_noise;
    in vec2 v_uv;
    out vec4 out_color;

    ${genVal}

    void main() {
      vec2 uv = v_uv;

      // I had a gen_val return a vec3 so that i could use the yz to pass data
      // for debugging as I was developing.
      vec3 val3 = gen_val(uv);
      float val = clamp(val3.x, 0., 1.);

      ${borderSnippet}

      val = floor(val * 1024.) / 1024.;

      out_color = vec4(val, val3.yz, 1.);
    }`;
}

function createRadialGradient(seed: string, borderWidth: number) {
  return () => {
    // circle from center
    const rng = seedrandom(seed);
    const towardsCenter = rng() < 0.5;

    // TODO: consider multiplying val by some factor (either consistent or rand)
    // also consider pow(val, something)

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      const float max_dist = 0.70703125;
      vec3 gen_val(vec2 uv) {
        float d = distance(vec2(0.5), v_uv);
        d = floor(d * 1024.) / 1024.;
        float val = clamp(d / max_dist, 0., 1.);
        
        ${
          towardsCenter
            ? ''
            : `val = 1. - val;
               val = floor(val * 1024.) / 1024.;`
        }
        
        return vec3(val, 0., 0.);
      }`,
    );
  };
}

function createNoiseLandscape(_seed: string, borderWidth: number) {
  return () => {
    // noise - this is all done in a texture that we just read from
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float val = texture(u_noise, uv).x;
        return vec3(val, 0., 0.);
      }`,
    );
  };
}

function createCentralCircle(seed: string, borderWidth: number) {
  return () => {
    // center stroked circle
    const rng = seedrandom(seed);
    const lineWidth = lerp(0.03, 0.08, rng()) / 2;
    const radius = lerp(0.25, 0.4, rng());
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float radius = ${glf(radius)};
        float lineWidth = ${glf(lineWidth)};
        float d = distance(vec2(0.5), v_uv);
        float val = step(radius - lineWidth, d) * step(d, radius + lineWidth);
        return vec3(val * 0.5, 0., 0.);
      }`,
    );
  };
}

function createCentralSquare(seed: string, borderWidth: number) {
  return () => {
    // center stroked square
    const rng = seedrandom(seed);
    const lineWidth = lerp(0.03, 0.08, rng()) / 2;
    const radius = lerp(0.25, 0.4, rng());
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float radius = ${glf(radius)};
        float lineWidth = ${glf(lineWidth)};
        vec2 d = abs(uv - vec2(0.5));
        float val = step(radius - lineWidth, max(d.x, d.y)) *
          step(max(d.x, d.y), radius + lineWidth);
        return vec3(val * 0.5);
      }`,
    );
  };
}

function createCornerCircles(seed: string, borderWidth: number) {
  return () => {
    // center stroked square
    const rng = seedrandom(seed);
    const lineWidth = coarseGrain(lerp(0.015, 0.03, rng()), Math.pow(2, 13));
    const radius = coarseGrain(lerp(0.5, 0.9, rng()), Math.pow(2, 13));
    const factor = sample(rng, [0.25, 0.5, 1]);

    // changing lineWidth fixes
    // changing radius fixes
    // repros with all factors

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      // const float cg = pow(10., 7.);
      vec3 gen_val(vec2 uv) {
        float radius = ${glf(radius)};
        float lineWidth = ${glf(lineWidth)};
        const vec2 corners[4] = vec2[4](
          vec2(0.),
          vec2(1.),
          vec2(0., 1.),
          vec2(1., 0.)
        );
        float val = 0.;

        for (int i = 0; i < 4; i++) {
          float d = distance(corners[i], v_uv);
          val += step(radius - lineWidth, d) * step(d, radius + lineWidth);
        }
        
        return vec3(val * ${glf(factor)}, 0., 0.);
      }`,
    );
  };
}

function createLines(seed: string, borderWidth: number) {
  return () => {
    // center stroked square
    const rng = seedrandom(seed);
    const numCells = ~~lerp(2, 12, Math.pow(rng(), 1.5));

    const lw = lerp(0.003, 0.03, Math.pow(rng(), 3));
    const horizontal = rng() < 0.5;
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float borderWidth = ${glf(borderWidth)};
        float lw = ${glf(lw)};
        if (${horizontal}) {
          uv = uv.yx;
        }
        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;

        float x = fract(uv.x * numCells + 0.5);
        float d = distance(x, 0.5);
        float val = step(d, lw/2.*numCells) * step(distance(uv.x, 0.5) * 2., 1. - lw);
        return vec3(val * 0.5, 0., 0.);
      }`,
    );
  };
}

function createGrid(seed: string, borderWidth: number) {
  return () => {
    // center stroked square
    const rng = seedrandom(seed);
    const numCells: Point = [~~lerp(3, 15, rng()), ~~lerp(3, 15, rng())];
    if (rng() < 0.4) {
      numCells[1] = numCells[0];
    }

    const skipPct = rng() < 0.8 ? 0 : lerp(0.5, 0.8, rng());
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      ${randFunc}
      vec3 gen_val(vec2 uv) {
        float borderWidth = ${glf(borderWidth)};
        vec2 numCells = vec2(${glf(numCells[0])}, ${glf(numCells[1])});
        float skipPct = ${glf(skipPct)};


        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;

        vec2 coord = floor(uv * numCells) / numCells;
        float val = rand(coord) * 0.5 * step(skipPct, rand(fract(coord + 1.23)));
        return vec3(val, 0., 0.);
      }`,
    );
  };
}

function createLinearGradient(seed: string, borderWidth: number) {
  return () => {
    // gradient - either diagonal, vertical, or horizontal
    const rng = seedrandom(seed);
    // This approach of dynamically building our shader is dangerous, bc
    // it's easy to have certain settings cause shader errors and not notice.
    const flipX = sample(rng, ['', 'uv.x = 1. - uv.x;']);
    const flipY = sample(rng, ['', 'uv.y = 1. - uv.y;']);
    // empty string gives us diagonal, other two are horizontal/vertical
    const direction = sample(rng, ['', 'uv.x = uv.y;', 'uv.y = uv.x;']);
    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      ${randFunc}
      vec3 gen_val(vec2 uv) {
        ${flipX}
        ${flipY}
        ${direction}   
        return vec3((uv.x + uv.y) / 2., 0., 0.);
      }`,
    );
  };
}

function createTriangles(seed: string, borderWidth: number) {
  return () => {
    // a bunch of triangles
    const rng = seedrandom(seed);
    // -1 means never flip, 1 means always flip, 0 means half the time
    const flip = sample(rng, [-1, 1, 0, 0, 0]);
    const numCells = ~~lerp(3, 15, rng());

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      ${randFunc}
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float borderWidth = ${glf(borderWidth)};
        float flip = ${glf(flip)};

        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;

        vec2 coord = floor(uv * numCells) / numCells;
        uv = fract(uv * numCells);

        float r = rand(coord);
        if (r < 0.5 + flip) {
          uv.x = 1. - uv.x;
        }

        float val = rand(coord + 7.77 * (step(uv.x, uv.y)));
        return vec3(val, 0., 0.);
      }`,
    );
  };
}

function createGridCircles(seed: string, borderWidth: number) {
  return () => {
    // a grid of circles
    const rng = seedrandom(seed);

    const numCells = ~~lerp(5, 25, rng());
    const cellSize = 1 / numCells;
    // relative to cell size
    const radius = lerp(0.1, 0.16, rng()) * cellSize;

    const jitterAmt = weightedPick(rng, [
      [10, 0],
      [2, 0.3 * cellSize],
      [2, radius * 0.5],
    ]);

    // This is a bit convoluted, calculating the centers in JS and then
    // dynamically building our frag shader, but it's the best way i could
    // come up with doing this whil using gaussian distribution
    const centers: Point[] = [];
    for (let i = 0; i < numCells; i++) {
      for (let j = 0; j < numCells; j++) {
        centers.push([
          i * cellSize + cellSize / 2 + gauss(rng, jitterAmt),
          j * cellSize + cellSize / 2 + gauss(rng, jitterAmt),
        ]);
      }
    }
    const vec2s = centers.map(c => `vec2(${glf(c[0])},${glf(c[1])})`);

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float radius = ${glf(radius)};
        float borderWidth = ${glf(borderWidth)};

        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;
        
        float val = 0.;
        float dist = 0.;
        vec2 diff = vec2(0.);
        float hypot = 0.;
        
        const float cg = pow(2., 13.);
        
        // Take a fairly hacky approach of calculating distance, as without
        // this, I was ending up with different values of sqrt on ipad
        ${vec2s
          .map(
            v =>
              `diff = uv - ${v};
              hypot = diff.x * diff.x + diff.y * diff.y;
              hypot = floor(hypot * cg) / cg;
              dist = sqrt(hypot);
              dist = floor(dist * cg) / cg;
              val += 0.15 * (1. - smoothstep(radius*0.75, radius * 1.5, dist));`,
          )
          .join('\n')}

        return vec3(val, 0., 0.);
      }`,
    );
  };
}

function createSinWaves(
  seed: string,
  borderWidth: number,
  sincos: ReturnType<typeof generateSinCos>,
) {
  return () => {
    // a set of sin waves
    const rng = seedrandom(seed);

    const numCells = ~~lerp(3, 12, Math.pow(rng(), 2));

    const lw = lerp(0.003, 0.01, Math.pow(rng(), 2));
    const horizontal = rng() < 0.5;
    const freq = ~~lerp(1, 5, rng());
    const amp = lerp(0.01, 0.05, Math.pow(rng(), 2));

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      ${sincos.glsl}
      const float cg = 4096.;
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float borderWidth = ${glf(borderWidth)};
        float lw = ${glf(lw)};
        float freq = ${glf(freq)};
        float amp = ${glf(amp)};

        if (${horizontal}) {
          uv = uv.yx;
        }
        
        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        
        uv.x += sin2(uv.y * TAU * freq) * amp;
        uv = floor(uv * cg) / cg;
        
        float x = fract(uv.x * numCells + 0.5);
        x = floor(x * cg) / cg;
        float d = distance(x, 0.5);
        d = floor(d * cg) / cg;
        
        float lwCell = lw/2.*numCells;
        
        float sm = smoothstep(lwCell*0.75, lwCell * 1.5, d);
        float val = (1. - sm) *
          step(distance(uv.x, 0.5) * 2., 1. - lw * 2.);

        return vec3(val * 0.5, 0., 0.);
      }`,
    );
  };
}

function createCheckerboard(seed: string, borderWidth: number) {
  return () => {
    // checkerboard
    const rng = seedrandom(seed);

    const numCells = ~~lerp(6, 10, rng());

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float borderWidth = ${glf(borderWidth)};
        
        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;
        
        vec2 coord = floor(uv * numCells);
        float val = step(mod((coord.x + coord.y), 2.), 0.9);
        // imitiation of shadowblur
        vec2 uvCell = fract(uv * numCells);
        vec2 d = abs(uvCell - vec2(0.5));
        val += smoothstep(0.95, 1., max(d.x, d.y)*2.);
        
        val = clamp(val, 0., 1.);
        return vec3(val * 0.5, 0., 0.);
      }`,
    );
  };
}

function createSteps(seed: string, borderWidth: number) {
  return () => {
    // draw two sides of a checkerboard square
    const rng = seedrandom(seed);

    const numCells = ~~lerp(6, 10, rng());

    const lw = coarseGrain(
      lerp(0.005, 0.04, Math.pow(rng(), 2)) / numCells,
      Math.pow(2, 9),
    );

    const flipX = sample(rng, ['', 'uv.x = 1. - uv.x;']);

    return createFragmentShader(
      borderWidth,
      /*glsl*/ `
      // from https://iquilezles.org/articles/distfunctions2d/
      float sdRoundBox(in vec2 p, in vec2 b, in vec4 r) {
        r.xy = (p.x>0.0)?r.xy : r.zw;
        r.x  = (p.y>0.0)?r.x  : r.y;
        vec2 q = abs(p)-b+r.x;
        return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
      } 
      
      vec3 gen_val(vec2 uv) {
        float numCells = ${glf(numCells)};
        float borderWidth = ${glf(borderWidth)};
        float lw = ${glf(lw)};
        ${flipX}
        
        uv = (uv - vec2(borderWidth)) / (1. - 2. * vec2(borderWidth));
        uv = floor(uv * 4096.) / 4096.;

        vec2 coord = floor(uv * numCells);
        
        float lightCell = (1. - step(mod(coord.x + coord.y, 2.), 0.9));
        vec2 uvCell = fract(uv * numCells);
        uvCell = mix(1. - uvCell, uvCell, lightCell);

        lw = lw * numCells / 2.;

        const float cg = pow(10., 7.);
        lw = floor(lw * cg) / cg;
        
        float left = 1. - smoothstep(lw, lw + 0.05, uvCell.x);
        left = floor(left * cg) / cg;
        float right = 1. - smoothstep(lw, lw + 0.05, uvCell.y);
        right = floor(right * cg) / cg;
        float corner = 1. - smoothstep(lw, lw + 0.05, distance(uvCell, vec2(1.)));
        corner = floor(corner * cg) / cg;
        
        float val = min(1., left + right + corner);
        
        return vec3(val * 0.5, 0., 0.);
      }`,
    );
  };
}

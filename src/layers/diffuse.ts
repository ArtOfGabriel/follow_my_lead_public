import { Point, sample } from '../core';
import { createDoubleFBO, initShaderProgram } from '../shader-lib/glShared';
import { hashCode, log, logPixel, logPixels } from '../debugUtils';

/**
 * This runs both our decay step, and our diffuse step (if diffusion is enabled)
 * Diffusion essentially replaces the current value with the average in the
 * Moore neighborhood, using a 3x3 kernel of weights. It then further modifies
 * those weights based on our landscape texture.
 */
export function createDiffuser(
  gl: WebGL2RenderingContext,
  extant: Point,
  {
    decay,
    diffuse,
  }: {
    // 0-1
    decay: number;
    diffuse: boolean;
  },
) {
  const fbos = createDoubleFBO(gl, extant, null);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
    gl.STATIC_DRAW,
  );
  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.STATIC_DRAW,
  );

  const program = initShaderProgram(gl, vert, frag(diffuse));
  gl.useProgram(program);
  const uniforms = {
    u_prev: gl.getUniformLocation(program, 'u_prev'),
    u_deposit: gl.getUniformLocation(program, 'u_deposit'),
    u_texsize: gl.getUniformLocation(program, 'u_texsize'),
    u_decay: gl.getUniformLocation(program, 'u_decay'),
    u_landscape: gl.getUniformLocation(program, 'u_landscape'),
    u_hack: gl.getUniformLocation(program, 'u_hack'), // TODO: remove
  };

  gl.uniform2f(uniforms.u_texsize, 1 / extant[0], 1 / extant[1]);

  gl.uniform1i(uniforms.u_prev, 0);
  gl.uniform1i(uniforms.u_deposit, 1);
  gl.uniform1i(uniforms.u_landscape, 2);

  return {
    update(
      landscapeTexture: WebGLTexture,
      depositTexture: WebGLTexture,
      useHack = false,
    ) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.dest.fbo);

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.useProgram(program);

      gl.uniform1i(uniforms.u_hack, useHack ? 1 : 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbos.src.texture);
      gl.uniform1i(uniforms.u_prev, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, depositTexture);
      gl.uniform1i(uniforms.u_deposit, 1);
      gl.uniform1f(uniforms.u_decay, 1 - decay);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, landscapeTexture);

      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      fbos.swap();
    },
    // TODO: remove for prod
    debug() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.src.fbo);
      const pixels = new Float32Array(fbos.width * fbos.height * 4);
      gl.readPixels(0, 0, fbos.width, fbos.height, gl.RGBA, gl.FLOAT, pixels);

      const hash = hashCode(pixels.join(','));
      log(hash, 'dif');
      // logPixel(pixels, 4 * (1024 * 511 + 511));

      return hash;
    },
    get fbo() {
      return fbos.src;
    },
  };
}

const vert = /*glsl*/ `#version 300 es
  precision highp float;
  in vec4 aPos;
  out vec2 v_uv;
  void main() {
    v_uv = (aPos.xy + 1.) / 2.;
    gl_Position = vec4(aPos.x, aPos.y, 0., 1.);
  }
`;

// Could be interesting to have diffusion and/or decay vary by channel. Could
// also be interesting to use noise (or some other texture) that affects
// decay and/or diffusion (instead of or in addition to landscape)

// One could also play with the diffusion kernel (3x3 matrix) that we use to
// do our diffusion

// Initial approach was doing everything as floats. I really struggled to get
// that to work consistently across different hardwares, and so I changed it to
// instead do much of the math in a scaled up integer space.
const frag = (diffuse: boolean) => {
  return /*glsl*/ `#version 300 es
    precision highp float;
    uniform sampler2D u_prev;
    uniform sampler2D u_deposit;
    uniform sampler2D u_landscape;
    uniform vec2 u_texsize;
    uniform float u_decay;
    uniform bool u_hack;

    in vec2 v_uv;
    out vec4 out_color;

    const float scale = 1024.;

    ivec3 current_val(vec2 uv) {
      uv = clamp(uv, 0., 1.0);
      vec3 prev = texture(u_prev, uv).rgb;
      vec3 dep = texture(u_deposit, uv).rgb;
      return ivec3((prev + dep) * scale);
    }

    void main() {
      ivec3 sum = ivec3(0);
      int sum_weights = 0;

      ${
        diffuse
          ? /*glsl*/ `
          const int weights[9] = int[9](
            1, 3, 1,
            3, 10, 3,
            1, 3, 1);
          
          const int radius = 1;
          for (int i = -radius; i <= radius; i += 1) {
            for (int j = -radius; j <= radius; j += 1) {
              vec2 pos = v_uv + vec2(float(i), float(j)) * u_texsize;
              vec2 clamped = clamp(pos, 0., 1.);
              vec2 diff = abs(pos - clamped);
              int inbounds = int(step(diff.x + diff.y, 0.));
              
              int land = int(scale * (1. - texture(u_landscape, clamped).r));
            
              int weight_index = (j + 1) * 3 + (i + 1);
              int weight = inbounds * weights[weight_index]*land;
              ivec3 val = current_val(clamped) * weight;

              // we use max to prevent addition from overflowing and giving us
              // negative values. This approach does mean that as density gets
              // especially large, our diffusion calculation is technically wrong
              // (i.e. we will get increased decay)
              sum = max(sum, sum + val);
              sum_weights = max(sum_weights, sum_weights + weight);
            }
          }

          // convert back to floats
          vec3 diffused = sum_weights == 0
            ? vec3(current_val(v_uv))
            : vec3(sum / sum_weights);
          diffused = diffused * u_decay / scale;
          
          out_color = vec4(diffused, 1.);`
          : // No diffusion case
            /*glsl*/ `out_color = vec4(vec3(current_val(v_uv)) * u_decay / scale, 1.);`
      }
    }
  `;
};

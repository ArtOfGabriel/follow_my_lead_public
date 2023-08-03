import { Point } from '../core';
import {
  createFBO,
  createTexture,
  getUniformLocation,
  initShaderProgram,
} from '../shader-lib/glShared';
import { AgentLayer } from './agents';
import { hashCode, log, logPixel } from '../debugUtils';

/**
 * Processes agent layers, and collects their deposits to create a single
 * deposit texture
 */
export function createDepositor(gl: WebGL2RenderingContext, extant: Point) {
  const fbo = createFBO(gl, extant, () => {
    const texture = createTexture(gl);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      // Blending with 32f doesn't work if we don't get this extension (i.e. on
      // my iPad). Surprisingly blending does still seem to work with 16f
      // In retrospect, wonder if I should have just used 16f everywhere
      gl.getExtension('EXT_float_blend') ? gl.RGBA32F : gl.RGBA16F,
      ...extant,
      0,
      gl.RGBA,
      gl.FLOAT,
      null,
    );
    return texture;
  });
  const vbo = gl.createBuffer();
  const program = initShaderProgram(gl, vert, frag);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, 3, -1, -1, 3, -1]),
    gl.STATIC_DRAW,
  );

  const uLocs = {
    u_amount: getUniformLocation(gl, program, 'u_amount'),
    u_buffer: getUniformLocation(gl, program, 'u_buffer'),
    u_dim: getUniformLocation(gl, program, 'u_dim'),
    u_dim_screen: getUniformLocation(gl, program, 'u_dim_screen'),
    u_point_size: getUniformLocation(gl, program, 'u_point_size'),
  };

  gl.uniform1i(uLocs.u_buffer, 0);
  gl.uniform2f(uLocs.u_dim_screen, fbo.width, fbo.height);

  return {
    get texture() {
      return fbo.texture;
    },
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.viewport(0, 0, fbo.width, fbo.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    applyAgentLayer(layer: AgentLayer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.useProgram(program);

      gl.uniform2f(uLocs.u_dim, ...layer.extant);
      gl.uniform3f(uLocs.u_amount, ...layer.deposit);
      gl.uniform1f(uLocs.u_point_size, layer.pointSize);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layer.texture);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      gl.viewport(0, 0, fbo.width, fbo.height);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, layer.numAgents);
      gl.disable(gl.BLEND);
    },
    // TODO: remove for prod
    debug() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
      const pixels = new Float32Array(fbo.width * fbo.height * 4);
      gl.readPixels(0, 0, fbo.width, fbo.height, gl.RGBA, gl.FLOAT, pixels);
      const hash = hashCode(pixels.join(','));
      log(hash, 'dep');

      // logPixel(pixels, 550_364);
      // logPixel(pixels, pixelIndex(376, 134));
      return hash;
    },
  };
}

// Here we use gl_VertexID to determine the location of this agent in our
// u_buffer texture. We then look at that texture to get the agent's current
// pos, and render a point at that position (to the appropriate channel).
const vert = /*glsl*/ `#version 300 es
  precision highp float;
  uniform sampler2D u_buffer;
  uniform vec2 u_dim;
  uniform vec2 u_dim_screen;
  uniform float u_point_size;

  out vec4 v_data;

  void main() {
    int width = int(u_dim.x);
    int y = gl_VertexID / width;
    int x = gl_VertexID - y * width;
    vec2 uv = vec2(float(x) + 0.5, float(y) + 0.5) / u_dim;
    
    // pos is in pixel space
    vec2 pos = texture(u_buffer, uv).rg;
    // floor it and add 0.5 so that we're on a half pixel
    // this seems to be necessary to get my mac/ipad behaving the same
    pos = floor(pos) + vec2(0.5);
    // convert from pixel space not normalized (0-1) space
    pos = pos / u_dim_screen;
    
    gl_Position = vec4(pos * 2. - 1., 0., 1.);
    gl_PointSize = u_point_size;
  }`;

const frag = /*glsl*/ `#version 300 es
  precision highp float;
  uniform vec3 u_amount;
  out vec4 out_color;

  void main() {
    out_color = vec4(u_amount, 1.);
  }`;

import seedrandom from 'seedrandom';

import { Point, mod } from '../core';
import {
  createDoubleFBO,
  createTexture,
  getUniformLocation,
  initShaderProgram,
} from '../shader-lib/glShared';
import { hashCode, log, logPixel, logPixels } from '../debugUtils';
import { generateSinCos } from './sincos';

type vec3 = [number, number, number];
type vec4 = [number, number, number, number];

export type AgentLayer = ReturnType<typeof createAgentLayer>;
export type AgentLayerOptions = {
  sensorOffset: number;
  deposit: vec3;
  pointSize: number;
  stepSize: number;
  sensorAngle: number; // expressed as a pct of PI
  rotationAmount: number; // expressed as a pct of PI
  landScale: vec3;
  texScale: vec3;
};

/**
 * This creates a layer (with 2x FBOs) of agent positions and angles. Each step
 * it will update those positions/angles according to
 * (a) passed in settings
 * (b) current pos/angle
 * (c) landscape texture
 * (d) deposit texture (i.e. history of where all three types of aegnts have been)
 */
export function createAgentLayer(
  gl: WebGL2RenderingContext,
  extant: Point,
  // posx, posy (canvas space), heading (radians)
  agentData: vec3[],
  {
    sensorOffset,
    deposit,
    pointSize,
    stepSize,
    sensorAngle,
    rotationAmount,
    landScale,
    texScale,
  }: AgentLayerOptions,
) {
  // It's not really too important what we seed this with
  const rng = seedrandom(
    stepSize.toString() + sensorOffset.toString() + deposit.join(','),
  );

  const cols = Math.ceil(Math.sqrt(agentData.length));
  const rows = Math.ceil(agentData.length / cols);

  const fbos = createDoubleFBO(gl, [cols, rows], () =>
    createDataTextureFromPoints(gl, agentData, cols, rows),
  );

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, 3, -1, -1, 3, -1]),
    gl.STATIC_DRAW,
  );

  // at 1024, some iterations seem to eventually diverge on linux
  const sincos = generateSinCos(gl, 512);

  const program = initShaderProgram(
    gl,
    vert,
    frag.replace('//insert-sincos', sincos.glsl),
  );

  const uLocs = {
    u_buffer: getUniformLocation(gl, program, 'u_buffer'),
    // what channel to use from trail/landscape maps for updating
    u_trail: getUniformLocation(gl, program, 'u_trail'),
    u_sincos: getUniformLocation(gl, program, 'u_sincos'),
    u_trail_dim: getUniformLocation(gl, program, 'u_trail_dim'),
    u_landscape: getUniformLocation(gl, program, 'u_landscape'),
    u_sensor_offset: getUniformLocation(gl, program, 'u_sensor_offset'),
    u_step_size: getUniformLocation(gl, program, 'u_step_size'),
    u_sensor_angle: getUniformLocation(gl, program, 'u_sensor_angle'),
    u_rotation_amount: getUniformLocation(gl, program, 'u_rotation_amount'),
    u_tex_scale: getUniformLocation(gl, program, 'u_tex_scale'),
    u_land_scale: getUniformLocation(gl, program, 'u_land_scale'),
    u_rand_dir: getUniformLocation(gl, program, 'u_rand_dir'),
  };

  gl.useProgram(program);
  gl.uniform1i(uLocs.u_buffer, 0);
  gl.uniform1i(uLocs.u_trail, 1);
  gl.uniform1i(uLocs.u_landscape, 2);
  gl.uniform1i(uLocs.u_sincos, 3);

  // we assume landscape is same dim as trail
  gl.uniform2f(uLocs.u_trail_dim, ...extant);
  gl.uniform1f(uLocs.u_sensor_offset, sensorOffset);
  gl.uniform1f(uLocs.u_step_size, stepSize);
  gl.uniform1f(uLocs.u_sensor_angle, sensorAngle * Math.PI);
  gl.uniform1f(uLocs.u_rotation_amount, rotationAmount * Math.PI);
  gl.uniform3f(uLocs.u_tex_scale, ...texScale);
  gl.uniform3f(uLocs.u_land_scale, ...landScale);

  return {
    get texture() {
      return fbos.src.texture;
    },
    get extant(): Point {
      return [fbos.width, fbos.height];
    },
    get numAgents() {
      return agentData.length;
    },
    get deposit() {
      return deposit;
    },
    get pointSize(): number {
      return pointSize ?? 1;
    },
    get length() {
      return agentData.length;
    },
    update(trail: WebGLTexture, landscape: WebGLTexture) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.useProgram(program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.dest.fbo);

      gl.uniform1f(uLocs.u_rand_dir, rng() < 0.5 ? 1 : -1);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbos.src.texture);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, trail);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, landscape);

      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, sincos.texture);

      gl.viewport(0, 0, fbos.width, fbos.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      fbos.swap();
    },
    // TODO: remove for prod
    debug() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.src.fbo);
      const pixels = new Float32Array(fbos.width * fbos.height * 4);
      gl.readPixels(0, 0, fbos.width, fbos.height, gl.RGBA, gl.FLOAT, pixels);
      const hash = hashCode(pixels.join(','));
      log(hash, 'age');

      // logPixels(pixels, 148, 8);
      // logPixel(pixels, 152);
      return hash;
    },
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

const vert = /*glsl*/ `#version 300 es
  precision highp float;
  in vec4 aPos;
  out vec2 v_uv;
  void main() {
    v_uv = (aPos.xy + 1.) / 2.;
    gl_Position = vec4(aPos.x, aPos.y, 0., 1.);
  }
`;

const frag = /*glsl*/ `#version 300 es
  precision highp float;
  uniform sampler2D u_buffer;
  uniform sampler2D u_trail;
  uniform sampler2D u_sincos;
  uniform sampler2D u_landscape;
  uniform vec2 u_trail_dim;
  // smaller numbers lead to small "cells"
  uniform float u_sensor_offset;
  uniform float u_step_size;
  // very small, and agent will often get idential readings across sensors
  uniform float u_sensor_angle;
  // changing this can change the shapes of what is generated
  uniform float u_rotation_amount;
  uniform vec3 u_tex_scale;
  uniform vec3 u_land_scale;
  uniform float u_rand_dir;
  
  in vec2 v_uv;
  out vec4 out_color;

  //insert-sincos

  vec2 polarize(vec2 v, float angle, float mag) {
    // decrease precision, to improve consistency across hardware
    return v  + floor(vec2(cos2(angle), sin2(angle)) * mag * 1024.) / 1024.;
  }

  float sum(vec3 v) { return v.x + v.y + v.z; }

  const float cg = pow(2., 11.);

  float trail(vec2 pos) {
    vec2 uv = pos / u_trail_dim;
    if (fract(uv) != uv) {
      return 0.;
    }
    // center of pixel
    uv = (floor(uv * u_trail_dim) + 0.5) / u_trail_dim;

    // could be interesting? to penalize a tex value that's too high 
    // (i.e. something like attracted to val < n, but turned away for val > n)
    vec3 tex = texture(u_trail, uv).rgb;
    vec3 land = texture(u_landscape, uv).rgb;
    
    return sum(u_tex_scale * tex) + sum(u_land_scale * land);
  }
  
  void main() {
    vec4 tex = texture(u_buffer, v_uv);
    vec2 pos = tex.xy;
    float angle = tex.z;

    vec2 agent_uv = pos / u_trail_dim;

    // all things that could be varied more - either per agent, per location,
    // or randomly
    float stepsize = u_step_size;
    float sensor_offset = u_sensor_offset;
    float sensor_angle = u_sensor_angle;
    float rotation_amount = u_rotation_amount;
    
    vec2 lp = polarize(pos, angle - sensor_angle, sensor_offset);
    vec2 cp = polarize(pos, angle, sensor_offset);
    vec2 rp = polarize(pos, angle + sensor_angle, sensor_offset);

    float left = trail(lp);
    float center = trail(cp);
    float right = trail(rp);
    
    float next_angle = angle;
    if (center > left && center > right) { 
      // noop
    } else if (center < left && center < right) {
      next_angle += rotation_amount * u_rand_dir;
    } else if (left < right) {
      next_angle += rotation_amount;
    } else if (right < left) {  
      next_angle -= rotation_amount;
    } else {
      // stay in same direction
    }

    next_angle = mod(next_angle + TAU, TAU);
    
    vec2 next_pos = polarize(pos, next_angle, stepsize);
    
    // if next pos is out of bounds, stay in place and turn around. could play
    // with other values of how much we rotate here
    if (next_pos.x < 0. || next_pos.y < 0.
        || next_pos.x >= u_trail_dim.x || next_pos.y >= u_trail_dim.y) {
      next_pos = pos;
      next_angle += PI;
    }
    
    out_color = vec4(next_pos, next_angle, 1.);
  }
`;

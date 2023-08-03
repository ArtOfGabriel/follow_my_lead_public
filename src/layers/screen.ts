import { Rng, sample, shuffle, weightedPick } from '../core';
import { initShaderProgram } from '../shader-lib/glShared';
import { Palette } from '../Palette';

export function createScreenDrawer(
  gl: WebGL2RenderingContext,
  palette: Palette,
) {
  const { background, color1, color2, color3 } = palette;

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

  const program = initShaderProgram(gl, vert, frag);
  gl.useProgram(program);

  const uniforms = {
    u_buffer: gl.getUniformLocation(program, 'u_buffer'),
    u_c1: gl.getUniformLocation(program, 'u_c1'),
    u_c2: gl.getUniformLocation(program, 'u_c2'),
    u_c3: gl.getUniformLocation(program, 'u_c3'),
    u_background: gl.getUniformLocation(program, 'u_background'),
  };

  gl.uniform3f(uniforms.u_c1, ...colorToRgb(color1));
  gl.uniform3f(uniforms.u_c2, ...colorToRgb(color2));
  gl.uniform3f(uniforms.u_c3, ...colorToRgb(color3));
  gl.uniform3f(uniforms.u_background, ...colorToRgb(background));

  return {
    draw(texture: WebGLTexture) {
      gl.useProgram(program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0.0, 0.0, 0.0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.u_buffer, 0);

      // I think this depends on the right arrays being activated, and this
      // might end up failing if we didn't last run diffuse. Could be a future
      // problem
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    },
  };
}

type vec3 = [number, number, number];

// color is either #aabbcc or aabbcc
function colorToRgb(color: string): vec3 {
  if (color[0] !== '#') {
    color = '#' + color;
  }
  if (color.length !== 7) {
    throw new Error('invalid string');
  }
  const r = color.slice(1, 3);
  const g = color.slice(3, 5);
  const b = color.slice(5, 7);
  const dec = [r, g, b].map(x => parseInt(x, 16) / 255);
  return [dec[0], dec[1], dec[2]];
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
  uniform vec3 u_c1;
  uniform vec3 u_c2;
  uniform vec3 u_c3;
  uniform vec3 u_background;
  in vec2 v_uv;
  out vec4 out_color;  

  // anything > will be rendered as if it was max_amount
  // Could potentially instead examine the texture after our initialSteps, and figure
  // out what should be max_amount from that.
  const vec3 max_amount = vec3(4.);

  void main() {
    vec3 amount = texture(u_buffer, v_uv).rgb;
    vec3 pct = amount / max_amount;
    pct = clamp(pct, 0., 1.);
    float maxXy = max(pct.x, pct.y);
    float maxPct = max(pct.z, maxXy);

    // by adjusting power here, we can get thicker/thinner lines
    // pct = pow(pct, vec3(0.8, 3., 1.));
    
    vec3 col = u_background;

    // avoid dividing by zero
    if (maxPct > 0.) {    
      // Not sure if there are better approaches for blending, but this works ok
      
      vec3 c12 = maxXy == 0. ? u_c1 : mix(u_c1, u_c2, pct.y / (pct.x + pct.y));
      vec3 c123 = mix(c12, u_c3, pct.z / (pct.x + pct.y + pct.z));
      col = mix(col, c123, maxPct);
    }

    out_color = vec4(col, 1.);
  }
`;

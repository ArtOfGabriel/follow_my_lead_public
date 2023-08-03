import { CtxGL } from '../core';
import { checkShaderError } from './checkShaderError';

export function initShaderProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw new Error('failed to create program');
  }
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram,
      )}`,
    );
  }

  return shaderProgram;
}

function loadShader(gl: CtxGL, type: GLenum, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('failed to create shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  // Should be no need for this now that I'm not actively developing.
  // TODO: remove
  checkShaderError(gl, shader, source, type, undefined);

  return shader;
}

export function createTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error('failed to create texture');
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return texture;
}

export function createFBO(
  gl: WebGL2RenderingContext,
  [width, height]: [number, number],
  texture: WebGLTexture | (() => WebGLTexture) | null,
) {
  let clear = false;
  if (typeof texture === 'function') {
    texture = texture();
  }

  if (!texture) {
    clear = true;
    texture = createTexture(gl);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      width,
      height,
      0,
      gl.RGBA,
      gl.FLOAT,
      null,
    );
  }

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  if (clear) {
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  return {
    fbo,
    texture,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
  };
}

export function createDoubleFBO(...params: Parameters<typeof createFBO>) {
  const fbos = [createFBO(...params), createFBO(...params)];
  let srcIndex = 0;

  return {
    get src() {
      return fbos[srcIndex];
    },
    get dest() {
      return fbos[srcIndex ^ 1];
    },
    get width() {
      return this.src.width;
    },
    get height() {
      return this.src.height;
    },
    swap() {
      srcIndex = srcIndex ^ 1;
    },
  };
}

export function getUniformLocation(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  ignoreNotFound = false,
) {
  const loc = gl.getUniformLocation(program, name);
  const error = gl.getError();
  if (error) {
    console.error(error);
  } else if (!loc && !ignoreNotFound) {
    console.error(`no location found for uniform ${name}`);
  }
  return loc;
}

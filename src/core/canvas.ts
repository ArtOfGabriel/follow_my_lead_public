import { Ctx } from '.';

export function createCanvas(
  width: number,
  height: number,
  options?: CanvasRenderingContext2DSettings,
  parent?: HTMLElement,
): Ctx {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', width.toString());
  canvas.setAttribute('height', height.toString());
  if (parent) {
    parent.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d', options);
  if (!ctx) {
    throw new Error('failed to get ctx');
  }
  return ctx;
}

export function createCanvasGL(
  width: number,
  height: number,
  options?: WebGLContextAttributes,
  parent?: HTMLElement,
): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('width', width.toString());
  canvas.setAttribute('height', height.toString());
  if (parent) {
    parent.appendChild(canvas);
  }

  const ctx = canvas.getContext('webgl2', options);
  if (!ctx) {
    throw new Error('failed to get ctx');
  }
  return ctx;
}

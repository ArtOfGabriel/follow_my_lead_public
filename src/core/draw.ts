import { Point, lerpPoint } from '.';
export type Ctx = CanvasRenderingContext2D;
export type CtxGL = WebGL2RenderingContext;

export function circle(ctx: Ctx, center: Point, radius: number) {
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, 0, 2 * Math.PI);
  ctx.fill();
}

export function strokeCircle(ctx: Ctx, center: Point, radius: number) {
  ctx.beginPath();
  ctx.arc(center[0], center[1], radius, 0, 2 * Math.PI);
  ctx.stroke();
}

export function line(ctx: Ctx, p1: Point, p2: Point) {
  ctx.beginPath();
  ctx.moveTo(...p1);
  ctx.lineTo(...p2);
  ctx.stroke();
}

export function curvyLine(ctx: Ctx, p1: Point, p2: Point) {
  const mid = lerpPoint(p1, p2, 0.5);
  const dx = 30;
  ctx.beginPath();
  ctx.moveTo(...p1);

  ctx.bezierCurveTo(mid[0] + dx, mid[1], mid[0] - dx, mid[1], ...p2);
  ctx.stroke();
}

export function pointsToPath(points: Point[], closePath = true): Path2D {
  const path = new Path2D();
  path.moveTo(...points[0]);
  points.slice(1).forEach(p => path.lineTo(...p));
  if (closePath) {
    path.closePath();
  }
  return path;
}

export type Point = [number, number];
export type Vector = [number, number];

export const lerp = (start: number, end: number, amt: number) =>
  start + (end - start) * amt;

export const lerpPoint = (start: Point, end: Point, amt: number): Point => [
  lerp(start[0], end[0], amt),
  lerp(start[1], end[1], amt),
];

export const mod = (num: number, modulo: number) => (num + modulo) % modulo;

export const clamp = (val: number, min: number, max: number) => {
  val = Math.min(max, val);
  val = Math.max(min, val);
  return val;
};

export function polarize(point: Point, angle: number, mag: number): Point {
  return [point[0] + Math.cos(angle) * mag, point[1] + Math.sin(angle) * mag];
}

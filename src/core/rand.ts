import seedrandom from 'seedrandom';

export type Rng = () => number;

// Taken from https://github.com/lodash/lodash/blob/master/shuffle.js
// Copied here so that it properly uses a seeded Math.random
export function shuffle<T>(rng: Rng, array: T[]): T[] {
  const length = array === null ? 0 : array.length;
  if (!length) {
    return [];
  }
  let index = -1;
  const lastIndex = length - 1;
  const result = array.slice(0); // modified this line
  while (++index < length) {
    const rand = index + Math.floor(rng() * (lastIndex - index + 1));
    const value = result[rand];
    result[rand] = result[index];
    result[index] = value;
  }
  return result;
}

export const randRange = (rng: Rng, min: number, max: number): number =>
  rng() * (max - min) + min;

export const sample = <T>(rng: Rng, array: T[]): T =>
  array[~~randRange(rng, 0, array.length)];

type WeightedOption<T> = [number, T];
export function weightedPick<T>(rng: Rng, options: WeightedOption<T>[]): T {
  const totalWeight = options.reduce((agg, cur) => agg + cur[0], 0);

  const r = rng();
  let runningPct = 0;
  let option: T = options[0][1];
  for (let i = 0; i < options.length && runningPct <= r; i++) {
    option = options[i][1];
    runningPct += options[i][0] / totalWeight;
  }
  return option;
}

export function gauss(rng: Rng, sd = 1) {
  let w: number, x1: number, x2: number;
  do {
    x1 = rng() * 2 - 1;
    x2 = rng() * 2 - 1;
    w = x1 * x1 + x2 * x2;
  } while (w >= 1);
  w = Math.sqrt((-2 * Math.log(w)) / w);

  return x1 * w * sd;
}

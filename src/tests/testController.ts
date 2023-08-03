import Physarum, { Options } from '../Physarum';
import { Point } from '../core';
import { hashCode, hashColor } from '../debugUtils';
import { agentTests } from './agentTests';
import { diffuseTests } from './diffuseTests';
import { landscapeTests } from './landscapeTests';

const size = 2048;
const glScale = 1 / 2;
const renderDim: Point = [size, size];
const trailDim: Point = [renderDim[0] * glScale, renderDim[1] * glScale];

export interface Test {
  seed: string;
  options: Partial<Options>;
  label: string;
}

export function createTest(
  label: string,
  seed: string,
  options: Partial<Options>,
): Test {
  return { seed, options, label };
}

export function createPhysarum(options: Options) {
  return new Physarum(trailDim, options);
}

/**
 * I was running into a lot of challenges debugging hardware differences. The
 * approach I ended up taking was to run one or multiple instances with particular
 * seeds, pull out the pixel data of the layer I was interested in (agent, diffuse
 * landscape), generate a hash for thata data, then manually compare the hash
 * values. Where different, I would use logPixel/logPixels to dig into where they
 * were different.
 */
export async function testRun() {
  // await landscapeTests();
  // await agentTests();
  await diffuseTests();
}

export function appendLine(content: string) {
  const div = document.createElement('div');
  div.style.font = '20px';
  getRoot().appendChild(div);
  div.innerHTML = content;
}

export function appendToLastLine(text: string) {
  const lastLine = [...getRoot().children].slice(-1)[0];
  if (lastLine) {
    lastLine.innerHTML += text;
  }
}

export function getRoot() {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('no root');
  }
  root.style.display = 'block';
  return root;
}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import seedrandom from 'seedrandom';
import {
  Test,
  appendLine,
  appendToLastLine,
  createPhysarum,
  createTest,
  getRoot,
  timeout,
} from './testController';
import Physarum from '../Physarum';
import { hashCode, hashColor } from '../debugUtils';

export async function agentTests() {
  const baseSeed = 'd';
  let aggregate = '';
  for (let i = 0; i < 45; i++) {
    const seed = baseSeed + i;
    const test = createTest(seed, seed, {});
    aggregate += await runAgentTest(test);
    appendToLastLine(` (${i}) ${hashCode(aggregate)}`);
    await timeout(100);
  }
  appendLine('OVERALL: ' + hashCode(aggregate));
}

async function runAgentTest({ seed, options: partialOptions, label }: Test) {
  return new Promise<string>(resolve => {
    const options = Physarum.createOptions(seed);
    const physarum = createPhysarum({
      ...options,
      ...partialOptions,
    });

    const div = document.createElement('div');
    div.style.font = '20px';
    getRoot().appendChild(div);

    const setText = (text: string | number) =>
      (div.innerHTML = label + ' ' + text);

    const result = physarum.debug();
    console.log(result);

    const hashes = result.agents.join(' ');
    const triplet = hashCode(hashes);
    setText(`${triplet} | ${hashes}`);
    div.style.background = hashColor(triplet);
    resolve(triplet);
  });
}

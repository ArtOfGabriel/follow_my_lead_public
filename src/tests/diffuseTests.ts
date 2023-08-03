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

const SLOW_UPDATES = true;

interface DiffuseTest extends Test {
  numSteps: number;
}

function createDiffuseTest(seed: string, numSteps: number): DiffuseTest {
  return {
    ...createTest(seed, seed, {}),
    numSteps,
  };
}

const tests: DiffuseTest[] = [
  createDiffuseTest('seed_full', 1),
  createDiffuseTest('seed_full2', 1),
  createDiffuseTest(' diffuse 4', 200),
];

export async function diffuseTests() {
  const numSteps = 300;
  const baseSeed = 'cb';
  const tests = Array.from({ length: 10 }, (_, i) =>
    createDiffuseTest(baseSeed + i, numSteps),
  );
  await runTests(tests);
}

async function runTests(tests: DiffuseTest[]) {
  let aggregate = '';
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    aggregate += await runDiffuseTest(test);
    appendToLastLine(` (${i}) ${hashCode(aggregate)}`);
    await timeout(1000);
  }
  appendLine('OVERALL: ' + hashCode(aggregate));
}

async function runDiffuseTest({
  seed,
  options: partialOptions,
  label,
  numSteps,
}: DiffuseTest) {
  return new Promise<string>(resolve => {
    async function foo() {
      const options = Physarum.createOptions(seed);
      const physarum = createPhysarum({
        ...options,
        ...partialOptions,
      });

      for (let i = 0; i < numSteps; i++) {
        physarum.update();
        if (i % 10 === 9 && SLOW_UPDATES) {
          await timeout(100);
        }
      }

      const div = document.createElement('div');
      div.style.font = '20px';
      getRoot().appendChild(div);

      const setText = (text: string | number) =>
        (div.innerHTML = label + ' ' + text);

      const result = physarum.debug();
      console.log(result);

      const hash = result.trail.diffuse;
      setText(hash);
      div.style.background = hashColor(hash);
      resolve(hash);
    }
    foo();
  });
}

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
import Physarum, { Options } from '../Physarum';
import { hashCode, hashColor } from '../debugUtils';

const tests: Test[] = [
  createTest('radial gradient', '1234', { landscapeType: 'radial gradient' }),
  createTest('central circle', '314', { landscapeType: 'central circle' }),
  createTest('central square', 'abc', { landscapeType: 'central square' }),
  createTest('corner circles', 'a', { landscapeType: 'corner circles' }),
  createTest('corner circles foo14', 'foo14', {
    landscapeType: 'corner circles',
  }),
  createTest('corner circles foo14', '*_42', {
    landscapeType: 'corner circles',
  }),
  createTest('lines', 'bbb', { landscapeType: 'lines' }),
  createTest('grid', 'ccc', { landscapeType: 'grid' }),
  createTest('linear gradient', 'ddd', { landscapeType: 'linear gradient' }),
  createTest('triangles', 'eee', { landscapeType: 'triangles' }),
  createTest('grid circles', 'fff', { landscapeType: 'grid circles' }),
  createTest('grid circles GC.11', 'GC.11', {
    landscapeType: 'grid circles',
  }),
  createTest('grid circles GC.21', 'GC.21', {
    landscapeType: 'grid circles',
  }),
  createTest('grid circles GC.44', 'GC.44', {
    landscapeType: 'grid circles',
  }),
  createTest('sin waves', 'ggg', { landscapeType: 'sin waves' }),
  createTest('sin waves SW.9', 'SW.9', { landscapeType: 'sin waves' }),
  createTest('checkerboard', 'hhh', { landscapeType: 'checkerboard' }),
  createTest('steps', 'iii', { landscapeType: 'steps' }),
  createTest('steps S-0', 'S-0', { landscapeType: 'steps' }),
  createTest('steps S-42', 'S-42', { landscapeType: 'steps' }),
  createTest('steps S-46', 'S-46', { landscapeType: 'steps' }),
  createTest('730.0659210251027', '730.0659210251027', {
    landscapeType: 'steps',
  }),
  createTest('-1a884373', '-1a884373', { landscapeType: 'steps' }),
  createTest('al40', 'al40', { landscapeType: 'steps' }),
  createTest('b18', 'b18', { landscapeType: 'steps' }),
  createTest('b24', 'b24', { landscapeType: 'steps' }),
  createTest('b27', 'b27', { landscapeType: 'steps' }),
  createTest('c7', 'c7', { landscapeType: 'steps' }),
  createTest('c39', 'c39', { landscapeType: 'steps' }),
  createTest('c41', 'c41', { landscapeType: 'steps' }),
];

export async function landscapeTests() {
  // await runTests(tests);

  // await runTests([createTest('c41', 'c41', { landscapeType: 'steps' })]);

  await runTests(createLandscapeTests('ccc', 45, 'noise'));
}

// Create a batch of tests for a specific landscape type
function createLandscapeTests(
  baseSeed: string,
  numTests: number,
  landscapeType?: Options['landscapeType'],
) {
  return Array.from({ length: numTests }, (_, i) => {
    const seed = baseSeed + i;
    let label = seed;
    const options: Partial<Options> = {};
    if (landscapeType) {
      label = `${landscapeType} ${seed}`;
      options.landscapeType = landscapeType;
    }

    return createTest(label, seed, options);
  });
}

async function runTests(tests: Test[]) {
  let aggregate = '';
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    aggregate += await runLandscapeTest(test);
    appendToLastLine(` (${i}) ${hashCode(aggregate)}`);
    await timeout(100);
  }
  appendLine('OVERALL: ' + hashCode(aggregate));
}

async function runLandscapeTest({
  seed,
  options: partialOptions,
  label,
}: Test) {
  return new Promise<string>(resolve => {
    const options = Physarum.createOptions(seed);
    console.log({
      ...options,
      ...partialOptions,
    });
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

    const hash = result.trail.land;
    setText(hash);
    div.style.background = hashColor(hash);
    resolve(hash);
  });
}

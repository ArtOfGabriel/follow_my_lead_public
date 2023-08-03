import Physarum from './Physarum';
import { Point, createCanvas } from './core';
import { getFriendlyColor } from './Palette';
import { testRun } from './tests/testController';

const size = 2048;
const glScale = 1 / 2;
const renderDim: Point = [size, size];
const trailDim: Point = [renderDim[0] * glScale, renderDim[1] * glScale];
const numInitialSteps = 300;

async function main() {
  const isLocalHost = window.location.host.includes('localhost');
  const query = new URLSearchParams(window.location.search);
  const querySeed = query.get('seed');

  const seed = '' || querySeed || window.$fx.hash || Date.now().toString();

  const freshStart = query.get('fresh') === 'true';
  const animate = query.get('animate') === 'true';

  // TODO: remove for prod
  // (window as any).lastStep = numInitialSteps;
  // (window as any).injectEnabled = true;

  const root = document.getElementById('root');
  if (!root) {
    throw new Error('missing root');
  }

  const ctx = createCanvas(...renderDim, {}, root);
  const options = Physarum.createOptions(seed);
  const physarum = new Physarum(trailDim, {
    ...options,
  });

  window.$fx.features({
    background: getFriendlyColor(options.palette.background),
    communities: [
      options.palette.color1,
      options.palette.color2,
      options.palette.color3,
    ]
      .sort()
      .map(getFriendlyColor)
      .join(', '),
    diffusion: options.diffuseEnabled,
    landscape: options.landscapeType,
    border: options.landscapeBorder,
    'jumbled attraction': options.jumbledAttraction,
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('seed: ', seed);
    console.log(window.$fx.getFeatures());
  }

  const runSteps = (numSteps: number) => {
    for (let i = 0; i < numSteps; i++) {
      physarum.update();
    }
    physarum.draw(ctx);
  };

  if (!freshStart && !animate) {
    runSteps(numInitialSteps);
  }

  if (window.$fx.isPreview) {
    window.$fx.preview();
  }

  let paused = !freshStart && !animate;
  setInterval(() => {
    if (paused) {
      return;
    }

    runSteps(1);

    if (physarum.frame === numInitialSteps && !animate) {
      paused = true;
    }
  }, 40);

  document.addEventListener('keydown', event => {
    // toggle pause
    if (event.code === 'Space') {
      paused = !paused;
      console.log('paused: ', paused);
    }

    // toggle fresh start
    if (event.code === 'KeyF') {
      if (freshStart) {
        query.delete('fresh');
      } else {
        query.set('fresh', 'true');
      }
      if (isLocalHost && !query.get('seed')) {
        query.set('seed', seed);
      }
      window.location.href = window.location.origin + '?' + query.toString();
    }

    // TODO: remove
    if (event.code === 'ArrowRight') {
      console.log('step');
      runSteps(1);
    }

    // toggle animate
    if (event.code === 'KeyA') {
      if (animate) {
        query.delete('animate');
      } else {
        query.set('animate', 'true');
      }
      if (isLocalHost && !query.get('seed')) {
        query.set('seed', seed);
      }
      window.location.href = window.location.origin + '?' + query.toString();
    }

    // Maybe leaving this in, but not going to mention it in the description.
    if (event.code === 'KeyL') {
      const landscape = document.getElementById('l');
      if (!landscape) {
        return;
      }
      if (landscape.style.display === 'none') {
        landscape.style.display = 'block';
      } else {
        landscape.style.display = 'none';
      }
    }

    // TODO: do i want to mention in description?
    if (event.code === 'KeyS') {
      const dataUrl = ctx.canvas
        .toDataURL('image/png')
        .replace('image/png', 'image/octet-stream');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.setAttribute('download', 'follow_my_lead.png');
      a.click();
    }
  });

  document.addEventListener('touchstart', () => {
    paused = !paused;
    console.log('paused: ', paused);
  });
}

main();
// testRun();

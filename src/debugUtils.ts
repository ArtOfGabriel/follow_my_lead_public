import seedrandom from 'seedrandom';

// TODO: remove me for prod

/**
 * This file includes some logic for analyzing pixel data, and injecting the
 * results of that analysis directly into the DOM (for situations like on my
 * ipad where getting access to the console.log is a bit of a PITA).
 */

/**
 * Returns a hash code from a string
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
export function hashCode(str: string) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(16);
}

let pre: HTMLPreElement | undefined;
export function injectDom() {
  if (pre) {
    return;
  }
  const root = document.getElementById('root');
  if (!root) {
    return;
  }
  if ((window as any).injectEnabled !== true) {
    return;
  }
  pre = document.createElement('pre');
  root.appendChild(pre);

  root.style.flexDirection = 'column';
  pre.style.textAlign = 'center';
  pre.style.fontSize = '24px';

  // const size = '50vmin';
  const size = '75vmin';
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    return;
  }
  canvas.style.height = size;
  canvas.style.width = size;

  addDebugDownload(canvas);
}

export function log(str: string | number, tag: string | undefined = undefined) {
  injectDom();
  if (!pre) {
    return;
  }

  if (['land', 'dep', 'age'].includes(tag ?? '')) {
    return;
  }

  let content = '';
  content += str.toString();
  if (tag !== undefined) {
    content += `[${tag}]`;
  }

  const color = hashColor(content);

  pre.innerHTML += `<span style="background: ${color};">${content}\n</span>`;
}

/**
 * Translate a hash code to a color, to make it easier to visually compare if
 * two hashcodes are the same.
 */
export function hashColor(hash: string) {
  const rng = seedrandom(hash);
  const hue = ~~(rng() * 360);
  return `hsl(${hue},70%,70%)`;
}

export function logPixels(
  pixels: Float32Array,
  start: number,
  increment: number,
  numSteps = 5,
) {
  if (pixels.some(x => isNaN(x))) {
    console.error('at least one instance of NaN');
  }
  if (pixels.some(x => x === Infinity)) {
    console.error('at least one instance of Infinity');
  }
  for (let i = 0; i < numSteps; i++) {
    const begin = start + i * increment;
    const end = start + i * increment + increment;
    log(
      hashCode(pixels.slice(begin, end).join(',')) +
        ` ${begin.toLocaleString()}|${end.toLocaleString()}`,
    );
  }
}

export function logPixel(pixels: Float32Array, index: number, cols = 1024) {
  const row = ~~(index / 4 / cols);
  const col = (index / 4) % cols;
  console.log(col, row);
  for (let i = 0; i < 4; i++) {
    log(pixels[index + i]);
  }
}

function addDebugDownload(canvas: HTMLCanvasElement) {
  // TODO: this is currently broken
  const dataUrl = canvas
    .toDataURL('image/png')
    .replace('image/png', 'image/octet-stream');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.setAttribute('download', 'follow_my_lead.png');
  a.innerHTML = 'download';
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('missing root');
  }
  root.appendChild(a);
}

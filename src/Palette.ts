import { Rng, sample, shuffle, weightedPick } from './core';

export interface Palette {
  background: string;
  color1: string;
  color2: string;
  color3: string;
}

const palettes: [number, [string, string]][] = [
  [7, ['000411-552f9d-efcb68-e1efe6', '000411-000411-e1efe6']],
  [10, ['423e3b-ff2e00-fea82f-fffecb', '423e3b-423e3b-423e3b-fea82f-fffecb']],
  [7, ['094074-3c6997-5adbff-ffdd4a', '094074']],
  [10, ['000411-d7263d-efcb68-3ab795', '000411-d7263d-efcb68-3ab795']],
  [10, ['042a2b-5eb1bf-cdedf6-ef7b45', '042a2b-042a2b-042a2b-5eb1bf-cdedf6']],
  [6, ['606c38-283618-fefae0-dda15e', '606c38-283618-fefae0-dda15e']],
  [5, ['413620-9c6615-9f7833-ffd791', '413620-9c6615-9f7833-ffd791']],
  [15, ['001427-708d81-f4d58d-bf0603', '001427-708d81-f4d58d-bf0603']],
  [12, ['050505-1b9aaa-dddbcb-f5f1e3', '050505-1b9aaa-dddbcb-f5f1e3']],
  [3, ['002500-b7245c-929982-edcbb1', '002500']],
  [4, ['3f0d12-f1f0cc-d5bf86-8d775f', '3f0d12-f1f0cc-d5bf86-8d775f']],
  [
    8,
    [
      '083d77-ebebd3-da4167-f4d35e-f78764',
      '083d77-083d77-083d77-ebebd3-ebebd3',
    ],
  ],
  [10, ['14281d-355834-6e633d-c2a878', '14281d-14281d-6e633d-c2a878-c2a878']],
  [3, ['271f30-6c5a49-c8ad55-d0fcb3', '271f30']],
  [
    10,
    [
      '004777-a30000-ff7700-efd28d',
      '004777-a30000-ff7700-004777-a30000-ff7700-efd28d',
    ],
  ],
  [10, ['353535-3c6e71-f2f8f8-d9d9d9', '353535-3c6e71-f2f8f8-d9d9d9']],
  [10, ['2e1f27-854d27-dd7230-f4c95d', '2e1f27-854d27-dd7230-f4c95d']],
  [10, ['606c38-283618-fefae0-dda15e', '606c38-283618-fefae0-dda15e']],
  [7, ['561643-6c0e23-c42021-f3ffb9', 'c42021-f3ffb9']],
  [10, ['4e598c-ffffff-f9c784-fcaf58', '4e598c-4e598c-ffffff']],
  [8, ['083d77-ebebd3-da4167-f4d35e', '083d77-ebebd3']],
  [8, ['0d0a0b-454955-f3eff5-72b01d', '0d0a0b-454955-f3eff5']],
  [6, ['ee4266-2a1e5c-0a0f0d-c4cbca', '2a1e5c-0a0f0d-c4cbca']],
  [10, ['fffcf2-ccc5b9-403d39-252422', 'fffcf2-ccc5b9-403d39-252422']],

  [6, ['da9f93-eef36a-95b8d1-0d1b1e', '0d1b1e']],
  [10, ['d5573b-f7dba7-1e2d2f-4281a4', 'd5573b-f7dba7-1e2d2f-4281a4']],
  [10, ['000500-362417-92817a-f1dabf', '000500-362417-92817a-f1dabf']],
  [10, ['660000-086788-f0c808-fff1d0', '660000-086788-f0c808-fff1d0']],
  [10, ['052f5f-06a77d-d5c67a-f1a208', '052f5f-d5c67a-f1a208']],
];

// Friendly names generated using coloraze library
const friendlyColor: Record<string, string> = {
  '000411': 'Jaguar',
  '552f9d': 'Daisy Bush',
  'efcb68': 'Arylide Yellow',
  'e1efe6': 'Swans Down',
  '423e3b': 'Armadillo',
  'ff2e00': 'Ferrari Red',
  'fea82f': 'Sea Buckthorn',
  'fffecb': 'Lemon Chiffon',
  '094074': 'Dark Cerulean',
  '3c6997': 'Calypso',
  '5adbff': 'Turquoise Blue',
  'ffdd4a': 'Mustard',
  'd7263d': 'Alizarin Crimson',
  '3ab795': 'Keppel',
  '042a2b': 'Daintree',
  '5eb1bf': 'Fountain Blue',
  'cdedf6': 'Onahau',
  'ef7b45': 'Jaffa',
  '606c38': 'Dark Olive Green',
  '283618': 'Mallard',
  'fefae0': 'Gin Fizz',
  'dda15e': 'Di Serria',
  '413620': 'Lisbon Brown',
  '9c6615': 'Golden Brown',
  '9f7833': 'Luxor Gold',
  'ffd791': 'Salomie',
  '001427': 'Black Pearl',
  '708d81': 'Blue Smoke',
  'f4d58d': 'Chalky',
  'bf0603': 'Guardsman Red',
  '050505': 'Black',
  '1b9aaa': 'Eastern Blue',
  'dddbcb': 'Moon Mist',
  'f5f1e3': 'Ecru White',
  '002500': 'Deep Fir',
  'b7245c': 'Rich Maroon',
  '929982': 'Artichoke',
  'edcbb1': 'Desert Sand',
  '3f0d12': 'Aubergine',
  'f1f0cc': 'Wheatfield',
  'd5bf86': 'Straw',
  '8d775f': 'Domino',
  '083d77': 'Dark Cerulean',
  'ebebd3': 'White Rock',
  'da4167': 'Cabaret',
  'f4d35e': 'Naples Yellow',
  'f78764': 'Salmon',
  '14281d': 'Dark Jungle Green',
  '355834': 'Hunter Green',
  '6e633d': 'Yellow Metal',
  'c2a878': 'Ecru',
  '271f30': 'Bastille',
  '6c5a49': 'Tobacco Brown',
  'c8ad55': 'Vegas Gold',
  'd0fcb3': 'Gossip',
  '004777': 'Dark Cerulean',
  'a30000': 'Dark Candy Apple Red',
  'ff7700': 'Flush Orange',
  'efd28d': 'Chalky',
  '353535': 'Tuatara',
  '3c6e71': 'William',
  'f2f8f8': 'Black Squeeze',
  'd9d9d9': 'Alto',
  '2e1f27': 'Cocoa Brown',
  '854d27': 'Bull Shot',
  'dd7230': 'Deep Carrot Orange',
  'f4c95d': 'Cream Can',
  '561643': 'Wine Berry',
  '6c0e23': 'Black Rose',
  'c42021': 'Fire Engine Red',
  'f3ffb9': 'Australian Mint',
  '4e598c': 'UCLA Blue',
  'ffffff': 'White',
  'f9c784': 'Chardonnay',
  'fcaf58': 'Texas Rose',
  '0d0a0b': 'Cod Gray',
  '454955': 'Mako',
  'f3eff5': 'Anti-flash White',
  '72b01d': 'Lima',
  'ee4266': 'Mandy',
  '2a1e5c': 'Port Gore',
  '0a0f0d': 'Woodsmoke',
  'c4cbca': 'Pumice',
  'fffcf2': 'Orchid White',
  'ccc5b9': 'Foggy Gray',
  '403d39': 'Masala',
  '252422': 'Log Cabin',
  'da9f93': 'Petite Orchid',
  'eef36a': 'Canary',
  '95b8d1': 'Dark Sky Blue',
  '0d1b1e': 'Aztec',
  'd5573b': 'Flame Pea',
  'f7dba7': 'Deep Champagne',
  '1e2d2f': 'Charleston Green',
  '4281a4': 'Wedgewood',
  '000500': 'Black',
  '362417': 'Sambuca',
  '92817a': 'Squirrel',
  'f1dabf': 'Almond',
  '660000': 'Blood Red',
  '086788': 'Orient',
  'f0c808': 'Corn',
  'fff1d0': 'Oasis',
  '052f5f': 'Cool Black',
  '06a77d': 'Gossamer',
  'd5c67a': 'Chenin',
  'f1a208': 'California',
};

export function getFriendlyColor(hex: string) {
  return friendlyColor[hex] ?? hex;
}

// Used this to get all of the colors that I used. I then fed them into a library
// called coloraze to get friendly names, and copied back the results here.
// const allColors = palettes.reduce((colors, entry) => {
//   entry[1]
//     .join('-')
//     .split('-')
//     .forEach(c => colors.add(c));
//   return colors;
// }, new Set<string>());
// console.log([...allColors.values()].join('-'));

export function createPalette(rng: Rng): Palette {
  // The first string is our full palette, the second is our set of potential
  // backgrounds
  const paletteDef = weightedPick(rng, palettes);

  const backgroundOptions = (paletteDef[1] ?? paletteDef[0]).split('-');
  const background = sample(rng, backgroundOptions);

  const foregroundOptions = paletteDef[0]
    .split('-')
    .filter(c => c !== background);

  const foreground = shuffle(rng, foregroundOptions);
  const color1 = foreground[0];
  let [color2, color3] = foreground.slice(1);

  const pctChange = 0.1;
  if (rng() < pctChange) {
    // reuse the same color for two layers
    color2 = color1;
  }
  if (rng() < pctChange) {
    // have one of our layers be the same color as the backgorund
    color2 = background;
  }
  if (rng() < pctChange) {
    // resuse the same color for two layers
    color3 = color1;
  }
  return {
    background,
    color1,
    color2,
    color3,
  };
}

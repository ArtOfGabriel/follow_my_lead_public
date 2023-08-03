import seedrandom from 'seedrandom';
import { makeNoise2D } from 'open-simplex-noise';
import {
  CtxGL,
  Point,
  Rng,
  clamp,
  gauss,
  lerp,
  mod,
  polarize,
  sample,
  shuffle,
  weightedPick,
} from './core';
import { AgentLayerOptions } from './layers/agents';
import { Options } from './Physarum';

const TAU = 2 * Math.PI;
type vec3 = [number, number, number];

type Creator = (rng: Rng, extant: Point, numAgents: number) => vec3[];

/**
 * Creates the agentData (initial position/angle), and options that get passed
 * to createAgentLayer.
 */
export function createAgentLayerData(
  seed: string,
  extant: Point,
  jumbledAttraction: Options['jumbledAttraction'],
) {
  const rng = seedrandom(seed);
  // specify numbers as if this was size 1024
  const dim = (w: number) => (w / 1024) * extant[0];

  // larger values seemed to lead to precision issues elsewhere (i.e. different
  // hardware giving different results)
  const depositAmount = 1;

  // This is mostly about determining the initial starting positions of each of
  // our three layers of agents.
  const creators = shuffle(
    rng,
    weightedPick<[Creator, Creator, Creator]>(rng, [
      [
        10,
        // all evenly distributed
        [
          createDistributedAgents(),
          createDistributedAgents(),
          createDistributedAgents(),
        ],
      ],
      [
        15,
        // one centrally distributed
        [
          createCenteredAgents(lerp(0.15, 0.4, rng())),
          createDistributedAgents(),
          createDistributedAgents(),
        ],
      ],

      [
        6,
        // one centrally distributed, one in a central square, one evenly distributed
        [
          createCenteredAgents(0.4),
          createDistributedAgents(lerp(0.1, 0.2, rng())),
          createDistributedAgents(),
        ],
      ],
      [
        7,
        // three squares of different sizes
        (() => {
          const size = lerp(0.05, 0.12, rng());
          const coeffs = [1, 2, 3];

          return [
            createDistributedAgents(size * coeffs[0]),
            createDistributedAgents(size * coeffs[1]),
            createDistributedAgents(size * coeffs[2]),
          ];
        })(),
      ],

      [
        10,
        (() => {
          // expontially more likely from some side or corner
          const expX = rng() < 0.25 ? 1 : lerp(1.5, 2, rng());
          const expY = rng() < 0.25 ? 1 : lerp(1.5, 2, rng());

          const [x1, x2] = shuffle(rng, [0, extant[0]]);
          const [y1, y2] = [0, extant[1]];
          return [
            (rng: Rng, extant: Point, numAgents: number): vec3[] =>
              Array.from(
                { length: numAgents },
                (): vec3 => [
                  lerp(x1, x2, Math.pow(rng(), expX)),
                  lerp(y1, y2, Math.pow(rng(), expY)),
                  TAU * rng(),
                ],
              ),
            (rng: Rng, extant: Point, numAgents: number): vec3[] =>
              Array.from(
                { length: numAgents },
                (): vec3 => [
                  lerp(x2, x1, Math.pow(rng(), expX)),
                  lerp(y2, y1, Math.pow(rng(), expY)),
                  TAU * rng(),
                ],
              ),
            createDistributedAgents(),
          ];
        })(),
      ],

      [
        10,
        // at least one using a flow field
        [
          createFlowFieldAgents(rng() * 10_000),
          rng() < 0.6
            ? createDistributedAgents()
            : createFlowFieldAgents(rng() * 10_000),
          rng() < 0.6
            ? createDistributedAgents()
            : createFlowFieldAgents(rng() * 10_000),
        ],
      ],

      [
        10,
        // at least one using a gaussian rect
        [
          createGaussianAgents(),
          rng() < 0 ? createDistributedAgents() : createGaussianAgents(),
          rng() < 0 ? createDistributedAgents() : createGaussianAgents(),
        ],
      ],
      [
        30,
        [
          sample(rng, [
            createDiagonalAgents(),
            createCenteredAgents(lerp(0.15, 0.4, rng())),
            createDistributedAgents(),
            createDistributedAgents(),
            createFlowFieldAgents(rng() * 10_000),
            createGaussianAgents(),
          ]),
          sample(rng, [
            createDiagonalAgents(),
            createCenteredAgents(lerp(0.15, 0.4, rng())),
            createDistributedAgents(),
            createDistributedAgents(),
            createFlowFieldAgents(rng() * 10_000),
            createGaussianAgents(),
          ]),
          sample(rng, [
            createDiagonalAgents(),
            createCenteredAgents(lerp(0.15, 0.4, rng())),
            createDistributedAgents(),
            createDistributedAgents(),
            createFlowFieldAgents(rng() * 10_000),
            createGaussianAgents(),
          ]),
        ],
      ],
    ]),
  );

  // Pick a set of three sensor offsets
  const sensorOffsetRegime = shuffle(
    rng,
    weightedPick<vec3>(rng, [
      [10, [3, 15, 7]],
      [5, [10, 10, 10]],
      [5, [5, 5, 5]],
      [2, [20, 20, 20]],
      [10, [3, 6, 9]],
      [10, [5, 10, 15]],
      [10, [5, 5, 15]],
      [10, [8, 11, 14]],
    ]),
  );

  const major = 1;
  // Note: these work best when multiples of w^x (i.e. 1/8 instead of 0.1)
  // by "work best" i mean, are less likely to cause cross-hardware precision
  // issues
  const minor = sample(rng, [1 / 8, 1 / 4, 1 / 2, 3 / 4]);

  // Pick how much we want each agent layer to be attracted/repulsed by other
  // layers.
  const texScaleRegimeChoice = weightedPick<[vec3, vec3, vec3]>(rng, [
    [
      10,
      // chain of attracted to self, ignores one, repulsed by other one
      [
        [major, -minor, 0],
        [0, major, -minor],
        [-minor, 0, major],
      ],
    ],
    [
      10,
      // everyone self-attracted. a/b repulsed by each other. c repulsed by both
      [
        [major, -minor, 0],
        [-minor, major, 0],
        [-minor, -minor, major * 2],
      ],
    ],
    [
      10,
      // everyone self attracted. a repulsed by b. b attracted to a, c repulsed by both
      [
        [major, -major, 0],
        [minor, major, 0],
        [-minor, -minor, major * 2],
      ],
    ],
    [
      10,
      // everyone attracted to self, repulsed by both others
      [
        [major * 2, -minor, -minor],
        [-minor, major * 2, -minor],
        [-minor, -minor, major * 2],
      ],
    ],
  ]);
  // Occasionally shuffle. In this case, it's no longer guaranteed that an
  // agent layer will necessarily be attracted to itself.

  let indices = [0, 1, 2];
  if (jumbledAttraction) {
    indices = shuffle(rng, indices);

    if (indices[0] === 0 && indices[1] === 1 && indices[2] === 2) {
      // if shuffling got us back into our initial state, do a manual "shuffle"
      indices = [1, 2, 0];
    }
  }

  const texScaleRegime = [
    texScaleRegimeChoice[indices[0]],
    texScaleRegimeChoice[indices[1]],
    texScaleRegimeChoice[indices[2]],
  ];

  // How much are agents influenced by the landscape texture.
  const landscaleMag = sample(rng, [25, 50, 100]);
  const landscapeRegime = weightedPick<vec3>(rng, [
    // standard
    [12, [landscaleMag, landscaleMag, landscaleMag]],
    // inverted
    [6, [-landscaleMag, -landscaleMag, -landscaleMag]],
    // heterogenous
    [
      8,
      [
        landscaleMag * sample(rng, [1, -1]),
        landscaleMag * sample(rng, [1, -1]),
        landscaleMag * sample(rng, [1, -1]),
      ],
    ],
  ]);

  return creators.map((creator, i) => {
    const agentData = creator(
      seedrandom(seed + i.toString()),
      extant,
      ~~(
        extant[0] *
        extant[1] *
        weightedPick(rng, [
          [10, 0.02],
          [5, 0.03],
          [3, 0.04],
          [1, 0.05],
        ])
      ),
    );
    const options: AgentLayerOptions = {
      pointSize: 1,
      stepSize: weightedPick(rng, [
        [3, 0.5],
        [10, 1],
        [2, 1.5],
        [1, 2],
      ]),
      landScale: [landscapeRegime[i], 0, 0],
      // rotationAmount and sensorAgent are a fraction of PI
      rotationAmount: weightedPick(rng, [
        [10, 0.25],
        [3, 0.25 * 0.5],
        [1, 0.25 * 0.25],
      ]),
      sensorAngle: weightedPick(rng, [
        [3, 0.25 * 2],
        [10, 0.25],
        [5, 0.25 * 0.5],
      ]),
      // I have this set up so that each agent only deposits onto a single channel
      deposit: Array.from({ length: 3 }, (_, j) =>
        i === j ? depositAmount : 0,
      ) as vec3,
      sensorOffset: dim(sensorOffsetRegime[i]),
      texScale: texScaleRegime[i],
    };
    return { agentData, options };
  });
}

const createDistributedAgents = (pad: number = 0): Creator => {
  return (rng: Rng, extant: Point, numAgents: number): vec3[] => {
    const rangeX: Point = [extant[0] * pad, extant[0] * (1 - pad)];
    const rangeY: Point = [extant[1] * pad, extant[1] * (1 - pad)];

    return Array.from({ length: numAgents }, (): vec3 => {
      // this is currently in canvas space, with origin in top left
      const pos: Point = [lerp(...rangeX, rng()), lerp(...rangeY, rng())];

      return [pos[0], pos[1], rng() * TAU];
    });
  };
};

const createCenteredAgents = (sd = 0.3): Creator => {
  return (rng: Rng, extant: Point, numAgents: number): vec3[] =>
    Array.from({ length: numAgents }, (): vec3 => {
      const angle = rng() * TAU;
      const pos = polarize(
        [extant[0] / 2, extant[1] / 2],
        angle + Math.PI,
        extant[0] * (0.1 + gauss(rng, sd)),
      );
      return [...pos, angle];
    });
};

/**
 * Start agents in a vertical/horizontal bar in the center, determined by a
 * gaussian distribution. If shouldInvert is true, instead start them along
 * the edges.
 */
const createGaussianAgents = (): Creator => {
  return (rng: Rng, extant: Point, numAgents: number): vec3[] => {
    const vert = rng() < 0.5;
    const shouldInvert = rng() < 0.3 || true;
    let sd = lerp(0.05, 0.2, Math.pow(rng(), 0.5));
    if (shouldInvert) {
      sd *= 2;
    }

    const maybeInvert = (pct: number) => {
      const result = mod(pct + (shouldInvert ? 0.5 : 0), 1);
      return clamp(result, 0, 1);
    };

    return Array.from({ length: numAgents }, (): vec3 => {
      return [
        vert
          ? extant[0] * maybeInvert(0.5 + gauss(rng, sd))
          : extant[0] * rng(),
        vert
          ? rng() * extant[1]
          : extant[1] * maybeInvert(0.5 + gauss(rng, sd)),
        rng() * TAU,
      ];
    });
  };
};

const createFlowFieldAgents = (seed: number) => {
  const snoise = makeNoise2D(seed);
  const noise = (x: number, y: number, det: number) =>
    (snoise(x * det, y * det) + 1) / 2;

  const update = (pos: Point, stepSize: number, det: number): Point => {
    const n = noise(...pos, det);
    const angle = TAU * n * 3;
    return polarize(pos, angle, stepSize);
  };

  return (rng: Rng, extant: Point, numAgents: number): vec3[] => {
    const jitter = (amt: number = 1) => (rng() * 2 - 1) * amt;
    const det = lerp(2, 6, rng());
    const stepSize = lerp(1, 5, rng());
    const numSteps = lerp(5, 20, rng());
    return Array.from({ length: numAgents }, (): vec3 => {
      let pos: Point = [rng(), rng()];
      for (let k = 0; k < numSteps; k++) {
        pos = update(pos, stepSize / extant[0], det);
      }
      return [
        pos[0] * extant[0] + jitter(stepSize * 2),
        pos[1] * extant[1] + jitter(stepSize * 2),
        noise(...pos, det) * TAU * 3,
      ];
    });
  };
};

const createDiagonalAgents = (): Creator => {
  return (rng: Rng, extant: Point, numAgents: number): vec3[] => {
    const lw = lerp(0.1, 0.5, Math.pow(rng(), 0.5));
    const flip = rng() < 0.5;

    const inbounds = (p: Point) =>
      Math.min(...p) >= 0 && p[0] < extant[0] && p[1] < extant[1];

    return Array.from({ length: numAgents }, (): vec3 => {
      let p: Point;
      do {
        const x = rng() * extant[0];
        const y = flip ? extant[1] - x : x;
        const angle = rng() * TAU;
        p = polarize([x, y], angle, lw * extant[0] * rng());
      } while (!inbounds(p));

      return [...p, rng() * TAU];
    });
  };
};

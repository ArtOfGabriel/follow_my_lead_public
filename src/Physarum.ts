import seedrandom from 'seedrandom';
import { Ctx, Point, createCanvasGL, weightedPick } from './core';
import TrailMap from './TrailMap';
import { AgentLayer, createAgentLayer } from './layers/agents';
import { createAgentLayerData } from './createAgentLayerData';
import { LandscapeType } from './layers/landscapeGL';
import { createPalette } from './Palette';

export type Options = ReturnType<(typeof Physarum)['createOptions']>;

/**
 * A pretty thin wrapper that creates our web gl object, and then controls
 * agentLayers/TrailMap, and rendering to the screen.
 */
export default class Physarum {
  private agentLayers: AgentLayer[];
  private trail: TrailMap;
  public frame: number = 0;

  private readonly seed: string;

  static createOptions(seed: string) {
    const rng = seedrandom(seed);
    return {
      seed,
      diffuseEnabled: rng() < 0.4,

      landscapeType: weightedPick<LandscapeType>(rng, [
        [10, 'radial gradient'],
        [12, 'noise'],
        [2.5, 'central circle'],
        [6, 'central square'],
        [6, 'corner circles'],
        [10, 'lines'],
        [20, 'grid'],
        [10, 'linear gradient'],
        [10, 'triangles'],
        [10, 'grid circles'],
        [10, 'sin waves'],
        [5, 'checkerboard'],
        [7, 'steps'],
      ]),

      palette: createPalette(rng),
      jumbledAttraction: rng() < 0.06,
      landscapeBorder: rng() < 0.8,
    };
  }

  constructor(trailDim: Point, options: Options) {
    this.seed = options.seed;

    const gl = this.createGL(trailDim);
    const rng = seedrandom(this.seed);

    const dataAndOptions = createAgentLayerData(
      this.seed,
      trailDim,
      options.jumbledAttraction,
    );

    this.agentLayers = dataAndOptions.map(({ agentData, options }) =>
      createAgentLayer(gl, trailDim, agentData, options),
    );

    this.trail = new TrailMap(gl, rng, trailDim, {
      // having this be a fraction of 128 (vs. something like 0.97) seems to
      // help with consistency across different GPUs
      decayFactor: 4 / 128,
      diffuseEnabled: options.diffuseEnabled,
      landscapeBorder: options.landscapeBorder,
      landscapeType: options.landscapeType,
      palette: options.palette,
    });
  }

  private createGL(extant: Point) {
    const gl = createCanvasGL(...extant);

    gl.getExtension('EXT_color_buffer_float');
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    return gl;
  }

  public update() {
    this.frame++;
    const { agentLayers, trail } = this;
    agentLayers.forEach(handler =>
      handler.update(trail.texture, trail.landscape),
    );
    // TODO: remove
    if (this.frame === (window as any).lastStep) {
      agentLayers.slice(0).forEach(handler => handler.debug());
    }

    trail.update(agentLayers);
  }

  public draw(ctx: Ctx) {
    const { trail } = this;
    trail.drawToCanvas(ctx);
  }

  public debug() {
    return {
      agents: this.agentLayers.map(layer => layer.debug()),
      trail: this.trail.debug(),
    };
  }
}

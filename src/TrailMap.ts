import { Ctx, Point, Rng } from './core';
import { createDepositor } from './layers/deposit';
import { createDiffuser } from './layers/diffuse';
import { LandscapeType, createLandscaperGL } from './layers/landscapeGL';
import { createLandscaperImage } from './layers/landscapeImage';
import { createScreenDrawer } from './layers/screen';
import { AgentLayer } from './layers/agents';
import { Palette } from './Palette';
import { log } from './debugUtils';

/**
 * This manages our map of deposits (i.e. where agents have been).
 * It has a couple of components
 * landscaper: Creates the landscape upon which agents move/diffuse. Only called
 *   once, though one could imagine a world in which it also changes over time
 * depositor: Takes current locations of agents, and adds a deposit at the
 *   relevant location for the relevant channel
 * diffuser: Does both decay (decrease the amount of deposit), and potentially
 *   diffuse (spread deposit outwards)
 * screenDrawer: Renders the values of deposits to our gl canvas.
 */
export default class TrailMap {
  private frame = 0;

  private depositor: ReturnType<typeof createDepositor>;
  private diffuser: ReturnType<typeof createDiffuser>;
  private landscaper: ReturnType<typeof createLandscaperImage>;
  private screenDrawer: ReturnType<typeof createScreenDrawer>;

  constructor(
    private gl: WebGL2RenderingContext,
    rng: Rng,
    extant: Point,
    {
      decayFactor,
      diffuseEnabled,
      landscapeBorder,
      landscapeType,
      palette,
    }: {
      decayFactor: number;
      diffuseEnabled: boolean;
      landscapeBorder: boolean;
      landscapeType: LandscapeType;
      palette: Palette;
    },
  ) {
    this.depositor = createDepositor(gl, extant);
    this.diffuser = createDiffuser(gl, extant, {
      decay: decayFactor,
      diffuse: diffuseEnabled,
    });

    // In retrospect, landscaper probably better belongs on Physarum vs TrailMap
    // but I'm not going to take the time to move it as this point.
    this.landscaper = createLandscaperImage(gl, extant);
    // this.landscaper = createLandscaper(gl, extant, rng);
    if ((window as any).lastStep !== undefined) {
      this.landscaper.debug();
    }

    this.screenDrawer = createScreenDrawer(gl, palette);
  }

  public get texture(): WebGLTexture {
    return this.diffuser.fbo.texture;
  }

  public get landscape(): WebGLTexture {
    return this.landscaper.texture;
  }

  update(agentLayers: AgentLayer[]) {
    if (agentLayers.length > 3) {
      throw new Error(' too many layers');
    }

    this.frame++;

    this.depositor.clear();

    agentLayers.forEach(layer => {
      this.depositor.applyAgentLayer(layer);
      // if (this.frame === (window as any).lastStep) {
      //   this.depositor.debug();
      // }
    });
    this.diffuser.update(
      this.landscaper.texture,
      this.depositor.texture,
      this.frame === (window as any).lastStep,
    );

    // We could diffuse more than once (i.e. allow deposits to diffuse further)
    // but I elected not to.
    // const numExtraDiffuseSteps = 0;
    // for (let i = 0; i < numExtraDiffuseSteps; i++) {
    //   this.diffuser.update(this.landscaper.texture);
    // }

    if (this.frame === (window as any).lastStep) {
      this.depositor.debug();
      this.diffuser.debug();
    }
  }

  drawToCanvas(ctx: Ctx) {
    const { width, height } = ctx.canvas;

    // render to gl canvas
    this.screenDrawer.draw(this.diffuser.fbo.texture);

    // render to passed in 2d canvas
    ctx.drawImage(this.gl.canvas, 0, 0, width, height);
  }

  public debug() {
    return {
      diffuse: this.diffuser.debug(),
      land: this.landscaper.debug(),
    };
  }
}

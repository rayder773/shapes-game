import { Box, Circle, type Body, World } from "planck";
import { Texture } from "pixi.js";
import {
  container,
  effect,
  graphic,
  signal,
  sprite,
  text,
  type PixiChild,
  type Signal,
} from "../pixi-dsl";

const pixelsPerMeter = 48;
const worldWidth = 960;
const worldHeight = 540;
const groundY = 440;

export class PlanckBallExample {
  readonly ballPosition: Signal<{ x: number; y: number }>;
  readonly ballRotation: Signal<number>;
  readonly ballHeight: Signal<number>;
  readonly hudText: Signal<string>;
  private readonly ballBody: Body;
  private readonly world: World;
  private elapsedSeconds = 0;

  constructor() {
    this.world = new World({
      gravity: {
        x: 0,
        y: -18,
      },
    });
    this.ballBody = this.createBall();
    this.ballPosition = signal(this.toScreenPoint(this.ballBody.getPosition()));
    this.ballRotation = signal(this.ballBody.getAngle());
    this.ballHeight = signal(0);
    this.hudText = signal("");

    this.createGround();

    effect(() => {      
      this.hudText.set(`height ${this.ballHeight.value.toFixed(2)}m`);
    });
  }

  view(): PixiChild {
    return container(
      graphic()
        .draw((graphics) => {
          graphics
            .rect(0, 0, worldWidth, worldHeight)
            .fill(0x10151f);
        }),
      graphic()
        .draw((graphics) => {
          graphics
            .rect(0, groundY, worldWidth, 18)
            .fill(0x3d7a5f);
          graphics
            .rect(0, groundY + 18, worldWidth, worldHeight - groundY)
            .fill(0x1d2b29);
        }),
      container(
        graphic()
          .draw((graphics) => {
            graphics
              .circle(0, 0, 26)
              .fill(0xff6b4a);
            graphics
              .circle(-8, -8, 7)
              .fill(0xffd166);
          }),
        sprite(Texture.WHITE)
          .anchor(0.5)
          .size(36, 4)
          .tint(0x2f1e1b),
      )
        .position(this.ballPosition)
        .rotation(this.ballRotation),
      text(this.hudText)
        .position(24, 22)
        .style({
          fill: 0xffffff,
          fontFamily: "Arial",
          fontSize: 20,
          fontWeight: "700",
        }),
    );
  }

  step(deltaSeconds: number): void {
    const fixedStep = Math.min(deltaSeconds, 1 / 30);

    this.elapsedSeconds += fixedStep;
    this.world.step(fixedStep);

    const position = this.ballBody.getPosition();

    if (position.y < -2) {
      this.resetBall();
      return;
    }

    this.ballPosition.set(this.toScreenPoint(position));
    this.ballRotation.set(-this.ballBody.getAngle());
    this.ballHeight.set(Math.max(position.y, 0));
  }

  private createBall(): Body {
    const body = this.world.createBody({
      angularDamping: 0.05,
      linearVelocity: {
        x: 2.5,
        y: 0,
      },
      position: {
        x: -3.5,
        y: 7.5,
      },
      type: "dynamic",
    });

    body.createFixture({
      density: 1,
      friction: 0.35,
      restitution: 0.72,
      shape: new Circle(0.55),
    });

    return body;
  }

  private createGround(): void {
    const ground = this.world.createBody({
      position: {
        x: 0,
        y: 0,
      },
      type: "static",
    });

    ground.createFixture({
      friction: 0.7,
      shape: new Box(10, 0.2),
    });
  }

  private resetBall(): void {
    const x = -3.5 + Math.sin(this.elapsedSeconds) * 1.5;

    this.ballBody.setTransform({
      x,
      y: 7.5,
    }, 0);
    this.ballBody.setLinearVelocity({
      x: 2.5,
      y: 0,
    });
    this.ballBody.setAngularVelocity(0);
  }

  private toScreenPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: worldWidth / 2 + point.x * pixelsPerMeter,
      y: groundY - point.y * pixelsPerMeter,
    };
  }
}

import { Box, Circle, type Body, World } from "planck";
import { Texture } from "pixi.js";
import {
  computed,
  container,
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
const worldOrigin = {
  x: worldWidth / 2,
  y: 440,
};
const groundPosition = {
  x: 0,
  y: 0,
};
const groundSize = {
  height: 0.4,
  width: 20,
};

export class PlanckBallExample {
  readonly ballPosition: Signal<{ x: number; y: number }>;
  readonly ballRotation: Signal<number>;
  readonly ballHeight: Signal<number>;
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

    this.createGround();
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
          const groundRect = this.toScreenRect(groundPosition, groundSize);

          graphics
            .rect(groundRect.x, groundRect.y, groundRect.width, groundRect.height)
            .fill(0x3d7a5f);
          graphics
            .rect(
              0,
              groundRect.y + groundRect.height,
              worldWidth,
              worldHeight - groundRect.y - groundRect.height,
            )
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
      text(computed(() => `height ${this.ballHeight.value.toFixed(2)}m`))
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
      position: groundPosition,
      type: "static",
    });

    ground.createFixture({
      friction: 0.7,
      shape: new Box(groundSize.width / 2, groundSize.height / 2),
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
      x: worldOrigin.x + point.x * pixelsPerMeter,
      y: worldOrigin.y - point.y * pixelsPerMeter,
    };
  }

  private toScreenRect(
    center: { x: number; y: number },
    size: { height: number; width: number },
  ): { height: number; width: number; x: number; y: number } {
    const screenCenter = this.toScreenPoint(center);
    const width = size.width * pixelsPerMeter;
    const height = size.height * pixelsPerMeter;

    return {
      height,
      width,
      x: screenCenter.x - width / 2,
      y: screenCenter.y - height / 2,
    };
  }
}

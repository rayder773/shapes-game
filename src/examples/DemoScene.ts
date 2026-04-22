import {
  computed,
  container,
  graphic,
  text,
  type PixiChild,
} from "../pixi-dsl";
import { type GameFrame } from "../game/GameFrame";
import { PhysicsScene } from "../game/PhysicsScene";
import {
  PhysicsToPixi,
  PlanckPhysicsWorld,
} from "../physics";
import { BallObject } from "../objects/BallObject";
import { GroundObject } from "../objects/GroundObject";

const worldWidth = 960;
const worldHeight = 540;

export class DemoScene {
  private readonly ball: BallObject;
  private readonly physicsScene: PhysicsScene;

  constructor() {
    const physics = new PlanckPhysicsWorld({
      gravity: {
        x: 0,
        y: -18,
      },
    });
    const transform = new PhysicsToPixi({
      origin: {
        x: worldWidth / 2,
        y: 440,
      },
      pixelsPerMeter: 48,
    });

    this.physicsScene = new PhysicsScene({
      physics,
    });
    this.ball = new BallObject(physics, transform, {
      angularDamping: 0.05,
      color: 0xff6b4a,
      friction: 0.35,
      highlightColor: 0xffd166,
      linearVelocity: {
        x: 2.5,
        y: 0,
      },
      position: {
        x: -3.5,
        y: 7.5,
      },
      radius: 0.55,
      restitution: 0.72,
    });

    this.physicsScene.add(new GroundObject(physics, transform, {
      color: 0x3d7a5f,
      friction: 0.7,
      position: {
        x: 0,
        y: 0,
      },
      size: {
        height: 0.4,
        width: 20,
      },
    }));
    this.physicsScene.add(this.ball);
  }

  tick(frame: GameFrame): void {
    this.physicsScene.tick(frame);
  }

  view(): PixiChild {
    return container(
      graphic()
        .draw((graphics) => {
          graphics
            .rect(0, 0, worldWidth, worldHeight)
            .fill(0x10151f);
        }),
      this.physicsScene.view(),
      text(computed(() => `height ${this.ball.height.value.toFixed(2)}m`))
        .position(24, 22)
        .style({
          fill: 0xffffff,
          fontFamily: "Arial",
          fontSize: 20,
          fontWeight: "700",
        }),
    );
  }
}

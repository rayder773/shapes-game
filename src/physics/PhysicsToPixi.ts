import { type PointLike } from "../pixi-dsl";
import { type PhysicsPoint, type PhysicsSize } from "./types";

export type PixiRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type PhysicsToPixiOptions = {
  origin: PointLike;
  pixelsPerMeter: number;
};

export class PhysicsToPixi {
  private readonly origin: PointLike;
  private readonly pixelsPerMeter: number;

  constructor(options: PhysicsToPixiOptions) {
    this.origin = options.origin;
    this.pixelsPerMeter = options.pixelsPerMeter;
  }

  length(meters: number): number {
    return meters * this.pixelsPerMeter;
  }

  point(point: PhysicsPoint): PointLike {
    return {
      x: this.origin.x + this.length(point.x),
      y: this.origin.y - this.length(point.y),
    };
  }

  rect(center: PhysicsPoint, size: PhysicsSize): PixiRect {
    const screenCenter = this.point(center);
    const width = this.length(size.width);
    const height = this.length(size.height);

    return {
      height,
      width,
      x: screenCenter.x - width / 2,
      y: screenCenter.y - height / 2,
    };
  }

  rotation(angle: number): number {
    return -angle;
  }
}

import type { CoordinateAdapter, CoordinateTransform, Vector2 } from './coordinates';

const defaultTransform: CoordinateTransform = {
  origin: { x: 0, y: 0 },
  camera: { x: 0, y: 0 },
  zoom: 1,
  scale: 1,
};

export class SimpleCoordinateAdapter implements CoordinateAdapter {
  private currentTransform: CoordinateTransform;

  constructor(initialTransform: Partial<CoordinateTransform> = {}) {
    this.currentTransform = {
      ...defaultTransform,
      ...initialTransform,
      origin: initialTransform.origin ?? defaultTransform.origin,
      camera: initialTransform.camera ?? defaultTransform.camera,
    };
  }

  get transform(): CoordinateTransform {
    return this.currentTransform;
  }

  setTransform(next: Partial<CoordinateTransform>): void {
    this.currentTransform = {
      ...this.currentTransform,
      ...next,
      origin: next.origin ?? this.currentTransform.origin,
      camera: next.camera ?? this.currentTransform.camera,
    };
  }

  worldToScreen(point: Vector2): Vector2 {
    const factor = this.currentTransform.zoom * this.currentTransform.scale;

    return {
      x: this.currentTransform.origin.x + (point.x - this.currentTransform.camera.x) * factor,
      y: this.currentTransform.origin.y + (point.y - this.currentTransform.camera.y) * factor,
    };
  }

  screenToWorld(point: Vector2): Vector2 {
    const factor = this.currentTransform.zoom * this.currentTransform.scale;

    return {
      x: (point.x - this.currentTransform.origin.x) / factor + this.currentTransform.camera.x,
      y: (point.y - this.currentTransform.origin.y) / factor + this.currentTransform.camera.y,
    };
  }

  worldLengthToScreen(length: number): number {
    return length * this.currentTransform.zoom * this.currentTransform.scale;
  }

  screenLengthToWorld(length: number): number {
    return length / (this.currentTransform.zoom * this.currentTransform.scale);
  }
}

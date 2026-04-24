export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface CoordinateTransform {
  readonly origin: Vector2;
  readonly camera: Vector2;
  readonly zoom: number;
  readonly scale: number;
}

export interface CoordinateAdapter {
  get transform(): CoordinateTransform;
  setTransform(next: Partial<CoordinateTransform>): void;
  worldToScreen(point: Vector2): Vector2;
  screenToWorld(point: Vector2): Vector2;
  worldLengthToScreen(length: number): number;
  screenLengthToWorld(length: number): number;
}

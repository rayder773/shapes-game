import type { Shape } from "./game-runtime.ts";

export type Vector2 = {
  x: number;
  y: number;
};

export const WALL_THICKNESS = 0.35;

const MIN_DIRECTION_LENGTH = 0.0001;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeVector(vector: Vector2): Vector2 | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length < MIN_DIRECTION_LENGTH) return null;

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function getTriangleVertices(size: number): Vector2[] {
  return [
    { x: 0, y: size },
    { x: -size * 0.92, y: -size * 0.58 },
    { x: size * 0.92, y: -size * 0.58 },
  ];
}

export function getShapeRadius(shape: Shape, size: number): number {
  if (shape === "circle") return size;
  if (shape === "square") return Math.hypot(size, size);
  return size * 1.05;
}

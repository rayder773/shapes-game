import { type PixiChild } from "../pixi-dsl";

export type WorldObject = {
  syncFromPhysics(): void;
  view(): PixiChild;
};

import type { PhysicsAdapter, PhysicsContact } from './physics';

export class NoopPhysicsAdapter implements PhysicsAdapter {
  step(_deltaTime: number): readonly PhysicsContact[] {
    return [];
  }
}

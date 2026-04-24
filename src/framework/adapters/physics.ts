import { createEventToken, createResourceToken } from '../core/tokens';

export interface PhysicsContact {
  readonly a: number;
  readonly b: number;
  readonly started: boolean;
}

export interface PhysicsAdapter {
  step(deltaTime: number): readonly PhysicsContact[];
}

export const physicsContactsResource = createResourceToken<readonly PhysicsContact[]>('physicsContacts');
export const physicsContactsEvent = createEventToken<readonly PhysicsContact[]>('physicsContacts');

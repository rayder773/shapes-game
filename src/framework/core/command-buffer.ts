import type { EventBus } from './event-bus';
import type { EntityId, World } from './world';
import type { ComponentToken, EventToken } from './tokens';

type CreateEntityCommand = {
  readonly type: 'createEntity';
  readonly entity: EntityId;
};

type DestroyEntityCommand = {
  readonly type: 'destroyEntity';
  readonly entity: EntityId;
};

type AddComponentCommand<T> = {
  readonly type: 'addComponent';
  readonly entity: EntityId;
  readonly token: ComponentToken<T>;
  readonly component: T;
};

type RemoveComponentCommand<T> = {
  readonly type: 'removeComponent';
  readonly entity: EntityId;
  readonly token: ComponentToken<T>;
};

type EmitEventCommand<T> = {
  readonly type: 'emitEvent';
  readonly event: EventToken<T>;
  readonly payload: T;
};

export type Command =
  | CreateEntityCommand
  | DestroyEntityCommand
  | AddComponentCommand<unknown>
  | RemoveComponentCommand<unknown>
  | EmitEventCommand<unknown>;

export class CommandBuffer {
  private readonly commands: Command[] = [];

  constructor(private readonly reserveEntityId: () => EntityId) {}

  createEntity(): EntityId {
    const entity = this.reserveEntityId();
    this.commands.push({ type: 'createEntity', entity });
    return entity;
  }

  destroyEntity(entity: EntityId): void {
    this.commands.push({ type: 'destroyEntity', entity });
  }

  addComponent<T>(entity: EntityId, token: ComponentToken<T>, component: T): void {
    this.commands.push({ type: 'addComponent', entity, token, component });
  }

  removeComponent<T>(entity: EntityId, token: ComponentToken<T>): void {
    this.commands.push({ type: 'removeComponent', entity, token });
  }

  emitEvent<T>(event: EventToken<T>, payload: T): void {
    this.commands.push({ type: 'emitEvent', event, payload });
  }

  apply(world: World, events: EventBus): void {
    for (const command of this.commands) {
      switch (command.type) {
        case 'createEntity':
          world.createEntity(command.entity);
          break;
        case 'destroyEntity':
          world.destroyEntity(command.entity);
          break;
        case 'addComponent':
          if (!world.hasEntity(command.entity)) {
            world.createEntity(command.entity);
          }

          world.addComponent(command.entity, command.token, command.component);
          break;
        case 'removeComponent':
          world.removeComponent(command.entity, command.token);
          break;
        case 'emitEvent':
          events.emit(command.event, command.payload);
          break;
      }
    }

    this.clear();
  }

  clear(): void {
    this.commands.length = 0;
  }

  get length(): number {
    return this.commands.length;
  }
}

import { ComponentStorage } from './component-storage';
import type { ComponentToken } from './tokens';

export type EntityId = number;

type ComponentTuple<Tokens extends readonly ComponentToken<unknown>[]> = {
  [Index in keyof Tokens]: Tokens[Index] extends ComponentToken<infer T> ? T : never;
};

export type QueryResult<Tokens extends readonly ComponentToken<unknown>[]> = [EntityId, ...ComponentTuple<Tokens>];

export class World {
  private nextEntityId = 1;

  private readonly entities = new Set<EntityId>();
  private readonly storages = new Map<ComponentToken<unknown>, ComponentStorage<unknown>>();

  createEntity(entityId?: EntityId): EntityId {
    const id = entityId ?? this.reserveEntityId();
    this.entities.add(id);

    if (id >= this.nextEntityId) {
      this.nextEntityId = id + 1;
    }

    return id;
  }

  reserveEntityId(): EntityId {
    const entityId = this.nextEntityId;
    this.nextEntityId += 1;
    return entityId;
  }

  destroyEntity(entity: EntityId): boolean {
    if (!this.entities.delete(entity)) {
      return false;
    }

    for (const storage of this.storages.values()) {
      storage.delete(entity);
    }

    return true;
  }

  hasEntity(entity: EntityId): boolean {
    return this.entities.has(entity);
  }

  addComponent<T>(entity: EntityId, token: ComponentToken<T>, component: T): void {
    this.assertEntity(entity);
    this.getStorage(token, true)!.set(entity, component);
  }

  removeComponent<T>(entity: EntityId, token: ComponentToken<T>): boolean {
    return this.getStorage(token, false)?.delete(entity) ?? false;
  }

  getComponent<T>(entity: EntityId, token: ComponentToken<T>): T | undefined {
    return this.getStorage(token, false)?.get(entity) as T | undefined;
  }

  hasComponent<T>(entity: EntityId, token: ComponentToken<T>): boolean {
    return this.getStorage(token, false)?.has(entity) ?? false;
  }

  query<const Tokens extends readonly ComponentToken<unknown>[]>(...tokens: Tokens): QueryResult<Tokens>[] {
    if (tokens.length === 0) {
      return Array.from(this.entities, (entity) => [entity] as unknown as QueryResult<Tokens>);
    }

    const storages = tokens.map((token) => this.getStorage(token, false));

    if (storages.some((storage) => storage === undefined)) {
      return [];
    }

    const smallestStorage = storages.reduce((smallest, current) =>
      current!.size < smallest!.size ? current : smallest,
    );

    const results: QueryResult<Tokens>[] = [];

    for (const [entity] of smallestStorage!.entries()) {
      const components: unknown[] = [];
      let matches = true;

      for (let index = 0; index < tokens.length; index += 1) {
        if (!storages[index]!.has(entity)) {
          matches = false;
          break;
        }

        components.push(storages[index]!.get(entity));
      }

      if (matches) {
        results.push([entity, ...components] as unknown as QueryResult<Tokens>);
      }
    }

    return results;
  }

  getEntities(): readonly EntityId[] {
    return Array.from(this.entities);
  }

  getStorage<T>(token: ComponentToken<T>, createIfMissing = false): ComponentStorage<T> | undefined {
    let storage = this.storages.get(token) as ComponentStorage<T> | undefined;

    if (!storage && createIfMissing) {
      storage = new ComponentStorage<T>();
      this.storages.set(token, storage as ComponentStorage<unknown>);
    }

    return storage;
  }

  private assertEntity(entity: EntityId): void {
    if (!this.entities.has(entity)) {
      throw new Error(`Entity ${entity} does not exist in the world.`);
    }
  }
}

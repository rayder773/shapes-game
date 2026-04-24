import type { EntityId } from './world';

export class ComponentStorage<T> {
  private readonly values = new Map<EntityId, T>();

  set(entity: EntityId, value: T): void {
    this.values.set(entity, value);
  }

  get(entity: EntityId): T | undefined {
    return this.values.get(entity);
  }

  has(entity: EntityId): boolean {
    return this.values.has(entity);
  }

  delete(entity: EntityId): boolean {
    return this.values.delete(entity);
  }

  clear(): void {
    this.values.clear();
  }

  entries(): IterableIterator<[EntityId, T]> {
    return this.values.entries();
  }

  keys(): IterableIterator<EntityId> {
    return this.values.keys();
  }

  valuesIterator(): IterableIterator<T> {
    return this.values.values();
  }

  get size(): number {
    return this.values.size;
  }
}

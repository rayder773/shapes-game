import type { ResourceToken } from './tokens';

export class ResourceStore {
  private readonly resources = new Map<ResourceToken<unknown>, unknown>();

  set<T>(token: ResourceToken<T>, value: T): void {
    this.resources.set(token, value);
  }

  get<T>(token: ResourceToken<T>): T | undefined {
    return this.resources.get(token) as T | undefined;
  }

  require<T>(token: ResourceToken<T>): T {
    const resource = this.get(token);

    if (resource === undefined) {
      throw new Error(`Resource "${String(token.description)}" is not registered.`);
    }

    return resource;
  }

  has<T>(token: ResourceToken<T>): boolean {
    return this.resources.has(token);
  }

  remove<T>(token: ResourceToken<T>): boolean {
    return this.resources.delete(token);
  }
}

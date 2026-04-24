import type { EventToken } from './tokens';

export interface EventEnvelope<T = unknown> {
  readonly type: EventToken<T>;
  readonly payload: T;
}

export class EventBus {
  private readonly queue: EventEnvelope[] = [];

  emit<T>(type: EventToken<T>, payload: T): void {
    this.queue.push({ type, payload });
  }

  drain<T>(type: EventToken<T>): T[] {
    const drained: T[] = [];
    const remaining: EventEnvelope[] = [];

    for (const event of this.queue) {
      if (event.type === type) {
        drained.push(event.payload as T);
        continue;
      }

      remaining.push(event);
    }

    this.queue.length = 0;
    this.queue.push(...remaining);

    return drained;
  }

  drainAll(): EventEnvelope[] {
    const drained = this.queue.slice();
    this.queue.length = 0;
    return drained;
  }

  clear<T>(type?: EventToken<T>): void {
    if (!type) {
      this.queue.length = 0;
      return;
    }

    const remaining = this.queue.filter((event) => event.type !== type);
    this.queue.length = 0;
    this.queue.push(...remaining);
  }

  peekAll(): readonly EventEnvelope[] {
    return this.queue;
  }
}

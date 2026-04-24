import type { RenderCommandToken } from '../core/tokens';

export interface RenderCommandEnvelope<T = unknown> {
  readonly type: RenderCommandToken<T>;
  readonly payload: T;
}

export class RenderCommandQueue {
  private readonly commands: RenderCommandEnvelope[] = [];

  enqueue<T>(type: RenderCommandToken<T>, payload: T): void {
    this.commands.push({ type, payload });
  }

  drain(): RenderCommandEnvelope[] {
    const drained = this.commands.slice();
    this.commands.length = 0;
    return drained;
  }

  peek(): readonly RenderCommandEnvelope[] {
    return this.commands;
  }

  clear(): void {
    this.commands.length = 0;
  }
}

import type { RenderCommandQueue } from '../render/render-command-queue';
import type { SystemContext } from '../core/context';
import type { StateValue } from '../core/state-machine';
import type { RenderCommandToken } from '../core/tokens';
import type { RenderCommandEnvelope } from '../render/render-command-queue';

export interface RendererAdapter {
  render(commands: readonly RenderCommandEnvelope[], context: SystemContext): void;
}

export class RendererFacade {
  constructor(
    readonly adapter: RendererAdapter,
    private readonly queue: RenderCommandQueue,
  ) {}

  enqueue<T>(type: RenderCommandToken<T>, payload: T): void {
    this.queue.enqueue(type, payload);
  }

  drain(): RenderCommandEnvelope[] {
    return this.queue.drain();
  }

  render<TState extends StateValue>(context: SystemContext<TState>): void {
    this.adapter.render(this.queue.drain(), context);
  }

  clear(): void {
    this.queue.clear();
  }
}

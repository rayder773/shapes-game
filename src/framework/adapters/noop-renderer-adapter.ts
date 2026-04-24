import type { RendererAdapter } from './renderer';
import type { RenderCommandEnvelope } from '../render/render-command-queue';
import type { SystemContext } from '../core/context';

export class NoopRendererAdapter implements RendererAdapter {
  render(_commands: readonly RenderCommandEnvelope[], _context: SystemContext): void {
    // Intentionally empty. Useful for headless tests and initial bootstrap.
  }
}

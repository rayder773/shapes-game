import type { SystemContext } from './context';
import type { Phase } from './phases';
import type { StateValue } from './state-machine';

export type SystemFunction<TState extends StateValue = StateValue> = (context: SystemContext<TState>) => void;

export interface SystemDefinition<TState extends StateValue = StateValue> {
  readonly id: string;
  readonly phase: Phase;
  readonly order: number;
  readonly run: SystemFunction<TState>;
  readonly enabledInStates?: readonly TState[];
  readonly isEnabled?: (context: SystemContext<TState>) => boolean;
}

interface RegisteredSystem<TState extends StateValue = StateValue> {
  readonly sequence: number;
  readonly definition: SystemDefinition<TState>;
}

export class SystemRegistry<TState extends StateValue = StateValue> {
  private readonly systemsByPhase = new Map<Phase, RegisteredSystem<TState>[]>();
  private sequence = 0;

  register(system: SystemDefinition<TState>): void {
    const systems = this.systemsByPhase.get(system.phase) ?? [];

    systems.push({
      sequence: this.sequence,
      definition: system,
    });
    this.sequence += 1;

    systems.sort((left, right) => {
      if (left.definition.order !== right.definition.order) {
        return left.definition.order - right.definition.order;
      }

      return left.sequence - right.sequence;
    });

    this.systemsByPhase.set(system.phase, systems);
  }

  getSystems(phase: Phase): readonly SystemDefinition<TState>[] {
    return (this.systemsByPhase.get(phase) ?? []).map((entry) => entry.definition);
  }

  isSystemEnabled(system: SystemDefinition<TState>, context: SystemContext<TState>): boolean {
    if (system.enabledInStates && system.enabledInStates.length > 0) {
      const currentState = context.state.currentState;

      if (currentState === undefined || !system.enabledInStates.includes(currentState)) {
        return false;
      }
    }

    return system.isEnabled?.(context) ?? true;
  }
}

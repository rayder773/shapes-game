import type { SystemDefinition } from './system-registry';
import type { ResourceToken } from './tokens';
import type { Phase } from './phases';
import type { StateValue } from './state-machine';

export interface LifecycleHooks {
  onInit?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  beforePhase?: (phase: Phase) => void;
  afterPhase?: (phase: Phase) => void;
  onStop?: () => void;
  onDispose?: () => void;
}
export interface ModuleBuilder<TState extends StateValue = StateValue> {
  registerSystem(system: SystemDefinition<TState>): void;
  registerResource<T>(token: ResourceToken<T>, value: T): void;
  addLifecycleHooks(hooks: LifecycleHooks): void;
}

export interface GameModule<TState extends StateValue = StateValue> {
  readonly name: string;
  install(builder: ModuleBuilder<TState>): void;
}

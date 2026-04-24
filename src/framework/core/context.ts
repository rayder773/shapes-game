import type { CoordinateAdapter } from '../adapters/coordinates';
import type { InputAdapter } from '../adapters/input';
import type { PhysicsAdapter } from '../adapters/physics';
import type { RendererFacade } from '../adapters/renderer';
import type { CommandBuffer } from './command-buffer';
import type { EventBus } from './event-bus';
import type { Phase } from './phases';
import type { ResourceStore } from './resource-store';
import type { StateMachine, StateValue } from './state-machine';
import type { World } from './world';

export interface TimeState {
  readonly deltaTime: number;
  readonly fixedDeltaTime: number;
  readonly maxDeltaTime: number;
  readonly elapsedTime: number;
  readonly frame: number;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly accumulator: number;
}

export interface SystemContext<TState extends StateValue = StateValue> {
  phase: Phase;
  readonly world: World;
  readonly events: EventBus;
  readonly commands: CommandBuffer;
  readonly input: InputAdapter;
  readonly renderer: RendererFacade;
  readonly physics: PhysicsAdapter;
  readonly coordinates: CoordinateAdapter;
  readonly state: StateMachine<TState>;
  readonly time: TimeState;
  readonly resources: ResourceStore;
}

import type { CoordinateAdapter } from '../adapters/coordinates';
import type { InputAdapter } from '../adapters/input';
import type { PhysicsAdapter } from '../adapters/physics';
import { NoopPhysicsAdapter } from '../adapters/noop-physics-adapter';
import { NoopRendererAdapter } from '../adapters/noop-renderer-adapter';
import { RendererFacade, type RendererAdapter } from '../adapters/renderer';
import { SimpleCoordinateAdapter } from '../adapters/simple-coordinate-adapter';
import { CommandBuffer } from './command-buffer';
import type { SystemContext, TimeState } from './context';
import { EventBus } from './event-bus';
import { GameLoop, type GameLoopOptions } from './game-loop';
import type { GameModule, LifecycleHooks, ModuleBuilder } from './module';
import { ResourceStore } from './resource-store';
import { StateMachine, type StateValue } from './state-machine';
import { SystemRegistry, type SystemDefinition } from './system-registry';
import { World } from './world';
import { RenderCommandQueue } from '../render/render-command-queue';

const createNoopInputAdapter = (): InputAdapter => ({
  keysDown: new Set<string>(),
  keysPressed: new Set<string>(),
  keysReleased: new Set<string>(),
  pointerPosition: { x: 0, y: 0 },
  pointerDown: false,
  pointerPressed: false,
  pointerReleased: false,
  beginFrame() {},
  endFrame() {},
});

export interface GameRuntime<TState extends StateValue = StateValue> {
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
  readonly systems: SystemRegistry<TState>;
  readonly context: SystemContext<TState>;
  readonly loop: GameLoop<TState>;
}

export interface CreateGameRuntimeOptions<TState extends StateValue = StateValue> {
  readonly input?: InputAdapter;
  readonly renderer?: RendererAdapter;
  readonly physics?: PhysicsAdapter;
  readonly coordinates?: CoordinateAdapter;
  readonly initialState?: TState;
  readonly modules?: readonly GameModule<TState>[];
  readonly systems?: readonly SystemDefinition<TState>[];
  readonly loop?: GameLoopOptions;
}

export const createGameRuntime = <TState extends StateValue = StateValue>(
  options: CreateGameRuntimeOptions<TState> = {},
): GameRuntime<TState> => {
  const world = new World();
  const events = new EventBus();
  const resources = new ResourceStore();
  const commands = new CommandBuffer(() => world.reserveEntityId());
  const input = options.input ?? createNoopInputAdapter();
  const physics = options.physics ?? new NoopPhysicsAdapter();
  const coordinates = options.coordinates ?? new SimpleCoordinateAdapter();
  const rendererQueue = new RenderCommandQueue();
  const renderer = new RendererFacade(options.renderer ?? new NoopRendererAdapter(), rendererQueue);
  const state = new StateMachine(options.initialState);
  const systems = new SystemRegistry<TState>();
  const hooks: LifecycleHooks[] = [];
  const time: TimeState = {
    deltaTime: 0,
    fixedDeltaTime: options.loop?.fixedDeltaTime ?? 1000 / 60,
    maxDeltaTime: options.loop?.maxDeltaTime ?? 100,
    elapsedTime: 0,
    frame: 0,
    isRunning: false,
    isPaused: false,
    accumulator: 0,
  };

  const context: SystemContext<TState> = {
    phase: 'beginFrame',
    world,
    events,
    commands,
    input,
    renderer,
    physics,
    coordinates,
    state,
    time,
    resources,
  };

  const builder: ModuleBuilder<TState> = {
    registerSystem(system) {
      systems.register(system);
    },
    registerResource(token, value) {
      resources.set(token, value);
    },
    addLifecycleHooks(hook) {
      hooks.push(hook);
    },
  };

  for (const module of options.modules ?? []) {
    module.install(builder);
  }

  for (const system of options.systems ?? []) {
    systems.register(system);
  }

  const loop = new GameLoop(context, systems, hooks, options.loop);

  for (const hook of hooks) {
    hook.onInit?.();
  }

  return {
    world,
    events,
    commands,
    input,
    renderer,
    physics,
    coordinates,
    state,
    time,
    resources,
    systems,
    context,
    loop,
  };
};

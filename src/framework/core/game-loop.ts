import { physicsContactsEvent, physicsContactsResource } from '../adapters/physics';
import type { SystemContext, TimeState } from './context';
import type { LifecycleHooks } from './module';
import { fixedStepPhases, type Phase } from './phases';
import type { SystemRegistry } from './system-registry';
import type { StateValue } from './state-machine';

export interface GameLoopOptions {
  readonly autoStart?: boolean;
  readonly fixedDeltaTime?: number;
  readonly maxDeltaTime?: number;
}

export class GameLoop<TState extends StateValue = StateValue> {
  private readonly fixedDeltaTime: number;
  readonly maxDeltaTime: number;

  private isRunning = false;
  private isPaused = false;
  private frameHandle?: number;
  private lastTimestamp?: number;

  private readonly timeState: {
    deltaTime: number;
    fixedDeltaTime: number;
    maxDeltaTime: number;
    elapsedTime: number;
    frame: number;
    isRunning: boolean;
    isPaused: boolean;
    accumulator: number;
  };

  constructor(
    private readonly context: SystemContext<TState>,
    private readonly registry: SystemRegistry<TState>,
    private readonly hooks: readonly LifecycleHooks[],
    options: GameLoopOptions = {},
  ) {
    this.fixedDeltaTime = options.fixedDeltaTime ?? 1000 / 60;
    this.maxDeltaTime = options.maxDeltaTime ?? 100;
    this.timeState = {
      deltaTime: 0,
      fixedDeltaTime: this.fixedDeltaTime,
      maxDeltaTime: this.maxDeltaTime,
      elapsedTime: 0,
      frame: 0,
      isRunning: false,
      isPaused: false,
      accumulator: 0,
    };

    Object.assign(this.context.time as object, this.timeState);
  }

  get time(): TimeState {
    return this.timeState;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.lastTimestamp = undefined;
    this.syncTimeFlags();
    this.invokeSimpleHooks('onStart');
    this.scheduleNextFrame();
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.frameHandle !== undefined) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
    }

    this.isRunning = false;
    this.isPaused = false;
    this.lastTimestamp = undefined;
    this.syncTimeFlags();
    this.invokeSimpleHooks('onStop');
    this.invokeSimpleHooks('onDispose');
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.syncTimeFlags();
    this.invokeSimpleHooks('onPause');
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.lastTimestamp = undefined;
    this.syncTimeFlags();
    this.invokeSimpleHooks('onResume');
    this.scheduleNextFrame();
  }

  tick(timestamp = performance.now()): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    const rawDelta = this.lastTimestamp === undefined ? this.fixedDeltaTime : timestamp - this.lastTimestamp;
    const deltaTime = Math.min(rawDelta, this.maxDeltaTime);

    this.lastTimestamp = timestamp;
    this.timeState.deltaTime = deltaTime;
    this.timeState.elapsedTime += deltaTime;
    this.timeState.frame += 1;
    this.timeState.accumulator += deltaTime;

    this.context.input.beginFrame();
    this.context.resources.set(physicsContactsResource, []);

    this.runPhase('beginFrame');
    this.runPhase('input');
    this.runPhase('preUpdate');
    this.runPhase('update');

    while (this.timeState.accumulator >= this.fixedDeltaTime) {
      this.runPhase('fixedUpdate', this.fixedDeltaTime);

      const contacts = this.context.physics.step(this.fixedDeltaTime);
      this.context.resources.set(physicsContactsResource, contacts);
      this.context.events.emit(physicsContactsEvent, contacts);
      this.context.commands.apply(this.context.world, this.context.events);

      this.runPhase('physics', this.fixedDeltaTime);
      this.runPhase('postPhysics', this.fixedDeltaTime);

      this.timeState.accumulator -= this.fixedDeltaTime;
    }

    this.runPhase('events');
    this.runPhase('postUpdate');
    this.runPhase('render');
    this.context.renderer.render(this.context);
    this.runPhase('ui');
    this.runPhase('cleanup');
    this.runPhase('endFrame');

    this.context.input.endFrame();

    if (this.isRunning && !this.isPaused) {
      this.scheduleNextFrame();
    }
  }

  private runPhase(phase: Phase, deltaOverride?: number): void {
    this.context.phase = phase;

    const previousDelta = this.timeState.deltaTime;

    if (deltaOverride !== undefined && fixedStepPhases.includes(phase as (typeof fixedStepPhases)[number])) {
      this.timeState.deltaTime = deltaOverride;
    }

    for (const hook of this.hooks) {
      hook.beforePhase?.(phase);
    }

    for (const system of this.registry.getSystems(phase)) {
      if (this.registry.isSystemEnabled(system, this.context)) {
        system.run(this.context);
      }
    }

    this.context.commands.apply(this.context.world, this.context.events);

    for (const hook of this.hooks) {
      hook.afterPhase?.(phase);
    }

    this.timeState.deltaTime = previousDelta;
  }

  private invokeSimpleHooks(name: 'onStart' | 'onPause' | 'onResume' | 'onStop' | 'onDispose'): void {
    for (const hook of this.hooks) {
      hook[name]?.();
    }
  }

  private scheduleNextFrame(): void {
    this.frameHandle = requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  private syncTimeFlags(): void {
    this.timeState.isRunning = this.isRunning;
    this.timeState.isPaused = this.isPaused;
  }
}

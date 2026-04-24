import type { InputAdapter, PointerState } from './input';

export interface BrowserInputAdapterOptions {
  readonly target?: Window;
  readonly pointerTarget?: EventTarget;
}

export class BrowserInputAdapter implements InputAdapter {
  readonly keysDown = new Set<string>();
  readonly keysPressed = new Set<string>();
  readonly keysReleased = new Set<string>();

  pointerPosition: PointerState = { x: 0, y: 0 };
  pointerDown = false;
  pointerPressed = false;
  pointerReleased = false;

  private readonly target: Window;
  private readonly pointerTarget: EventTarget;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keysDown.has(event.code)) {
      this.keysPressed.add(event.code);
    }

    this.keysDown.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.code);
    this.keysReleased.add(event.code);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.pointerPosition = { x: event.clientX, y: event.clientY };
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.onPointerMove(event);

    if (!this.pointerDown) {
      this.pointerPressed = true;
    }

    this.pointerDown = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.onPointerMove(event);
    this.pointerDown = false;
    this.pointerReleased = true;
  };

  constructor(options: BrowserInputAdapterOptions = {}) {
    this.target = options.target ?? window;
    this.pointerTarget = options.pointerTarget ?? this.target;

    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.pointerTarget.addEventListener('pointermove', this.onPointerMove as EventListener);
    this.pointerTarget.addEventListener('pointerdown', this.onPointerDown as EventListener);
    this.pointerTarget.addEventListener('pointerup', this.onPointerUp as EventListener);
    this.pointerTarget.addEventListener('pointercancel', this.onPointerUp as EventListener);
  }

  beginFrame(): void {
    // Transient flags are cleared at the end of the frame so systems can consume them during input/update.
  }

  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.pointerPressed = false;
    this.pointerReleased = false;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.pointerTarget.removeEventListener('pointermove', this.onPointerMove as EventListener);
    this.pointerTarget.removeEventListener('pointerdown', this.onPointerDown as EventListener);
    this.pointerTarget.removeEventListener('pointerup', this.onPointerUp as EventListener);
    this.pointerTarget.removeEventListener('pointercancel', this.onPointerUp as EventListener);
  }
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
}

export interface InputSnapshot {
  readonly keysDown: ReadonlySet<string>;
  readonly keysPressed: ReadonlySet<string>;
  readonly keysReleased: ReadonlySet<string>;
  readonly pointerPosition: PointerState;
  readonly pointerDown: boolean;
  readonly pointerPressed: boolean;
  readonly pointerReleased: boolean;
}

export interface InputAdapter extends InputSnapshot {
  beginFrame(): void;
  endFrame(): void;
}

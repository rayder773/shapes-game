export type StateValue = string | number | symbol;

export class StateMachine<TState extends StateValue = StateValue> {
  private state?: TState;

  constructor(initialState?: TState) {
    this.state = initialState;
  }

  get currentState(): TState | undefined {
    return this.state;
  }

  enterState(state: TState): TState | undefined {
    const previous = this.state;
    this.state = state;
    return previous;
  }

  exitState(): TState | undefined {
    const previous = this.state;
    this.state = undefined;
    return previous;
  }
}

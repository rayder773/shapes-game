export type Unsubscribe = () => void;

type PrimitiveValue = string | number | boolean | bigint | symbol;

type DependencyTracker = {
  record<T>(source: Signal<T>): void;
};

export type Signal<T> = {
  readonly value: T;
  set(value: T): void;
  subscribe(listener: (value: T) => void): Unsubscribe;
  toString(): string;
  valueOf(): T;
  [Symbol.toPrimitive](hint: string): PrimitiveValue;
};

export type ValueSource<T> = T | Signal<T>;

let activeTracker: DependencyTracker | null = null;

export function signal<T>(initialValue: T): Signal<T> {
  let currentValue = initialValue;
  const listeners = new Set<(value: T) => void>();

  const trackSelf = () => {
    activeTracker?.record(api);
  };

  const api: Signal<T> = {
    get value() {
      trackSelf();
      return currentValue;
    },
    set(value) {
      if (Object.is(currentValue, value)) {
        return;
      }

      currentValue = value;

      for (const listener of [...listeners]) {
        listener(currentValue);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toString() {
      trackSelf();
      return String(currentValue);
    },
    valueOf() {
      trackSelf();
      return currentValue;
    },
    [Symbol.toPrimitive]() {
      trackSelf();

      if (
        typeof currentValue === "string"
        || typeof currentValue === "number"
        || typeof currentValue === "boolean"
        || typeof currentValue === "bigint"
        || typeof currentValue === "symbol"
      ) {
        return currentValue;
      }

      return String(currentValue);
    },
  };

  return api;
}

export function isSignal<T>(source: ValueSource<T>): source is Signal<T> {
  return typeof source === "object"
    && source !== null
    && "subscribe" in source
    && "set" in source
    && "value" in source;
}

export function read<T>(source: ValueSource<T>): T {
  return isSignal(source)
    ? source.value
    : source;
}

export function bindValue<T>(
  source: ValueSource<T>,
  apply: (value: T) => void,
  track: (unsubscribe: Unsubscribe) => void,
): void {
  apply(read(source));

  if (isSignal(source)) {
    track(source.subscribe(apply));
  }
}

export function effect(callback: () => void | Unsubscribe): Unsubscribe {
  let disposed = false;
  let cleanup: Unsubscribe | undefined;
  let subscriptions: Unsubscribe[] = [];

  const run = () => {
    if (disposed) {
      return;
    }

    cleanup?.();

    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }

    const dependencies = new Set<Signal<unknown>>();
    const previousTracker = activeTracker;

    subscriptions = [];
    activeTracker = {
      record(source) {
        dependencies.add(source as Signal<unknown>);
      },
    };

    try {
      const nextCleanup = callback();
      cleanup = typeof nextCleanup === "function"
        ? nextCleanup
        : undefined;
    } finally {
      activeTracker = previousTracker;
    }

    for (const dependency of dependencies) {
      subscriptions.push(dependency.subscribe(run));
    }
  };

  run();

  return () => {
    disposed = true;
    cleanup?.();

    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }

    subscriptions = [];
  };
}

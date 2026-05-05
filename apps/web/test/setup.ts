import { beforeEach, afterEach, vi } from "vitest";

type CanvasCall = {
  method: string;
  args: unknown[];
};

type ListenerRecord = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject | null;
  options?: boolean | AddEventListenerOptions;
};

type TestVisualViewport = EventTarget & {
  width: number;
  height: number;
  scale: number;
  offsetLeft: number;
  offsetTop: number;
  pageLeft: number;
  pageTop: number;
};

const ORIGINAL_ADD_EVENT_LISTENER = EventTarget.prototype.addEventListener;
const ORIGINAL_REMOVE_EVENT_LISTENER = EventTarget.prototype.removeEventListener;
const listenerRecords: ListenerRecord[] = [];
const canvasLog: CanvasCall[] = [];
const canvasContexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
const viewportTarget = new EventTarget() as TestVisualViewport;

let nowMs = 0;
let viewportWidth = 1280;
let viewportHeight = 720;
let coarsePointer = false;
let hoverNone = false;
let standaloneMode = false;
let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

class CanvasRenderingContext2DMock {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  lineDashOffset = 0;

  clearRect(...args: unknown[]) {
    canvasLog.push({ method: "clearRect", args });
  }

  beginPath(...args: unknown[]) {
    canvasLog.push({ method: "beginPath", args });
  }

  arc(...args: unknown[]) {
    canvasLog.push({ method: "arc", args });
  }

  rect(...args: unknown[]) {
    canvasLog.push({ method: "rect", args });
  }

  moveTo(...args: unknown[]) {
    canvasLog.push({ method: "moveTo", args });
  }

  lineTo(...args: unknown[]) {
    canvasLog.push({ method: "lineTo", args });
  }

  closePath(...args: unknown[]) {
    canvasLog.push({ method: "closePath", args });
  }

  fill(...args: unknown[]) {
    canvasLog.push({ method: "fill", args });
  }

  stroke(...args: unknown[]) {
    canvasLog.push({ method: "stroke", args });
  }

  save(...args: unknown[]) {
    canvasLog.push({ method: "save", args });
  }

  restore(...args: unknown[]) {
    canvasLog.push({ method: "restore", args });
  }

  translate(...args: unknown[]) {
    canvasLog.push({ method: "translate", args });
  }

  rotate(...args: unknown[]) {
    canvasLog.push({ method: "rotate", args });
  }

  setTransform(...args: unknown[]) {
    canvasLog.push({ method: "setTransform", args });
  }

  setLineDash(...args: unknown[]) {
    canvasLog.push({ method: "setLineDash", args });
  }
}

Object.defineProperty(globalThis, "__ANTI_MATCH_TEST_INTERNALS__", {
  configurable: true,
  value: {
    getCanvasLog: () => canvasLog,
    resetCanvasLog: () => {
      canvasLog.length = 0;
    },
    setViewport(width: number, height: number) {
      viewportWidth = width;
      viewportHeight = height;
    },
    setDeviceMode(mode: "desktop" | "phone") {
      if (mode === "phone") {
        coarsePointer = true;
        hoverNone = true;
        userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
        viewportWidth = 390;
        viewportHeight = 844;
      } else {
        coarsePointer = false;
        hoverNone = false;
        userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
        viewportWidth = 1280;
        viewportHeight = 720;
      }
    },
    setStandaloneMode(value: boolean) {
      standaloneMode = value;
    },
    dispatchViewportEvent(type: string) {
      viewportTarget.dispatchEvent(new Event(type));
    },
    advanceNow(ms: number) {
      nowMs += ms;
      vi.advanceTimersByTime(ms);
    },
  },
});

EventTarget.prototype.addEventListener = function patchedAddEventListener(
  this: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) {
  listenerRecords.push({ target: this, type, listener, options });
  return ORIGINAL_ADD_EVENT_LISTENER.call(this, type, listener, options);
};

Object.defineProperty(window, "visualViewport", {
  configurable: true,
  value: viewportTarget,
});

Object.defineProperties(viewportTarget, {
  width: {
    configurable: true,
    get: () => viewportWidth,
  },
  height: {
    configurable: true,
    get: () => viewportHeight,
  },
  scale: {
    configurable: true,
    get: () => 1,
  },
  offsetLeft: {
    configurable: true,
    get: () => 0,
  },
  offsetTop: {
    configurable: true,
    get: () => 0,
  },
  pageLeft: {
    configurable: true,
    get: () => 0,
  },
  pageTop: {
    configurable: true,
    get: () => 0,
  },
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    matches:
      query === "(pointer: coarse)" ? coarsePointer
        : query === "(hover: none)" ? hoverNone
          : query === "(display-mode: standalone)" ? standaloneMode
            : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Object.defineProperty(window, "PointerEvent", {
  configurable: true,
  value: class PointerEvent extends MouseEvent {
    pointerType: string;

    constructor(type: string, init?: PointerEventInit) {
      super(type, init);
      this.pointerType = init?.pointerType ?? "mouse";
    }
  },
});

Object.defineProperty(navigator, "userAgent", {
  configurable: true,
  get: () => userAgent,
});

Object.defineProperty(navigator, "userAgentData", {
  configurable: true,
  get: () => ({ mobile: /iPhone|Android.+Mobile/i.test(userAgent) }),
});

Object.defineProperty(navigator, "standalone", {
  configurable: true,
  get: () => standaloneMode,
});

Object.defineProperty(window, "innerWidth", {
  configurable: true,
  get: () => viewportWidth,
});

Object.defineProperty(window, "innerHeight", {
  configurable: true,
  get: () => viewportHeight,
});

Object.defineProperty(window, "devicePixelRatio", {
  configurable: true,
  get: () => 1,
});

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value(this: HTMLCanvasElement, contextId: string) {
    if (contextId !== "2d") {
      return null;
    }

    const existing = canvasContexts.get(this);
    if (existing) {
      return existing;
    }

    const context = new CanvasRenderingContext2DMock() as unknown as CanvasRenderingContext2D;
    canvasContexts.set(this, context);
    return context;
  },
});

Object.defineProperty(HTMLCanvasElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: viewportHeight,
      right: viewportWidth,
      width: viewportWidth,
      height: viewportHeight,
      toJSON() {
        return this;
      },
    };
  },
});

beforeEach(() => {
  nowMs = 0;
  coarsePointer = false;
  hoverNone = false;
  standaloneMode = false;
  userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  viewportWidth = 1280;
  viewportHeight = 720;
  canvasLog.length = 0;
  listenerRecords.length = 0;
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-02T12:00:00.000Z"));
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 16)
  ));
  vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
    window.clearTimeout(handle);
  });
});

afterEach(() => {
  for (const record of listenerRecords.splice(0)) {
    ORIGINAL_REMOVE_EVENT_LISTENER.call(record.target, record.type, record.listener, record.options);
  }

  document.body.innerHTML = "";
  vi.clearAllTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

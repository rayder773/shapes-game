import type {
  CanvasRenderer,
  CanvasRendererFrame,
} from "../game/canvas-renderer.ts";

export type PointerFeedback = CanvasRenderer & {
  install(): void;
  destroy(): void;
};

export type PointerFeedbackDependencies = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  isPhoneDevice: () => boolean;
  now: () => number;
};

type Point = {
  x: number;
  y: number;
};

type JoystickState = {
  pointerId: number;
  base: Point;
  current: Point;
  releasedAt: number | null;
};

type RippleState = {
  origin: Point;
  startedAt: number;
};

const JOYSTICK_BASE_RADIUS_PX = 44;
const JOYSTICK_KNOB_RADIUS_PX = 16;
const JOYSTICK_MAX_TRAVEL_PX = 28;
const JOYSTICK_FADE_MS = 180;
const RIPPLE_COUNT = 3;
const RIPPLE_DELAY_MS = 80;
const RIPPLE_DURATION_MS = 650;
const RIPPLE_START_RADIUS_PX = 12;
const RIPPLE_END_RADIUS_PX = 72;
const MAX_ACTIVE_RIPPLES = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function getClampedKnob(base: Point, current: Point): Point {
  const deltaX = current.x - base.x;
  const deltaY = current.y - base.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= JOYSTICK_MAX_TRAVEL_PX || distance === 0) {
    return current;
  }

  const ratio = JOYSTICK_MAX_TRAVEL_PX / distance;
  return {
    x: base.x + deltaX * ratio,
    y: base.y + deltaY * ratio,
  };
}

export function createPointerFeedback({
  canvas,
  context,
  isPhoneDevice,
  now,
}: PointerFeedbackDependencies): PointerFeedback {
  let hasInstalled = false;
  let joystick: JoystickState | null = null;
  const ripples: RippleState[] = [];

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const point = getCanvasPoint(canvas, event);
    if (!isPhoneDevice()) {
      ripples.push({ origin: point, startedAt: now() });
      if (ripples.length > MAX_ACTIVE_RIPPLES) {
        ripples.splice(0, ripples.length - MAX_ACTIVE_RIPPLES);
      }
      return;
    }

    if (joystick && joystick.releasedAt === null && joystick.pointerId !== event.pointerId) return;

    joystick = {
      pointerId: event.pointerId,
      base: point,
      current: point,
      releasedAt: null,
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!joystick || joystick.releasedAt !== null || joystick.pointerId !== event.pointerId) return;
    joystick.current = getCanvasPoint(canvas, event);
  }

  function handlePointerEnd(event: PointerEvent): void {
    if (!joystick || joystick.releasedAt !== null || joystick.pointerId !== event.pointerId) return;
    joystick.current = getCanvasPoint(canvas, event);
    joystick.releasedAt = now();
  }

  function drawJoystick(frame: CanvasRendererFrame): void {
    if (!joystick) return;

    const frameNow = frame.now();
    const alpha = joystick.releasedAt === null
      ? 1
      : 1 - (frameNow - joystick.releasedAt) / JOYSTICK_FADE_MS;

    if (alpha <= 0) {
      joystick = null;
      return;
    }

    const knob = getClampedKnob(joystick.base, joystick.current);
    context.save();
    context.globalAlpha = clamp(alpha, 0, 1);
    context.lineWidth = 2;
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.fillStyle = "rgba(102, 168, 255, 0.16)";
    context.beginPath();
    context.arc(joystick.base.x, joystick.base.y, JOYSTICK_BASE_RADIUS_PX, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.shadowColor = "rgba(102, 168, 255, 0.8)";
    context.shadowBlur = 14;
    context.beginPath();
    context.arc(knob.x, knob.y, JOYSTICK_KNOB_RADIUS_PX, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawRipples(frame: CanvasRendererFrame): void {
    const frameNow = frame.now();

    for (let rippleIndex = ripples.length - 1; rippleIndex >= 0; rippleIndex -= 1) {
      const ripple = ripples[rippleIndex]!;
      const age = frameNow - ripple.startedAt;
      if (age >= RIPPLE_DURATION_MS) {
        ripples.splice(rippleIndex, 1);
        continue;
      }

      for (let ringIndex = 0; ringIndex < RIPPLE_COUNT; ringIndex += 1) {
        const ringAge = age - ringIndex * RIPPLE_DELAY_MS;
        if (ringAge < 0) continue;

        const availableDuration = RIPPLE_DURATION_MS - ringIndex * RIPPLE_DELAY_MS;
        const progress = clamp(ringAge / availableDuration, 0, 1);
        const radius = RIPPLE_START_RADIUS_PX
          + (RIPPLE_END_RADIUS_PX - RIPPLE_START_RADIUS_PX) * progress;

        context.save();
        context.globalAlpha = (1 - progress) * 0.62;
        context.strokeStyle = "rgba(255, 209, 102, 0.95)";
        context.lineWidth = 2.4 - progress * 1.2;
        context.shadowColor = "rgba(255, 209, 102, 0.7)";
        context.shadowBlur = 10 * (1 - progress);
        context.beginPath();
        context.arc(ripple.origin.x, ripple.origin.y, radius, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }
  }

  return {
    install(): void {
      if (hasInstalled) return;
      hasInstalled = true;
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerup", handlePointerEnd);
      canvas.addEventListener("pointercancel", handlePointerEnd);
    },
    destroy(): void {
      if (!hasInstalled) return;
      hasInstalled = false;
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerEnd);
      canvas.removeEventListener("pointercancel", handlePointerEnd);
      joystick = null;
      ripples.length = 0;
    },
    render(frame): void {
      drawRipples(frame);
      drawJoystick(frame);
    },
  };
}

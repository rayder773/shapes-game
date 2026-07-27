import { beforeEach, describe, expect, test } from "vitest";
import { createPointerFeedback } from "../src/platform/pointer-feedback.ts";

type CanvasCall = {
  method: string;
  args: unknown[];
};

class FeedbackContextMock {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  shadowColor = "transparent";
  shadowBlur = 0;
  globalAlpha = 1;
  readonly calls: CanvasCall[] = [];

  beginPath(...args: unknown[]) { this.calls.push({ method: "beginPath", args }); }
  arc(...args: unknown[]) { this.calls.push({ method: "arc", args }); }
  fill(...args: unknown[]) { this.calls.push({ method: "fill", args }); }
  stroke(...args: unknown[]) { this.calls.push({ method: "stroke", args }); }
  save(...args: unknown[]) { this.calls.push({ method: "save", args }); }
  restore(...args: unknown[]) { this.calls.push({ method: "restore", args }); }
}

let canvas: HTMLCanvasElement;
let context: FeedbackContextMock;
let nowMs: number;
let phone: boolean;

function dispatchPointer(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", init: Partial<PointerEventInit> = {}) {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    clientX: 100,
    clientY: 120,
    button: 0,
    pointerId: 1,
    pointerType: phone ? "touch" : "mouse",
    ...init,
  }));
}

function createFeedback() {
  return createPointerFeedback({
    canvas,
    context: context as unknown as CanvasRenderingContext2D,
    isPhoneDevice: () => phone,
    now: () => nowMs,
  });
}

function render(feedback: ReturnType<typeof createFeedback>) {
  feedback.render({
    metrics: { widthCss: 300, heightCss: 180 },
    entities: [],
    now: () => nowMs,
    isDamageInvulnerable: () => false,
  });
}

describe("pointer feedback", () => {
  beforeEach(() => {
    document.body.innerHTML = `<canvas id="game"></canvas>`;
    canvas = document.getElementById("game") as HTMLCanvasElement;
    context = new FeedbackContextMock();
    nowMs = 1_000;
    phone = false;
  });

  test("draws three expanding desktop waves and removes them after the animation", () => {
    const feedback = createFeedback();
    feedback.install();
    dispatchPointer("pointerdown", { clientX: 90, clientY: 110 });

    nowMs += 160;
    render(feedback);
    const arcs = context.calls.filter((call) => call.method === "arc");
    expect(arcs).toHaveLength(3);
    expect(arcs.every((call) => call.args[0] === 90 && call.args[1] === 110)).toBe(true);

    context.calls.length = 0;
    nowMs = 1_651;
    render(feedback);
    expect(context.calls).toEqual([]);
  });

  test("draws a clamped mobile joystick and fades it after release", () => {
    phone = true;
    const feedback = createFeedback();
    feedback.install();
    dispatchPointer("pointerdown");
    dispatchPointer("pointermove", { clientX: 200, clientY: 120 });
    render(feedback);

    expect(context.calls.filter((call) => call.method === "arc")).toEqual([
      { method: "arc", args: [100, 120, 44, 0, Math.PI * 2] },
      { method: "arc", args: [128, 120, 16, 0, Math.PI * 2] },
    ]);

    dispatchPointer("pointerup", { clientX: 200, clientY: 120 });
    context.calls.length = 0;
    nowMs += 181;
    render(feedback);
    expect(context.calls).toEqual([]);
  });

  test("ignores secondary mobile pointers and removes listeners on destroy", () => {
    phone = true;
    const feedback = createFeedback();
    feedback.install();
    dispatchPointer("pointerdown", { pointerId: 1, clientX: 80 });
    dispatchPointer("pointerdown", { pointerId: 2, clientX: 220 });
    render(feedback);

    const baseArc = context.calls.find((call) => call.method === "arc");
    expect(baseArc?.args[0]).toBe(80);

    feedback.destroy();
    context.calls.length = 0;
    dispatchPointer("pointerdown", { pointerId: 3 });
    render(feedback);
    expect(context.calls).toEqual([]);
    expect(document.querySelectorAll("canvas")).toHaveLength(1);
  });
});

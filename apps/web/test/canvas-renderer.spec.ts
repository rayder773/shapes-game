import { describe, expect, test } from "vitest";
import {
  createCanvasRenderer,
  type CanvasRenderableEntity,
} from "../src/canvas-renderer.ts";

type CanvasCall = {
  method: string;
  args: unknown[];
};

class CanvasContextMock {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  lineDashOffset = 0;
  shadowColor = "transparent";
  shadowBlur = 0;
  globalAlpha = 1;
  readonly calls: CanvasCall[] = [];

  clearRect(...args: unknown[]) {
    this.calls.push({ method: "clearRect", args });
  }

  beginPath(...args: unknown[]) {
    this.calls.push({ method: "beginPath", args });
  }

  arc(...args: unknown[]) {
    this.calls.push({ method: "arc", args });
  }

  rect(...args: unknown[]) {
    this.calls.push({ method: "rect", args });
  }

  moveTo(...args: unknown[]) {
    this.calls.push({ method: "moveTo", args });
  }

  lineTo(...args: unknown[]) {
    this.calls.push({ method: "lineTo", args });
  }

  closePath(...args: unknown[]) {
    this.calls.push({ method: "closePath", args });
  }

  fill(...args: unknown[]) {
    this.calls.push({ method: "fill", args });
  }

  stroke(...args: unknown[]) {
    this.calls.push({ method: "stroke", args });
  }

  save(...args: unknown[]) {
    this.calls.push({ method: "save", args });
  }

  restore(...args: unknown[]) {
    this.calls.push({ method: "restore", args });
  }

  translate(...args: unknown[]) {
    this.calls.push({ method: "translate", args });
  }

  rotate(...args: unknown[]) {
    this.calls.push({ method: "rotate", args });
  }

  setLineDash(...args: unknown[]) {
    this.calls.push({ method: "setLineDash", args });
  }
}

function createContext() {
  return new CanvasContextMock();
}

const baseEntity: CanvasRenderableEntity = {
  id: 1,
  kind: "target",
  position: { x: 2, y: 3 },
  rotation: Math.PI / 4,
  appearance: {
    shape: "circle",
    color: "red",
    fillStyle: "outline",
    size: 0.5,
  },
};

function renderEntities(context: CanvasContextMock, entities: CanvasRenderableEntity[]) {
  const renderer = createCanvasRenderer({
    context: context as unknown as CanvasRenderingContext2D,
    scale: 30,
  });

  renderer.render({
    metrics: {
      widthCss: 300,
      heightCss: 180,
    },
    entities,
    now: () => 0,
    isDamageInvulnerable: (entity) => entity.kind === "player",
  });
}

describe("canvas renderer", () => {
  test("clears the canvas before drawing entities", () => {
    const context = createContext();

    renderEntities(context, [baseEntity]);

    expect(context.calls[0]).toEqual({
      method: "clearRect",
      args: [0, 0, 300, 180],
    });
  });

  test("draws player, target, life pickup and coin pickup shapes", () => {
    const context = createContext();
    const entities: CanvasRenderableEntity[] = [
      {
        ...baseEntity,
        id: 1,
        kind: "player",
        appearance: { ...baseEntity.appearance, shape: "square", fillStyle: "filled" },
      },
      {
        ...baseEntity,
        id: 2,
        kind: "target",
        appearance: { ...baseEntity.appearance, shape: "triangle", fillStyle: "dashed" },
      },
      {
        ...baseEntity,
        id: 3,
        kind: "lifePickup",
      },
      {
        ...baseEntity,
        id: 4,
        kind: "coinPickup",
      },
    ];

    renderEntities(context, entities);

    expect(context.calls.some((call) => call.method === "rect")).toBe(true);
    expect(context.calls.some((call) => call.method === "lineTo")).toBe(true);
    expect(context.calls.some((call) => call.method === "arc")).toBe(true);
    expect(context.calls.filter((call) => call.method === "save")).toHaveLength(5);
  });

  test("applies world transform, rotation and dashed stroke style", () => {
    const context = createContext();

    renderEntities(context, [
      {
        ...baseEntity,
        position: { x: 2, y: 3 },
        rotation: Math.PI / 6,
        appearance: { ...baseEntity.appearance, fillStyle: "dashed" },
      },
    ]);

    expect(context.calls).toContainEqual({ method: "translate", args: [60, 90] });
    expect(context.calls).toContainEqual({ method: "rotate", args: [-Math.PI / 6] });
    expect(context.calls).toContainEqual({ method: "setLineDash", args: [[9, 6]] });
    expect(context.calls).toContainEqual({ method: "setLineDash", args: [[]] });
  });

  test("draws the extra player visual while damage invulnerability is active", () => {
    const normalContext = createContext();
    const invulnerableContext = createContext();
    const player: CanvasRenderableEntity = {
      ...baseEntity,
      kind: "player",
      appearance: { ...baseEntity.appearance, shape: "circle", fillStyle: "outline" },
    };

    createCanvasRenderer({
      context: normalContext as unknown as CanvasRenderingContext2D,
      scale: 30,
    }).render({
      metrics: { widthCss: 300, heightCss: 180 },
      entities: [player],
      now: () => 0,
      isDamageInvulnerable: () => false,
    });
    createCanvasRenderer({
      context: invulnerableContext as unknown as CanvasRenderingContext2D,
      scale: 30,
    }).render({
      metrics: { widthCss: 300, heightCss: 180 },
      entities: [player],
      now: () => 0,
      isDamageInvulnerable: () => true,
    });

    const normalArcCount = normalContext.calls.filter((call) => call.method === "arc").length;
    const invulnerableArcCount = invulnerableContext.calls.filter((call) => call.method === "arc").length;
    const normalStrokeCount = normalContext.calls.filter((call) => call.method === "stroke").length;
    const invulnerableStrokeCount = invulnerableContext.calls.filter((call) => call.method === "stroke").length;

    expect(invulnerableArcCount).toBe(normalArcCount + 1);
    expect(invulnerableStrokeCount).toBe(normalStrokeCount + 1);
  });
});

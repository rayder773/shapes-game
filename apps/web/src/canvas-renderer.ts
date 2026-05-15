import {
  getCoinHexagonPoints,
  getCoinInnerRadius,
  getCoinSpokes,
  getLifeCrossSegments,
  getLifeDiamondPoints,
} from "./icons.ts";

type Shape = "circle" | "square" | "triangle";
type ColorName = "red" | "blue" | "green";
type FillStyleName = "filled" | "outline" | "dashed";

export type CanvasRendererMetrics = {
  widthCss: number;
  heightCss: number;
};

export type CanvasRenderableEntity = {
  id: number;
  kind: "player" | "target" | "lifePickup" | "coinPickup";
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  appearance: {
    shape: Shape;
    color: ColorName;
    fillStyle: FillStyleName;
    size: number;
  };
};

export type CanvasRendererFrame = {
  metrics: CanvasRendererMetrics;
  entities: Iterable<CanvasRenderableEntity>;
  now: () => number;
  isDamageInvulnerable: (entity: CanvasRenderableEntity) => boolean;
};

export type CanvasRenderer = {
  render(frame: CanvasRendererFrame): void;
};

type CanvasRendererDependencies = {
  context: CanvasRenderingContext2D;
  scale: number;
};

const COLOR_MAP: Record<ColorName, string> = {
  red: "#ff5f5f",
  blue: "#66a8ff",
  green: "#59e093",
};
const LIFE_COLOR = "#b894ff";
const COIN_COLOR = "#ffd166";

function getTriangleVertices(size: number): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: size },
    { x: -size * 0.92, y: -size * 0.58 },
    { x: size * 0.92, y: -size * 0.58 },
  ];
}

export function createCanvasRenderer({ context, scale }: CanvasRendererDependencies): CanvasRenderer {
  function worldToCanvas(metrics: CanvasRendererMetrics, x: number, y: number): { x: number; y: number } {
    return {
      x: x * scale,
      y: metrics.heightCss - y * scale,
    };
  }

  function traceShape(shape: Shape, size: number): void {
    context.beginPath();

    if (shape === "circle") {
      context.arc(0, 0, size * scale, 0, Math.PI * 2);
      return;
    }

    if (shape === "square") {
      const pixelSize = size * scale;
      context.rect(-pixelSize, -pixelSize, pixelSize * 2, pixelSize * 2);
      return;
    }

    const vertices = getTriangleVertices(size);
    context.moveTo(vertices[0]!.x * scale, -vertices[0]!.y * scale);
    for (let index = 1; index < vertices.length; index += 1) {
      const vertex = vertices[index]!;
      context.lineTo(vertex.x * scale, -vertex.y * scale);
    }
    context.closePath();
  }

  function drawPlayerMarker(): void {
    context.save();
    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(0, 0, 0, 0.35)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  function drawLifePickup(size: number): void {
    const unitScale = (size * scale * 0.96) / 10;
    const diamondPoints = getLifeDiamondPoints(unitScale);
    const crossSegments = getLifeCrossSegments(unitScale);

    context.beginPath();
    context.moveTo(diamondPoints[0]!.x, diamondPoints[0]!.y);
    for (let index = 1; index < diamondPoints.length; index += 1) {
      const point = diamondPoints[index]!;
      context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.stroke();

    for (const segment of crossSegments) {
      context.beginPath();
      context.moveTo(segment.from.x, segment.from.y);
      context.lineTo(segment.to.x, segment.to.y);
      context.stroke();
    }
  }

  function drawCoinPickup(size: number): void {
    const unitScale = (size * scale * 1.05) / 10;
    const hexagonPoints = getCoinHexagonPoints(unitScale);
    const spokes = getCoinSpokes(unitScale);

    context.beginPath();
    for (let index = 0; index < hexagonPoints.length; index += 1) {
      const point = hexagonPoints[index]!;
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.closePath();
    context.stroke();

    context.beginPath();
    context.arc(0, 0, getCoinInnerRadius(unitScale), 0, Math.PI * 2);
    context.stroke();

    for (const spoke of spokes) {
      context.beginPath();
      context.moveTo(spoke.from.x, spoke.from.y);
      context.lineTo(spoke.to.x, spoke.to.y);
      context.stroke();
    }
  }

  function drawEntity(
    metrics: CanvasRendererMetrics,
    entity: CanvasRenderableEntity,
    now: () => number,
    isDamageInvulnerable: (entity: CanvasRenderableEntity) => boolean,
  ): void {
    const { x, y } = worldToCanvas(metrics, entity.position.x, entity.position.y);
    const color =
      entity.kind === "lifePickup" ? LIFE_COLOR
        : entity.kind === "coinPickup" ? COIN_COLOR
          : COLOR_MAP[entity.appearance.color];
    const isInvulnerablePlayer = entity.kind === "player" && isDamageInvulnerable(entity);

    context.save();
    context.translate(x, y);
    context.rotate(-entity.rotation);
    context.lineWidth =
      entity.kind === "player" ? 4.5
        : entity.kind === "lifePickup" ? 2.8
          : entity.kind === "coinPickup" ? 2.4
            : 2.2;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.setLineDash(
      entity.kind === "lifePickup" || entity.kind === "coinPickup"
        ? []
        : entity.appearance.fillStyle === "dashed" ? [9, 6] : [],
    );

    if (entity.kind === "lifePickup") {
      context.shadowColor = "rgba(184, 148, 255, 0.4)";
      context.shadowBlur = 14;
      drawLifePickup(entity.appearance.size);
    } else if (entity.kind === "coinPickup") {
      context.shadowColor = "rgba(255, 209, 102, 0.46)";
      context.shadowBlur = 18;
      drawCoinPickup(entity.appearance.size);
    } else {
      traceShape(entity.appearance.shape, entity.appearance.size);

      if (entity.appearance.fillStyle === "filled") {
        context.globalAlpha = 0.9;
        context.fill();
        context.globalAlpha = 1;
        context.stroke();
      } else {
        context.stroke();
      }
    }

    context.setLineDash([]);

    if (entity.kind === "player") {
      if (isInvulnerablePlayer && Math.floor(now() / 90) % 2 === 0) {
        traceShape(entity.appearance.shape, entity.appearance.size * 1.18);
        context.strokeStyle = "#ffd166";
        context.lineWidth = 2.2;
        context.stroke();
      }
      drawPlayerMarker();
    }

    context.restore();
  }

  return {
    render({ metrics, entities, now, isDamageInvulnerable }: CanvasRendererFrame): void {
      context.clearRect(0, 0, metrics.widthCss, metrics.heightCss);

      for (const entity of entities) {
        drawEntity(metrics, entity, now, isDamageInvulnerable);
      }
    },
  };
}

type Point = {
  x: number;
  y: number;
};

type Segment = {
  from: Point;
  to: Point;
};

const COIN_HEXAGON_POINTS = [
  { x: 0, y: -10 },
  { x: 8.66, y: -5 },
  { x: 8.66, y: 5 },
  { x: 0, y: 10 },
  { x: -8.66, y: 5 },
  { x: -8.66, y: -5 },
] as const;
const COIN_INNER_RADIUS = 5.2;
const COIN_SPOKES = [
  { from: { x: 0, y: -7.2 }, to: { x: 0, y: -5.7 } },
  { from: { x: 6.24, y: -3.6 }, to: { x: 4.94, y: -2.85 } },
  { from: { x: 6.24, y: 3.6 }, to: { x: 4.94, y: 2.85 } },
  { from: { x: 0, y: 7.2 }, to: { x: 0, y: 5.7 } },
  { from: { x: -6.24, y: 3.6 }, to: { x: -4.94, y: 2.85 } },
  { from: { x: -6.24, y: -3.6 }, to: { x: -4.94, y: -2.85 } },
] as const;
const COIN_SVG_VIEWBOX_SIZE = 24;
const COIN_SVG_STROKE = 2;
const COIN_SVG_RING_STROKE = 1.8;
const COIN_SVG_SPOKE_STROKE = 1.4;

const LIFE_DIAMOND_POINTS = [
  { x: 0, y: -10 },
  { x: 10, y: 0 },
  { x: 0, y: 10 },
  { x: -10, y: 0 },
] as const;
const LIFE_CROSS_HALF = 3.4;
const LIFE_SVG_STROKE = 2;
const LIFE_SVG_CROSS_STROKE = 1.8;

function scalePoints(points: readonly Point[], scale: number): Point[] {
  return points.map((point) => ({
    x: point.x * scale,
    y: point.y * scale,
  }));
}

function scaleSegments(segments: readonly Segment[], scale: number): Segment[] {
  return segments.map((segment) => ({
    from: {
      x: segment.from.x * scale,
      y: segment.from.y * scale,
    },
    to: {
      x: segment.to.x * scale,
      y: segment.to.y * scale,
    },
  }));
}

export function getCoinHexagonPoints(scale: number): Point[] {
  return scalePoints(COIN_HEXAGON_POINTS, scale);
}

export function getCoinSpokes(scale: number): Segment[] {
  return scaleSegments(COIN_SPOKES, scale);
}

export function getCoinInnerRadius(scale: number): number {
  return COIN_INNER_RADIUS * scale;
}

export function getLifeDiamondPoints(scale: number): Point[] {
  return scalePoints(LIFE_DIAMOND_POINTS, scale);
}

export function getLifeCrossSegments(scale: number): Segment[] {
  return [
    {
      from: { x: -LIFE_CROSS_HALF * scale, y: 0 },
      to: { x: LIFE_CROSS_HALF * scale, y: 0 },
    },
    {
      from: { x: 0, y: -LIFE_CROSS_HALF * scale },
      to: { x: 0, y: LIFE_CROSS_HALF * scale },
    },
  ];
}

export function createCoinIconSvgMarkup(): string {
  const polygonPoints = COIN_HEXAGON_POINTS.map((point) => `${point.x},${point.y}`).join(" ");
  const spokesMarkup = COIN_SPOKES.map((spoke) => (
    `<line x1="${spoke.from.x}" y1="${spoke.from.y}" x2="${spoke.to.x}" y2="${spoke.to.y}" `
    + `stroke="currentColor" stroke-width="${COIN_SVG_SPOKE_STROKE}" stroke-linecap="round" />`
  )).join("");

  return (
    `<svg viewBox="-12 -12 ${COIN_SVG_VIEWBOX_SIZE} ${COIN_SVG_VIEWBOX_SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">`
    + `<polygon points="${polygonPoints}" stroke="currentColor" stroke-width="${COIN_SVG_STROKE}" stroke-linejoin="round" />`
    + `<circle cx="0" cy="0" r="${COIN_INNER_RADIUS}" stroke="currentColor" stroke-width="${COIN_SVG_RING_STROKE}" />`
    + spokesMarkup
    + "</svg>"
  );
}

export function createLifeIconSvgMarkup(): string {
  const polygonPoints = LIFE_DIAMOND_POINTS.map((point) => `${point.x},${point.y}`).join(" ");
  const crossSegments = [
    `<line x1="${-LIFE_CROSS_HALF}" y1="0" x2="${LIFE_CROSS_HALF}" y2="0" stroke="currentColor" stroke-width="${LIFE_SVG_CROSS_STROKE}" stroke-linecap="round" />`,
    `<line x1="0" y1="${-LIFE_CROSS_HALF}" x2="0" y2="${LIFE_CROSS_HALF}" stroke="currentColor" stroke-width="${LIFE_SVG_CROSS_STROKE}" stroke-linecap="round" />`,
  ].join("");

  return (
    `<svg viewBox="-12 -12 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">`
    + `<polygon points="${polygonPoints}" stroke="currentColor" stroke-width="${LIFE_SVG_STROKE}" stroke-linejoin="round" />`
    + crossSegments
    + "</svg>"
  );
}

export function initializeIcons(): void {
  const coinMarkup = createCoinIconSvgMarkup();
  for (const element of document.querySelectorAll<HTMLElement>("[data-coin-icon]")) {
    element.innerHTML = coinMarkup;
  }
}

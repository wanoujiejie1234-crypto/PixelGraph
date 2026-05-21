export type ErEndpointSide = 'left' | 'right' | 'top' | 'bottom';

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export interface CrowfootLinePrimitive {
  end: Point;
  start: Point;
  type: 'line';
}

export interface CrowfootCirclePrimitive {
  center: Point;
  radius: number;
  type: 'circle';
}

export type CrowfootPrimitive = CrowfootCirclePrimitive | CrowfootLinePrimitive;

export type CrowfootCardinality = 'one' | 'zero-one' | 'many' | 'zero-many';

function add(point: Point, ...vectors: Vector[]): Point {
  return vectors.reduce(
    (current, vector) => ({
      x: current.x + vector.x,
      y: current.y + vector.y,
    }),
    point,
  );
}

function scale(vector: Vector, amount: number): Vector {
  return {
    x: vector.x * amount,
    y: vector.y * amount,
  };
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

export function edgeDirection(side: ErEndpointSide | undefined, fallback: Vector): Vector {
  if (side === 'left') return { x: -1, y: 0 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'top') return { x: 0, y: -1 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return normalize(fallback);
}

export function normalizeCrowfootCardinality(value: string | undefined): CrowfootCardinality {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '');

  if (normalized === '1' || normalized === '1..1') return 'one';
  if (normalized === '0..1' || normalized === '01' || normalized === '0,1') return 'zero-one';
  if (normalized === 'n' || normalized === 'many' || normalized === '1..n' || normalized === 'm' || normalized === '1..m') return 'many';
  return 'zero-many';
}

export function crowfootPrimitives(point: Point, direction: Vector, cardinality: string | undefined): CrowfootPrimitive[] {
  const n = normalize(direction);
  const p = { x: -n.y, y: n.x };
  const kind = normalizeCrowfootCardinality(cardinality);

  const oneBarCenter = add(point, scale(n, 13));
  const zeroCircleCenter = add(point, scale(n, 7));
  const manyJoin = add(point, scale(n, kind === 'zero-many' ? 27 : 18));
  const manyCenterTip = add(point, scale(n, kind === 'zero-many' ? 13 : 5));
  const manyUpperTip = add(point, scale(n, kind === 'zero-many' ? 16 : 8), scale(p, 8));
  const manyLowerTip = add(point, scale(n, kind === 'zero-many' ? 16 : 8), scale(p, -8));

  if (kind === 'one') {
    return [
      {
        end: add(oneBarCenter, scale(p, 8)),
        start: add(oneBarCenter, scale(p, -8)),
        type: 'line',
      },
    ];
  }

  if (kind === 'zero-one') {
    return [
      {
        center: zeroCircleCenter,
        radius: 4.5,
        type: 'circle',
      },
      {
        end: add(add(point, scale(n, 19)), scale(p, 8)),
        start: add(add(point, scale(n, 19)), scale(p, -8)),
        type: 'line',
      },
    ];
  }

  const manyLines: CrowfootPrimitive[] = [
    {
      end: manyCenterTip,
      start: manyJoin,
      type: 'line',
    },
    {
      end: manyUpperTip,
      start: manyJoin,
      type: 'line',
    },
    {
      end: manyLowerTip,
      start: manyJoin,
      type: 'line',
    },
  ];

  if (kind === 'many') return manyLines;

  return [
    {
      center: zeroCircleCenter,
      radius: 4.5,
      type: 'circle',
    },
    ...manyLines,
  ];
}

export function crowfootLabelPoint(point: Point, direction: Vector, side: 'from' | 'to'): Point {
  const n = normalize(direction);
  const p = { x: -n.y, y: n.x };
  return add(point, scale(n, 36), scale(p, side === 'from' ? 16 : -16));
}

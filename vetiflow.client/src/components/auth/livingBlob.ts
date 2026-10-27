// The maths behind the sign-in page's moving shapes (build plan S.20c), after
// the designer's reference, codepen.io/supah/pen/PoZrzQx: a blob is a smooth
// closed curve through points spaced evenly around a centre, and each point
// eases in and out between a smallest and largest radius on its own timing.

export interface BlobSettings {
  centerX: number;
  centerY: number;
  minRadius: number;
  maxRadius: number;
  // Seconds for one point to ease from smallest to largest radius.
  minDuration: number;
  maxDuration: number;
  points: number;
  // The same seed always gives the same shape and timings.
  seed: number;
}

export interface BlobPoint {
  angle: number;
  duration: number;
  // Where in its cycle the point starts, 0 to 1.
  phase: number;
}

interface Point {
  x: number;
  y: number;
}

// A small seeded random (mulberry32), so screenshots and tests repeat.
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBlobPoints(settings: BlobSettings): BlobPoint[] {
  const random = seededRandom(settings.seed);
  const slice = (Math.PI * 2) / settings.points;

  return Array.from({ length: settings.points }, (_, index) => ({
    angle: slice * index,
    duration: settings.minDuration + random() * (settings.maxDuration - settings.minDuration),
    phase: random()
  }));
}

// Eases in and out between the radii: smallest at the start of a cycle,
// largest halfway, as a sine. When still, every point rests in the middle.
export function pointRadius(point: BlobPoint, settings: BlobSettings, seconds: number, isStill: boolean): number {
  const middle = (settings.minRadius + settings.maxRadius) / 2;

  if (isStill) {
    return middle;
  }

  const turn = seconds / (point.duration * 2) + point.phase;
  const swing = (1 - Math.cos(turn * Math.PI * 2)) / 2;
  return settings.minRadius + (settings.maxRadius - settings.minRadius) * swing;
}

// A smooth closed curve through the points: each segment's handles follow the
// neighbouring points (the reference's createPath, with a 0.15 tension).
export function smoothClosedPath(points: Point[]): string {
  const count = points.length;
  const at = (index: number) => points[(index + count) % count];
  const round = (value: number) => Math.round(value * 10) / 10;
  let path = `M${round(points[0].x)} ${round(points[0].y)} C`;

  for (let index = 0; index < count; index++) {
    const before = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const after = at(index + 2);

    const handle1 = { x: start.x + (end.x - before.x) * 0.15, y: start.y + (end.y - before.y) * 0.15 };
    const handle2 = { x: end.x - (after.x - start.x) * 0.15, y: end.y - (after.y - start.y) * 0.15 };

    path += ` ${round(handle1.x)} ${round(handle1.y)} ${round(handle2.x)} ${round(handle2.y)} ${round(end.x)} ${round(end.y)}`;
  }

  return `${path}z`;
}

export function blobPath(settings: BlobSettings, points: BlobPoint[], seconds: number, isStill: boolean): string {
  return smoothClosedPath(
    points.map((point) => {
      const radius = pointRadius(point, settings, seconds, isStill);
      return {
        x: settings.centerX + Math.cos(point.angle) * radius,
        y: settings.centerY + Math.sin(point.angle) * radius
      };
    })
  );
}

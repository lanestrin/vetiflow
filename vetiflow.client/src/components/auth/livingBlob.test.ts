import { describe, expect, it } from "vitest";
import { blobPath, createBlobPoints, pointRadius, seededRandom, type BlobSettings } from "./livingBlob";

const settings: BlobSettings = {
  centerX: 400,
  centerY: 300,
  minRadius: 200,
  maxRadius: 240,
  minDuration: 2,
  maxDuration: 4,
  points: 9,
  seed: 7
};

describe("livingBlob", () => {
  it("draws one closed curve segment per point", () => {
    const path = blobPath(settings, createBlobPoints(settings), 1.3, false);

    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("z")).toBe(true);
    // After "C", each point adds two handles and an end: six numbers.
    const numbers = path.slice(path.indexOf("C") + 1, -1).trim().split(/\s+/);
    expect(numbers).toHaveLength(settings.points * 6);
  });

  it("keeps every point between the smallest and largest radius", () => {
    const points = createBlobPoints(settings);

    for (let seconds = 0; seconds < 20; seconds += 0.37) {
      for (const point of points) {
        const radius = pointRadius(point, settings, seconds, false);
        expect(radius).toBeGreaterThanOrEqual(settings.minRadius);
        expect(radius).toBeLessThanOrEqual(settings.maxRadius);
      }
    }
  });

  it("moves the shape over time", () => {
    const points = createBlobPoints(settings);

    expect(blobPath(settings, points, 0, false)).not.toBe(blobPath(settings, points, 1, false));
  });

  it("rests every point at the middle radius when still", () => {
    const points = createBlobPoints(settings);

    for (const point of points) {
      expect(pointRadius(point, settings, 0, true)).toBe(220);
      expect(pointRadius(point, settings, 9.5, true)).toBe(220);
    }
    expect(blobPath(settings, points, 0, true)).toBe(blobPath(settings, points, 9.5, true));
  });

  it("repeats the same timings for the same seed", () => {
    expect(createBlobPoints(settings)).toEqual(createBlobPoints(settings));
    expect(createBlobPoints({ ...settings, seed: 8 })).not.toEqual(createBlobPoints(settings));

    const random = seededRandom(1);
    const value = random();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("stretches the shape", () => {
    const points = createBlobPoints(settings);
    const coordinates = (path: string) => path.replace(/[MCz]/g, " ").trim().split(/\s+/).map(Number);
    const plain = coordinates(blobPath(settings, points, 0, true));
    const wide = coordinates(blobPath({ ...settings, stretchX: 2 }, points, 0, true));

    // Coordinates alternate x, y: every x is twice as far from the centre,
    // every y is unchanged.
    const xs = (values: number[]) => values.filter((_, index) => index % 2 === 0);
    const ys = (values: number[]) => values.filter((_, index) => index % 2 === 1);

    xs(wide).forEach((x, index) => {
      expect(x - settings.centerX).toBeCloseTo((xs(plain)[index] - settings.centerX) * 2, 0);
    });
    expect(ys(wide)).toEqual(ys(plain));
  });

  it("keeps durations within the given range", () => {
    for (const point of createBlobPoints(settings)) {
      expect(point.duration).toBeGreaterThanOrEqual(settings.minDuration);
      expect(point.duration).toBeLessThanOrEqual(settings.maxDuration);
    }
  });
});

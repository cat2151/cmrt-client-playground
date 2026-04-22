import { describe, expect, it } from "vitest";
import {
  buildMeasureGridCacheStateMap,
  parseMeasureGridCacheState,
  readMeasureGridCacheState,
} from "./measure-grid-cache.ts";

describe("parseMeasureGridCacheState", () => {
  it("accepts DAW cache states used by GET /status", () => {
    expect(parseMeasureGridCacheState("empty")).toBe("empty");
    expect(parseMeasureGridCacheState("pending")).toBe("pending");
    expect(parseMeasureGridCacheState("rendering")).toBe("rendering");
    expect(parseMeasureGridCacheState("ready")).toBe("ready");
    expect(parseMeasureGridCacheState("error")).toBe("error");
  });

  it("ignores unknown cache states", () => {
    expect(parseMeasureGridCacheState("stale")).toBeNull();
  });
});

describe("readMeasureGridCacheState", () => {
  it("reads a track and measure from the DAW status cache matrix", () => {
    const cells = [
      [{ state: "ready" }],
      [{ state: "empty" }, { state: "rendering" }],
    ];

    expect(readMeasureGridCacheState(cells, 1, 1)).toBe("rendering");
  });

  it("returns null outside the cache matrix", () => {
    expect(readMeasureGridCacheState([[{ state: "ready" }]], 2, 1)).toBeNull();
  });
});

describe("buildMeasureGridCacheStateMap", () => {
  it("maps each known status cell to the measure-grid key", () => {
    const states = buildMeasureGridCacheStateMap([
      [{ state: "ready" }],
      [{ state: "pending" }, { state: "rendering" }],
    ]);

    expect(Object.fromEntries(states)).toEqual({
      "0:0": "ready",
      "1:0": "pending",
      "1:1": "rendering",
    });
  });

  it("drops unknown status cells", () => {
    const states = buildMeasureGridCacheStateMap([[{ state: "unknown" }]]);

    expect(states.size).toBe(0);
  });
});

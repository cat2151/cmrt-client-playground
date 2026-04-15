import { describe, expect, it } from "vitest";
import {
  expandMeasureGridConfigToInclude,
  getVisibleMeasures,
  getVisibleTracks,
  type MeasureGridConfig,
} from "./measure-grid.ts";

describe("getVisibleTracks", () => {
  it("returns visible track numbers from the config", () => {
    const config: MeasureGridConfig = {
      trackStart: 3,
      trackCount: 4,
      measureStart: 0,
      measureCount: 8,
    };

    expect(getVisibleTracks(config)).toEqual([3, 4, 5, 6]);
  });
});

describe("getVisibleMeasures", () => {
  it("returns visible measure numbers from the config", () => {
    const config: MeasureGridConfig = {
      trackStart: 1,
      trackCount: 4,
      measureStart: 2,
      measureCount: 3,
    };

    expect(getVisibleMeasures(config)).toEqual([2, 3, 4]);
  });
});

describe("expandMeasureGridConfigToInclude", () => {
  it("expands start positions when target is before the current grid", () => {
    const config: MeasureGridConfig = {
      trackStart: 3,
      trackCount: 2,
      measureStart: 4,
      measureCount: 2,
    };

    expect(
      expandMeasureGridConfigToInclude(config, 1, 2, {
        maxTrackCount: 16,
        maxMeasureCount: 32,
      })
    ).toEqual({
      trackStart: 1,
      trackCount: 4,
      measureStart: 2,
      measureCount: 4,
    });
  });

  it("expands counts when target is after the current grid", () => {
    const config: MeasureGridConfig = {
      trackStart: 2,
      trackCount: 2,
      measureStart: 1,
      measureCount: 2,
    };

    expect(
      expandMeasureGridConfigToInclude(config, 5, 4, {
        maxTrackCount: 16,
        maxMeasureCount: 32,
      })
    ).toEqual({
      trackStart: 2,
      trackCount: 4,
      measureStart: 1,
      measureCount: 4,
    });
  });

  it("returns null when expansion exceeds configured limits", () => {
    const config: MeasureGridConfig = {
      trackStart: 1,
      trackCount: 4,
      measureStart: 0,
      measureCount: 8,
    };

    expect(
      expandMeasureGridConfigToInclude(config, 20, 40, {
        maxTrackCount: 16,
        maxMeasureCount: 32,
      })
    ).toBeNull();
  });
});

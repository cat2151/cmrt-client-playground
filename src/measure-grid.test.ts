import { describe, expect, it } from "vitest";
import {
  expandMeasureGridConfigToInclude,
  getMeasureGridCellHighlight,
  getVisibleMeasures,
  getVisibleTracks,
  isStaleMeasureGridPostSync,
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

describe("isStaleMeasureGridPostSync", () => {
  it("returns false when the input state still matches the sent snapshot", () => {
    expect(
      isStaleMeasureGridPostSync({
        sentValue: "cdef",
        currentValue: "cdef",
        sentEditVersion: 2,
        currentEditVersion: 2,
      })
    ).toBe(false);
  });

  it("returns true when the input value changed while the POST was in-flight", () => {
    expect(
      isStaleMeasureGridPostSync({
        sentValue: "cdef",
        currentValue: "gabc",
        sentEditVersion: 2,
        currentEditVersion: 3,
      })
    ).toBe(true);
  });

  it("returns true when edit history changed even if the value returned to the same text", () => {
    expect(
      isStaleMeasureGridPostSync({
        sentValue: "cdef",
        currentValue: "cdef",
        sentEditVersion: 2,
        currentEditVersion: 3,
      })
    ).toBe(true);
  });
});

describe("getMeasureGridCellHighlight", () => {
  it("returns chord when the cell matches only the chord target", () => {
    expect(
      getMeasureGridCellHighlight(2, 3, {
        chordTarget: { track: 2, measure: 3 },
        bassTarget: { track: 5, measure: 7 },
      })
    ).toBe("chord");
  });

  it("returns bass when the cell matches only the bass target", () => {
    expect(
      getMeasureGridCellHighlight(5, 7, {
        chordTarget: { track: 2, measure: 3 },
        bassTarget: { track: 5, measure: 7 },
      })
    ).toBe("bass");
  });

  it("returns both when chord and bass target the same cell", () => {
    expect(
      getMeasureGridCellHighlight(4, 6, {
        chordTarget: { track: 4, measure: 6 },
        bassTarget: { track: 4, measure: 6 },
      })
    ).toBe("both");
  });

  it("returns none when the cell is not targeted", () => {
    expect(
      getMeasureGridCellHighlight(1, 1, {
        chordTarget: { track: 2, measure: 3 },
        bassTarget: { track: 5, measure: 7 },
      })
    ).toBe("none");
  });

  it("returns none when nullable targets are missing", () => {
    expect(
      getMeasureGridCellHighlight(2, 3, {
        chordTarget: null,
        bassTarget: null,
      })
    ).toBe("none");
  });
});

import { describe, expect, it } from "vitest";
import {
  expandMeasureGridConfigToInclude,
  formatMeasureGridMeasureLabel,
  formatMeasureGridTrackLabel,
  getMeasureGridArrowNavigationTarget,
  getMeasureGridCaretPosition,
  getMeasureGridCellHighlight,
  getMeasureGridCellExpandedWidthCh,
  getMmlsCellValue,
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

  it("includes conductor track 0 when the grid starts there", () => {
    const config: MeasureGridConfig = {
      trackStart: 0,
      trackCount: 4,
      measureStart: 0,
      measureCount: 8,
    };

    expect(getVisibleTracks(config)).toEqual([0, 1, 2, 3]);
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

describe("measure-grid labels", () => {
  it("shows special labels for conductor and init cells", () => {
    expect(formatMeasureGridTrackLabel(0)).toBe("Conductor");
    expect(formatMeasureGridTrackLabel(2)).toBe("track 2");
    expect(formatMeasureGridMeasureLabel(0)).toBe("init");
    expect(formatMeasureGridMeasureLabel(3)).toBe("3");
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

describe("getMeasureGridCellExpandedWidthCh", () => {
  it("adds a small editing buffer to the current text length", () => {
    expect(getMeasureGridCellExpandedWidthCh("l8cdef")).toBe(8);
  });

  it("keeps empty values focusable without collapsing the editor", () => {
    expect(getMeasureGridCellExpandedWidthCh("")).toBe(2);
  });
});

describe("getMeasureGridArrowNavigationTarget", () => {
  it("moves left only when the caret is already at the start", () => {
    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowLeft",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 0,
        selectionEnd: 0,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toEqual({
      track: 2,
      measure: 3,
      selectionBehavior: "end",
    });

    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowLeft",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 1,
        selectionEnd: 1,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toBeNull();
  });

  it("moves right only when the caret is already at the end", () => {
    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowRight",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 5,
        selectionEnd: 5,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toEqual({
      track: 2,
      measure: 5,
      selectionBehavior: "start",
    });

    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowRight",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 0,
        selectionEnd: 5,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toBeNull();
  });

  it("preserves vertical caret offset from the start when the caret is in the front half", () => {
    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowUp",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 2,
        selectionEnd: 2,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toEqual({
      track: 1,
      measure: 4,
      selectionBehavior: "preserve",
      caretOffset: 2,
      caretOffsetOrigin: "start",
    });
  });

  it("preserves vertical caret offset from the end when the caret is in the back half", () => {
    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowDown",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 4,
        selectionEnd: 4,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toEqual({
      track: 3,
      measure: 4,
      selectionBehavior: "preserve",
      caretOffset: 1,
      caretOffsetOrigin: "end",
    });
  });

  it("stays in place at the edges and during composition or modifier use", () => {
    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowLeft",
        track: 2,
        measure: 3,
        value: "l8cde",
        selectionStart: 0,
        selectionEnd: 0,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toBeNull();

    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowUp",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 2,
        selectionEnd: 2,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: true,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      })
    ).toBeNull();

    expect(
      getMeasureGridArrowNavigationTarget({
        key: "ArrowDown",
        track: 2,
        measure: 4,
        value: "l8cde",
        selectionStart: 2,
        selectionEnd: 2,
        visibleTracks: [1, 2, 3],
        visibleMeasures: [3, 4, 5],
        isComposing: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
      })
    ).toBeNull();
  });
});

describe("getMeasureGridCaretPosition", () => {
  it("keeps the same offset from the start when preserving from the front half", () => {
    expect(getMeasureGridCaretPosition("abcd", "preserve", 2, "start")).toBe(2);
  });

  it("keeps the same offset from the end when preserving from the back half", () => {
    expect(getMeasureGridCaretPosition("abcdef", "preserve", 2, "end")).toBe(4);
  });

  it("clamps to the destination edge when the destination text is shorter", () => {
    expect(getMeasureGridCaretPosition("abc", "preserve", 5, "start")).toBe(3);
    expect(getMeasureGridCaretPosition("abc", "preserve", 5, "end")).toBe(0);
  });
});

describe("getMmlsCellValue", () => {
  it("reads the track/measure cell directly from the /mmls snapshot", () => {
    expect(
      getMmlsCellValue(
        [
          ["meta"],
          ["@1", "l8cde"],
          ["@2", "l8gab"],
        ],
        2,
        1
      )
    ).toBe("l8gab");
  });

  it("returns null when the requested track or measure is outside the snapshot", () => {
    expect(
      getMmlsCellValue(
        [
          ["meta"],
          ["@1", "l8cde"],
        ],
        3,
        0
      )
    ).toBeNull();
    expect(
      getMmlsCellValue(
        [
          ["meta"],
          ["@1", "l8cde"],
        ],
        1,
        5
      )
    ).toBeNull();
  });
});

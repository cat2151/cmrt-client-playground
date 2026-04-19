import { describe, expect, it, vi } from "vitest";
import {
  getStartupAbRepeatRange,
  isSameAbRepeatRange,
  syncDebouncedAbRepeat,
} from "./ab-repeat.ts";

describe("getStartupAbRepeatRange", () => {
  it("uses the chord measure range for the parsed chord measure span", () => {
    expect(
      getStartupAbRepeatRange({
        input: "C / C / C / C",
        chordMeasure: 5,
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 6,
    });
  });

  it("falls back to a single-measure range when the input is empty or invalid", () => {
    expect(
      getStartupAbRepeatRange({
        input: "",
        chordMeasure: 5,
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 5,
    });

    expect(
      getStartupAbRepeatRange({
        input: "not a chord",
        chordMeasure: 5,
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 5,
    });
  });
});

describe("isSameAbRepeatRange", () => {
  it("returns true only when both range endpoints match", () => {
    expect(
      isSameAbRepeatRange(
        { startMeasure: 3, endMeasure: 6 },
        { startMeasure: 3, endMeasure: 6 }
      )
    ).toBe(true);
    expect(
      isSameAbRepeatRange(
        { startMeasure: 3, endMeasure: 6 },
        { startMeasure: 3, endMeasure: 7 }
      )
    ).toBe(false);
  });

  it("handles nullable ranges", () => {
    expect(isSameAbRepeatRange(null, null)).toBe(true);
    expect(isSameAbRepeatRange({ startMeasure: 1, endMeasure: 1 }, null)).toBe(
      false
    );
  });
});

describe("syncDebouncedAbRepeat", () => {
  it("schedules a sync when CMRT is ready and the range changed", () => {
    const debouncedSync = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };

    syncDebouncedAbRepeat({
      isCmrtReady: true,
      nextRange: { startMeasure: 4, endMeasure: 7 },
      appliedRange: { startMeasure: 4, endMeasure: 6 },
      debouncedSync,
    });

    expect(debouncedSync.schedule).toHaveBeenCalledTimes(1);
    expect(debouncedSync.cancel).not.toHaveBeenCalled();
  });

  it("cancels a pending sync when the next range is unavailable or unchanged", () => {
    const debouncedSync = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };

    syncDebouncedAbRepeat({
      isCmrtReady: true,
      nextRange: { startMeasure: 4, endMeasure: 7 },
      appliedRange: { startMeasure: 4, endMeasure: 7 },
      debouncedSync,
    });
    syncDebouncedAbRepeat({
      isCmrtReady: true,
      nextRange: null,
      appliedRange: { startMeasure: 4, endMeasure: 7 },
      debouncedSync,
    });
    syncDebouncedAbRepeat({
      isCmrtReady: false,
      nextRange: { startMeasure: 5, endMeasure: 8 },
      appliedRange: { startMeasure: 4, endMeasure: 7 },
      debouncedSync,
    });

    expect(debouncedSync.schedule).not.toHaveBeenCalled();
    expect(debouncedSync.cancel).toHaveBeenCalledTimes(3);
  });
});

import { describe, expect, it } from "vitest";
import { getStartupAbRepeatRange } from "./ab-repeat.ts";

describe("getStartupAbRepeatRange", () => {
  it("covers both chord and bass targets for the parsed chord measure span", () => {
    expect(
      getStartupAbRepeatRange({
        input: "C / C / C / C",
        chordMeasure: 5,
        bassMeasureValue: "11",
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 12,
    });
  });

  it("falls back to a single-measure range when the input is empty or invalid", () => {
    expect(
      getStartupAbRepeatRange({
        input: "",
        chordMeasure: 5,
        bassMeasureValue: "",
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 5,
    });

    expect(
      getStartupAbRepeatRange({
        input: "not a chord",
        chordMeasure: 5,
        bassMeasureValue: "11",
      })
    ).toEqual({
      startMeasure: 5,
      endMeasure: 11,
    });
  });
});

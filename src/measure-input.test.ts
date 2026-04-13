import { describe, expect, it } from "vitest";
import { planMeasureInputs, splitInputIntoMeasures } from "./measure-input.ts";

describe("splitInputIntoMeasures", () => {
  it("keeps a single-line chord progression as one measure", () => {
    expect(splitInputIntoMeasures("C, Am, G7")).toEqual(["C, Am, G7"]);
  });

  it("splits multi-line input into measures and ignores blank lines", () => {
    expect(splitInputIntoMeasures(" C \n\n Am\r\n G7 \n")).toEqual([
      "C",
      "Am",
      "G7",
    ]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(splitInputIntoMeasures(" \n\t\r\n ")).toEqual([]);
  });
});

describe("planMeasureInputs", () => {
  it("assigns sequential measures from the requested start measure", () => {
    expect(planMeasureInputs("C\nAm\nG7", 4)).toEqual([
      { chord: "C", measure: 4 },
      { chord: "Am", measure: 5 },
      { chord: "G7", measure: 6 },
    ]);
  });
});

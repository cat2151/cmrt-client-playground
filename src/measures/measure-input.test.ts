import { describe, expect, it } from "vitest";
import {
  QUARTER_NOTES_PER_MEASURE,
  assignMeasuresToChunks,
  getChordSegmentDurationInQuarterNotes,
  parseChordSegments,
  planMeasureInputs,
  splitChordSegmentsByMeasure,
  splitSanitizedMmlIntoChordSegments,
} from "./measure-input.ts";

describe("splitSanitizedMmlIntoChordSegments", () => {
  it("splits sanitized MML into apostrophe-delimited chord segments", () => {
    expect(splitSanitizedMmlIntoChordSegments("'c1eg''a1<ce''g1b<df'")).toEqual([
      "'c1eg'",
      "'a1<ce'",
      "'g1b<df'",
    ]);
  });

  it("returns an empty array for invalid MML", () => {
    expect(splitSanitizedMmlIntoChordSegments("'c1eg'x")).toEqual([]);
  });
});

describe("getChordSegmentDurationInQuarterNotes", () => {
  it("treats omitted note length as a whole note", () => {
    expect(getChordSegmentDurationInQuarterNotes("'ceg'")).toBe(
      QUARTER_NOTES_PER_MEASURE
    );
  });

  it("reads the first note length from the chord segment", () => {
    expect(getChordSegmentDurationInQuarterNotes("'c2eg'")).toBe(2);
  });

  it("supports dotted note lengths", () => {
    expect(getChordSegmentDurationInQuarterNotes("'c4.eg'")).toBe(1.5);
  });
});

describe("splitChordSegmentsByMeasure", () => {
  it("groups chord segments into 1-measure chunks by duration", () => {
    const chordSegments = parseChordSegments(["'c2eg'", "'c2fg'", "'b1dfg'"]);
    expect(chordSegments).not.toBeNull();
    expect(splitChordSegmentsByMeasure(chordSegments ?? [])).toEqual([
      {
        chordSegments: [
          { mml: "'c2eg'", durationInQuarterNotes: 2 },
          { mml: "'c2fg'", durationInQuarterNotes: 2 },
        ],
        durationInQuarterNotes: 4,
        mml: "'c2eg''c2fg'",
      },
      {
        chordSegments: [{ mml: "'b1dfg'", durationInQuarterNotes: 4 }],
        durationInQuarterNotes: 4,
        mml: "'b1dfg'",
      },
    ]);
  });

  it("returns null when a chord segment would cross a measure boundary", () => {
    const chordSegments = parseChordSegments(["'c2eg'", "'b1dfg'"]);
    expect(chordSegments).not.toBeNull();
    expect(splitChordSegmentsByMeasure(chordSegments ?? [])).toBeNull();
  });
});

describe("assignMeasuresToChunks", () => {
  it("assigns sequential measure numbers", () => {
    expect(
      assignMeasuresToChunks(
        [
          {
            chordSegments: [{ mml: "'c1eg'", durationInQuarterNotes: 4 }],
            durationInQuarterNotes: 4,
            mml: "'c1eg'",
          },
          {
            chordSegments: [{ mml: "'a1<ce'", durationInQuarterNotes: 4 }],
            durationInQuarterNotes: 4,
            mml: "'a1<ce'",
          },
        ],
        4
      )
    ).toEqual([
      {
        chordSegments: [{ mml: "'c1eg'", durationInQuarterNotes: 4 }],
        durationInQuarterNotes: 4,
        measure: 4,
        mml: "'c1eg'",
      },
      {
        chordSegments: [{ mml: "'a1<ce'", durationInQuarterNotes: 4 }],
        durationInQuarterNotes: 4,
        measure: 5,
        mml: "'a1<ce'",
      },
    ]);
  });
});

describe("planMeasureInputs", () => {
  it("plans measure inputs from sanitized MML", () => {
    expect(planMeasureInputs("'c2eg''c2fg''b1dfg'", 5)).toEqual([
      {
        chordSegments: [
          { mml: "'c2eg'", durationInQuarterNotes: 2 },
          { mml: "'c2fg'", durationInQuarterNotes: 2 },
        ],
        durationInQuarterNotes: 4,
        measure: 5,
        mml: "'c2eg''c2fg'",
      },
      {
        chordSegments: [{ mml: "'b1dfg'", durationInQuarterNotes: 4 }],
        durationInQuarterNotes: 4,
        measure: 6,
        mml: "'b1dfg'",
      },
    ]);
  });
});

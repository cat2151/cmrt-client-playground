import { describe, expect, it } from "vitest";
import { selectAutoTargetTracks } from "./auto-targets.ts";

describe("selectAutoTargetTracks", () => {
  it("selects the first pad and bass tracks by filter name", () => {
    expect(
      selectAutoTargetTracks([
        { track: 2, filterName: "Warm Pad" },
        { track: 3, filterName: "Bright Pad" },
        { track: 4, filterName: "Electric Bass" },
        { track: 5, filterName: "Synth Bass" },
      ])
    ).toEqual({
      chordTrack: 2,
      bassTrack: 4,
    });
  });

  it("matches filter names case-insensitively and leaves missing targets unchanged", () => {
    expect(
      selectAutoTargetTracks([
        { track: 6, filterName: "SOFT PAD" },
        { track: 7, filterName: null },
      ])
    ).toEqual({
      chordTrack: 6,
      bassTrack: null,
    });
  });
});

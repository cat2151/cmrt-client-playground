import { describe, expect, it } from "vitest";
import { selectAutoTargetTracks } from "./auto-targets.ts";

describe("selectAutoTargetTracks", () => {
  it("selects the first matching tracks when multiple pad and bass candidates exist", () => {
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

  it("matches filter names case-insensitively", () => {
    expect(
      selectAutoTargetTracks([
        { track: 6, filterName: "SOFT PAD" },
        { track: 7, filterName: "SYNTH BASS" },
      ])
    ).toEqual({
      chordTrack: 6,
      bassTrack: 7,
    });
  });

  it("leaves missing targets as null", () => {
    expect(
      selectAutoTargetTracks([{ track: 8, filterName: "Lead" }])
    ).toEqual({
      chordTrack: null,
      bassTrack: null,
    });
  });
});

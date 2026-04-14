import { describe, expect, it } from "vitest";
import {
  splitBassRootChordSegment,
  splitBassRootMmlByTrack,
} from "./bass-root-mml.ts";

describe("splitBassRootChordSegment", () => {
  it("keeps ordinary chord segments on the chord track", () => {
    expect(splitBassRootChordSegment("'c1eg'")).toEqual({
      chordMml: "'c1eg'",
      bassMml: "",
    });
    expect(splitBassRootChordSegment("'b1<d+f+'")).toEqual({
      chordMml: "'b1<d+f+'",
      bassMml: "",
    });
  });

  it("extracts bass-root output into separate chord and bass segments", () => {
    expect(splitBassRootChordSegment("'>c1<ceg'")).toEqual({
      chordMml: "'c1eg'",
      bassMml: "'>c1'",
    });
    expect(splitBassRootChordSegment("'>a1<a<ce'")).toEqual({
      chordMml: "'a1<ce'",
      bassMml: "'>a1'",
    });
  });
});

describe("splitBassRootMmlByTrack", () => {
  it("splits only the bass-root segments in a measure", () => {
    expect(splitBassRootMmlByTrack("'>c2<ceg''f2a<c'")).toEqual({
      chordMml: "'c2eg''f2a<c'",
      bassMml: "'>c2'",
    });
  });

  it("keeps the original MML when nothing is split", () => {
    expect(splitBassRootMmlByTrack("'c1eg''g1b<df'")).toEqual({
      chordMml: "'c1eg''g1b<df'",
      bassMml: "",
    });
  });
});

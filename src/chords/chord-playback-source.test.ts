import { describe, expect, it } from "vitest";
import { buildChordPlaybackSource } from "./chord-playback-source.ts";

describe("buildChordPlaybackSource", () => {
  it("returns empty-input for blank text", () => {
    expect(buildChordPlaybackSource("   ")).toEqual({
      ok: false,
      reason: "empty-input",
    });
  });

  it("returns unrecognized-chord for unknown chords", () => {
    expect(buildChordPlaybackSource("ZZZZZ")).toEqual({
      ok: false,
      reason: "unrecognized-chord",
    });
  });

  it("builds shared MML for local playback and preview", () => {
    expect(buildChordPlaybackSource("F")).toEqual({
      ok: true,
      input: "F",
      mml: "v11'f1a<c'",
      sanitizedMml: "'f1a<c'",
      chordMml: "'f1a<c'",
      bassMml: "",
      removedTokens: ["v11"],
    });
  });

  it("keeps generated bass MML separate from chord playback MML", () => {
    expect(buildChordPlaybackSource("Key=C Bass is root. I")).toEqual({
      ok: true,
      input: "Key=C Bass is root. I",
      mml: "v11'>c1<ceg'",
      sanitizedMml: "'>c1<ceg'",
      chordMml: "'c1eg'",
      bassMml: "'>c1'",
      removedTokens: ["v11"],
    });
  });
});

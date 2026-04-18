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
});

import { describe, expect, it } from "vitest";
import { buildChordPlaybackSource } from "../chords/chord-playback-source.ts";
import { buildTonePlaybackMml } from "./tone-playback-mml.ts";

describe("buildTonePlaybackMml", () => {
  it("keeps generated bass notes in Tone.js playback MML", () => {
    const source = buildChordPlaybackSource("Key=C Bass is root. I");
    if (!source.ok) {
      throw new Error("expected chord source to be built");
    }

    expect(source.chordMml).toBe("'c1eg'");
    expect(source.bassMml).toBe("'>c1'");
    expect(buildTonePlaybackMml(source)).toBe("'>c1<ceg'");
  });
});

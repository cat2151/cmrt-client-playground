import { describe, expect, it } from "vitest";
import { adjustChordProgression } from "./auto-adjust.ts";
import { chordToMml } from "../chords/chord-to-mml.ts";

describe("adjustChordProgression", () => {
  it("adds inversion and octave markers while keeping the original preamble", () => {
    const input = "Key=C Bass is root. I-bVII-IV-I";
    const result = adjustChordProgression(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.adjustedInput).toMatch(/^Key=C Bass is root\. /);
    expect(result.adjustedInput).not.toBe(input);
    expect(result.maxBassJump).not.toBeNull();
    expect(result.maxBassJump).toBeLessThanOrEqual(5);
    expect(result.summary).toMatch(/^自動ボイシング: 4 chords /);
    expect(chordToMml(result.adjustedInput)).not.toBeNull();
  });

  it("can re-adjust an already adjusted progression without duplicating markers", () => {
    const result = adjustChordProgression(
      "Key=C Bass is root. I^1'/,-bVII^2/,-IV/,"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.adjustedInput).not.toContain("^1'/,^");
    expect(chordToMml(result.adjustedInput)).not.toBeNull();
  });

  it("returns a non-destructive failure when no chord can be targeted", () => {
    const input = "...";

    expect(adjustChordProgression(input)).toEqual({
      ok: false,
      adjustedInput: input,
      message: "調整対象のコードがありません",
      diagnostics: [],
    });
  });
});

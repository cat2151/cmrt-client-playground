import { describe, it, expect } from "vitest";
import { chordToMml } from "./chord-to-mml.ts";

describe("chordToMml (using chord2mml library)", () => {
  it("C major produces MML containing 'ceg'", () => {
    const result = chordToMml("C");
    expect(result).not.toBeNull();
    expect(result).toContain("c");
    expect(result).toContain("e");
    expect(result).toContain("g");
  });

  it("Am produces MML containing 'a', 'c', 'e'", () => {
    const result = chordToMml("Am");
    expect(result).not.toBeNull();
    expect(result).toContain("a");
    expect(result).toContain("c");
    expect(result).toContain("e");
  });

  it("G7 produces MML containing 'g', 'b', 'd', 'f'", () => {
    const result = chordToMml("G7");
    expect(result).not.toBeNull();
    expect(result).toContain("g");
    expect(result).toContain("b");
    expect(result).toContain("d");
    expect(result).toContain("f");
  });

  it("empty string returns null", () => {
    expect(chordToMml("")).toBeNull();
  });

  it("unknown chord returns null", () => {
    expect(chordToMml("ZZZZZ")).toBeNull();
  });

  it("F major produces MML containing 'f', 'a', 'c'", () => {
    const result = chordToMml("F");
    expect(result).not.toBeNull();
    expect(result).toContain("f");
    expect(result).toContain("a");
    expect(result).toContain("c");
  });

  it("distinguishes F and F^1 voicings", () => {
    expect(chordToMml("F")).toBe("v11'f1a<c'");
    expect(chordToMml("F^1")).toBe("v11'a1<cf'");
  });
});

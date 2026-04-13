import { describe, it, expect } from "vitest";
import { chordToMml } from "./chord-to-mml.ts";

describe("chordToMml", () => {
  it("C major returns 'ceg'", () => {
    expect(chordToMml("C")).toBe("'ceg'");
  });

  it("Am returns 'ace'", () => {
    expect(chordToMml("Am")).toBe("'ace'");
  });

  it("G7 returns 'gbdf'", () => {
    expect(chordToMml("G7")).toBe("'gbdf'");
  });

  it("empty string returns null", () => {
    expect(chordToMml("")).toBeNull();
  });

  it("unknown chord returns null", () => {
    expect(chordToMml("Xmaj")).toBeNull();
  });

  it("F major returns 'fac'", () => {
    expect(chordToMml("F")).toBe("'fac'");
  });
});

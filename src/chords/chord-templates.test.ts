import { describe, expect, it } from "vitest";
import {
  chordDegreeSequenceContains,
  formatChordDegreeNumberSearchLabel,
  formatChordDegreeRomanSearchLabel,
  formatChordTemplateInput,
  formatChordTemplateOptionLabel,
  getChordDegreeSearchTokens,
  parseChordTemplates,
} from "./chord-templates.ts";

describe("chord templates", () => {
  it("parses valid chord progression templates", () => {
    expect(
      parseChordTemplates([
        { degrees: " I-IV-V-I ", description: " cadence " },
        { degrees: "I-V-VIm-IV", description: "4コード進行" },
      ])
    ).toEqual({
      ok: true,
      templates: [
        { degrees: "I-IV-V-I", description: "cadence" },
        { degrees: "I-V-VIm-IV", description: "4コード進行" },
      ],
    });
  });

  it("skips empty and duplicate degrees while preserving the first entry", () => {
    expect(
      parseChordTemplates([
        { degrees: "I-IV-V-I", description: "first" },
        { degrees: "", description: "empty" },
        { degrees: " I-IV-V-I ", description: "duplicate" },
      ])
    ).toEqual({
      ok: true,
      templates: [{ degrees: "I-IV-V-I", description: "first" }],
    });
  });

  it("rejects invalid template shapes", () => {
    expect(parseChordTemplates({ degrees: "I" })).toEqual({
      ok: false,
      message: "JSON の最上位が array ではありません",
    });

    expect(parseChordTemplates([{ degrees: "I" }])).toEqual({
      ok: false,
      message: "1 件目の description が文字列ではありません",
    });
  });

  it("formats option labels with the description when present", () => {
    expect(
      formatChordTemplateOptionLabel({
        degrees: "I-V-VIm-IV",
        description: "4コード進行",
      })
    ).toBe("I-V-VIm-IV: 4コード進行");

    expect(
      formatChordTemplateOptionLabel({
        degrees: "I-IV-V-I",
        description: "",
      })
    ).toBe("I-IV-V-I");
  });

  it("formats template input with key and bass root directives", () => {
    expect(formatChordTemplateInput("I-IV-V-I", "C")).toBe(
      "Key=C Bass is root. I-IV-V-I"
    );
    expect(formatChordTemplateInput("I-V-VIm-IV", "F#")).toBe(
      "Key=F# Bass is root. I-V-VIm-IV"
    );
  });

  it("normalizes degree search tokens from numbers and roman numerals", () => {
    expect(getChordDegreeSearchTokens("4 5 3 6")).toEqual(["4", "5", "3", "6"]);
    expect(getChordDegreeSearchTokens("4536")).toEqual(["4", "5", "3", "6"]);
    expect(getChordDegreeSearchTokens("IV-V-IIIm-VIm")).toEqual([
      "4",
      "5",
      "3",
      "6",
    ]);
    expect(getChordDegreeSearchTokens("Key=C Bass is root. bVII-IV-I")).toEqual([
      "b7",
      "4",
      "1",
    ]);
  });

  it("formats normalized degree search labels", () => {
    const tokens = ["4", "5", "3", "6"];
    expect(formatChordDegreeNumberSearchLabel(tokens)).toBe("4-5-3-6");
    expect(formatChordDegreeRomanSearchLabel(tokens)).toBe("IV-V-III-VI");
  });

  it("matches degree search tokens by contiguous subsequence", () => {
    expect(chordDegreeSequenceContains(["1", "4", "5", "1"], ["4", "5"])).toBe(
      true
    );
    expect(chordDegreeSequenceContains(["1", "4", "1", "5"], ["4", "5"])).toBe(
      false
    );
  });
});

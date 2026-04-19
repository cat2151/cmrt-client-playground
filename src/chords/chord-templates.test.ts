import { describe, expect, it } from "vitest";
import {
  formatChordTemplateInput,
  formatChordTemplateOptionLabel,
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
});

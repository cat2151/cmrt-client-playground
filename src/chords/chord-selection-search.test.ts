import { describe, expect, it } from "vitest";
import {
  createChordSelectionSearchQuery,
  getChordSelectionSearchResults,
} from "./chord-selection-search.ts";

describe("chord selection search", () => {
  it("normalizes a number query to a roman-degree label", () => {
    expect(createChordSelectionSearchQuery("4 5 3 6")).toMatchObject({
      text: "4 5 3 6",
      degreeTokens: ["4", "5", "3", "6"],
      label: "IV-V-III-VI",
      isActive: true,
    });
  });

  it("searches history and templates by contiguous normalized degrees", () => {
    const results = getChordSelectionSearchResults(
      {
        history: [
          "Key=C Bass is root. IV-V-IIIm-VIm",
          "Key=C Bass is root. IV-I-V-VIm",
        ],
        templates: [
          { degrees: "IV-V-IIIm-VIm", description: "王道進行" },
          { degrees: "I-IV-V-I", description: "cadence" },
        ],
        templateLoadState: "ready",
        currentInput: "Key=C Bass is root. IV-V-IIIm-VIm",
        selectedTemplateDegrees: "IV-V-IIIm-VIm",
      },
      "4536"
    );

    expect(results.query.label).toBe("IV-V-III-VI");
    expect(results.history.map((result) => result.value)).toEqual([
      "Key=C Bass is root. IV-V-IIIm-VIm",
    ]);
    expect(results.templates.map((result) => result.value.degrees)).toEqual([
      "IV-V-IIIm-VIm",
    ]);
    expect(results.history[0].selected).toBe(true);
    expect(results.templates[0].selected).toBe(true);
    expect(results.templates[0].numberLabel).toBe("4-5-3-6");
  });

  it("falls back to text search when the query is not a degree sequence", () => {
    const results = getChordSelectionSearchResults(
      {
        history: ["Key=C Bass is root. I-IV-V-I"],
        templates: [
          { degrees: "I-IV-V-I", description: "cadence" },
          { degrees: "I-V-VIm-IV", description: "4コード進行" },
        ],
        templateLoadState: "ready",
        currentInput: "",
        selectedTemplateDegrees: null,
      },
      "cad"
    );

    expect(results.history).toEqual([]);
    expect(results.templates.map((result) => result.value.degrees)).toEqual(["I-IV-V-I"]);
  });
});

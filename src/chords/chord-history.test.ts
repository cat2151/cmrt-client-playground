import { describe, expect, it } from "vitest";
import {
  addChordHistoryEntry,
  normalizeChordHistory,
  parseChordHistoryStorage,
  serializeChordHistory,
} from "./chord-history.ts";

describe("chord history", () => {
  it("adds the newest chord first and moves duplicates to the front", () => {
    expect(addChordHistoryEntry(["C", "Am", "G7"], "Am")).toEqual([
      "Am",
      "C",
      "G7",
    ]);
  });

  it("trims entries, drops blanks, deduplicates, and enforces the limit", () => {
    expect(normalizeChordHistory([" C ", "", "Am", "C", "G7"], 2)).toEqual([
      "C",
      "Am",
    ]);
  });

  it("serializes normalized history as a JSON string for local storage", () => {
    expect(serializeChordHistory([" C ", "Am", "C"])).toBe(
      JSON.stringify(["C", "Am"])
    );
  });

  it("parses stored history", () => {
    expect(parseChordHistoryStorage(JSON.stringify(["C", "Am"]))).toEqual({
      ok: true,
      history: ["C", "Am"],
    });
  });

  it("rejects non-string stored history entries", () => {
    expect(parseChordHistoryStorage(JSON.stringify(["C", 1]))).toEqual({
      ok: false,
      message: "2 件目が文字列ではありません",
    });
  });
});

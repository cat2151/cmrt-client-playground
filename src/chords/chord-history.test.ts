import { describe, expect, it } from "vitest";
import {
  addChordHistoryEntry,
  normalizeChordHistory,
  parseChordHistoryStorage,
  serializeChordHistory,
  shouldRememberChordHistoryInput,
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

  it("keeps up to 100 entries by default", () => {
    const entries = Array.from({ length: 101 }, (_, index) => `entry ${index + 1}`);

    const normalized = normalizeChordHistory(entries);

    expect(normalized).toHaveLength(100);
    expect(normalized[0]).toBe("entry 1");
    expect(normalized[normalized.length - 1]).toBe("entry 100");
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

  it("remembers non-empty custom inputs but skips template inputs", () => {
    expect(shouldRememberChordHistoryInput("Key=C Bass is root. IV", false)).toBe(
      true
    );
    expect(shouldRememberChordHistoryInput("   ", false)).toBe(false);
    expect(shouldRememberChordHistoryInput("Key=C Bass is root. IV", true)).toBe(
      false
    );
  });
});

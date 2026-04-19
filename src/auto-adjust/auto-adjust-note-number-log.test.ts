import { describe, expect, it } from "vitest";
import type { AutoAdjustResult } from "./auto-adjust.ts";
import { formatAutoAdjustNoteNumberLog } from "./auto-adjust-note-number-log.ts";

describe("formatAutoAdjustNoteNumberLog", () => {
  it("logs adjusted input, converted MML, and note numbers", () => {
    const result: AutoAdjustResult = {
      ok: true,
      adjustedInput: "F",
      chordCount: 1,
      maxBassJump: null,
      maxTopJump: null,
      summary: "自動ボイシング: 1 chords / bass max jump - / top max jump -",
      diagnostics: [],
    };

    expect(formatAutoAdjustNoteNumberLog(result)).toBe(
      "自動ボイシング結果 最終出力(adjustedInput): adjustedInput=\"F\" MML=\"'f1a<c'\" 変換関数名=buildChordPlaybackSource -> extractSanitizedMmlNoteNumbers 変換後のnote number列=[65, 69, 72]"
    );
  });

  it("skips failed adjustment results", () => {
    expect(
      formatAutoAdjustNoteNumberLog({
        ok: false,
        adjustedInput: "...",
        message: "調整対象のコードがありません",
        diagnostics: [],
      })
    ).toBeNull();
  });
});

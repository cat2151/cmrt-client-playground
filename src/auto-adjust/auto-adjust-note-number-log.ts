import { buildChordPlaybackSource } from "../chords/chord-playback-source.ts";
import {
  extractSanitizedMmlNoteNumbers,
  formatLogValue,
  formatNoteNumbers,
} from "../music/note-numbers.ts";
import type { AutoAdjustResult } from "./auto-adjust.ts";

const AUTO_ADJUST_NOTE_NUMBER_CONVERSION_FUNCTION =
  "buildChordPlaybackSource -> extractSanitizedMmlNoteNumbers";

export function formatAutoAdjustNoteNumberLog(
  result: AutoAdjustResult
): string | null {
  if (!result.ok) {
    return null;
  }

  const source = buildChordPlaybackSource(result.adjustedInput);
  if (!source.ok) {
    return `自動ボイシング結果 最終出力(adjustedInput): adjustedInput=${formatLogValue(
      result.adjustedInput
    )} MML=(変換失敗: ${source.reason}) 変換関数名=${AUTO_ADJUST_NOTE_NUMBER_CONVERSION_FUNCTION} 変換後のnote number列=(変換失敗)`;
  }

  const noteNumbers = extractSanitizedMmlNoteNumbers(source.sanitizedMml);
  return `自動ボイシング結果 最終出力(adjustedInput): adjustedInput=${formatLogValue(
    result.adjustedInput
  )} MML=${formatLogValue(
    source.sanitizedMml
  )} 変換関数名=${AUTO_ADJUST_NOTE_NUMBER_CONVERSION_FUNCTION} 変換後のnote number列=${
    noteNumbers === null ? "(変換失敗)" : formatNoteNumbers(noteNumbers)
  }`;
}

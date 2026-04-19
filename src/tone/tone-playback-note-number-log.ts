import type { SequenceEvent } from "tonejs-json-sequencer";
import {
  formatLogValue,
  formatNoteNumbers,
  getToneSequenceNoteNumbers,
} from "../music/note-numbers.ts";

const TONE_PLAYBACK_NOTE_NUMBER_CONVERSION_FUNCTION =
  "tonejs-mml-to-json.mml2json(stripToneMmlVolumeTokens)";

export function formatTonePlaybackNoteNumberLog(options: {
  mml: string;
  sequence: readonly SequenceEvent[];
}): string {
  return `演奏MML 最終出力(MML): MML=${formatLogValue(
    options.mml
  )} 変換関数名=${TONE_PLAYBACK_NOTE_NUMBER_CONVERSION_FUNCTION} 変換後のnote number列=${formatNoteNumbers(
    getToneSequenceNoteNumbers(options.sequence)
  )}`;
}

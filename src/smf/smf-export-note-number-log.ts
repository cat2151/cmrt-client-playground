import {
  getPianoRollNoteNumbers,
  parseSmfToPianoRollData,
} from "../piano-roll/smf-piano-roll.ts";
import { formatLogValue, formatNoteNumbers } from "../music/note-numbers.ts";

export function formatSmfExportNoteNumberLog(
  mml: string,
  smfData: Uint8Array
): string {
  const noteNumbers = getPianoRollNoteNumbers(parseSmfToPianoRollData(smfData));
  return `export SMF 最終出力(SMF) note number列: MML=${formatLogValue(
    mml
  )} note number列=${formatNoteNumbers(noteNumbers)}`;
}

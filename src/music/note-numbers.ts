import type { SequenceEvent } from "tonejs-json-sequencer";
import { splitSanitizedMmlIntoChordSegments } from "../measures/measure-input.ts";

const MML_DEFAULT_C_MIDI_NOTE_NUMBER = 60;

const PITCH_CLASS_BY_NOTE: Record<string, number> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

export function formatLogValue(value: string): string {
  return JSON.stringify(value) ?? "\"\"";
}

export function formatNoteNumbers(noteNumbers: readonly number[]): string {
  return `[${noteNumbers.join(", ")}]`;
}

function accidentalOffset(accidentals: string): number {
  let offset = 0;
  for (const accidental of accidentals) {
    if (accidental === "#" || accidental === "+") {
      offset += 1;
    }
    if (accidental === "b" || accidental === "-") {
      offset -= 1;
    }
  }
  return offset;
}

export function toneNoteNameToMidiNoteNumber(noteName: unknown): number | null {
  if (typeof noteName !== "string") {
    return null;
  }

  const match = noteName.match(
    /^(?<note>[A-Ga-g])(?<accidentals>[#b+\-]*)(?<octave>-?\d+)$/
  );
  if (match?.groups === undefined) {
    return null;
  }

  const pitchClass = PITCH_CLASS_BY_NOTE[match.groups.note.toLowerCase()];
  if (pitchClass === undefined) {
    return null;
  }

  return (
    (Number.parseInt(match.groups.octave, 10) + 1) * 12 +
    pitchClass +
    accidentalOffset(match.groups.accidentals)
  );
}

function appendToneSequenceNoteNumbers(
  noteNameOrNames: unknown,
  noteNumbers: number[]
): void {
  const noteNames = Array.isArray(noteNameOrNames)
    ? noteNameOrNames
    : [noteNameOrNames];
  for (const noteName of noteNames) {
    const noteNumber = toneNoteNameToMidiNoteNumber(noteName);
    if (noteNumber !== null) {
      noteNumbers.push(noteNumber);
    }
  }
}

export function getToneSequenceNoteNumbers(
  sequence: readonly SequenceEvent[]
): number[] {
  const noteNumbers: number[] = [];
  for (const event of sequence) {
    if (event.eventType !== "triggerAttackRelease") {
      continue;
    }

    appendToneSequenceNoteNumbers(event.args[0], noteNumbers);
  }

  return noteNumbers;
}

export function parseChordSegmentRelativePitches(
  chordSegment: string
): number[] | null {
  if (!/^'[^']*'$/.test(chordSegment)) {
    return null;
  }

  const pitches: number[] = [];
  let octaveOffset = 0;
  let rest = chordSegment.slice(1, -1);

  while (rest !== "") {
    const match = rest.match(
      /^(?<prefix>[<>]*)(?<note>[a-gr])(?<accidentals>[+#-]*)(?<lengthText>\d*)(?<dotText>\.*)/i
    );
    if (match?.groups === undefined || match[0] === "") {
      return null;
    }

    for (const char of match.groups.prefix) {
      octaveOffset += char === "<" ? 1 : -1;
    }

    const note = match.groups.note.toLowerCase();
    if (note !== "r") {
      const pitchClass = PITCH_CLASS_BY_NOTE[note];
      if (pitchClass === undefined) {
        return null;
      }
      pitches.push(
        pitchClass +
          accidentalOffset(match.groups.accidentals) +
          octaveOffset * 12
      );
    }

    rest = rest.slice(match[0].length);
  }

  return pitches;
}

export function extractSanitizedMmlNoteNumbers(mml: string): number[] | null {
  const chordSegments = splitSanitizedMmlIntoChordSegments(mml);
  if (mml.trim() !== "" && chordSegments.length === 0) {
    return null;
  }

  const noteNumbers: number[] = [];
  for (const chordSegment of chordSegments) {
    const relativePitches = parseChordSegmentRelativePitches(chordSegment);
    if (relativePitches === null) {
      return null;
    }

    noteNumbers.push(
      ...relativePitches.map(
        (pitch) => MML_DEFAULT_C_MIDI_NOTE_NUMBER + pitch
      )
    );
  }

  return noteNumbers;
}

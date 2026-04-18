import { Midi } from "@tonejs/midi";

export interface PianoRollNote {
  pitch: number;
  startTick: number;
  endTick: number;
  track: number;
  channel: number;
}

export interface PianoRollData {
  division: number;
  totalTicks: number;
  minPitch: number;
  maxPitch: number;
  notes: PianoRollNote[];
}

export type PianoRollDisplayRole = "chord" | "bass" | "both";

export interface PianoRollDisplayNote extends PianoRollNote {
  role: PianoRollDisplayRole;
}

export interface PianoRollDisplayData {
  division: number;
  totalTicks: number;
  minPitch: number;
  maxPitch: number;
  notes: PianoRollDisplayNote[];
}

export function getPianoRollNoteNumbers(data: Pick<PianoRollData, "notes">): number[] {
  return data.notes.map((note) => note.pitch);
}

export function formatPianoRollNoteNumbers(noteNumbers: readonly number[]): string {
  return `[${noteNumbers.join(", ")}]`;
}

export function formatPianoRollDebugSummary(options: {
  mml: string;
  data: Pick<PianoRollData, "notes">;
}): string {
  return `piano roll preview: mml=${options.mml} note numbers=${formatPianoRollNoteNumbers(
    getPianoRollNoteNumbers(options.data)
  )}`;
}

function isIntervalActive(
  notes: readonly PianoRollNote[],
  startTick: number,
  endTick: number
): boolean {
  return notes.some((note) => note.startTick < endTick && startTick < note.endTick);
}

function mergeAdjacentDisplayNotes(notes: readonly PianoRollDisplayNote[]): PianoRollDisplayNote[] {
  if (notes.length === 0) {
    return [];
  }

  const merged: PianoRollDisplayNote[] = [notes[0]];
  for (const note of notes.slice(1)) {
    const lastNote = merged[merged.length - 1];
    if (
      lastNote.pitch === note.pitch &&
      lastNote.role === note.role &&
      lastNote.endTick === note.startTick
    ) {
      lastNote.endTick = note.endTick;
      continue;
    }

    merged.push({ ...note });
  }

  return merged;
}

export function buildPianoRollDisplayData(options: {
  chordData?: PianoRollData | null;
  bassData?: PianoRollData | null;
}): PianoRollDisplayData {
  const chordData = options.chordData ?? null;
  const bassData = options.bassData ?? null;
  const division = chordData?.division ?? bassData?.division;
  if (division === undefined) {
    throw new Error("ピアノロール表示対象のノートがありません");
  }

  const pitchSet = new Set<number>();
  for (const note of chordData?.notes ?? []) {
    pitchSet.add(note.pitch);
  }
  for (const note of bassData?.notes ?? []) {
    pitchSet.add(note.pitch);
  }
  const pitches = [...pitchSet].sort((left, right) => left - right);
  const displayNotes: PianoRollDisplayNote[] = [];

  for (const pitch of pitches) {
    const chordNotes = (chordData?.notes ?? []).filter((note) => note.pitch === pitch);
    const bassNotes = (bassData?.notes ?? []).filter((note) => note.pitch === pitch);
    const boundaries = [...new Set([
      ...chordNotes.flatMap((note) => [note.startTick, note.endTick]),
      ...bassNotes.flatMap((note) => [note.startTick, note.endTick]),
    ])].sort((left, right) => left - right);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const startTick = boundaries[index];
      const endTick = boundaries[index + 1];
      if (endTick <= startTick) {
        continue;
      }

      const chordActive = isIntervalActive(chordNotes, startTick, endTick);
      const bassActive = isIntervalActive(bassNotes, startTick, endTick);
      if (!chordActive && !bassActive) {
        continue;
      }

      displayNotes.push({
        pitch,
        startTick,
        endTick,
        track: chordActive ? chordNotes[0]?.track ?? bassNotes[0]?.track ?? 0 : bassNotes[0]?.track ?? 0,
        channel:
          chordActive ? chordNotes[0]?.channel ?? bassNotes[0]?.channel ?? 0 : bassNotes[0]?.channel ?? 0,
        role: chordActive && bassActive ? "both" : chordActive ? "chord" : "bass",
      });
    }
  }

  const mergedNotes = mergeAdjacentDisplayNotes(
    displayNotes.sort(
      (left, right) =>
        left.startTick - right.startTick ||
        left.pitch - right.pitch ||
        left.endTick - right.endTick
    )
  );
  if (mergedNotes.length === 0) {
    throw new Error("ピアノロール表示対象のノートがありません");
  }

  const noteNumbers = mergedNotes.map((note) => note.pitch);
  return {
    division,
    totalTicks: Math.max(...mergedNotes.map((note) => note.endTick)),
    minPitch: Math.min(...noteNumbers),
    maxPitch: Math.max(...noteNumbers),
    notes: mergedNotes,
  };
}

export function parseSmfToPianoRollData(smfData: Uint8Array): PianoRollData {
  const midi = new Midi(smfData);
  const notes: PianoRollNote[] = midi.tracks
    .flatMap((track, trackIndex) =>
      track.notes.map((note): PianoRollNote => ({
        pitch: note.midi,
        startTick: note.ticks,
        endTick: Math.max(note.ticks + 1, note.ticks + note.durationTicks),
        track: trackIndex,
        channel: track.channel,
      }))
    )
    .sort(
      (left: PianoRollNote, right: PianoRollNote) =>
        left.startTick - right.startTick ||
        left.pitch - right.pitch ||
        left.endTick - right.endTick ||
        left.track - right.track
    );

  if (notes.length === 0) {
    throw new Error("SMFにノートイベントがありません");
  }

  const pitches = getPianoRollNoteNumbers({ notes });
  return {
    division: midi.header.ppq,
    totalTicks: Math.max(...notes.map((note) => note.endTick)),
    minPitch: Math.min(...pitches),
    maxPitch: Math.max(...pitches),
    notes,
  };
}

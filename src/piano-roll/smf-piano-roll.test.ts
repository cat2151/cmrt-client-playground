import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import {
  buildPianoRollDisplayData,
  formatPianoRollDebugSummary,
  formatPianoRollNoteNumbers,
  getPianoRollPitchRowBoundaries,
  getPianoRollPitchRowMetrics,
  getPianoRollNoteNumbers,
  parseSmfToPianoRollData,
} from "./smf-piano-roll.ts";

function createSmfFromPitches(pitches: readonly number[]): Uint8Array {
  const midi = new Midi();
  const track = midi.addTrack();
  for (const [index, pitch] of pitches.entries()) {
    track.addNote({
      midi: pitch,
      ticks: index * 120,
      durationTicks: 240,
      velocity: 0.75,
    });
  }
  return midi.toArray();
}

function createSmfFromNotes(
  notes: ReadonlyArray<{ midi: number; ticks: number; durationTicks: number }>
): Uint8Array {
  const midi = new Midi();
  const track = midi.addTrack();
  for (const note of notes) {
    track.addNote({
      midi: note.midi,
      ticks: note.ticks,
      durationTicks: note.durationTicks,
      velocity: 0.75,
    });
  }
  return midi.toArray();
}

describe("parseSmfToPianoRollData", () => {
  it("reads note numbers through @tonejs/midi", () => {
    const result = parseSmfToPianoRollData(createSmfFromPitches([60, 64]));

    expect(result.division).toBe(480);
    expect(result.totalTicks).toBe(360);
    expect(result.minPitch).toBe(60);
    expect(result.maxPitch).toBe(64);
    expect(result.notes).toEqual([
      { pitch: 60, startTick: 0, endTick: 240, track: 0, channel: 0 },
      { pitch: 64, startTick: 120, endTick: 360, track: 0, channel: 0 },
    ]);
  });

  it("returns different displayed note numbers for F and F^1 voicings", () => {
    const fData = parseSmfToPianoRollData(createSmfFromPitches([65, 69, 72]));
    const fInversionData = parseSmfToPianoRollData(createSmfFromPitches([69, 72, 77]));

    expect(getPianoRollNoteNumbers(fData)).toEqual([65, 69, 72]);
    expect(getPianoRollNoteNumbers(fInversionData)).toEqual([69, 72, 77]);
    expect(getPianoRollNoteNumbers(fData)).not.toEqual(getPianoRollNoteNumbers(fInversionData));
    expect(formatPianoRollDebugSummary({ mml: "v11'f1a<c'", data: fData })).toBe(
      "piano roll preview: mml=v11'f1a<c' note numbers=[65, 69, 72]"
    );
    expect(formatPianoRollDebugSummary({ mml: "v11'a1<cf'", data: fInversionData })).toBe(
      "piano roll preview: mml=v11'a1<cf' note numbers=[69, 72, 77]"
    );
  });

  it("formats note number arrays exactly as the log displays them", () => {
    expect(formatPianoRollNoteNumbers([60, 65, 65, 69])).toBe("[60, 65, 65, 69]");
  });

  it("offsets note rows below the horizontal grid line", () => {
    expect(
      getPianoRollPitchRowBoundaries({
        minPitch: 60,
        maxPitch: 66,
        contentHeightPx: 192,
      })
    ).toEqual([0, 27, 55, 82, 110, 137, 165, 192]);
    expect(
      getPianoRollPitchRowMetrics({
        minPitch: 60,
        maxPitch: 62,
        pitch: 62,
        contentHeightPx: 192,
      })
    ).toEqual({
      topPx: 1,
      heightPx: 63,
    });
    expect(
      getPianoRollPitchRowMetrics({
        minPitch: 60,
        maxPitch: 62,
        pitch: 60,
        contentHeightPx: 192,
      })
    ).toEqual({
      topPx: 129,
      heightPx: 63,
    });
  });

  it("marks chord and bass overlaps with a dedicated role", () => {
    const chordData = parseSmfToPianoRollData(
      createSmfFromNotes([
        { midi: 60, ticks: 0, durationTicks: 240 },
        { midi: 64, ticks: 0, durationTicks: 240 },
      ])
    );
    const bassData = parseSmfToPianoRollData(
      createSmfFromNotes([
        { midi: 48, ticks: 0, durationTicks: 240 },
        { midi: 60, ticks: 0, durationTicks: 240 },
      ])
    );

    expect(buildPianoRollDisplayData({ chordData, bassData }).notes).toEqual([
      { pitch: 48, startTick: 0, endTick: 240, track: 0, channel: 0, role: "bass" },
      { pitch: 60, startTick: 0, endTick: 240, track: 0, channel: 0, role: "both" },
      { pitch: 64, startTick: 0, endTick: 240, track: 0, channel: 0, role: "chord" },
    ]);
  });

  it("splits partially overlapped notes into chord, both, and bass regions", () => {
    const chordData = parseSmfToPianoRollData(
      createSmfFromNotes([{ midi: 60, ticks: 0, durationTicks: 240 }])
    );
    const bassData = parseSmfToPianoRollData(
      createSmfFromNotes([{ midi: 60, ticks: 120, durationTicks: 240 }])
    );

    expect(buildPianoRollDisplayData({ chordData, bassData }).notes).toEqual([
      { pitch: 60, startTick: 0, endTick: 120, track: 0, channel: 0, role: "chord" },
      { pitch: 60, startTick: 120, endTick: 240, track: 0, channel: 0, role: "both" },
      { pitch: 60, startTick: 240, endTick: 360, track: 0, channel: 0, role: "bass" },
    ]);
  });

  it("throws for malformed data", () => {
    expect(() => parseSmfToPianoRollData(new Uint8Array([0x00, 0x01, 0x02]))).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { SequenceEvent } from "tonejs-json-sequencer";
import {
  extractSanitizedMmlNoteNumbers,
  formatLogValue,
  formatNoteNumbers,
  getToneSequenceNoteNumbers,
  parseChordSegmentRelativePitches,
  toneNoteNameToMidiNoteNumber,
} from "./note-numbers.ts";

describe("note number helpers", () => {
  it("formats note number arrays exactly as the log displays them", () => {
    expect(formatNoteNumbers([60, 65, 65, 69])).toBe("[60, 65, 65, 69]");
  });

  it("escapes log values onto one log line", () => {
    expect(formatLogValue("@DuoSynth\n'ceg'")).toBe("\"@DuoSynth\\n'ceg'\"");
  });

  it("converts Tone.js note names to MIDI note numbers", () => {
    expect(toneNoteNameToMidiNoteNumber("C4")).toBe(60);
    expect(toneNoteNameToMidiNoteNumber("F#4")).toBe(66);
    expect(toneNoteNameToMidiNoteNumber("Bb3")).toBe(58);
    expect(toneNoteNameToMidiNoteNumber(["C4"])).toBeNull();
  });

  it("extracts note numbers from Tone.js sequencer trigger events", () => {
    const sequence: SequenceEvent[] = [
      { eventType: "createNode", nodeId: 0, nodeType: "Synth" },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["F4", "4n", "0"] },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["A4", "4n", "0"] },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["C5", "4n", "0"] },
    ];

    expect(getToneSequenceNoteNumbers(sequence)).toEqual([65, 69, 72]);
  });

  it("extracts note numbers from Tone.js sequencer chord trigger events", () => {
    const sequence: SequenceEvent[] = [
      {
        eventType: "triggerAttackRelease",
        nodeId: 0,
        args: [["F4", "A4", "C5"], "4n", "0"],
      } as unknown as SequenceEvent,
    ];

    expect(getToneSequenceNoteNumbers(sequence)).toEqual([65, 69, 72]);
  });

  it("parses chord-segment relative pitches with app MML octave direction", () => {
    expect(parseChordSegmentRelativePitches("'f1a<c'")).toEqual([5, 9, 12]);
    expect(parseChordSegmentRelativePitches("'>c1<ceg'")).toEqual([
      -12,
      0,
      4,
      7,
    ]);
  });

  it("extracts app MML note numbers from sanitized chord MML", () => {
    expect(extractSanitizedMmlNoteNumbers("'f1a<c''g1b<d'")).toEqual([
      65,
      69,
      72,
      67,
      71,
      74,
    ]);
  });
});

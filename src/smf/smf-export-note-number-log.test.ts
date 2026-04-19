import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { formatSmfExportNoteNumberLog } from "./smf-export-note-number-log.ts";

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

describe("formatSmfExportNoteNumberLog", () => {
  it("logs final SMF note numbers with the exported MML", () => {
    expect(
      formatSmfExportNoteNumberLog(
        "v11'f1a<c'",
        createSmfFromPitches([65, 69, 72])
      )
    ).toBe(
      "export SMF 最終出力(SMF) note number列: MML=\"v11'f1a<c'\" note number列=[65, 69, 72]"
    );
  });
});

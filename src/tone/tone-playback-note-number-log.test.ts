import { describe, expect, it } from "vitest";
import type { SequenceEvent } from "tonejs-json-sequencer";
import { formatTonePlaybackNoteNumberLog } from "./tone-playback-note-number-log.ts";

describe("formatTonePlaybackNoteNumberLog", () => {
  it("logs final playback MML and converted note numbers", () => {
    const sequence: SequenceEvent[] = [
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["F4", "4n", "0"] },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["A4", "4n", "0"] },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["C5", "4n", "0"] },
    ];

    expect(
      formatTonePlaybackNoteNumberLog({
        mml: "@DuoSynth\nv10\n'f1a<c'",
        sequence,
      })
    ).toBe(
      "演奏MML 最終出力(MML): MML=\"@DuoSynth\\nv10\\n'f1a<c'\" 変換関数名=tonejs-mml-to-json.mml2json(stripToneMmlVolumeTokens) 変換後のnote number列=[65, 69, 72]"
    );
  });
});

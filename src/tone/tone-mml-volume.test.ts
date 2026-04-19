import { describe, expect, it } from "vitest";
import type { SequenceEvent } from "tonejs-json-sequencer";
import {
  applyToneMmlVolumeToSequence,
  extractToneMmlVolume,
  stripToneMmlVolumeTokens,
  toneMmlVolumeToVelocity,
} from "./tone-mml-volume.ts";

describe("tone MML volume", () => {
  it("extracts the last v1-v15 token", () => {
    expect(extractToneMmlVolume("@Synth\nv10\n'ceg'")).toBe(10);
    expect(extractToneMmlVolume("@Synth v3 'ceg' v15")).toBe(15);
    expect(extractToneMmlVolume("@Synth v100 'ceg'")).toBeNull();
  });

  it("strips app-scale v1-v15 tokens before passing MML to the converter", () => {
    expect(stripToneMmlVolumeTokens("@Synth\nv10\n'ceg'")).toBe("@Synth\n\n'ceg'");
    expect(stripToneMmlVolumeTokens("@Synth v100 'ceg'")).toBe("@Synth v100 'ceg'");
  });

  it("maps v1-v15 to Tone.js trigger velocity", () => {
    expect(toneMmlVolumeToVelocity(1)).toBeCloseTo(1 / 15);
    expect(toneMmlVolumeToVelocity(10)).toBeCloseTo(10 / 15);
    expect(toneMmlVolumeToVelocity(15)).toBe(1);
  });

  it("applies velocity to triggerAttackRelease events", () => {
    const sequence: SequenceEvent[] = [
      { eventType: "createNode", nodeId: 0, nodeType: "Synth" },
      { eventType: "triggerAttackRelease", nodeId: 0, args: ["C4", "4n", "0"] },
    ];

    expect(applyToneMmlVolumeToSequence(sequence, 10)).toEqual([
      { eventType: "createNode", nodeId: 0, nodeType: "Synth" },
      {
        eventType: "triggerAttackRelease",
        nodeId: 0,
        args: ["C4", "4n", "0", 10 / 15],
      },
    ]);
  });
});

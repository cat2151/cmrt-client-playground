import { describe, expect, it } from "vitest";
import { getPianoRollPlaybackPlacement } from "./piano-roll-preview-controller.ts";

describe("getPianoRollPlaybackPlacement", () => {
  it("advances from the status response anchor time", () => {
    expect(
      getPianoRollPlaybackPlacement(
        {
          measureOffset: 0,
          elapsedMs: 840,
          durationMs: 2000,
          receivedAtMs: 1000,
        },
        1160
      )
    ).toEqual({
      measureOffset: 0,
      progress: 0.5,
    });
  });

  it("predicts the next measure after the reported measure duration", () => {
    expect(
      getPianoRollPlaybackPlacement(
        {
          measureOffset: 0,
          elapsedMs: 2100,
          durationMs: 2000,
          receivedAtMs: 1000,
        },
        1000
      )
    ).toEqual({
      measureOffset: 1,
      progress: 0.05,
    });
  });

  it("keeps advancing across multiple predicted measure boundaries", () => {
    expect(
      getPianoRollPlaybackPlacement(
        {
          measureOffset: 2,
          elapsedMs: 3900,
          durationMs: 1000,
          receivedAtMs: 1000,
        },
        1200
      )
    ).toEqual({
      measureOffset: 6,
      progress: 0.1,
    });
  });

  it("predicts wrapping from the loop end measure to the loop start measure", () => {
    expect(
      getPianoRollPlaybackPlacement(
        {
          measureOffset: 2,
          elapsedMs: 2100,
          durationMs: 2000,
          receivedAtMs: 1000,
          loop: {
            startMeasureOffset: 1,
            endMeasureOffset: 2,
          },
        },
        1000
      )
    ).toEqual({
      measureOffset: 1,
      progress: 0.05,
    });
  });

  it("keeps predicted playback inside the loop range across repeated wraps", () => {
    expect(
      getPianoRollPlaybackPlacement(
        {
          measureOffset: 1,
          elapsedMs: 6500,
          durationMs: 1000,
          receivedAtMs: 1000,
          loop: {
            startMeasureOffset: 1,
            endMeasureOffset: 3,
          },
        },
        1000
      )
    ).toEqual({
      measureOffset: 1,
      progress: 0.5,
    });
  });
});

import { describe, expect, it } from "vitest";
import type { DawStatusResponse } from "../daw/status.ts";
import {
  getDawCacheCells,
  getDawPlaybackMeasure,
  getPianoRollPlaybackPosition,
} from "./app-daw-status-sync.ts";

const statusTiming = {
  requestStartedAtMs: 1000,
  responseReceivedAtMs: 1010,
};

const playingStatus: DawStatusResponse = {
  mode: "daw",
  play: {
    state: "playing",
    isPlaying: true,
    isPreview: false,
    currentMeasure: 5,
    currentMeasureIndex: 4,
    currentBeat: 2,
    measureElapsedMs: 840,
    measureDurationMs: 2000,
    loop: {
      enabled: false,
      startMeasure: null,
      endMeasure: null,
    },
  },
  cache: {
    activeRenderCount: 0,
    pendingCount: 0,
    renderingCount: 0,
    readyCount: 0,
    errorCount: 0,
    isUpdating: false,
    isComplete: true,
    cells: [],
  },
  grid: {
    tracks: 4,
    measures: 8,
  },
};

describe("getDawPlaybackMeasure", () => {
  it("returns the current DAW measure while playing", () => {
    expect(getDawPlaybackMeasure(playingStatus)).toBe(5);
  });

  it("returns null while idle", () => {
    expect(
      getDawPlaybackMeasure({
        ...playingStatus,
        play: {
          ...playingStatus.play,
          state: "idle",
          isPlaying: false,
          currentMeasure: null,
        },
      })
    ).toBeNull();
  });
});

describe("getDawCacheCells", () => {
  it("returns the DAW status cache matrix for grid rendering state", () => {
    const cells = [[{ state: "ready" }], [{ state: "pending" }, { state: "rendering" }]];

    expect(
      getDawCacheCells({
        ...playingStatus,
        cache: {
          ...playingStatus.cache,
          cells,
        },
      })
    ).toBe(cells);
  });

  it("returns null when status is unavailable", () => {
    expect(getDawCacheCells(null)).toBeNull();
  });
});

describe("getPianoRollPlaybackPosition", () => {
  it("maps DAW measure timing to a preview playback anchor", () => {
    expect(getPianoRollPlaybackPosition(playingStatus, statusTiming, "3")).toEqual({
      measureOffset: 2,
      elapsedMs: 840,
      durationMs: 2000,
      receivedAtMs: 1010,
    });
  });

  it("hides the preview indicator before the preview start measure", () => {
    expect(getPianoRollPlaybackPosition(playingStatus, statusTiming, "6")).toBeNull();
  });

  it("hides the preview indicator when chord measure is invalid", () => {
    expect(getPianoRollPlaybackPosition(playingStatus, statusTiming, "x")).toBeNull();
  });

  it("hides the preview indicator without measure timing", () => {
    expect(
      getPianoRollPlaybackPosition(
        {
          ...playingStatus,
          play: {
            ...playingStatus.play,
            measureElapsedMs: null,
          },
        },
        statusTiming,
        "3"
      )
    ).toBeNull();
  });

  it("maps DAW loop bounds to preview measure offsets", () => {
    expect(
      getPianoRollPlaybackPosition(
        {
          ...playingStatus,
          play: {
            ...playingStatus.play,
            loop: {
              enabled: true,
              startMeasure: 4,
              endMeasure: 5,
            },
          },
        },
        statusTiming,
        "3"
      )
    ).toEqual({
      measureOffset: 2,
      elapsedMs: 840,
      durationMs: 2000,
      receivedAtMs: 1010,
      loop: {
        startMeasureOffset: 1,
        endMeasureOffset: 2,
      },
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_BASE_URL } from "./daw-client.ts";
import {
  createDawStatusPollingController,
  formatDawStatus,
  getDawStatus,
  type DawStatusResponse,
} from "./status.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const readyStatus: DawStatusResponse = {
  mode: "daw",
  play: {
    state: "idle",
    isPlaying: false,
    isPreview: false,
    currentMeasure: null,
    currentMeasureIndex: null,
    currentBeat: null,
    measureElapsedMs: null,
    measureDurationMs: null,
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
    readyCount: 8,
    errorCount: 0,
    isUpdating: false,
    isComplete: true,
    cells: [[{ state: "ready" }]],
  },
  grid: {
    tracks: 4,
    measures: 8,
  },
};

describe("getDawStatus", () => {
  it("requests /status from the DAW base url", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => readyStatus,
    } as Response);

    const result = await getDawStatus({
      getBaseUrl: () => DEFAULT_BASE_URL,
    });

    expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_BASE_URL}/status`);
    expect(result).toEqual(readyStatus);
  });

  it("rejects responses that do not match the DAW status shape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    } as Response);

    const result = await getDawStatus({
      getBaseUrl: () => DEFAULT_BASE_URL,
    });

    expect(result).toEqual({
      kind: "invalidResponse",
      message: "expected DAW status response",
    });
  });
});

describe("createDawStatusPollingController", () => {
  it("ignores stale status responses that return after a newer request", async () => {
    const firstStatus: DawStatusResponse = {
      ...readyStatus,
      play: {
        ...readyStatus.play,
        state: "playing",
        isPlaying: true,
        currentMeasure: 1,
        currentMeasureIndex: 0,
        currentBeat: 1,
        measureElapsedMs: 100,
        measureDurationMs: 2000,
      },
    };
    const secondStatus: DawStatusResponse = {
      ...firstStatus,
      play: {
        ...firstStatus.play,
        currentMeasure: 2,
        currentMeasureIndex: 1,
        measureElapsedMs: 400,
      },
    };
    const pendingResponses: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pendingResponses.push(resolve);
        })
    );
    const statuses: DawStatusResponse[] = [];
    const controller = createDawStatusPollingController({
      client: { getBaseUrl: () => DEFAULT_BASE_URL },
      statusEl: { textContent: "", dataset: {} } as HTMLElement,
      onStatus: (status) => {
        if (status !== null) {
          statuses.push(status);
        }
      },
    });

    const firstSync = controller.syncNow();
    const secondSync = controller.syncNow();
    pendingResponses[1]?.({
      ok: true,
      status: 200,
      json: async () => secondStatus,
    } as Response);
    await secondSync;
    pendingResponses[0]?.({
      ok: true,
      status: 200,
      json: async () => firstStatus,
    } as Response);
    await firstSync;

    expect(statuses).toEqual([secondStatus]);
  });
});

describe("formatDawStatus", () => {
  it("formats play position, loop, cache, and grid summary in one line", () => {
    const line = formatDawStatus({
      ...readyStatus,
      play: {
        ...readyStatus.play,
        state: "playing",
        isPlaying: true,
        currentMeasure: 3,
        currentMeasureIndex: 2,
        currentBeat: 1,
        measureElapsedMs: 840,
        measureDurationMs: 2000,
        loop: {
          enabled: true,
          startMeasure: 1,
          endMeasure: 3,
        },
      },
      cache: {
        ...readyStatus.cache,
        pendingCount: 1,
        renderingCount: 2,
        isUpdating: true,
        isComplete: false,
      },
    });

    expect(line).toBe(
      "DAW status: play=playing meas=3 beat=1 loop=1-3 cache=updating pending=1 rendering=2 ready=8 error=0 grid=4x8"
    );
  });
});

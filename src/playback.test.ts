import { describe, expect, it } from "vitest";
import { runPlaybackAction, type PlaybackClient } from "./playback.ts";

describe("runPlaybackAction", () => {
  it("logs startup play success", async () => {
    const logs: string[] = [];
    const client: PlaybackClient = {
      postPlayStart: async () => undefined,
      postPlayStop: async () => undefined,
    };

    const result = await runPlaybackAction({
      action: "start",
      source: "startup",
      client,
      appendLog: (message) => logs.push(message),
    });

    expect(result).toBe(true);
    expect(logs).toEqual(["起動時に play を開始しました"]);
  });

  it("logs formatted manual stop errors", async () => {
    const logs: string[] = [];
    const client: PlaybackClient = {
      postPlayStart: async () => undefined,
      postPlayStop: async () => ({
        kind: "http",
        status: 500,
        body: "boom",
      }),
    };

    const result = await runPlaybackAction({
      action: "stop",
      source: "manual",
      client,
      appendLog: (message) => logs.push(message),
    });

    expect(result).toBe(false);
    expect(logs).toEqual([
      "ERROR: play 停止に失敗しました: http request failed with status 500: boom",
    ]);
  });
});

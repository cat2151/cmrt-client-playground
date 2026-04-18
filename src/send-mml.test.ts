import { describe, expect, it } from "vitest";
import { sendMml, type SendMmlClient } from "./send-mml.ts";

describe("sendMml", () => {
  it("splits multi-measure input into multiple chord posts in order", async () => {
    const logs: string[] = [];
    const reflected: Array<{ track: number; measure: number; mml: string }> = [];
    const posts: Array<{ track: number; measure: number; mml: string }> = [];
    const client: SendMmlClient = {
      getBaseUrl: () => "http://127.0.0.1:62151",
      postMml: async (track, measure, mml) => {
        posts.push({ track, measure, mml });
      },
    };

    await sendMml({
      input: "C / C / C / C",
      chordTrack: 2,
      chordMeasure: 5,
      bassTrackValue: "9",
      client,
      appendLog: (message) => logs.push(message),
      reflectValue: (track, measure, mml) => reflected.push({ track, measure, mml }),
    });

    expect(posts).toEqual([
      { track: 2, measure: 5, mml: "'c2eg''c2eg'" },
      { track: 2, measure: 6, mml: "'c2eg''c2eg'" },
    ]);
    expect(reflected).toEqual(posts);
    expect(logs).toContain("meas分割完了: 2 meas の送信に成功しました");
  });

  it("stops and logs a formatted error when chord posting fails", async () => {
    const logs: string[] = [];
    const client: SendMmlClient = {
      getBaseUrl: () => "http://127.0.0.1:62151",
      postMml: async () => {
        return {
          kind: "http",
          status: 500,
          body: "boom",
        };
      },
    };

    await sendMml({
      input: "C",
      chordTrack: 2,
      chordMeasure: 5,
      bassTrackValue: "9",
      client,
      appendLog: (message) => logs.push(message),
      reflectValue: () => {
        throw new Error("reflectValue should not be called after chord POST failure");
      },
    });

    expect(logs[logs.length - 1]).toBe(
      "ERROR (chord measure 5): http request failed with status 500: boom"
    );
  });
});

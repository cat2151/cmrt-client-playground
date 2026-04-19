import { describe, expect, it } from "vitest";
import {
  APP_STORAGE_EXPORT_VERSION,
  parseAppStorageSnapshot,
  stringifyAppStorageSnapshot,
} from "./app-storage.ts";

describe("app storage JSON", () => {
  const allowedKeys = ["cmrt-client-playground.input", "cmrt-client-playground.chord.track"];

  it("stringifies and parses the managed local storage values", () => {
    const json = stringifyAppStorageSnapshot(
      {
        "cmrt-client-playground.input": "C Am G7",
        "cmrt-client-playground.chord.track": "2",
      },
      "2026-04-18T00:00:00.000Z"
    );

    expect(json).toContain(`"version": ${APP_STORAGE_EXPORT_VERSION}`);

    expect(parseAppStorageSnapshot(json, allowedKeys)).toEqual({
      ok: true,
      snapshot: {
        version: APP_STORAGE_EXPORT_VERSION,
        exportedAt: "2026-04-18T00:00:00.000Z",
        values: {
          "cmrt-client-playground.input": "C Am G7",
          "cmrt-client-playground.chord.track": "2",
        },
      },
    });
  });

  it("ignores unmanaged keys", () => {
    const result = parseAppStorageSnapshot(
      JSON.stringify({
        version: APP_STORAGE_EXPORT_VERSION,
        exportedAt: "2026-04-18T00:00:00.000Z",
        values: {
          "cmrt-client-playground.input": "C",
          unmanaged: "ignored",
        },
      }),
      allowedKeys
    );

    expect(result).toEqual({
      ok: true,
      snapshot: {
        version: APP_STORAGE_EXPORT_VERSION,
        exportedAt: "2026-04-18T00:00:00.000Z",
        values: {
          "cmrt-client-playground.input": "C",
        },
      },
    });
  });

  it("rejects invalid JSON", () => {
    expect(parseAppStorageSnapshot("{", allowedKeys)).toEqual({
      ok: false,
      message: "JSON として読み取れませんでした",
    });
  });

  it("rejects non-string values for managed keys", () => {
    expect(
      parseAppStorageSnapshot(
        JSON.stringify({
          version: APP_STORAGE_EXPORT_VERSION,
          exportedAt: "2026-04-18T00:00:00.000Z",
          values: {
            "cmrt-client-playground.chord.track": 1,
          },
        }),
        allowedKeys
      )
    ).toEqual({
      ok: false,
      message: "values.cmrt-client-playground.chord.track が文字列ではありません",
    });
  });
});

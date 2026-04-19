import { describe, expect, it } from "vitest";
import {
  getStartupErrorOverlay,
  STARTUP_CONNECTING_OVERLAY,
} from "./startup-overlay.ts";

describe("STARTUP_CONNECTING_OVERLAY", () => {
  it("uses a neutral waiting message without details", () => {
    expect(STARTUP_CONNECTING_OVERLAY).toEqual({
      title: "cmrt接続確認中...",
      message: "しばらくお待ちください",
      detail: null,
    });
  });
});

describe("getStartupErrorOverlay", () => {
  it("asks the user to start cmrt for transport failures", () => {
    expect(
      getStartupErrorOverlay({ kind: "transport", message: "connection refused" })
    ).toEqual({
      title: "cmrt接続待機中",
      message: "cmrtを起動してください",
      detail: null,
    });
  });

  it("shows detailed guidance for invalid responses", () => {
    expect(
      getStartupErrorOverlay({ kind: "invalidResponse", message: "bad json" })
    ).toEqual({
      title: "cmrt応答エラー",
      message: "このアプリとcmrtそれぞれのバージョンを確認してください",
      detail: "invalid response body: bad json",
    });
  });

  it("shows detailed guidance for http failures", () => {
    expect(
      getStartupErrorOverlay({ kind: "http", status: 404, body: "not found" })
    ).toEqual({
      title: "cmrt応答エラー",
      message: "このアプリとcmrtそれぞれのバージョンを確認してください",
      detail: "http request failed with status 404: not found",
    });
  });
});

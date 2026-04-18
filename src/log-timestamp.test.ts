import { describe, expect, it } from "vitest";
import { formatLogTimestamp } from "./log-timestamp.ts";

describe("formatLogTimestamp", () => {
  it("formats timestamps in JST", () => {
    expect(formatLogTimestamp(new Date("2026-04-18T12:38:18.375Z"))).toBe(
      "2026-04-18T21:38:18.375+09:00"
    );
  });
});

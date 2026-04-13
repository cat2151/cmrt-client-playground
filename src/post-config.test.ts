import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  parsePositiveInteger,
  sanitizeMmlForPost,
} from "./post-config.ts";

describe("parsePositiveInteger", () => {
  it("accepts positive integers", () => {
    expect(parsePositiveInteger("1")).toBe(1);
    expect(parsePositiveInteger(" 12 ")).toBe(12);
  });

  it("rejects invalid values", () => {
    expect(parsePositiveInteger("")).toBeNull();
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("-1")).toBeNull();
    expect(parsePositiveInteger("1.5")).toBeNull();
    expect(parsePositiveInteger("1.0")).toBeNull();
    expect(parsePositiveInteger("1e2")).toBeNull();
    expect(parsePositiveInteger("abc")).toBeNull();
    expect(parsePositiveInteger("9007199254740992")).toBeNull();
  });

  it("keeps the current default targets documented in code", () => {
    expect(DEFAULT_TRACK).toBe(1);
    expect(DEFAULT_MEASURE).toBe(1);
  });
});

describe("sanitizeMmlForPost", () => {
  it("removes volume tokens such as v11 before posting", () => {
    expect(sanitizeMmlForPost("v11'c1eg'")).toEqual({
      mml: "'c1eg'",
      removedTokens: ["v11"],
    });
  });

  it("removes multiple volume tokens", () => {
    expect(sanitizeMmlForPost("v11'c'v12e")).toEqual({
      mml: "'c'e",
      removedTokens: ["v11", "v12"],
    });
  });

  it("leaves MML unchanged when nothing needs to be removed", () => {
    expect(sanitizeMmlForPost("'ace'")).toEqual({
      mml: "'ace'",
      removedTokens: [],
    });
  });
});

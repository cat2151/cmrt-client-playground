import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  formatPostErrorMessage,
  parseNonNegativeInteger,
  parsePositiveInteger,
  resolveBassTargets,
  sanitizeMmlForPost,
} from "./post-config.ts";

describe("parsePositiveInteger", () => {
  it("accepts positive integers", () => {
    expect(parsePositiveInteger("1")).toBe(1);
    expect(parsePositiveInteger(" 12 ")).toBe(12);
    expect(parsePositiveInteger("9007199254740991")).toBe(9007199254740991);
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
    expect(parsePositiveInteger("9007199254740993")).toBeNull();
  });

  it("keeps the current default targets documented in code", () => {
    expect(DEFAULT_TRACK).toBe(1);
    expect(DEFAULT_MEASURE).toBe(1);
  });
});

describe("parseNonNegativeInteger", () => {
  it("accepts zero and positive integers", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
    expect(parseNonNegativeInteger(" 12 ")).toBe(12);
    expect(parseNonNegativeInteger("9007199254740991")).toBe(9007199254740991);
  });

  it("rejects invalid values", () => {
    expect(parseNonNegativeInteger("")).toBeNull();
    expect(parseNonNegativeInteger("-1")).toBeNull();
    expect(parseNonNegativeInteger("1.5")).toBeNull();
    expect(parseNonNegativeInteger("1e2")).toBeNull();
    expect(parseNonNegativeInteger("abc")).toBeNull();
    expect(parseNonNegativeInteger("9007199254740992")).toBeNull();
    expect(parseNonNegativeInteger("9007199254740993")).toBeNull();
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

describe("resolveBassTargets", () => {
  it("falls back to chord targets when the bass track is blank or invalid", () => {
    expect(resolveBassTargets("", { track: 3, measure: 7 })).toEqual({
      track: 3,
      measure: 7,
    });
    expect(resolveBassTargets("0", { track: 3, measure: 7 })).toEqual({
      track: 3,
      measure: 7,
    });
  });

  it("uses only the explicit bass track and always shares the chord measure", () => {
    expect(resolveBassTargets("5", { track: 3, measure: 7 })).toEqual({
      track: 5,
      measure: 7,
    });
  });
});

describe("formatPostErrorMessage", () => {
  it("includes role and measure even for single-measure errors", () => {
    expect(formatPostErrorMessage(false, 0, 1, "bass", 12, "boom")).toBe(
      "ERROR (bass measure 12): boom"
    );
  });

  it("keeps the split-measure error format", () => {
    expect(formatPostErrorMessage(true, 1, 4, "chord", 6, "boom")).toBe(
      "ERROR: meas分割 2/4 (chord measure 6): boom"
    );
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { DawClient, dawClientErrorMessage, DEFAULT_BASE_URL } from "./daw-client.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DawClient.new", () => {
  it("localDefault uses known base url", () => {
    const client = DawClient.localDefault();
    expect(client.getBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("trims whitespace and trailing slashes", () => {
    const result = DawClient.new(" http://127.0.0.1:62151/// ");
    expect(result).toBeInstanceOf(DawClient);
    expect((result as DawClient).getBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("rejects empty base url", () => {
    const result = DawClient.new("   ");
    expect((result as { kind: string }).kind).toBe("emptyBaseUrl");
  });
});

describe("dawClientErrorMessage", () => {
  it("formats emptyBaseUrl error", () => {
    const msg = dawClientErrorMessage({ kind: "emptyBaseUrl" });
    expect(msg).toContain("empty");
  });

  it("formats http error", () => {
    const msg = dawClientErrorMessage({ kind: "http", status: 404, body: "not found" });
    expect(msg).toContain("404");
    expect(msg).toContain("not found");
  });

  it("formats transport error", () => {
    const msg = dawClientErrorMessage({ kind: "transport", message: "connection refused" });
    expect(msg).toContain("connection refused");
  });

  it("formats invalidResponse error", () => {
    const msg = dawClientErrorMessage({ kind: "invalidResponse", message: "bad json" });
    expect(msg).toContain("bad json");
  });
});

describe("DawClient.getMml", () => {
  it("requests the expected track/measure query and returns mml", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ mml: "@1 l8cde" }),
      } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMml(2, 0);

    expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_BASE_URL}/mml?track=2&measure=0`);
    expect(result).toBe("@1 l8cde");
  });

  it("rejects responses without mml", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ track: 2, measure: 0 }),
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMml(2, 0);

    expect(result).toEqual({
      kind: "invalidResponse",
      message: "expected an object with string mml",
    });
  });

  it("does not treat regular payloads with a kind field as a DawClientError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mml: "@1 l8cde", kind: "lead" }),
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMml(2, 0);

    expect(result).toBe("@1 l8cde");
  });
});

describe("DawClient.getMeasureInfo", () => {
  it("extracts an optional snake_case filter name from init meas responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        track: 2,
        measure: 0,
        filter_name: "Warm Pad",
        mml: "@1 l8cde",
      }),
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMeasureInfo(2, 0);

    expect(result).toEqual({
      mml: "@1 l8cde",
      filterName: "Warm Pad",
    });
  });

  it("extracts an optional nested filter name when present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        track: 3,
        measure: 0,
        filter: { name: "Electric Bass" },
        mml: "@2 l8efg",
      }),
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMeasureInfo(3, 0);

    expect(result).toEqual({
      mml: "@2 l8efg",
      filterName: "Electric Bass",
    });
  });

  it("extracts an optional camelCase filter name when present", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        track: 5,
        measure: 0,
        filterName: "Glass Pad",
        mml: "@3 l8gab",
      }),
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getMeasureInfo(5, 0);

    expect(result).toEqual({
      mml: "@3 l8gab",
      filterName: "Glass Pad",
    });
  });
});

describe("DawClient.getPatches", () => {
  it("rejects mixed arrays", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ["Pads/Factory Pad.fxp", 1],
    } as Response);

    const client = DawClient.localDefault();
    const result = await client.getPatches();

    expect(result).toEqual({
      kind: "invalidResponse",
      message: "expected an array of strings",
    });
  });
});

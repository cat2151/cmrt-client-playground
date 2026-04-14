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
});

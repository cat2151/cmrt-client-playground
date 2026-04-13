import { describe, it, expect } from "vitest";
import { DawClient, dawClientErrorMessage, DEFAULT_BASE_URL } from "./daw-client.ts";

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

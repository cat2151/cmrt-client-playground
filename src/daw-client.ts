/**
 * DawClient – TypeScript port of the Rust daw-client-lib
 * SSoT: https://github.com/cat2151/clap-mml-render-tui/blob/main/daw-client-lib/src/lib.rs
 */

export const DEFAULT_BASE_URL = "http://127.0.0.1:62151";

export type DawClientError =
  | { kind: "emptyBaseUrl" }
  | { kind: "http"; status: number; body: string }
  | { kind: "transport"; message: string }
  | { kind: "invalidResponse"; message: string };

export function dawClientErrorMessage(error: DawClientError): string {
  switch (error.kind) {
    case "emptyBaseUrl":
      return "base url must not be empty";
    case "http":
      return `http request failed with status ${error.status}: ${error.body}`;
    case "transport":
      return `http transport error: ${error.message}`;
    case "invalidResponse":
      return `invalid response body: ${error.message}`;
  }
}

interface StatusResponse {
  status: string;
}

interface PostMmlRequest {
  track: number;
  measure: number;
  mml: string;
}

interface PostMixerRequest {
  track: number;
  db: number;
}

interface PostPatchRequest {
  track: number;
  patch: string;
}

function normalizeBaseUrl(baseUrl: string): string | DawClientError {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.length === 0) {
    return { kind: "emptyBaseUrl" };
  }
  return trimmed;
}

export class DawClient {
  private readonly baseUrl: string;

  private constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  static new(baseUrl: string): DawClient | DawClientError {
    const normalized = normalizeBaseUrl(baseUrl);
    if (typeof normalized !== "string") {
      return normalized;
    }
    return new DawClient(normalized);
  }

  static localDefault(): DawClient {
    return new DawClient(DEFAULT_BASE_URL);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async postMml(
    track: number,
    measure: number,
    mml: string
  ): Promise<void | DawClientError> {
    const body: PostMmlRequest = { track, measure, mml };
    return this.postStatus("/mml", body);
  }

  async postMixer(
    track: number,
    db: number
  ): Promise<void | DawClientError> {
    const body: PostMixerRequest = { track, db };
    return this.postStatus("/mixer", body);
  }

  async postPatch(
    track: number,
    patch: string
  ): Promise<void | DawClientError> {
    const body: PostPatchRequest = { track, patch };
    return this.postStatus("/patch", body);
  }

  async getPatches(): Promise<string[] | DawClientError> {
    try {
      const response = await fetch(this.endpointUrl("/patches"));
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { kind: "http", status: response.status, body };
      }
      try {
        const data = await response.json();
        if (!Array.isArray(data)) {
          return {
            kind: "invalidResponse",
            message: "expected an array of strings",
          };
        }
        return data as string[];
      } catch (e) {
        return {
          kind: "invalidResponse",
          message: String(e),
        };
      }
    } catch (e) {
      return { kind: "transport", message: String(e) };
    }
  }

  private async postStatus(
    path: string,
    body: unknown
  ): Promise<void | DawClientError> {
    try {
      const response = await fetch(this.endpointUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let statusResponse: StatusResponse;
      try {
        statusResponse = (await response.json()) as StatusResponse;
      } catch (e) {
        return { kind: "invalidResponse", message: String(e) };
      }
      if (!response.ok) {
        return {
          kind: "http",
          status: response.status,
          body: JSON.stringify(statusResponse),
        };
      }
      if (statusResponse.status === "ok") {
        return;
      }
      return {
        kind: "invalidResponse",
        message: `unexpected status response (http ${response.status}): ${statusResponse.status}`,
      };
    } catch (e) {
      return { kind: "transport", message: String(e) };
    }
  }

  private endpointUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}

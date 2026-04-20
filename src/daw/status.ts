import {
  dawClientErrorMessage,
  type DawClientError,
} from "./daw-client.ts";

export const DAW_STATUS_POLL_INTERVAL_MS = 250;

export interface DawStatusClient {
  getBaseUrl(): string;
}

export interface DawStatusResponse {
  mode: string;
  play: DawStatusPlay;
  cache: DawStatusCache;
  grid: DawStatusGrid;
}

export interface DawStatusPlay {
  state: string;
  isPlaying: boolean;
  isPreview: boolean;
  currentMeasure: number | null;
  currentMeasureIndex: number | null;
  currentBeat: number | null;
  measureElapsedMs: number | null;
  measureDurationMs: number | null;
  loop: DawStatusLoop;
}

export interface DawStatusLoop {
  enabled: boolean;
  startMeasure: number | null;
  endMeasure: number | null;
}

export interface DawStatusCache {
  activeRenderCount: number;
  pendingCount: number;
  renderingCount: number;
  readyCount: number;
  errorCount: number;
  isUpdating: boolean;
  isComplete: boolean;
  cells: DawStatusCacheCell[][];
}

export interface DawStatusCacheCell {
  state: string;
}

export interface DawStatusGrid {
  tracks: number;
  measures: number;
}

export interface DawStatusPollingController {
  start(): void;
  stop(): void;
  syncNow(): Promise<void>;
}

export interface DawStatusTiming {
  requestStartedAtMs: number;
  responseReceivedAtMs: number;
}

interface DawStatusPollingOptions {
  client: DawStatusClient;
  statusEl: HTMLElement;
  intervalMs?: number;
  onStatus?: (status: DawStatusResponse | null, timing: DawStatusTiming | null) => void;
}

type ValidationResult = DawStatusResponse | DawClientError;

export async function getDawStatus(
  client: DawStatusClient
): Promise<DawStatusResponse | DawClientError> {
  try {
    const response = await fetch(`${client.getBaseUrl()}/status`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { kind: "http", status: response.status, body };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (e) {
      return { kind: "invalidResponse", message: String(e) };
    }

    return parseDawStatusResponse(data);
  } catch (e) {
    return { kind: "transport", message: String(e) };
  }
}

export function formatDawStatus(status: DawStatusResponse): string {
  const playParts = [`play=${status.play.state}`];
  if (status.play.currentMeasure !== null) {
    playParts.push(`meas=${status.play.currentMeasure}`);
  }
  if (status.play.currentBeat !== null) {
    playParts.push(`beat=${status.play.currentBeat}`);
  }

  const loop = status.play.loop.enabled
    ? `loop=${status.play.loop.startMeasure ?? "?"}-${status.play.loop.endMeasure ?? "?"}`
    : "loop=off";
  const cache = status.cache.isUpdating
    ? `cache=updating pending=${status.cache.pendingCount} rendering=${status.cache.renderingCount}`
    : "cache=complete";
  const cacheCounts = `ready=${status.cache.readyCount} error=${status.cache.errorCount}`;
  const grid = `grid=${status.grid.tracks}x${status.grid.measures}`;

  return `DAW status: ${playParts.join(" ")} ${loop} ${cache} ${cacheCounts} ${grid}`;
}

export function formatDawStatusError(error: DawClientError): string {
  return `DAW status: ${dawClientErrorMessage(error)}`;
}

export function createDawStatusPollingController(
  options: DawStatusPollingOptions
): DawStatusPollingController {
  const intervalMs = options.intervalMs ?? DAW_STATUS_POLL_INTERVAL_MS;
  let timer: number | null = null;
  let statusSeq = 0;

  async function syncNow(): Promise<void> {
    const seq = ++statusSeq;
    const requestStartedAtMs = performance.now();
    const result = await getDawStatus(options.client);
    const responseReceivedAtMs = performance.now();
    if (seq !== statusSeq) {
      return;
    }
    const timing: DawStatusTiming = {
      requestStartedAtMs,
      responseReceivedAtMs,
    };

    if (isDawClientError(result)) {
      options.statusEl.textContent = formatDawStatusError(result);
      options.statusEl.dataset.status = "error";
      options.onStatus?.(null, timing);
      return;
    }

    options.statusEl.textContent = formatDawStatus(result);
    options.statusEl.dataset.status = result.cache.isUpdating ? "updating" : "complete";
    options.onStatus?.(result, timing);
  }

  return {
    start(): void {
      if (timer !== null) {
        return;
      }

      options.statusEl.textContent = "DAW status: connecting";
      void syncNow();
      timer = window.setInterval(() => {
        void syncNow();
      }, intervalMs);
    },
    stop(): void {
      if (timer === null) {
        return;
      }

      window.clearInterval(timer);
      timer = null;
      statusSeq += 1;
    },
    syncNow,
  };
}

function parseDawStatusResponse(data: unknown): ValidationResult {
  if (!isRecord(data)) {
    return invalidStatusResponse();
  }

  const play = parsePlay(data.play);
  const cache = parseCache(data.cache);
  const grid = parseGrid(data.grid);
  if (
    typeof data.mode !== "string" ||
    play === null ||
    cache === null ||
    grid === null
  ) {
    return invalidStatusResponse();
  }

  return {
    mode: data.mode,
    play,
    cache,
    grid,
  };
}

function parsePlay(data: unknown): DawStatusPlay | null {
  if (!isRecord(data)) {
    return null;
  }

  const loop = parseLoop(data.loop);
  if (
    typeof data.state !== "string" ||
    typeof data.isPlaying !== "boolean" ||
    typeof data.isPreview !== "boolean" ||
    !isNullableNumber(data.currentMeasure) ||
    !isNullableNumber(data.currentMeasureIndex) ||
    !isNullableNumber(data.currentBeat) ||
    !isNullableNumber(data.measureElapsedMs) ||
    !isNullableNumber(data.measureDurationMs) ||
    loop === null
  ) {
    return null;
  }

  return {
    state: data.state,
    isPlaying: data.isPlaying,
    isPreview: data.isPreview,
    currentMeasure: data.currentMeasure,
    currentMeasureIndex: data.currentMeasureIndex,
    currentBeat: data.currentBeat,
    measureElapsedMs: data.measureElapsedMs,
    measureDurationMs: data.measureDurationMs,
    loop,
  };
}

function parseLoop(data: unknown): DawStatusLoop | null {
  if (!isRecord(data)) {
    return null;
  }

  if (
    typeof data.enabled !== "boolean" ||
    !isNullableNumber(data.startMeasure) ||
    !isNullableNumber(data.endMeasure)
  ) {
    return null;
  }

  return {
    enabled: data.enabled,
    startMeasure: data.startMeasure,
    endMeasure: data.endMeasure,
  };
}

function parseCache(data: unknown): DawStatusCache | null {
  if (!isRecord(data)) {
    return null;
  }

  const cells = parseCacheCells(data.cells);
  if (
    !isNumber(data.activeRenderCount) ||
    !isNumber(data.pendingCount) ||
    !isNumber(data.renderingCount) ||
    !isNumber(data.readyCount) ||
    !isNumber(data.errorCount) ||
    typeof data.isUpdating !== "boolean" ||
    typeof data.isComplete !== "boolean" ||
    cells === null
  ) {
    return null;
  }

  return {
    activeRenderCount: data.activeRenderCount,
    pendingCount: data.pendingCount,
    renderingCount: data.renderingCount,
    readyCount: data.readyCount,
    errorCount: data.errorCount,
    isUpdating: data.isUpdating,
    isComplete: data.isComplete,
    cells,
  };
}

function parseCacheCells(data: unknown): DawStatusCacheCell[][] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const cells: DawStatusCacheCell[][] = [];
  for (const row of data) {
    if (!Array.isArray(row)) {
      return null;
    }

    const parsedRow: DawStatusCacheCell[] = [];
    for (const cell of row) {
      if (!isRecord(cell) || typeof cell.state !== "string") {
        return null;
      }

      parsedRow.push({ state: cell.state });
    }
    cells.push(parsedRow);
  }

  return cells;
}

function parseGrid(data: unknown): DawStatusGrid | null {
  if (!isRecord(data) || !isNumber(data.tracks) || !isNumber(data.measures)) {
    return null;
  }

  return {
    tracks: data.tracks,
    measures: data.measures,
  };
}

function isDawClientError(data: DawStatusResponse | DawClientError): data is DawClientError {
  return "kind" in data;
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function isNumber(data: unknown): data is number {
  return typeof data === "number" && Number.isFinite(data);
}

function isNullableNumber(data: unknown): data is number | null {
  return data === null || isNumber(data);
}

function invalidStatusResponse(): DawClientError {
  return {
    kind: "invalidResponse",
    message: "expected DAW status response",
  };
}

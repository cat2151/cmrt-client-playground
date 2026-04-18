import "./style.css";
import { syncDebouncedAutoSend } from "./auto-send.ts";
import {
  selectAutoTargetTracks,
  type AutoTargetCandidate,
} from "./auto-targets.ts";
import { DawClient } from "./daw-client.ts";
import {
  createMeasureGridController,
  type MeasureGridConfig,
} from "./measure-grid.ts";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  parsePositiveInteger,
  resolveBassTargets,
} from "./post-config.ts";
import { createDebouncedCallback } from "./debounce.ts";
import { sendMml } from "./send-mml.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const trackEl = document.getElementById("track") as HTMLInputElement;
const measureEl = document.getElementById("measure") as HTMLInputElement;
const bassTrackEl = document.getElementById("bass-track") as HTMLInputElement;
const bassMeasureEl = document.getElementById("bass-measure") as HTMLInputElement;
const gridTrackStartEl = document.getElementById("grid-track-start") as HTMLInputElement;
const gridTrackCountEl = document.getElementById("grid-track-count") as HTMLInputElement;
const gridMeasureStartEl = document.getElementById("grid-measure-start") as HTMLInputElement;
const gridMeasureCountEl = document.getElementById("grid-measure-count") as HTMLInputElement;
const measureGridHeadEl = document.getElementById("measure-grid-head") as HTMLTableSectionElement;
const measureGridBodyEl = document.getElementById("measure-grid-body") as HTMLTableSectionElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const TRACK_STORAGE_KEY = "cmrt-client-playground.track";
const MEASURE_STORAGE_KEY = "cmrt-client-playground.measure";
const BASS_TRACK_STORAGE_KEY = "cmrt-client-playground.bass-track";
const BASS_MEASURE_STORAGE_KEY = "cmrt-client-playground.bass-measure";
const AUTO_SEND_DELAY_MS = 1000;
const INIT_MEASURE = 0;
const AUTO_TARGET_TRACK_SCAN_START = 1;
const AUTO_TARGET_TRACK_SCAN_END = 16;
const GRID_AUTO_FETCH_INTERVAL_MS = 1000;
const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;

const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 1,
  trackCount: 4,
  measureStart: 0,
  measureCount: 8,
};
const dawClient = DawClient.localDefault();

function appendLog(message: string): void {
  const timestamp = new Date().toISOString();
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function loadStoredTarget(
  key: string,
  fallback: number,
  element: HTMLInputElement
): boolean {
  try {
    const storedValue = localStorage.getItem(key);
    const parsed = storedValue === null ? null : parsePositiveInteger(storedValue);
    element.value = String(parsed ?? fallback);
    return parsed !== null;
  } catch {
    element.value = String(fallback);
    return false;
  }
}

function saveTarget(key: string, element: HTMLInputElement): void {
  const parsed = parsePositiveInteger(element.value);
  if (parsed === null) {
    return;
  }

  try {
    localStorage.setItem(key, String(parsed));
  } catch {
    // Ignore storage errors and keep the UI usable.
  }
}

function getTargetValue(
  element: HTMLInputElement,
  name: string
): number | null {
  const parsed = parsePositiveInteger(element.value);
  if (parsed === null) {
    appendLog(`ERROR: ${name} には 1 以上の整数を指定してください`);
    return null;
  }
  return parsed;
}

const measureGridController = createMeasureGridController({
  elements: {
    trackStartEl: gridTrackStartEl,
    trackCountEl: gridTrackCountEl,
    measureStartEl: gridMeasureStartEl,
    measureCountEl: gridMeasureCountEl,
    headEl: measureGridHeadEl,
    bodyEl: measureGridBodyEl,
  },
  dawClient,
  appendLog,
  autoSendDelayMs: AUTO_SEND_DELAY_MS,
  maxAutoExpandedTrackCount: MAX_AUTO_EXPANDED_TRACK_COUNT,
  maxAutoExpandedMeasureCount: MAX_AUTO_EXPANDED_MEASURE_COUNT,
  initialConfig: DEFAULT_MEASURE_GRID_CONFIG,
});

function syncMeasureGridHighlightTargets(): void {
  const chordTrack = parsePositiveInteger(trackEl.value);
  const chordMeasure = parsePositiveInteger(measureEl.value);
  const chordTarget =
    chordTrack === null || chordMeasure === null
      ? null
      : { track: chordTrack, measure: chordMeasure };
  const bassTarget =
    chordTarget === null
      ? null
      : resolveBassTargets(bassTrackEl.value, bassMeasureEl.value, chordTarget);

  measureGridController.setHighlightTargets({
    chordTarget,
    bassTarget,
  });
}

function applyMeasureGridConfigFromControls(): boolean {
  const nextConfig = measureGridController.readConfigFromControls();
  if (nextConfig === null) {
    return false;
  }

  measureGridController.applyConfig(nextConfig);
  return true;
}

let isReloadingMeasureGrid = false;
let shouldReloadMeasureGridAgain = false;
let measureGridQueuedReloadTimer: number | null = null;
let lastMeasureGridReloadStartedAt = 0;

function cancelQueuedMeasureGridReload(): void {
  if (measureGridQueuedReloadTimer === null) {
    return;
  }

  window.clearTimeout(measureGridQueuedReloadTimer);
  measureGridQueuedReloadTimer = null;
}

function queueMeasureGridReload(): void {
  cancelQueuedMeasureGridReload();
  const elapsedMs = Date.now() - lastMeasureGridReloadStartedAt;
  const delayMs = Math.max(0, GRID_AUTO_FETCH_INTERVAL_MS - elapsedMs);
  measureGridQueuedReloadTimer = window.setTimeout(() => {
    measureGridQueuedReloadTimer = null;
    void reloadMeasureGridFromCmrt();
  }, delayMs);
}

async function reloadMeasureGridFromCmrt(): Promise<void> {
  if (isReloadingMeasureGrid) {
    shouldReloadMeasureGridAgain = true;
    return;
  }

  cancelQueuedMeasureGridReload();
  isReloadingMeasureGrid = true;
  lastMeasureGridReloadStartedAt = Date.now();
  try {
    await measureGridController.loadFromCmrt();
  } finally {
    isReloadingMeasureGrid = false;
    if (shouldReloadMeasureGridAgain) {
      shouldReloadMeasureGridAgain = false;
      queueMeasureGridReload();
    }
  }
}

async function autoSelectTracksFromCmrt(options: {
  shouldSelectChordTrack: boolean;
  shouldSelectBassTrack: boolean;
}): Promise<void> {
  if (!options.shouldSelectChordTrack && !options.shouldSelectBassTrack) {
    return;
  }

  const candidates: AutoTargetCandidate[] = [];
  for (
    let track = AUTO_TARGET_TRACK_SCAN_START;
    track <= AUTO_TARGET_TRACK_SCAN_END;
    track += 1
  ) {
    const result = await dawClient.getMeasureInfo(track, INIT_MEASURE);
    if (typeof result === "object" && "kind" in result) {
      break;
    }

    candidates.push({ track, filterName: result.filterName });
  }
  const selection = selectAutoTargetTracks(candidates);

  if (options.shouldSelectChordTrack && selection.chordTrack !== null) {
    trackEl.value = String(selection.chordTrack);
    saveTarget(TRACK_STORAGE_KEY, trackEl);
  }

  if (options.shouldSelectBassTrack && selection.bassTrack !== null) {
    bassTrackEl.value = String(selection.bassTrack);
    saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  }

  if (
    (options.shouldSelectChordTrack && selection.chordTrack !== null) ||
    (options.shouldSelectBassTrack && selection.bassTrack !== null)
  ) {
    const selectedTargets: string[] = [];
    if (options.shouldSelectChordTrack && selection.chordTrack !== null) {
      selectedTargets.push(`chord track=${selection.chordTrack}`);
    }
    if (options.shouldSelectBassTrack && selection.bassTrack !== null) {
      selectedTargets.push(`bass track=${selection.bassTrack}`);
    }
    appendLog(
      `起動時に track を自動選択: ${selectedTargets.join(", ")}`
    );
    syncMeasureGridHighlightTargets();
  }
}

async function sendCurrentMml(): Promise<void> {
  const chordTrack = getTargetValue(trackEl, "chord track");
  const chordMeasure = getTargetValue(measureEl, "chord meas");
  if (chordTrack === null || chordMeasure === null) {
    return;
  }
  await sendMml({
    input: inputEl.value,
    chordTrack,
    chordMeasure,
    bassTrackValue: bassTrackEl.value,
    bassMeasureValue: bassMeasureEl.value,
    client: dawClient,
    appendLog,
    reflectValue: (track, measure, mml) =>
      measureGridController.reflectValue(track, measure, mml),
  });
}

const debouncedSendMml = createDebouncedCallback(() => {
  if (!inputEl.value.trim()) {
    return;
  }

  return sendCurrentMml();
}, AUTO_SEND_DELAY_MS);

function syncTopLevelAutoSend(): void {
  const canSendToChordTargets =
    parsePositiveInteger(trackEl.value) !== null &&
    parsePositiveInteger(measureEl.value) !== null;
  syncDebouncedAutoSend(inputEl.value, debouncedSendMml, canSendToChordTargets);
}

const hasStoredChordTrack = loadStoredTarget(TRACK_STORAGE_KEY, DEFAULT_TRACK, trackEl);
loadStoredTarget(MEASURE_STORAGE_KEY, DEFAULT_MEASURE, measureEl);
const hasStoredBassTrack = loadStoredTarget(
  BASS_TRACK_STORAGE_KEY,
  DEFAULT_TRACK,
  bassTrackEl
);
loadStoredTarget(BASS_MEASURE_STORAGE_KEY, DEFAULT_MEASURE, bassMeasureEl);
measureGridController.syncControls();
measureGridController.render();
syncMeasureGridHighlightTargets();

void autoSelectTracksFromCmrt({
  shouldSelectChordTrack: !hasStoredChordTrack,
  shouldSelectBassTrack: !hasStoredBassTrack,
});
void reloadMeasureGridFromCmrt();
const measureGridAutoFetchTimer = window.setInterval(() => {
  void reloadMeasureGridFromCmrt();
}, GRID_AUTO_FETCH_INTERVAL_MS);
window.addEventListener("beforeunload", () => {
  window.clearInterval(measureGridAutoFetchTimer);
  cancelQueuedMeasureGridReload();
});

trackEl.addEventListener("input", () => {
  saveTarget(TRACK_STORAGE_KEY, trackEl);
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
});
measureEl.addEventListener("input", () => {
  saveTarget(MEASURE_STORAGE_KEY, measureEl);
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
});
bassTrackEl.addEventListener("input", () => {
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
});
bassMeasureEl.addEventListener("input", () => {
  saveTarget(BASS_MEASURE_STORAGE_KEY, bassMeasureEl);
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
});
inputEl.addEventListener("input", () => {
  syncTopLevelAutoSend();
});
for (const element of [
  gridTrackStartEl,
  gridTrackCountEl,
  gridMeasureStartEl,
  gridMeasureCountEl,
]) {
  element.addEventListener("change", () => {
    if (!applyMeasureGridConfigFromControls()) {
      return;
    }

    void reloadMeasureGridFromCmrt();
  });
}

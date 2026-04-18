import "./style.css";
import {
  parseAppStorageSnapshot,
  stringifyAppStorageSnapshot,
} from "./app-storage.ts";
import { getStartupAbRepeatRange } from "./ab-repeat.ts";
import { syncDebouncedAutoSend } from "./auto-send.ts";
import {
  selectAutoTargetTracks,
  type AutoTargetCandidate,
} from "./auto-targets.ts";
import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import {
  createMeasureGridController,
  type MeasureGridConfig,
} from "./measure-grid.ts";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  parseNonNegativeInteger,
  parsePositiveInteger,
  resolveBassTargets,
} from "./post-config.ts";
import { createDebouncedCallback } from "./debounce.ts";
import { sendMml } from "./send-mml.ts";
import {
  getStartupErrorOverlay,
  STARTUP_CONNECTING_OVERLAY,
  type StartupOverlayState,
} from "./startup-overlay.ts";
import { runPlaybackAction } from "./playback.ts";

const appShellEl = document.getElementById("app-shell") as HTMLDivElement;
const startupOverlayEl = document.getElementById("startup-overlay") as HTMLDivElement;
const startupOverlayTitleEl = document.getElementById(
  "startup-overlay-title"
) as HTMLHeadingElement;
const startupOverlayMessageEl = document.getElementById(
  "startup-overlay-message"
) as HTMLParagraphElement;
const startupOverlayDetailEl = document.getElementById(
  "startup-overlay-detail"
) as HTMLPreElement;
const playStartButtonEl = document.getElementById("play-start") as HTMLButtonElement;
const playStopButtonEl = document.getElementById("play-stop") as HTMLButtonElement;
const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const localStorageExportButtonEl = document.getElementById(
  "local-storage-export"
) as HTMLButtonElement;
const localStorageImportButtonEl = document.getElementById(
  "local-storage-import"
) as HTMLButtonElement;
const localStorageImportFileEl = document.getElementById(
  "local-storage-import-file"
) as HTMLInputElement;
const chordTrackEl = document.getElementById("track") as HTMLInputElement;
const chordMeasureEl = document.getElementById("measure") as HTMLInputElement;
const bassTrackEl = document.getElementById("bass-track") as HTMLInputElement;
const gridTrackStartEl = document.getElementById("grid-track-start") as HTMLInputElement;
const gridTrackCountEl = document.getElementById("grid-track-count") as HTMLInputElement;
const gridMeasureStartEl = document.getElementById("grid-measure-start") as HTMLInputElement;
const gridMeasureCountEl = document.getElementById("grid-measure-count") as HTMLInputElement;
const measureGridHeadEl = document.getElementById("measure-grid-head") as HTMLTableSectionElement;
const measureGridBodyEl = document.getElementById("measure-grid-body") as HTMLTableSectionElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const INPUT_STORAGE_KEY = "cmrt-client-playground.input";
const CHORD_TRACK_STORAGE_KEY = "cmrt-client-playground.chord.track";
const CHORD_MEASURE_STORAGE_KEY = "cmrt-client-playground.chord.measure";
const BASS_TRACK_STORAGE_KEY = "cmrt-client-playground.bass-track";
const APP_STORAGE_EXPORT_FILENAME = "cmrt-client-playground-local-storage.json";
const APP_STORAGE_KEYS = [
  INPUT_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  BASS_TRACK_STORAGE_KEY,
] as const;
const AUTO_SEND_DELAY_MS = 1000;
const INIT_MEASURE = 0;
const AUTO_TARGET_TRACK_SCAN_START = 1;
const AUTO_TARGET_TRACK_SCAN_END = 16;
const GRID_AUTO_FETCH_INTERVAL_MS = 1000;
const STARTUP_CONNECTIVITY_RETRY_MS = 1000;
const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;
const reportedLocalStorageErrors = new Set<string>();

const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 0,
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

function reportLocalStorageError(action: string, error: unknown): void {
  const message = `ERROR: local storage の${action}に失敗しました: ${String(error)}`;
  if (reportedLocalStorageErrors.has(message)) {
    return;
  }

  reportedLocalStorageErrors.add(message);
  appendLog(message);
}

function readLocalStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error: unknown) {
    reportLocalStorageError(`読み取り(${key})`, error);
    return null;
  }
}

function writeLocalStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: unknown) {
    reportLocalStorageError(`保存(${key})`, error);
    return false;
  }
}

function removeLocalStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error: unknown) {
    reportLocalStorageError(`削除(${key})`, error);
    return false;
  }
}

function setStartupOverlayState(state: StartupOverlayState): void {
  startupOverlayTitleEl.textContent = state.title;
  startupOverlayMessageEl.textContent = state.message;
  startupOverlayDetailEl.textContent = state.detail ?? "";
  startupOverlayDetailEl.hidden = state.detail === null;
}

function showStartupOverlay(state: StartupOverlayState): void {
  setStartupOverlayState(state);
  startupOverlayEl.hidden = false;
  appShellEl.setAttribute("inert", "");
  appShellEl.setAttribute("aria-busy", "true");
}

function hideStartupOverlay(): void {
  startupOverlayEl.hidden = true;
  appShellEl.removeAttribute("inert");
  appShellEl.removeAttribute("aria-busy");
}

function loadStoredTarget(
  key: string,
  fallback: number,
  element: HTMLInputElement
): boolean {
  const storedValue = readLocalStorageItem(key);
  const parsed = storedValue === null ? null : parseNonNegativeInteger(storedValue);
  element.value = String(parsed ?? fallback);
  return parsed !== null;
}

function loadStoredText(
  key: string,
  fallback: string,
  element: HTMLInputElement | HTMLTextAreaElement
): boolean {
  const storedValue = readLocalStorageItem(key);
  element.value = storedValue ?? fallback;
  return storedValue !== null;
}

function saveTarget(key: string, element: HTMLInputElement): void {
  const parsed = parseNonNegativeInteger(element.value);
  if (parsed === null) {
    return;
  }

  writeLocalStorageItem(key, String(parsed));
}

function saveText(key: string, value: string): void {
  writeLocalStorageItem(key, value);
}

function persistTopLevelStateToStorage(): void {
  saveText(INPUT_STORAGE_KEY, inputEl.value);
  saveTarget(CHORD_TRACK_STORAGE_KEY, chordTrackEl);
  saveTarget(CHORD_MEASURE_STORAGE_KEY, chordMeasureEl);
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
}

function restoreTopLevelStateFromStorage(): {
  hasStoredChordTrack: boolean;
  hasStoredBassTrack: boolean;
} {
  loadStoredText(INPUT_STORAGE_KEY, "", inputEl);
  const hasStoredChordTrack = loadStoredTarget(CHORD_TRACK_STORAGE_KEY, DEFAULT_TRACK, chordTrackEl);
  loadStoredTarget(CHORD_MEASURE_STORAGE_KEY, DEFAULT_MEASURE, chordMeasureEl);
  const hasStoredBassTrack = loadStoredTarget(BASS_TRACK_STORAGE_KEY, DEFAULT_TRACK, bassTrackEl);

  return { hasStoredChordTrack, hasStoredBassTrack };
}

function collectManagedLocalStorageValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of APP_STORAGE_KEYS) {
    const value = readLocalStorageItem(key);
    if (value !== null) {
      values[key] = value;
    }
  }
  return values;
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const linkEl = document.createElement("a");
  linkEl.href = downloadUrl;
  linkEl.download = filename;
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
  URL.revokeObjectURL(downloadUrl);
}

function exportManagedLocalStorage(): void {
  persistTopLevelStateToStorage();
  const json = stringifyAppStorageSnapshot(collectManagedLocalStorageValues());
  downloadTextFile(APP_STORAGE_EXPORT_FILENAME, json);
  appendLog("local storage を JSON export しました");
}

function validateImportedStorageValues(values: Record<string, string>): string | null {
  for (const key of [
    CHORD_TRACK_STORAGE_KEY,
    CHORD_MEASURE_STORAGE_KEY,
    BASS_TRACK_STORAGE_KEY,
  ]) {
    const value = values[key];
    if (value !== undefined && parseNonNegativeInteger(value) === null) {
      return `${key} には 0 以上の整数を指定してください`;
    }
  }

  return null;
}

async function importManagedLocalStorage(file: File): Promise<void> {
  let raw: string;
  try {
    raw = await file.text();
  } catch (error: unknown) {
    appendLog(`ERROR: local storage JSON import の読み込みに失敗しました: ${String(error)}`);
    return;
  }

  const parsed = parseAppStorageSnapshot(raw, APP_STORAGE_KEYS);
  if (!parsed.ok) {
    appendLog(`ERROR: local storage JSON import に失敗しました: ${parsed.message}`);
    return;
  }

  const validationError = validateImportedStorageValues(parsed.snapshot.values);
  if (validationError !== null) {
    appendLog(`ERROR: local storage JSON import に失敗しました: ${validationError}`);
    return;
  }

  debouncedSendMml.cancel();
  for (const key of APP_STORAGE_KEYS) {
    const value = parsed.snapshot.values[key];
    if (value === undefined) {
      removeLocalStorageItem(key);
      continue;
    }
    writeLocalStorageItem(key, value);
  }

  restoreTopLevelStateFromStorage();
  syncMeasureGridHighlightTargets();
  if (isCmrtReady) {
    void applyStartupAbRepeat();
  }
  appendLog("local storage を JSON import しました");
}

function getTargetValue(
  element: HTMLInputElement,
  name: string
): number | null {
  const parsed = parseNonNegativeInteger(element.value);
  if (parsed === null) {
    appendLog(`ERROR: ${name} には 0 以上の整数を指定してください`);
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
  getRowHeaderActions: (track) => {
    const actions: {
      label: string;
      ariaLabel: string;
      onClick: () => void;
    }[] = [];
    if (parseNonNegativeInteger(chordTrackEl.value) === track) {
      actions.push({
        label: "chord r",
        ariaLabel: `chord track ${track} にランダム音色を設定`,
        onClick: () => {
          void postRandomPatchForTarget(chordTrackEl, "chord");
        },
      });
    }
    if (parseNonNegativeInteger(bassTrackEl.value) === track) {
      actions.push({
        label: "bass r",
        ariaLabel: `bass track ${track} にランダム音色を設定`,
        onClick: () => {
          void postRandomPatchForTarget(bassTrackEl, "bass");
        },
      });
    }
    return actions;
  },
  autoSendDelayMs: AUTO_SEND_DELAY_MS,
  maxAutoExpandedTrackCount: MAX_AUTO_EXPANDED_TRACK_COUNT,
  maxAutoExpandedMeasureCount: MAX_AUTO_EXPANDED_MEASURE_COUNT,
  initialConfig: DEFAULT_MEASURE_GRID_CONFIG,
});

function syncMeasureGridTrackHeaderActions(): void {
  measureGridController.render();
  syncMeasureGridHighlightTargets();
}

function syncMeasureGridHighlightTargets(): void {
  const chordTrack = parseNonNegativeInteger(chordTrackEl.value);
  const chordMeasure = parseNonNegativeInteger(chordMeasureEl.value);
  const chordTarget =
    chordTrack === null || chordMeasure === null
      ? null
      : { track: chordTrack, measure: chordMeasure };
  const bassTarget =
    chordTarget === null
      ? null
      : resolveBassTargets(bassTrackEl.value, chordTarget);

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
let measureGridAutoFetchTimer: number | null = null;
let startupConnectivityRetryTimer: number | null = null;
let isCheckingStartupConnectivity = false;
let isCmrtReady = false;

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

function clearStartupConnectivityRetry(): void {
  if (startupConnectivityRetryTimer === null) {
    return;
  }

  window.clearTimeout(startupConnectivityRetryTimer);
  startupConnectivityRetryTimer = null;
}

function scheduleStartupConnectivityRetry(): void {
  if (isCmrtReady || startupConnectivityRetryTimer !== null) {
    return;
  }

  startupConnectivityRetryTimer = window.setTimeout(() => {
    startupConnectivityRetryTimer = null;
    void ensureCmrtReady();
  }, STARTUP_CONNECTIVITY_RETRY_MS);
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
    chordTrackEl.value = String(selection.chordTrack);
    saveTarget(CHORD_TRACK_STORAGE_KEY, chordTrackEl);
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
    syncMeasureGridTrackHeaderActions();
  }
}

async function startAppAfterCmrtReady(options: {
  shouldSelectChordTrack: boolean;
  shouldSelectBassTrack: boolean;
}): Promise<void> {
  hideStartupOverlay();
  clearStartupConnectivityRetry();
  await applyStartupAbRepeat();
  void autoSelectTracksFromCmrt(options);
  void reloadMeasureGridFromCmrt();
  await runPlaybackAction({
    action: "start",
    source: "startup",
    client: dawClient,
    appendLog,
  });

  if (measureGridAutoFetchTimer !== null) {
    return;
  }

  measureGridAutoFetchTimer = window.setInterval(() => {
    void reloadMeasureGridFromCmrt();
  }, GRID_AUTO_FETCH_INTERVAL_MS);
}

async function ensureCmrtReady(): Promise<void> {
  if (isCmrtReady || isCheckingStartupConnectivity) {
    return;
  }

  isCheckingStartupConnectivity = true;
  try {
    const result = await dawClient.getMmls();
    if (typeof result === "object" && result !== null && "kind" in result) {
      showStartupOverlay(getStartupErrorOverlay(result));
      scheduleStartupConnectivityRetry();
      return;
    }

    isCmrtReady = true;
    await startAppAfterCmrtReady({
      shouldSelectChordTrack: !hasStoredChordTrack,
      shouldSelectBassTrack: !hasStoredBassTrack,
    });
  } finally {
    isCheckingStartupConnectivity = false;
  }
}

async function applyStartupAbRepeat(): Promise<void> {
  const chordMeasure = parseNonNegativeInteger(chordMeasureEl.value);
  if (chordMeasure === null) {
    return;
  }

  const range = getStartupAbRepeatRange({
    input: inputEl.value,
    chordMeasure,
  });
  const result = await dawClient.postAbRepeat(range.startMeasure, range.endMeasure);
  if (result !== undefined) {
    appendLog(
      `ERROR: 起動時の A-B repeat 設定に失敗しました: ${dawClientErrorMessage(result)}`
    );
    return;
  }

  appendLog(
    `起動時に A-B repeat を設定: measA=${range.startMeasure}, measB=${range.endMeasure}`
  );
}

async function sendCurrentMml(): Promise<void> {
  const chordTrack = getTargetValue(chordTrackEl, "chord track");
  const chordMeasure = getTargetValue(chordMeasureEl, "chord meas");
  if (chordTrack === null || chordMeasure === null) {
    return;
  }
  await sendMml({
    input: inputEl.value,
    chordTrack,
    chordMeasure,
    bassTrackValue: bassTrackEl.value,
    client: dawClient,
    appendLog,
    reflectValue: (track, measure, mml) =>
      measureGridController.reflectValue(track, measure, mml),
  });
}

async function postRandomPatchForTarget(
  element: HTMLInputElement,
  name: "chord" | "bass"
): Promise<void> {
  const track = getTargetValue(element, `${name} track`);
  if (track === null) {
    return;
  }

  const result = await dawClient.postRandomPatch(track);
  if (result !== undefined) {
    appendLog(
      `ERROR: ${name} のランダム音色設定に失敗しました: ${dawClientErrorMessage(result)}`
    );
    return;
  }

  appendLog(`${name} track=${track} にランダム音色を設定しました`);
  void reloadMeasureGridFromCmrt();
}

const debouncedSendMml = createDebouncedCallback(() => {
  if (!inputEl.value.trim()) {
    return;
  }

  return sendCurrentMml();
}, AUTO_SEND_DELAY_MS);

function syncTopLevelAutoSend(): void {
  const canSendToChordTargets =
    parseNonNegativeInteger(chordTrackEl.value) !== null &&
    parseNonNegativeInteger(chordMeasureEl.value) !== null;
  syncDebouncedAutoSend(inputEl.value, debouncedSendMml, canSendToChordTargets);
}

const { hasStoredChordTrack, hasStoredBassTrack } = restoreTopLevelStateFromStorage();
measureGridController.syncControls();
measureGridController.render();
syncMeasureGridHighlightTargets();
showStartupOverlay(STARTUP_CONNECTING_OVERLAY);
void ensureCmrtReady();

window.addEventListener("beforeunload", () => {
  if (measureGridAutoFetchTimer !== null) {
    window.clearInterval(measureGridAutoFetchTimer);
  }
  clearStartupConnectivityRetry();
  cancelQueuedMeasureGridReload();
});

chordTrackEl.addEventListener("input", () => {
  saveTarget(CHORD_TRACK_STORAGE_KEY, chordTrackEl);
  syncMeasureGridTrackHeaderActions();
  syncTopLevelAutoSend();
});
chordMeasureEl.addEventListener("input", () => {
  saveTarget(CHORD_MEASURE_STORAGE_KEY, chordMeasureEl);
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
});
bassTrackEl.addEventListener("input", () => {
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  syncMeasureGridTrackHeaderActions();
  syncTopLevelAutoSend();
});
inputEl.addEventListener("input", () => {
  saveText(INPUT_STORAGE_KEY, inputEl.value);
  syncTopLevelAutoSend();
});
playStartButtonEl.addEventListener("click", () => {
  void runPlaybackAction({
    action: "start",
    source: "manual",
    client: dawClient,
    appendLog,
  });
});
playStopButtonEl.addEventListener("click", () => {
  void runPlaybackAction({
    action: "stop",
    source: "manual",
    client: dawClient,
    appendLog,
  });
});
localStorageExportButtonEl.addEventListener("click", () => {
  exportManagedLocalStorage();
});
localStorageImportButtonEl.addEventListener("click", () => {
  localStorageImportFileEl.click();
});
localStorageImportFileEl.addEventListener("change", () => {
  const file = localStorageImportFileEl.files?.item(0);
  localStorageImportFileEl.value = "";
  if (file === null || file === undefined) {
    return;
  }

  void importManagedLocalStorage(file);
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

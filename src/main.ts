import "./style.css";
import "./auto-adjust.css";
import {
  parseAppStorageSnapshot,
  stringifyAppStorageSnapshot,
} from "./app-storage.ts";
import {
  getStartupAbRepeatRange,
  isSameAbRepeatRange,
  syncDebouncedAbRepeat,
  type StartupAbRepeatRange,
} from "./ab-repeat.ts";
import { syncDebouncedAutoSend } from "./auto-send.ts";
import { createAutoAdjustPanel } from "./auto-adjust-panel.ts";
import {
  selectAutoTargetTracks,
  type AutoTargetCandidate,
} from "./auto-targets.ts";
import { formatLogTimestamp } from "./log-timestamp.ts";
import {
  addChordHistoryEntry,
  parseChordHistoryStorage,
  serializeChordHistory,
} from "./chord-history.ts";
import { buildChordPlaybackSource } from "./chord-playback-source.ts";
import {
  formatChordTemplateInput,
  formatChordTemplateOptionLabel,
  parseChordTemplates,
  type ChordTemplate,
} from "./chord-templates.ts";
import {
  createChordProgressionEditor,
  type ChordProgressionEditor,
} from "./chord-progression-highlight.ts";
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
import { buildPianoRollPreviewFromSource } from "./piano-roll-preview.ts";
import { sendMml } from "./send-mml.ts";
import {
  convertChordProgressionToSmf,
  createMmlabcToSmfConverter,
  SMF_EXPORT_FILENAME,
} from "./smf-export.ts";
import {
  getPianoRollPitchRowBoundaries,
  getPianoRollPitchRowMetrics,
  type PianoRollDisplayData,
} from "./smf-piano-roll.ts";
import {
  getStartupErrorOverlay,
  STARTUP_CONNECTING_OVERLAY,
  type StartupOverlayState,
} from "./startup-overlay.ts";
import {
  initializeToneChordPlayback,
  playToneChordMml,
  stopToneChordPlayback,
} from "./tone-chord-playback.ts";
import {
  syncToneChordPreviewAfterInputChange,
  type ToneChordPreviewInputSource,
} from "./tone-chord-preview-sync.ts";
import { getPlaybackButtonState, runPlaybackAction } from "./playback.ts";

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
const chordAnalysisErrorBalloonEl = document.getElementById(
  "chord-analysis-error-balloon"
) as HTMLSpanElement;
const chordHistorySelectEl = document.getElementById("chord-history") as HTMLSelectElement;
const chordTemplateKeySelectEl = document.getElementById(
  "chord-template-key"
) as HTMLSelectElement;
const chordTemplateSelectEl = document.getElementById("chord-template") as HTMLSelectElement;
const inputEditorEl = document.getElementById("input") as HTMLDivElement;
const pianoRollContentEl = document.getElementById("piano-roll-content") as HTMLDivElement;
const localStorageExportButtonEl = document.getElementById(
  "local-storage-export"
) as HTMLButtonElement;
const localStorageImportButtonEl = document.getElementById(
  "local-storage-import"
) as HTMLButtonElement;
const localStorageImportFileEl = document.getElementById(
  "local-storage-import-file"
) as HTMLInputElement;
const cmrtTargetSettingsEl = document.getElementById(
  "cmrt-target-settings"
) as HTMLDivElement;
const chordTrackEl = document.getElementById("track") as HTMLInputElement;
const chordMeasureEl = document.getElementById("measure") as HTMLInputElement;
const bassTrackEl = document.getElementById("bass-track") as HTMLInputElement;
const autoAdjustChordsEl = document.getElementById(
  "auto-adjust-chords"
) as HTMLInputElement;
const autoAdjustOutputPanelEl = document.getElementById(
  "auto-adjust-output-panel"
) as HTMLDivElement;
const autoAdjustOutputEl = document.getElementById(
  "auto-adjust-output"
) as HTMLTextAreaElement;
const autoAdjustStatusEl = document.getElementById(
  "auto-adjust-status"
) as HTMLParagraphElement;
const gridTrackStartEl = document.getElementById("grid-track-start") as HTMLInputElement;
const gridTrackCountEl = document.getElementById("grid-track-count") as HTMLInputElement;
const gridMeasureStartEl = document.getElementById("grid-measure-start") as HTMLInputElement;
const gridMeasureCountEl = document.getElementById("grid-measure-count") as HTMLInputElement;
const measureGridHeadEl = document.getElementById("measure-grid-head") as HTMLTableSectionElement;
const measureGridBodyEl = document.getElementById("measure-grid-body") as HTMLTableSectionElement;
const logToggleButtonEl = document.getElementById("log-toggle") as HTMLButtonElement;
const smfExportButtonEl = document.getElementById("smf-export") as HTMLButtonElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const INPUT_STORAGE_KEY = "cmrt-client-playground.input";
const CHORD_HISTORY_STORAGE_KEY = "cmrt-client-playground.chord.history";
const CHORD_TRACK_STORAGE_KEY = "cmrt-client-playground.chord.track";
const CHORD_MEASURE_STORAGE_KEY = "cmrt-client-playground.chord.measure";
const BASS_TRACK_STORAGE_KEY = "cmrt-client-playground.bass-track";
const AUTO_ADJUST_CHORDS_STORAGE_KEY = "cmrt-client-playground.auto-adjust-chords";
const CHORD_TEMPLATE_URL =
  "https://raw.githubusercontent.com/cat2151/cat-music-patterns/main/chord-progressions.json";
const APP_STORAGE_EXPORT_FILENAME = "cmrt-client-playground-local-storage.json";
const APP_STORAGE_KEYS = [
  INPUT_STORAGE_KEY,
  CHORD_HISTORY_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  BASS_TRACK_STORAGE_KEY,
  AUTO_ADJUST_CHORDS_STORAGE_KEY,
] as const;
const AUTO_SEND_DELAY_MS = 1000;
const INIT_MEASURE = 0;
const AUTO_TARGET_TRACK_SCAN_START = 1;
const AUTO_TARGET_TRACK_SCAN_END = 16;
const GRID_AUTO_FETCH_INTERVAL_MS = 1000;
const STARTUP_CONNECTIVITY_RETRY_MS = 1000;
const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;
const CHORD_HISTORY_SELECT_MIN_CH = 12;
const CHORD_HISTORY_SELECT_MAX_CH = 24;
const CHORD_ANALYSIS_ERROR_BALLOON_MS = 5000;
const CHORD_ANALYSIS_ERROR_BALLOON_VIEWPORT_MARGIN_PX = 8;
const PIANO_ROLL_HEIGHT_PX = 192;
const PIANO_ROLL_MIN_NOTE_WIDTH_PERCENT = 0.6;
const reportedLocalStorageErrors = new Set<string>();
const smfConverter = createMmlabcToSmfConverter();
const inputEl: ChordProgressionEditor = createChordProgressionEditor({
  element: inputEditorEl,
});
const autoAdjustPanel = createAutoAdjustPanel({
  enabledEl: autoAdjustChordsEl,
  panelEl: autoAdjustOutputPanelEl,
  outputEl: autoAdjustOutputEl,
  statusEl: autoAdjustStatusEl,
});

const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 0,
  trackCount: 4,
  measureStart: 0,
  measureCount: 8,
};
const dawClient = DawClient.localDefault();
let chordHistory: string[] = [];
let chordTemplates: ChordTemplate[] = [];
let chordTemplateLoadState: "loading" | "ready" | "error" = "loading";
let selectedChordTemplateDegrees: string | null = null;

function appendLog(message: string): void {
  const timestamp = formatLogTimestamp();
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
  element: HTMLInputElement | ChordProgressionEditor
): boolean {
  const storedValue = readLocalStorageItem(key);
  element.value = storedValue ?? fallback;
  return storedValue !== null;
}

function loadStoredBoolean(key: string, fallback: boolean): boolean {
  const storedValue = readLocalStorageItem(key);
  if (storedValue === "true") {
    return true;
  }
  if (storedValue === "false") {
    return false;
  }
  return fallback;
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

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatChordHistoryOptionLabel(value: string): string {
  return value.replace(/\s+/g, " ");
}

function syncChordHistorySelectWidth(): void {
  const longestLabelLength =
    chordHistory.length === 0
      ? "chord history".length
      : Math.max(
          ...chordHistory.map((entry) => formatChordHistoryOptionLabel(entry).length)
        );
  const widthCh = Math.min(
    CHORD_HISTORY_SELECT_MAX_CH,
    Math.max(CHORD_HISTORY_SELECT_MIN_CH, longestLabelLength)
  );
  chordHistorySelectEl.style.setProperty(
    "--chord-history-select-label-ch",
    String(widthCh)
  );
}

function renderChordHistorySelect(): void {
  const currentInput = inputEl.value.trim();
  chordHistorySelectEl.replaceChildren();

  const placeholderEl = document.createElement("option");
  placeholderEl.value = "";
  placeholderEl.textContent =
    chordHistory.length === 0 ? "chord history empty" : "chord history";
  placeholderEl.disabled = true;
  chordHistorySelectEl.append(placeholderEl);

  let selectedHistoryEntry = false;
  for (const entry of chordHistory) {
    const optionEl = document.createElement("option");
    optionEl.value = entry;
    optionEl.textContent = formatChordHistoryOptionLabel(entry);
    optionEl.title = entry;
    if (entry === currentInput) {
      optionEl.selected = true;
      selectedHistoryEntry = true;
    }
    chordHistorySelectEl.append(optionEl);
  }

  placeholderEl.selected = !selectedHistoryEntry;
  chordHistorySelectEl.disabled = chordHistory.length === 0;
  syncChordHistorySelectWidth();
}

function renderChordTemplateSelect(): void {
  chordTemplateSelectEl.replaceChildren();

  const placeholderEl = document.createElement("option");
  placeholderEl.value = "";
  placeholderEl.textContent =
    chordTemplateLoadState === "loading"
      ? "template loading..."
      : chordTemplateLoadState === "error"
        ? "template load failed"
        : chordTemplates.length === 0
          ? "template empty"
          : "template";
  placeholderEl.disabled = true;
  chordTemplateSelectEl.append(placeholderEl);

  let selectedTemplate = false;
  if (chordTemplateLoadState === "ready") {
    for (const template of chordTemplates) {
      const optionEl = document.createElement("option");
      optionEl.value = template.degrees;
      optionEl.textContent = formatChordTemplateOptionLabel(template);
      optionEl.title = optionEl.textContent;
      if (template.degrees === selectedChordTemplateDegrees) {
        optionEl.selected = true;
        selectedTemplate = true;
      }
      chordTemplateSelectEl.append(optionEl);
    }
  }

  placeholderEl.selected = !selectedTemplate;
  chordTemplateSelectEl.disabled =
    chordTemplateLoadState !== "ready" || chordTemplates.length === 0;
}

function getSelectedChordTemplateKey(): string {
  return chordTemplateKeySelectEl.value || "C";
}

function getSelectedChordTemplateInput(): string | null {
  if (selectedChordTemplateDegrees === null) {
    return null;
  }

  return formatChordTemplateInput(
    selectedChordTemplateDegrees,
    getSelectedChordTemplateKey()
  );
}

function isCurrentInputFromSelectedTemplate(): boolean {
  const templateInput = getSelectedChordTemplateInput();
  return templateInput !== null && inputEl.value === templateInput;
}

function applySelectedChordTemplateToInput(source: ToneChordPreviewInputSource): void {
  const templateInput = getSelectedChordTemplateInput();
  if (templateInput === null) {
    return;
  }

  inputEl.value = templateInput;
  syncChordInputStateAfterChange(source);
}

async function loadChordTemplates(): Promise<void> {
  chordTemplateLoadState = "loading";
  renderChordTemplateSelect();

  let response: Response;
  try {
    response = await fetch(CHORD_TEMPLATE_URL, { cache: "no-store" });
  } catch (error: unknown) {
    chordTemplates = [];
    chordTemplateLoadState = "error";
    renderChordTemplateSelect();
    appendLog(`ERROR: template JSON の fetch に失敗しました: ${String(error)}`);
    return;
  }

  if (!response.ok) {
    chordTemplates = [];
    chordTemplateLoadState = "error";
    renderChordTemplateSelect();
    appendLog(
      `ERROR: template JSON の fetch に失敗しました: HTTP ${response.status} ${response.statusText}`
    );
    return;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error: unknown) {
    chordTemplates = [];
    chordTemplateLoadState = "error";
    renderChordTemplateSelect();
    appendLog(`ERROR: template JSON を JSON として読み取れませんでした: ${String(error)}`);
    return;
  }

  const parsed = parseChordTemplates(raw);
  if (!parsed.ok) {
    chordTemplates = [];
    chordTemplateLoadState = "error";
    renderChordTemplateSelect();
    appendLog(`ERROR: template JSON の形式が不正です: ${parsed.message}`);
    return;
  }

  chordTemplates = parsed.templates;
  chordTemplateLoadState = "ready";
  renderChordTemplateSelect();
  appendLog(`template JSON を読み込みました: ${chordTemplates.length} 件`);
}

function saveChordHistory(): void {
  writeLocalStorageItem(CHORD_HISTORY_STORAGE_KEY, serializeChordHistory(chordHistory));
}

function loadStoredChordHistory(): void {
  const storedValue = readLocalStorageItem(CHORD_HISTORY_STORAGE_KEY);
  if (storedValue === null) {
    chordHistory = [];
    renderChordHistorySelect();
    return;
  }

  const parsed = parseChordHistoryStorage(storedValue);
  if (!parsed.ok) {
    appendLog(`ERROR: chord history の復帰に失敗しました: ${parsed.message}`);
    chordHistory = [];
    renderChordHistorySelect();
    return;
  }

  chordHistory = parsed.history;
  renderChordHistorySelect();
}

function rememberChordHistoryEntry(input: string): void {
  const nextHistory = addChordHistoryEntry(chordHistory, input);
  if (areStringArraysEqual(chordHistory, nextHistory)) {
    renderChordHistorySelect();
    return;
  }

  chordHistory = nextHistory;
  saveChordHistory();
  renderChordHistorySelect();
}

function persistTopLevelStateToStorage(): void {
  saveText(INPUT_STORAGE_KEY, inputEl.value);
  saveChordHistory();
  saveTarget(CHORD_TRACK_STORAGE_KEY, chordTrackEl);
  saveTarget(CHORD_MEASURE_STORAGE_KEY, chordMeasureEl);
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  saveText(AUTO_ADJUST_CHORDS_STORAGE_KEY, autoAdjustPanel.storageValue);
}

function restoreTopLevelStateFromStorage(): {
  hasStoredChordTrack: boolean;
  hasStoredBassTrack: boolean;
} {
  selectedChordTemplateDegrees = null;
  loadStoredText(INPUT_STORAGE_KEY, "", inputEl);
  autoAdjustPanel.enabled = loadStoredBoolean(AUTO_ADJUST_CHORDS_STORAGE_KEY, false);
  loadStoredChordHistory();
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

function downloadBlobFile(filename: string, blob: Blob): void {
  const downloadUrl = URL.createObjectURL(blob);
  const linkEl = document.createElement("a");
  linkEl.href = downloadUrl;
  linkEl.download = filename;
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
  URL.revokeObjectURL(downloadUrl);
}

function downloadTextFile(filename: string, content: string): void {
  downloadBlobFile(filename, new Blob([content], { type: "application/json" }));
}

function downloadBinaryFile(
  filename: string,
  content: Uint8Array,
  mimeType: string
): void {
  downloadBlobFile(filename, new Blob([content], { type: mimeType }));
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

  const chordHistoryValue = values[CHORD_HISTORY_STORAGE_KEY];
  if (chordHistoryValue !== undefined) {
    const parsed = parseChordHistoryStorage(chordHistoryValue);
    if (!parsed.ok) {
      return `${CHORD_HISTORY_STORAGE_KEY} は chord history として読み取れません: ${parsed.message}`;
    }
  }

  const autoAdjustValue = values[AUTO_ADJUST_CHORDS_STORAGE_KEY];
  if (
    autoAdjustValue !== undefined &&
    autoAdjustValue !== "true" &&
    autoAdjustValue !== "false"
  ) {
    return `${AUTO_ADJUST_CHORDS_STORAGE_KEY} には true または false を指定してください`;
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
  debouncedSyncAbRepeat.cancel();
  for (const key of APP_STORAGE_KEYS) {
    const value = parsed.snapshot.values[key];
    if (value === undefined) {
      removeLocalStorageItem(key);
      continue;
    }
    writeLocalStorageItem(key, value);
  }

  restoreTopLevelStateFromStorage();
  syncAutoAdjustPanel();
  syncMeasureGridHighlightTargets();
  if (isCmrtReady) {
    void applyAbRepeat({ source: "auto" });
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
      disabled?: boolean;
    }[] = [];
    if (parseNonNegativeInteger(chordTrackEl.value) === track) {
      actions.push({
        label: "chord r",
        ariaLabel: `chord track ${track} にランダム音色を設定`,
        onClick: () => {
          void postRandomPatchForTarget(chordTrackEl, "chord");
        },
        disabled: isToneFallbackMode,
      });
    }
    if (parseNonNegativeInteger(bassTrackEl.value) === track) {
      actions.push({
        label: "bass r",
        ariaLabel: `bass track ${track} にランダム音色を設定`,
        onClick: () => {
          void postRandomPatchForTarget(bassTrackEl, "bass");
        },
        disabled: isToneFallbackMode,
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

function syncToneFallbackVisibility(): void {
  cmrtTargetSettingsEl.hidden = isToneFallbackMode;
}

function syncMeasureGridHighlightTargets(): void {
  const chordTrack = parseNonNegativeInteger(chordTrackEl.value);
  const chordMeasure = parseNonNegativeInteger(chordMeasureEl.value);
  const chordRange = getCurrentAbRepeatRange();
  const chordTarget =
    chordTrack === null || chordRange === null
      ? null
      : {
          track: chordTrack,
          measure: chordRange.startMeasure,
          endMeasure: chordRange.endMeasure,
        };
  const bassTarget =
    chordTrack === null || chordRange === null
      ? null
      : {
          ...resolveBassTargets(bassTrackEl.value, {
            track: chordTrack,
            measure: chordRange.startMeasure,
          }),
          endMeasure: chordRange.endMeasure,
        };

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
let isToneFallbackMode = false;
let appliedAbRepeatRange: StartupAbRepeatRange | null = null;
let currentPlaybackBackend: "cmrt" | "tone" | null = null;
let chordAnalysisErrorBalloonTimer: number | null = null;
let isSmfExporting = false;
let pianoRollPreviewRequestId = 0;
let lastPreviewDebugSummary: string | null = null;
let toneChordPreviewRequestId = 0;
let toneFallbackPlaybackResetTimer: number | null = null;
let lastTonePreviewErrorMessage: string | null = null;

function syncPlaybackButtonState(): void {
  const buttonState = getPlaybackButtonState(currentPlaybackBackend !== null);
  playStartButtonEl.disabled = buttonState.playDisabled;
  playStopButtonEl.disabled = buttonState.stopDisabled;
}

function setPlaybackBackend(nextBackend: "cmrt" | "tone" | null): void {
  currentPlaybackBackend = nextBackend;
  syncPlaybackButtonState();
  syncMeasureGridTrackHeaderActions();
}

function hideChordAnalysisErrorBalloon(): void {
  if (chordAnalysisErrorBalloonTimer !== null) {
    window.clearTimeout(chordAnalysisErrorBalloonTimer);
    chordAnalysisErrorBalloonTimer = null;
  }

  chordAnalysisErrorBalloonEl.hidden = true;
  chordAnalysisErrorBalloonEl.textContent = "";
  chordAnalysisErrorBalloonEl.style.removeProperty(
    "--error-balloon-viewport-offset-y"
  );
}

function setLogVisible(visible: boolean): void {
  logEl.hidden = !visible;
  logToggleButtonEl.setAttribute("aria-expanded", visible ? "true" : "false");
}

function keepChordAnalysisErrorBalloonInsideViewport(): void {
  chordAnalysisErrorBalloonEl.style.setProperty(
    "--error-balloon-viewport-offset-y",
    "0px"
  );
  const rect = chordAnalysisErrorBalloonEl.getBoundingClientRect();
  const offsetY = Math.max(
    0,
    CHORD_ANALYSIS_ERROR_BALLOON_VIEWPORT_MARGIN_PX - rect.top
  );
  chordAnalysisErrorBalloonEl.style.setProperty(
    "--error-balloon-viewport-offset-y",
    `${offsetY}px`
  );
}

function showChordAnalysisErrorBalloon(message: string): void {
  if (chordAnalysisErrorBalloonTimer !== null) {
    window.clearTimeout(chordAnalysisErrorBalloonTimer);
  }

  chordAnalysisErrorBalloonEl.textContent = `chord分析エラー: ${message}`;
  chordAnalysisErrorBalloonEl.hidden = false;
  keepChordAnalysisErrorBalloonInsideViewport();
  window.requestAnimationFrame(() => {
    if (!chordAnalysisErrorBalloonEl.hidden) {
      keepChordAnalysisErrorBalloonInsideViewport();
    }
  });
  chordAnalysisErrorBalloonTimer = window.setTimeout(() => {
    chordAnalysisErrorBalloonTimer = null;
    chordAnalysisErrorBalloonEl.hidden = true;
    chordAnalysisErrorBalloonEl.textContent = "";
    chordAnalysisErrorBalloonEl.style.removeProperty(
      "--error-balloon-viewport-offset-y"
    );
  }, CHORD_ANALYSIS_ERROR_BALLOON_MS);
}

function clearPianoRollPreview(): void {
  pianoRollContentEl.replaceChildren();
  pianoRollContentEl.classList.add("piano-roll__content--empty");
  pianoRollContentEl.style.removeProperty("background-size");
  lastPreviewDebugSummary = null;
}

function renderPianoRollPreview(options: {
  data: PianoRollDisplayData;
  summary: string;
}): void {
  const pianoRollData = options.data;
  const totalTicks = Math.max(1, pianoRollData.totalTicks);
  const quarterNoteCount = Math.max(1, totalTicks / pianoRollData.division);
  const rowBoundaries = getPianoRollPitchRowBoundaries({
    minPitch: pianoRollData.minPitch,
    maxPitch: pianoRollData.maxPitch,
    contentHeightPx: PIANO_ROLL_HEIGHT_PX,
  });
  pianoRollContentEl.replaceChildren();
  pianoRollContentEl.classList.remove("piano-roll__content--empty");
  pianoRollContentEl.style.backgroundSize = `${100 / quarterNoteCount}% 100%`;

  for (const lineTopPx of rowBoundaries.slice(0, -1)) {
    const lineEl = document.createElement("div");
    lineEl.className = "piano-roll__row-line";
    lineEl.style.top = `${lineTopPx}px`;
    pianoRollContentEl.append(lineEl);
  }

  for (const note of pianoRollData.notes) {
    const noteEl = document.createElement("div");
    noteEl.className = `piano-roll__note piano-roll__note--${note.role}`;
    const rowMetrics = getPianoRollPitchRowMetrics({
      minPitch: pianoRollData.minPitch,
      maxPitch: pianoRollData.maxPitch,
      pitch: note.pitch,
      contentHeightPx: PIANO_ROLL_HEIGHT_PX,
    });
    noteEl.style.left = `${(note.startTick / totalTicks) * 100}%`;
    noteEl.style.top = `${rowMetrics.topPx}px`;
    noteEl.style.width = `${Math.max(
      PIANO_ROLL_MIN_NOTE_WIDTH_PERCENT,
      ((note.endTick - note.startTick) / totalTicks) * 100
    )}%`;
    noteEl.style.height = `${rowMetrics.heightPx}px`;
    pianoRollContentEl.append(noteEl);
  }

  if (options.summary !== lastPreviewDebugSummary) {
    appendLog(options.summary);
    lastPreviewDebugSummary = options.summary;
  }
}

function syncAutoAdjustPanel(): void {
  autoAdjustPanel.sync(inputEl.value);
}

function getEffectiveChordInput(): string {
  return autoAdjustPanel.getEffectiveInput(inputEl.value);
}

function cancelToneChordPreview(): void {
  toneChordPreviewRequestId += 1;
  stopToneChordPlayback();
}

function clearToneFallbackPlaybackReset(): void {
  if (toneFallbackPlaybackResetTimer === null) {
    return;
  }

  window.clearTimeout(toneFallbackPlaybackResetTimer);
  toneFallbackPlaybackResetTimer = null;
}

function scheduleToneFallbackPlaybackReset(durationSeconds: number): void {
  clearToneFallbackPlaybackReset();
  toneFallbackPlaybackResetTimer = window.setTimeout(() => {
    toneFallbackPlaybackResetTimer = null;
    if (currentPlaybackBackend !== "tone") {
      return;
    }

    setPlaybackBackend(null);
  }, Math.max(0, durationSeconds * 1000 + 100));
}

function reportTonePreviewError(error: unknown): void {
  const message = `ERROR: Tone.js chord preview に失敗しました: ${String(error)}`;
  if (message === lastTonePreviewErrorMessage) {
    return;
  }

  lastTonePreviewErrorMessage = message;
  appendLog(message);
}

async function syncToneChordPreview(): Promise<void> {
  if (currentPlaybackBackend !== null) {
    return;
  }

  const requestId = ++toneChordPreviewRequestId;
  const source = buildChordPlaybackSource(getEffectiveChordInput());
  if (!source.ok) {
    stopToneChordPlayback();
    return;
  }

  try {
    await playToneChordMml({
      mml: source.chordMml,
      shouldContinue: () =>
        requestId === toneChordPreviewRequestId && currentPlaybackBackend === null,
    });
    if (requestId === toneChordPreviewRequestId) {
      lastTonePreviewErrorMessage = null;
    }
  } catch (error: unknown) {
    if (requestId !== toneChordPreviewRequestId) {
      return;
    }

    stopToneChordPlayback();
    reportTonePreviewError(error);
  }
}

async function syncPianoRollPreview(): Promise<void> {
  const requestId = ++pianoRollPreviewRequestId;
  const source = buildChordPlaybackSource(getEffectiveChordInput());
  if (!source.ok) {
    clearPianoRollPreview();
    return;
  }

  try {
    const preview = await buildPianoRollPreviewFromSource(source, smfConverter);
    if (requestId !== pianoRollPreviewRequestId) {
      return;
    }
    if (!preview.ok) {
      clearPianoRollPreview();
      return;
    }

    renderPianoRollPreview({
      data: preview.data,
      summary: preview.summary,
    });
  } catch (error: unknown) {
    if (requestId !== pianoRollPreviewRequestId) {
      return;
    }

    clearPianoRollPreview();
    appendLog(`ERROR: piano roll 表示に失敗しました: ${String(error)}`);
  }
}

function getCurrentAbRepeatRange(): StartupAbRepeatRange | null {
  const chordMeasure = parseNonNegativeInteger(chordMeasureEl.value);
  if (chordMeasure === null) {
    return null;
  }

  return getStartupAbRepeatRange({
    input: getEffectiveChordInput(),
    chordMeasure,
  });
}

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

function activateToneFallbackMode(error: ReturnType<typeof getStartupErrorOverlay>): void {
  hideStartupOverlay();
  if (isToneFallbackMode) {
    return;
  }

  isToneFallbackMode = true;
  syncToneFallbackVisibility();
  syncMeasureGridTrackHeaderActions();
  appendLog(
    `cmrt疎通確認エラーのため Tone.js chord fallback で継続します: ${error.title}`
  );
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
  autoStartPlayback: boolean;
}): Promise<void> {
  isToneFallbackMode = false;
  syncToneFallbackVisibility();
  syncMeasureGridTrackHeaderActions();
  hideStartupOverlay();
  clearStartupConnectivityRetry();
  await applyAbRepeat({ source: "startup", force: true });
  void autoSelectTracksFromCmrt(options);
  void reloadMeasureGridFromCmrt();
  if (options.autoStartPlayback) {
    cancelToneChordPreview();
    const started = await runPlaybackAction({
      action: "start",
      source: "startup",
      client: dawClient,
      appendLog,
    });
    if (started) {
      setPlaybackBackend("cmrt");
    }
  } else {
    appendLog("cmrt接続確認に成功しました");
  }

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
      const overlayState = getStartupErrorOverlay(result);
      showStartupOverlay(overlayState);
      activateToneFallbackMode(overlayState);
      scheduleStartupConnectivityRetry();
      return;
    }

    const wasUsingToneFallback = isToneFallbackMode;
    isCmrtReady = true;
    await startAppAfterCmrtReady({
      shouldSelectChordTrack: !hasStoredChordTrack,
      shouldSelectBassTrack: !hasStoredBassTrack,
      autoStartPlayback: !wasUsingToneFallback,
    });
  } finally {
    isCheckingStartupConnectivity = false;
  }
}

async function applyAbRepeat(options: {
  source: "startup" | "auto";
  force?: boolean;
}): Promise<void> {
  const range = getCurrentAbRepeatRange();
  if (range === null) {
    return;
  }

  if (!options.force && isSameAbRepeatRange(appliedAbRepeatRange, range)) {
    return;
  }

  const result = await dawClient.postAbRepeat(range.startMeasure, range.endMeasure);
  if (result !== undefined) {
    const actionLabel =
      options.source === "startup" ? "起動時の A-B repeat 設定" : "A-B repeat の同期";
    appendLog(`ERROR: ${actionLabel}に失敗しました: ${dawClientErrorMessage(result)}`);
    return;
  }

  appliedAbRepeatRange = range;
  const successMessage =
    options.source === "startup"
      ? `起動時に A-B repeat を設定: measA=${range.startMeasure}, measB=${range.endMeasure}`
      : `A-B repeat を同期: measA=${range.startMeasure}, measB=${range.endMeasure}`;
  appendLog(successMessage);
}

async function sendCurrentMml(): Promise<void> {
  const chordTrack = getTargetValue(chordTrackEl, "chord track");
  const chordMeasure = getTargetValue(chordMeasureEl, "chord meas");
  if (chordTrack === null || chordMeasure === null) {
    return;
  }
  if (!isCurrentInputFromSelectedTemplate()) {
    rememberChordHistoryEntry(inputEl.value);
  }
  await sendMml({
    input: getEffectiveChordInput(),
    chordTrack,
    chordMeasure,
    bassTrackValue: bassTrackEl.value,
    client: dawClient,
    appendLog,
    onChordAnalysisError: showChordAnalysisErrorBalloon,
    reflectValue: (track, measure, mml) =>
      measureGridController.reflectValue(track, measure, mml),
  });
}

async function exportCurrentSmf(): Promise<void> {
  if (isSmfExporting) {
    return;
  }

  isSmfExporting = true;
  smfExportButtonEl.disabled = true;
  try {
    if (inputEl.value.trim() !== "" && !isCurrentInputFromSelectedTemplate()) {
      rememberChordHistoryEntry(inputEl.value);
    }

    const result = await convertChordProgressionToSmf(
      getEffectiveChordInput(),
      smfConverter
    );
    if (!result.ok) {
      appendLog(`ERROR: ${result.message}`);
      if (result.chordAnalysisMessage !== undefined) {
        showChordAnalysisErrorBalloon(result.chordAnalysisMessage);
      }
      return;
    }

    appendLog(`コード進行 → MML(SMF export): ${result.mml}`);
    downloadBinaryFile(SMF_EXPORT_FILENAME, result.smfData, "audio/midi");
    appendLog(
      `SMF export: ${SMF_EXPORT_FILENAME} (${result.smfData.byteLength} bytes)`
    );
  } finally {
    isSmfExporting = false;
    smfExportButtonEl.disabled = false;
  }
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
  if (!getEffectiveChordInput().trim()) {
    return;
  }

  return sendCurrentMml();
}, AUTO_SEND_DELAY_MS);
const debouncedSyncAbRepeat = createDebouncedCallback(() => {
  return applyAbRepeat({ source: "auto" });
}, AUTO_SEND_DELAY_MS);

function syncTopLevelAutoSend(): void {
  if (!isCmrtReady) {
    debouncedSendMml.cancel();
    return;
  }

  const canSendToChordTargets =
    parseNonNegativeInteger(chordTrackEl.value) !== null &&
    parseNonNegativeInteger(chordMeasureEl.value) !== null;
  syncDebouncedAutoSend(
    getEffectiveChordInput(),
    debouncedSendMml,
    canSendToChordTargets
  );
}

function syncTopLevelAbRepeat(): void {
  syncDebouncedAbRepeat({
    isCmrtReady,
    nextRange: getCurrentAbRepeatRange(),
    appliedRange: appliedAbRepeatRange,
    debouncedSync: debouncedSyncAbRepeat,
  });
}

function syncChordInputStateAfterChange(
  source: ToneChordPreviewInputSource = "other"
): void {
  saveText(INPUT_STORAGE_KEY, inputEl.value);
  syncAutoAdjustPanel();
  renderChordHistorySelect();
  renderChordTemplateSelect();
  syncMeasureGridHighlightTargets();
  syncTopLevelAutoSend();
  syncTopLevelAbRepeat();
  void syncPianoRollPreview();
  syncToneChordPreviewAfterInputChange({
    isToneFallbackMode,
    source,
    cancelPreview: cancelToneChordPreview,
    syncPreview: () => {
      void syncToneChordPreview();
    },
  });
}

const { hasStoredChordTrack, hasStoredBassTrack } = restoreTopLevelStateFromStorage();
syncAutoAdjustPanel();
renderChordTemplateSelect();
void loadChordTemplates();
measureGridController.syncControls();
measureGridController.render();
syncMeasureGridHighlightTargets();
syncPlaybackButtonState();
void syncPianoRollPreview();
void initializeToneChordPlayback().catch((error: unknown) => {
  reportTonePreviewError(error);
});
showStartupOverlay(STARTUP_CONNECTING_OVERLAY);
void ensureCmrtReady();

window.addEventListener("beforeunload", () => {
  if (measureGridAutoFetchTimer !== null) {
    window.clearInterval(measureGridAutoFetchTimer);
  }
  clearStartupConnectivityRetry();
  cancelQueuedMeasureGridReload();
  debouncedSendMml.cancel();
  debouncedSyncAbRepeat.cancel();
  clearToneFallbackPlaybackReset();
  cancelToneChordPreview();
  hideChordAnalysisErrorBalloon();
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
  syncTopLevelAbRepeat();
});
bassTrackEl.addEventListener("input", () => {
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  syncMeasureGridTrackHeaderActions();
  syncTopLevelAutoSend();
});
autoAdjustPanel.addChangeListener(() => {
  saveText(AUTO_ADJUST_CHORDS_STORAGE_KEY, autoAdjustPanel.storageValue);
  syncChordInputStateAfterChange();
});
inputEl.addEventListener("input", () => {
  selectedChordTemplateDegrees = null;
  syncChordInputStateAfterChange("textarea");
});
chordHistorySelectEl.addEventListener("change", () => {
  const selectedChord = chordHistorySelectEl.value;
  if (selectedChord === "") {
    return;
  }

  selectedChordTemplateDegrees = null;
  inputEl.value = selectedChord;
  rememberChordHistoryEntry(inputEl.value);
  syncChordInputStateAfterChange();
  inputEl.focus();
});
chordTemplateKeySelectEl.addEventListener("change", () => {
  applySelectedChordTemplateToInput("template");
});
chordTemplateSelectEl.addEventListener("change", () => {
  const selectedTemplate = chordTemplateSelectEl.value;
  if (selectedTemplate === "") {
    return;
  }

  selectedChordTemplateDegrees = selectedTemplate;
  applySelectedChordTemplateToInput("template");
  chordTemplateSelectEl.focus();
});
playStartButtonEl.addEventListener("click", async () => {
  cancelToneChordPreview();
  clearToneFallbackPlaybackReset();
  if (!isCmrtReady) {
    const effectiveInput = getEffectiveChordInput();
    const source = buildChordPlaybackSource(effectiveInput);
    if (!source.ok) {
      if (source.reason === "unrecognized-chord") {
        const message = `コードを認識できませんでした: "${effectiveInput.trim()}"`;
        appendLog(`ERROR: ${message}`);
        showChordAnalysisErrorBalloon(message);
      }
      return;
    }

    try {
      const durationSeconds = await playToneChordMml({
        mml: source.chordMml,
      });
      appendLog("Tone.js chord play を開始しました");
      setPlaybackBackend("tone");
      scheduleToneFallbackPlaybackReset(durationSeconds);
    } catch (error: unknown) {
      appendLog(`ERROR: Tone.js chord play の開始に失敗しました: ${String(error)}`);
    }
    return;
  }

  stopToneChordPlayback();
  const started = await runPlaybackAction({
    action: "start",
    source: "manual",
    client: dawClient,
    appendLog,
  });
  if (!started) {
    return;
  }

  setPlaybackBackend("cmrt");
});
playStopButtonEl.addEventListener("click", async () => {
  clearToneFallbackPlaybackReset();
  if (currentPlaybackBackend === "tone") {
    stopToneChordPlayback();
    appendLog("Tone.js chord play を停止しました");
    setPlaybackBackend(null);
    return;
  }

  const stopped = await runPlaybackAction({
    action: "stop",
    source: "manual",
    client: dawClient,
    appendLog,
  });
  if (!stopped) {
    return;
  }

  setPlaybackBackend(null);
});
logToggleButtonEl.addEventListener("click", () => {
  setLogVisible(logEl.hidden);
});
smfExportButtonEl.addEventListener("click", () => {
  void exportCurrentSmf();
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

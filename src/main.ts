import "./style.css";
import "./auto-adjust.css";
import {
  AUTO_ADJUST_CHORDS_STORAGE_KEY,
  AUTO_SEND_DELAY_MS,
  BASS_TRACK_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  DEFAULT_MEASURE_GRID_CONFIG,
  INPUT_STORAGE_KEY,
  MAX_AUTO_EXPANDED_MEASURE_COUNT,
  MAX_AUTO_EXPANDED_TRACK_COUNT,
} from "./app-constants.ts";
import { getAppDomElements } from "./app-dom.ts";
import { createAppendLog } from "./app-log.ts";
import {
  createLocalStorageAccess,
  exportManagedLocalStorageSnapshot,
  importManagedLocalStorageSnapshot,
  loadStoredBoolean,
  loadStoredTarget,
  loadStoredText,
  saveTarget,
  saveText,
} from "./app-storage-io.ts";
import { createAutoAdjustPanel } from "./auto-adjust-panel.ts";
import { buildChordPlaybackSource } from "./chord-playback-source.ts";
import { createChordSelectionController } from "./chord-selection-controller.ts";
import { createChordProgressionEditor } from "./chord-progression-highlight.ts";
import { createChordAnalysisErrorBalloon } from "./chord-analysis-error-balloon.ts";
import { createCmrtRuntime, type CmrtRuntime } from "./cmrt-runtime.ts";
import { DawClient } from "./daw-client.ts";
import { createMeasureGridController } from "./measure-grid.ts";
import { DEFAULT_MEASURE, DEFAULT_TRACK, parseNonNegativeInteger } from "./post-config.ts";
import { createPianoRollPreviewController } from "./piano-roll-preview-controller.ts";
import { getPlaybackButtonState, runPlaybackAction } from "./playback.ts";
import { sendMml } from "./send-mml.ts";
import { createMmlabcToSmfConverter } from "./smf-export.ts";
import { createSmfExportController } from "./smf-export-controller.ts";
import { STARTUP_CONNECTING_OVERLAY } from "./startup-overlay.ts";
import { createStartupOverlayController } from "./startup-overlay-controller.ts";
import { playToneChordMml } from "./tone-chord-playback.ts";
import { createTonePreviewController } from "./tone-preview-controller.ts";
import type { ToneChordPreviewInputSource } from "./tone-chord-preview-sync.ts";

type PlaybackBackend = "cmrt" | "tone" | null;

const dom = getAppDomElements();
const appendLog = createAppendLog(dom.logEl);
const storage = createLocalStorageAccess(appendLog);
const startupOverlay = createStartupOverlayController(dom);
const chordAnalysisErrorBalloon = createChordAnalysisErrorBalloon(
  dom.chordAnalysisErrorBalloonEl
);
const smfConverter = createMmlabcToSmfConverter();
const dawClient = DawClient.localDefault();
const inputEl = createChordProgressionEditor({
  element: dom.inputEditorEl,
});
const autoAdjustOutputEditor = createChordProgressionEditor({
  element: dom.autoAdjustOutputEditorEl,
});
const autoAdjustPanel = createAutoAdjustPanel({
  enabledEl: dom.autoAdjustChordsEl,
  panelEl: dom.autoAdjustOutputPanelEl,
  outputEl: autoAdjustOutputEditor,
  statusEl: dom.autoAdjustStatusEl,
});

let currentPlaybackBackend: PlaybackBackend = null;
let cmrtRuntime: CmrtRuntime | null = null;

function saveTargetValue(key: string, element: HTMLInputElement): void {
  saveTarget(storage, key, element);
}

function saveTextValue(key: string, value: string): void {
  saveText(storage, key, value);
}

function getTargetValue(element: HTMLInputElement, name: string): number | null {
  const parsed = parseNonNegativeInteger(element.value);
  if (parsed === null) {
    appendLog(`ERROR: ${name} には 0 以上の整数を指定してください`);
    return null;
  }
  return parsed;
}

function setLogVisible(visible: boolean): void {
  dom.logEl.hidden = !visible;
  dom.logToggleButtonEl.setAttribute("aria-expanded", visible ? "true" : "false");
}

function syncPlaybackButtonState(): void {
  const buttonState = getPlaybackButtonState(currentPlaybackBackend !== null);
  dom.playStartButtonEl.disabled = buttonState.playDisabled;
  dom.playStopButtonEl.disabled = buttonState.stopDisabled;
}

function setPlaybackBackend(nextBackend: PlaybackBackend): void {
  currentPlaybackBackend = nextBackend;
  syncPlaybackButtonState();
  cmrtRuntime?.syncMeasureGridTrackHeaderActions();
}

function syncAutoAdjustPanel(): void {
  autoAdjustPanel.sync(inputEl.value);
}

function getEffectiveChordInput(): string {
  return autoAdjustPanel.getEffectiveInput(inputEl.value);
}

const measureGridController = createMeasureGridController({
  elements: {
    trackStartEl: dom.gridTrackStartEl,
    trackCountEl: dom.gridTrackCountEl,
    measureStartEl: dom.gridMeasureStartEl,
    measureCountEl: dom.gridMeasureCountEl,
    headEl: dom.measureGridHeadEl,
    bodyEl: dom.measureGridBodyEl,
  },
  dawClient,
  appendLog,
  getRowHeaderActions: (track) => cmrtRuntime?.getRowHeaderActions(track) ?? [],
  autoSendDelayMs: AUTO_SEND_DELAY_MS,
  maxAutoExpandedTrackCount: MAX_AUTO_EXPANDED_TRACK_COUNT,
  maxAutoExpandedMeasureCount: MAX_AUTO_EXPANDED_MEASURE_COUNT,
  initialConfig: DEFAULT_MEASURE_GRID_CONFIG,
});

const pianoRollPreview = createPianoRollPreviewController({
  contentEl: dom.pianoRollContentEl,
  smfConverter,
  getInput: getEffectiveChordInput,
  appendLog,
});

const tonePreview = createTonePreviewController({
  getInput: getEffectiveChordInput,
  getPlaybackBackend: () => currentPlaybackBackend,
  setPlaybackBackend,
  isToneFallbackMode: () => cmrtRuntime?.isToneFallbackMode ?? false,
  appendLog,
});

const chordSelection = createChordSelectionController({
  inputEl,
  chordHistorySelectEl: dom.chordHistorySelectEl,
  chordTemplateKeySelectEl: dom.chordTemplateKeySelectEl,
  chordTemplateSelectEl: dom.chordTemplateSelectEl,
  storage,
  appendLog,
  onInputChange: syncChordInputStateAfterChange,
});

async function sendCurrentMml(): Promise<void> {
  const chordTrack = getTargetValue(dom.chordTrackEl, "chord track");
  const chordMeasure = getTargetValue(dom.chordMeasureEl, "chord meas");
  if (chordTrack === null || chordMeasure === null) {
    return;
  }
  if (!chordSelection.isCurrentInputFromSelectedTemplate()) {
    chordSelection.rememberChordHistoryEntry(inputEl.value);
  }
  await sendMml({
    input: getEffectiveChordInput(),
    chordTrack,
    chordMeasure,
    bassTrackValue: dom.bassTrackEl.value,
    client: dawClient,
    appendLog,
    onChordAnalysisError: chordAnalysisErrorBalloon.show,
    reflectValue: (track, measure, mml) =>
      measureGridController.reflectValue(track, measure, mml),
  });
}

cmrtRuntime = createCmrtRuntime({
  dawClient,
  measureGridController,
  cmrtTargetSettingsEl: dom.cmrtTargetSettingsEl,
  chordTrackEl: dom.chordTrackEl,
  chordMeasureEl: dom.chordMeasureEl,
  bassTrackEl: dom.bassTrackEl,
  appendLog,
  saveTarget: saveTargetValue,
  getEffectiveChordInput,
  sendCurrentMml,
  cancelToneChordPreview: tonePreview.cancelPreview,
  setPlaybackBackend,
  showStartupOverlay: startupOverlay.show,
  hideStartupOverlay: startupOverlay.hide,
});

const smfExportController = createSmfExportController({
  inputEl,
  smfExportButtonEl: dom.smfExportButtonEl,
  smfConverter,
  getInput: getEffectiveChordInput,
  isCurrentInputFromSelectedTemplate: chordSelection.isCurrentInputFromSelectedTemplate,
  rememberChordHistoryEntry: chordSelection.rememberChordHistoryEntry,
  showChordAnalysisErrorBalloon: chordAnalysisErrorBalloon.show,
  appendLog,
});

function persistTopLevelStateToStorage(): void {
  saveTextValue(INPUT_STORAGE_KEY, inputEl.value);
  chordSelection.saveChordHistory();
  saveTargetValue(CHORD_TRACK_STORAGE_KEY, dom.chordTrackEl);
  saveTargetValue(CHORD_MEASURE_STORAGE_KEY, dom.chordMeasureEl);
  saveTargetValue(BASS_TRACK_STORAGE_KEY, dom.bassTrackEl);
  saveTextValue(AUTO_ADJUST_CHORDS_STORAGE_KEY, autoAdjustPanel.storageValue);
}

function restoreTopLevelStateFromStorage(): {
  hasStoredChordTrack: boolean;
  hasStoredBassTrack: boolean;
} {
  chordSelection.clearSelectedTemplate();
  loadStoredText(storage, INPUT_STORAGE_KEY, "", inputEl);
  autoAdjustPanel.enabled = loadStoredBoolean(
    storage,
    AUTO_ADJUST_CHORDS_STORAGE_KEY,
    false
  );
  chordSelection.loadStoredChordHistory();
  const hasStoredChordTrack = loadStoredTarget(
    storage,
    CHORD_TRACK_STORAGE_KEY,
    DEFAULT_TRACK,
    dom.chordTrackEl
  );
  loadStoredTarget(
    storage,
    CHORD_MEASURE_STORAGE_KEY,
    DEFAULT_MEASURE,
    dom.chordMeasureEl
  );
  const hasStoredBassTrack = loadStoredTarget(
    storage,
    BASS_TRACK_STORAGE_KEY,
    DEFAULT_TRACK,
    dom.bassTrackEl
  );

  return { hasStoredChordTrack, hasStoredBassTrack };
}

function syncChordInputStateAfterChange(
  source: ToneChordPreviewInputSource = "other"
): void {
  saveTextValue(INPUT_STORAGE_KEY, inputEl.value);
  syncAutoAdjustPanel();
  chordSelection.renderHistorySelect();
  chordSelection.renderTemplateSelect();
  cmrtRuntime?.syncMeasureGridHighlightTargets();
  cmrtRuntime?.syncTopLevelAutoSend();
  cmrtRuntime?.syncTopLevelAbRepeat();
  void pianoRollPreview.sync();
  tonePreview.syncAfterInputChange(source);
}

const { hasStoredChordTrack, hasStoredBassTrack } = restoreTopLevelStateFromStorage();
syncAutoAdjustPanel();
chordSelection.renderTemplateSelect();
void chordSelection.loadChordTemplates();
measureGridController.syncControls();
measureGridController.render();
cmrtRuntime.syncMeasureGridHighlightTargets();
syncPlaybackButtonState();
void pianoRollPreview.sync();
tonePreview.initialize();
startupOverlay.show(STARTUP_CONNECTING_OVERLAY);
cmrtRuntime.start({
  shouldSelectChordTrack: !hasStoredChordTrack,
  shouldSelectBassTrack: !hasStoredBassTrack,
});

window.addEventListener("beforeunload", () => {
  cmrtRuntime?.cleanup();
  tonePreview.clearPlaybackReset();
  tonePreview.cancelPreview();
  chordAnalysisErrorBalloon.hide();
});

dom.chordTrackEl.addEventListener("input", () => {
  saveTargetValue(CHORD_TRACK_STORAGE_KEY, dom.chordTrackEl);
  cmrtRuntime?.syncMeasureGridTrackHeaderActions();
  cmrtRuntime?.syncTopLevelAutoSend();
});
dom.chordMeasureEl.addEventListener("input", () => {
  saveTargetValue(CHORD_MEASURE_STORAGE_KEY, dom.chordMeasureEl);
  cmrtRuntime?.syncMeasureGridHighlightTargets();
  cmrtRuntime?.syncTopLevelAutoSend();
  cmrtRuntime?.syncTopLevelAbRepeat();
});
dom.bassTrackEl.addEventListener("input", () => {
  saveTargetValue(BASS_TRACK_STORAGE_KEY, dom.bassTrackEl);
  cmrtRuntime?.syncMeasureGridTrackHeaderActions();
  cmrtRuntime?.syncTopLevelAutoSend();
});
autoAdjustPanel.addChangeListener(() => {
  saveTextValue(AUTO_ADJUST_CHORDS_STORAGE_KEY, autoAdjustPanel.storageValue);
  syncChordInputStateAfterChange();
});
inputEl.addEventListener("input", () => {
  chordSelection.clearSelectedTemplate();
  syncChordInputStateAfterChange("textarea");
});
dom.chordHistorySelectEl.addEventListener("change", () => {
  chordSelection.selectHistoryEntry();
});
dom.chordTemplateKeySelectEl.addEventListener("change", () => {
  chordSelection.applySelectedChordTemplateToInput("template");
});
dom.chordTemplateSelectEl.addEventListener("change", () => {
  chordSelection.selectTemplate();
});
dom.playStartButtonEl.addEventListener("click", async () => {
  tonePreview.cancelPreview();
  tonePreview.clearPlaybackReset();
  if (!cmrtRuntime?.isCmrtReady) {
    const effectiveInput = getEffectiveChordInput();
    const source = buildChordPlaybackSource(effectiveInput);
    if (!source.ok) {
      if (source.reason === "unrecognized-chord") {
        const message = `コードを認識できませんでした: "${effectiveInput.trim()}"`;
        appendLog(`ERROR: ${message}`);
        chordAnalysisErrorBalloon.show(message);
      }
      return;
    }

    try {
      const durationSeconds = await playToneChordMml({ mml: source.chordMml });
      appendLog("Tone.js chord play を開始しました");
      setPlaybackBackend("tone");
      tonePreview.schedulePlaybackReset(durationSeconds);
    } catch (error: unknown) {
      appendLog(`ERROR: Tone.js chord play の開始に失敗しました: ${String(error)}`);
    }
    return;
  }

  tonePreview.stopPlayback();
  const started = await runPlaybackAction({
    action: "start",
    source: "manual",
    client: dawClient,
    appendLog,
  });
  if (started) {
    setPlaybackBackend("cmrt");
  }
});
dom.playStopButtonEl.addEventListener("click", async () => {
  tonePreview.clearPlaybackReset();
  if (currentPlaybackBackend === "tone") {
    tonePreview.stopPlayback();
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
  if (stopped) {
    setPlaybackBackend(null);
  }
});
dom.logToggleButtonEl.addEventListener("click", () => {
  setLogVisible(dom.logEl.hidden);
});
dom.smfExportButtonEl.addEventListener("click", () => {
  void smfExportController.exportCurrentSmf();
});
dom.localStorageExportButtonEl.addEventListener("click", () => {
  exportManagedLocalStorageSnapshot({
    storage,
    persistState: persistTopLevelStateToStorage,
    appendLog,
  });
});
dom.localStorageImportButtonEl.addEventListener("click", () => {
  dom.localStorageImportFileEl.click();
});
dom.localStorageImportFileEl.addEventListener("change", () => {
  const file = dom.localStorageImportFileEl.files?.item(0);
  dom.localStorageImportFileEl.value = "";
  if (file === null || file === undefined) {
    return;
  }

  void importManagedLocalStorageSnapshot({
    file,
    storage,
    beforeImport: () => {
      cmrtRuntime?.cancelPendingSync();
    },
    afterImport: () => {
      restoreTopLevelStateFromStorage();
      syncAutoAdjustPanel();
      cmrtRuntime?.syncMeasureGridHighlightTargets();
      if (cmrtRuntime?.isCmrtReady) {
        void cmrtRuntime.applyAbRepeat({ source: "auto" });
      }
    },
    appendLog,
  });
});
for (const element of [
  dom.gridTrackStartEl,
  dom.gridTrackCountEl,
  dom.gridMeasureStartEl,
  dom.gridMeasureCountEl,
]) {
  element.addEventListener("change", () => {
    if (!cmrtRuntime?.applyMeasureGridConfigFromControls()) {
      return;
    }

    void cmrtRuntime.reloadMeasureGridFromCmrt();
  });
}

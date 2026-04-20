import "../styles/style.css";
import "../auto-adjust/auto-adjust.css";
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
import { initializeToneFallbackUi } from "./tone-fallback-ui.ts";
import { getTargetValue } from "./app-target-value.ts";
import { syncDawPlaybackVisuals } from "./app-daw-status-sync.ts";
import { createAppToneInstrumentSettings } from "./app-tone-instrument-settings.ts";
import { playCurrentToneChord } from "./app-tone-playback.ts";
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
import { createAutoAdjustPanel } from "../auto-adjust/auto-adjust-panel.ts";
import { createChordSelectionController } from "../chords/chord-selection-controller.ts";
import { createChordProgressionEditor } from "../chords/chord-progression-highlight.ts";
import { createChordAnalysisErrorBalloon } from "../chords/chord-analysis-error-balloon.ts";
import { createCmrtRuntime, type CmrtRuntime } from "./cmrt-runtime.ts";
import { DawClient } from "../daw/daw-client.ts";
import { createMeasureGridController } from "../measure-grid/measure-grid.ts";
import { DEFAULT_MEASURE, DEFAULT_TRACK } from "../daw/post-config.ts";
import { createPianoRollPreviewController } from "../piano-roll/piano-roll-preview-controller.ts";
import { getPlaybackButtonState, runPlaybackAction } from "../daw/playback.ts";
import { sendMml } from "../daw/send-mml.ts";
import { createDawStatusPollingController } from "../daw/status.ts";
import { createMmlabcToSmfConverter } from "../smf/smf-export.ts";
import { createSmfExportController } from "../smf/smf-export-controller.ts";
import { STARTUP_CONNECTING_OVERLAY } from "../startup/startup-overlay.ts";
import { createStartupOverlayController } from "../startup/startup-overlay-controller.ts";
import { createTonePreviewController } from "../tone/tone-preview-controller.ts";
import type { ToneChordPreviewInputSource } from "../tone/tone-chord-preview-sync.ts";

type PlaybackBackend = "cmrt" | "tone" | null;
const dom = getAppDomElements();
const toneFallbackUi = initializeToneFallbackUi(dom);
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
  appendLog,
});
let onToneInstrumentMmlChange = (): void => {};
const toneInstrumentSettings = createAppToneInstrumentSettings({
  dom, storage, appendLog, onInstrumentMmlChange: () => onToneInstrumentMmlChange(),
});
let currentPlaybackBackend: PlaybackBackend = null;
let cmrtRuntime: CmrtRuntime | null = null;
function saveTargetValue(key: string, element: HTMLInputElement): void {
  saveTarget(storage, key, element);
}
function saveTextValue(key: string, value: string): void {
  saveText(storage, key, value);
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
const dawStatusPolling = createDawStatusPollingController({ client: dawClient, statusEl: dom.dawStatusEl, onStatus: (status, timing) => syncDawPlaybackVisuals({ status, timing, chordMeasureEl: dom.chordMeasureEl, measureGridController, pianoRollPreview }) });

const tonePreview = createTonePreviewController({
  getInput: getEffectiveChordInput,
  getInstrumentMml: toneInstrumentSettings.getInstrumentMml,
  getPlaybackBackend: () => currentPlaybackBackend,
  setPlaybackBackend,
  isToneFallbackMode: () => cmrtRuntime?.isToneFallbackMode ?? false,
  appendLog,
});

const chordSelection = createChordSelectionController({
  inputEl,
  chordHistorySelectEl: dom.chordHistorySelectEl,
  chordSearchShellEl: dom.chordSearchShellEl,
  chordSearchButtonEl: dom.chordSearchButtonEl,
  chordSearchInputEl: dom.chordSearchInputEl,
  chordSearchResultsEl: dom.chordSearchResultsEl,
  chordTemplateKeySelectEl: dom.chordTemplateKeySelectEl,
  chordTemplateSelectEl: dom.chordTemplateSelectEl,
  storage,
  appendLog,
  onInputChange: syncChordInputStateAfterChange,
});

function playToneInstrumentPreview(): Promise<boolean> {
  return playCurrentToneChord({
    getInput: getEffectiveChordInput,
    getInstrumentMml: toneInstrumentSettings.getInstrumentMml,
    cancelTonePreview: tonePreview.cancelPreview,
    clearTonePlaybackReset: tonePreview.clearPlaybackReset,
    scheduleTonePlaybackReset: tonePreview.schedulePlaybackReset,
    setPlaybackBackend,
    appendLog,
    showChordAnalysisErrorBalloon: chordAnalysisErrorBalloon.show,
  });
}
onToneInstrumentMmlChange = () => {
  void playToneInstrumentPreview();
};

async function sendCurrentMml(): Promise<void> {
  const chordTrack = getTargetValue(dom.chordTrackEl, "chord track", appendLog);
  const chordMeasure = getTargetValue(dom.chordMeasureEl, "chord meas", appendLog);
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
  toneInstrumentSettings.persistState();
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
  toneInstrumentSettings.restoreState();
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
void toneInstrumentSettings.loadToneInstruments();
measureGridController.syncControls();
measureGridController.render();
cmrtRuntime.syncMeasureGridHighlightTargets();
syncPlaybackButtonState();
void pianoRollPreview.sync();
tonePreview.initialize();
startupOverlay.show(STARTUP_CONNECTING_OVERLAY);
dawStatusPolling.start();
cmrtRuntime.start({
  shouldSelectChordTrack: !hasStoredChordTrack,
  shouldSelectBassTrack: !hasStoredBassTrack,
});

window.addEventListener("beforeunload", () => {
  toneFallbackUi.disconnect();
  toneInstrumentSettings.persistState();
  cmrtRuntime?.cleanup();
  dawStatusPolling.stop();
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
dom.chordSearchButtonEl.addEventListener("click", () => {
  chordSelection.toggleSearch();
});
dom.chordSearchInputEl.addEventListener("input", () => {
  chordSelection.syncSearch();
});
dom.chordSearchInputEl.addEventListener("keydown", (event) => {
  chordSelection.handleSearchKeydown(event);
});
dom.chordTemplateKeySelectEl.addEventListener("change", () => {
  chordSelection.applySelectedChordTemplateToInput("template");
});
dom.chordTemplateSelectEl.addEventListener("change", () => {
  chordSelection.selectTemplate();
});
dom.toneInstrumentPlayButtonEl.addEventListener("click", () => {
  void playToneInstrumentPreview();
});
dom.playStartButtonEl.addEventListener("click", async () => {
  if (!cmrtRuntime?.isCmrtReady) {
    await playToneInstrumentPreview();
    return;
  }

  tonePreview.cancelPreview();
  tonePreview.clearPlaybackReset();
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
      tonePreview.syncAfterInputChange("other");
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

import {
  AUTO_SEND_DELAY_MS,
  AUTO_TARGET_TRACK_SCAN_END,
  AUTO_TARGET_TRACK_SCAN_START,
  BASS_TRACK_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  GRID_AUTO_FETCH_INTERVAL_MS,
  INIT_MEASURE,
  STARTUP_CONNECTIVITY_RETRY_MS,
} from "./app-constants.ts";
import {
  getStartupAbRepeatRange,
  isSameAbRepeatRange,
  syncDebouncedAbRepeat,
  type StartupAbRepeatRange,
} from "../automation/ab-repeat.ts";
import { syncDebouncedAutoSend } from "../automation/auto-send.ts";
import { selectAutoTargetTracks, type AutoTargetCandidate } from "../automation/auto-targets.ts";
import { createDebouncedCallback } from "../utils/debounce.ts";
import { DawClient, dawClientErrorMessage } from "../daw/daw-client.ts";
import type { createMeasureGridController } from "../measure-grid/measure-grid.ts";
import {
  parseNonNegativeInteger,
  resolveBassTargets,
} from "../daw/post-config.ts";
import { getStartupErrorOverlay } from "../startup/startup-overlay.ts";
import { runPlaybackAction } from "../daw/playback.ts";

type MeasureGridController = ReturnType<typeof createMeasureGridController>;
type PlaybackBackend = "cmrt" | "tone" | null;

interface CmrtRuntimeOptions {
  dawClient: DawClient;
  measureGridController: MeasureGridController;
  cmrtTargetSettingsEl: HTMLDivElement;
  chordTrackEl: HTMLInputElement;
  chordMeasureEl: HTMLInputElement;
  bassTrackEl: HTMLInputElement;
  appendLog: (message: string) => void;
  saveTarget: (key: string, element: HTMLInputElement) => void;
  getEffectiveChordInput: () => string;
  sendCurrentMml: () => Promise<void>;
  cancelToneChordPreview: () => void;
  setPlaybackBackend: (backend: PlaybackBackend) => void;
  showStartupOverlay: (state: ReturnType<typeof getStartupErrorOverlay>) => void;
  hideStartupOverlay: () => void;
}

interface CmrtRuntimeStartupOptions {
  shouldSelectChordTrack: boolean;
  shouldSelectBassTrack: boolean;
}

export interface CmrtRuntime {
  readonly isCmrtReady: boolean;
  readonly isToneFallbackMode: boolean;
  getCurrentAbRepeatRange(): StartupAbRepeatRange | null;
  getRowHeaderActions(track: number): {
    label: string;
    ariaLabel: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
  syncMeasureGridTrackHeaderActions(): void;
  syncMeasureGridHighlightTargets(): void;
  applyMeasureGridConfigFromControls(): boolean;
  syncTopLevelAutoSend(): void;
  syncTopLevelAbRepeat(): void;
  applyAbRepeat(options: { source: "startup" | "auto"; force?: boolean }): Promise<void>;
  reloadMeasureGridFromCmrt(): Promise<void>;
  start(options: CmrtRuntimeStartupOptions): void;
  cancelPendingSync(): void;
  cleanup(): void;
}

export function createCmrtRuntime(options: CmrtRuntimeOptions): CmrtRuntime {
  const {
    dawClient,
    measureGridController,
    cmrtTargetSettingsEl,
    chordTrackEl,
    chordMeasureEl,
    bassTrackEl,
    appendLog,
    saveTarget,
    getEffectiveChordInput,
    sendCurrentMml,
    cancelToneChordPreview,
    setPlaybackBackend,
    showStartupOverlay,
    hideStartupOverlay,
  } = options;

  let startupOptions: CmrtRuntimeStartupOptions = {
    shouldSelectChordTrack: false,
    shouldSelectBassTrack: false,
  };
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

  const debouncedSendMml = createDebouncedCallback(() => {
    if (!getEffectiveChordInput().trim()) {
      return;
    }

    return sendCurrentMml();
  }, AUTO_SEND_DELAY_MS);
  const debouncedSyncAbRepeat = createDebouncedCallback(() => {
    return applyAbRepeat({ source: "auto" });
  }, AUTO_SEND_DELAY_MS);

  function syncToneFallbackVisibility(): void {
    cmrtTargetSettingsEl.hidden = isToneFallbackMode;
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

  function syncMeasureGridHighlightTargets(): void {
    const chordTrack = parseNonNegativeInteger(chordTrackEl.value);
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

    measureGridController.setHighlightTargets({ chordTarget, bassTarget });
  }

  function syncMeasureGridTrackHeaderActions(): void {
    measureGridController.render();
    syncMeasureGridHighlightTargets();
  }

  function applyMeasureGridConfigFromControls(): boolean {
    const nextConfig = measureGridController.readConfigFromControls();
    if (nextConfig === null) {
      return false;
    }

    measureGridController.applyConfig(nextConfig);
    return true;
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

  async function autoSelectTracksFromCmrt(): Promise<void> {
    if (
      !startupOptions.shouldSelectChordTrack &&
      !startupOptions.shouldSelectBassTrack
    ) {
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

    if (startupOptions.shouldSelectChordTrack && selection.chordTrack !== null) {
      chordTrackEl.value = String(selection.chordTrack);
      saveTarget(CHORD_TRACK_STORAGE_KEY, chordTrackEl);
    }

    if (startupOptions.shouldSelectBassTrack && selection.bassTrack !== null) {
      bassTrackEl.value = String(selection.bassTrack);
      saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
    }

    if (
      (startupOptions.shouldSelectChordTrack && selection.chordTrack !== null) ||
      (startupOptions.shouldSelectBassTrack && selection.bassTrack !== null)
    ) {
      const selectedTargets: string[] = [];
      if (startupOptions.shouldSelectChordTrack && selection.chordTrack !== null) {
        selectedTargets.push(`chord track=${selection.chordTrack}`);
      }
      if (startupOptions.shouldSelectBassTrack && selection.bassTrack !== null) {
        selectedTargets.push(`bass track=${selection.bassTrack}`);
      }
      appendLog(`起動時に track を自動選択: ${selectedTargets.join(", ")}`);
      syncMeasureGridTrackHeaderActions();
    }
  }

  async function startAppAfterCmrtReady(options: {
    autoStartPlayback: boolean;
  }): Promise<void> {
    isToneFallbackMode = false;
    syncToneFallbackVisibility();
    syncMeasureGridTrackHeaderActions();
    hideStartupOverlay();
    clearStartupConnectivityRetry();
    await applyAbRepeat({ source: "startup", force: true });
    void autoSelectTracksFromCmrt();
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

  async function postRandomPatchForTarget(
    element: HTMLInputElement,
    name: "chord" | "bass"
  ): Promise<void> {
    const track = parseNonNegativeInteger(element.value);
    if (track === null) {
      appendLog(`ERROR: ${name} track には 0 以上の整数を指定してください`);
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

  return {
    get isCmrtReady(): boolean {
      return isCmrtReady;
    },
    get isToneFallbackMode(): boolean {
      return isToneFallbackMode;
    },
    getCurrentAbRepeatRange,
    getRowHeaderActions(track: number) {
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
    syncMeasureGridTrackHeaderActions,
    syncMeasureGridHighlightTargets,
    applyMeasureGridConfigFromControls,
    syncTopLevelAutoSend,
    syncTopLevelAbRepeat,
    applyAbRepeat,
    reloadMeasureGridFromCmrt,
    start(options: CmrtRuntimeStartupOptions): void {
      startupOptions = options;
      void ensureCmrtReady();
    },
    cancelPendingSync(): void {
      debouncedSendMml.cancel();
      debouncedSyncAbRepeat.cancel();
    },
    cleanup(): void {
      if (measureGridAutoFetchTimer !== null) {
        window.clearInterval(measureGridAutoFetchTimer);
      }
      clearStartupConnectivityRetry();
      cancelQueuedMeasureGridReload();
      debouncedSendMml.cancel();
      debouncedSyncAbRepeat.cancel();
    },
  };
}

import { buildChordPlaybackSource } from "../chords/chord-playback-source.ts";
import {
  initializeToneChordPlayback,
  playToneChordMml,
  stopToneChordPlayback,
} from "./tone-chord-playback.ts";
import {
  syncToneChordPreviewAfterInputChange,
  type ToneChordPreviewInputSource,
} from "./tone-chord-preview-sync.ts";
import { buildTonePlaybackMml } from "./tone-playback-mml.ts";

interface TonePreviewControllerOptions {
  getInput: () => string;
  getInstrumentMml: () => string;
  getPlaybackBackend: () => "cmrt" | "tone" | null;
  setPlaybackBackend: (backend: "cmrt" | "tone" | null) => void;
  isToneFallbackMode: () => boolean;
  appendLog: (message: string) => void;
}

export function createTonePreviewController(options: TonePreviewControllerOptions): {
  initialize(): void;
  cancelPreview(): void;
  clearPlaybackReset(): void;
  schedulePlaybackReset(durationSeconds: number): void;
  reportPreviewError(error: unknown): void;
  stopPlayback(): void;
  syncPreview(): Promise<void>;
  syncAfterInputChange(source: ToneChordPreviewInputSource): void;
} {
  let previewRequestId = 0;
  let playbackResetTimer: number | null = null;
  let lastPreviewErrorMessage: string | null = null;

  function cancelPreview(): void {
    previewRequestId += 1;
    stopToneChordPlayback();
  }

  function clearPlaybackReset(): void {
    if (playbackResetTimer === null) {
      return;
    }

    window.clearTimeout(playbackResetTimer);
    playbackResetTimer = null;
  }

  function schedulePlaybackReset(durationSeconds: number): void {
    clearPlaybackReset();
    playbackResetTimer = window.setTimeout(() => {
      playbackResetTimer = null;
      if (options.getPlaybackBackend() !== "tone") {
        return;
      }

      options.setPlaybackBackend(null);
    }, Math.max(0, durationSeconds * 1000 + 100));
  }

  function reportPreviewError(error: unknown): void {
    const message = `ERROR: Tone.js chord preview に失敗しました: ${String(error)}`;
    if (message === lastPreviewErrorMessage) {
      return;
    }

    lastPreviewErrorMessage = message;
    options.appendLog(message);
  }

  async function syncPreview(): Promise<void> {
    if (options.getPlaybackBackend() !== null) {
      return;
    }

    const requestId = ++previewRequestId;
    const source = buildChordPlaybackSource(options.getInput());
    if (!source.ok) {
      stopToneChordPlayback();
      return;
    }

    try {
      await playToneChordMml({
        mml: buildTonePlaybackMml(source, options.getInstrumentMml()),
        appendLog: options.appendLog,
        shouldContinue: () =>
          requestId === previewRequestId && options.getPlaybackBackend() === null,
      });
      if (requestId === previewRequestId) {
        lastPreviewErrorMessage = null;
      }
    } catch (error: unknown) {
      if (requestId !== previewRequestId) {
        return;
      }

      stopToneChordPlayback();
      reportPreviewError(error);
    }
  }

  return {
    initialize(): void {
      void initializeToneChordPlayback().catch((error: unknown) => {
        reportPreviewError(error);
      });
    },
    cancelPreview,
    clearPlaybackReset,
    schedulePlaybackReset,
    reportPreviewError,
    stopPlayback(): void {
      stopToneChordPlayback();
    },
    syncPreview,
    syncAfterInputChange(source: ToneChordPreviewInputSource): void {
      syncToneChordPreviewAfterInputChange({
        isToneFallbackMode: options.isToneFallbackMode(),
        source,
        cancelPreview,
        syncPreview: () => {
          void syncPreview();
        },
      });
    },
  };
}

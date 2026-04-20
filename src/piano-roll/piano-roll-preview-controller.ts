import {
  PIANO_ROLL_HEIGHT_PX,
  PIANO_ROLL_MIN_NOTE_WIDTH_PERCENT,
} from "../app/app-constants.ts";
import { buildChordPlaybackSource } from "../chords/chord-playback-source.ts";
import { QUARTER_NOTES_PER_MEASURE } from "../measures/measure-input.ts";
import { buildPianoRollPreviewFromSource } from "./piano-roll-preview.ts";
import type { createMmlabcToSmfConverter } from "../smf/smf-export.ts";
import {
  getPianoRollPitchRowBoundaries,
  getPianoRollPitchRowMetrics,
  type PianoRollDisplayData,
} from "./smf-piano-roll.ts";

interface PianoRollPreviewControllerOptions {
  contentEl: HTMLDivElement;
  smfConverter: ReturnType<typeof createMmlabcToSmfConverter>;
  getInput: () => string;
  appendLog: (message: string) => void;
}

export interface PianoRollPlaybackPosition {
  measureOffset: number;
  elapsedMs: number;
  durationMs: number;
  receivedAtMs: number;
  loop?: PianoRollPlaybackLoop | null;
}

export interface PianoRollPlaybackLoop {
  startMeasureOffset: number;
  endMeasureOffset: number;
}

export interface PianoRollPlaybackPlacement {
  measureOffset: number;
  progress: number;
}

export function getPianoRollPlaybackPlacement(
  position: PianoRollPlaybackPosition,
  nowMs: number
): PianoRollPlaybackPlacement {
  if (position.durationMs <= 0) {
    return {
      measureOffset: position.measureOffset,
      progress: 0,
    };
  }

  const elapsedMs = Math.max(
    0,
    position.elapsedMs + (nowMs - position.receivedAtMs)
  );
  const elapsedMeasureCount = Math.floor(elapsedMs / position.durationMs);
  const elapsedInMeasureMs =
    elapsedMs - elapsedMeasureCount * position.durationMs;

  return {
    measureOffset: getPredictedMeasureOffset(position, elapsedMeasureCount),
    progress: elapsedInMeasureMs / position.durationMs,
  };
}

function getPredictedMeasureOffset(
  position: PianoRollPlaybackPosition,
  elapsedMeasureCount: number
): number {
  const loop = position.loop;
  if (
    loop === null ||
    loop === undefined ||
    loop.endMeasureOffset < loop.startMeasureOffset ||
    position.measureOffset < loop.startMeasureOffset ||
    position.measureOffset > loop.endMeasureOffset
  ) {
    return position.measureOffset + elapsedMeasureCount;
  }

  const loopMeasureCount = loop.endMeasureOffset - loop.startMeasureOffset + 1;
  const currentLoopOffset = position.measureOffset - loop.startMeasureOffset;
  return (
    loop.startMeasureOffset +
    ((currentLoopOffset + elapsedMeasureCount) % loopMeasureCount)
  );
}

export function createPianoRollPreviewController(
  options: PianoRollPreviewControllerOptions
): {
  clear(): void;
  sync(): Promise<void>;
  setPlaybackPosition(position: PianoRollPlaybackPosition | null): void;
} {
  const { contentEl, smfConverter, getInput, appendLog } = options;
  let requestId = 0;
  let lastDebugSummary: string | null = null;
  let quarterNoteCount: number | null = null;
  let playbackPosition: PianoRollPlaybackPosition | null = null;
  let playbackMeasureEl: HTMLDivElement | null = null;
  let playbackHeadEl: HTMLDivElement | null = null;
  let playbackAnimationFrameId: number | null = null;

  function clear(): void {
    contentEl.replaceChildren();
    contentEl.classList.add("piano-roll__content--empty");
    contentEl.style.removeProperty("background-size");
    quarterNoteCount = null;
    playbackPosition = null;
    playbackMeasureEl = null;
    playbackHeadEl = null;
    lastDebugSummary = null;
    stopPlaybackAnimation();
  }

  function ensurePlaybackOverlayElements(): {
    measureEl: HTMLDivElement;
    headEl: HTMLDivElement;
  } {
    if (playbackMeasureEl === null) {
      playbackMeasureEl = document.createElement("div");
      playbackMeasureEl.className = "piano-roll__play-measure";
      contentEl.append(playbackMeasureEl);
    }
    if (playbackHeadEl === null) {
      playbackHeadEl = document.createElement("div");
      playbackHeadEl.className = "piano-roll__playhead";
      contentEl.append(playbackHeadEl);
    }

    return {
      measureEl: playbackMeasureEl,
      headEl: playbackHeadEl,
    };
  }

  function removePlaybackOverlayElements(): void {
    playbackMeasureEl?.remove();
    playbackHeadEl?.remove();
    playbackMeasureEl = null;
    playbackHeadEl = null;
  }

  function stopPlaybackAnimation(): void {
    if (playbackAnimationFrameId === null) {
      return;
    }

    window.cancelAnimationFrame(playbackAnimationFrameId);
    playbackAnimationFrameId = null;
  }

  function requestNextPlaybackFrame(): void {
    if (playbackAnimationFrameId !== null) {
      return;
    }

    playbackAnimationFrameId = window.requestAnimationFrame((nowMs) => {
      playbackAnimationFrameId = null;
      syncPlaybackOverlay(nowMs);
      if (playbackPosition !== null) {
        requestNextPlaybackFrame();
      }
    });
  }

  function syncPlaybackOverlay(nowMs: number): void {
    if (playbackPosition === null || quarterNoteCount === null) {
      removePlaybackOverlayElements();
      return;
    }

    const placement = getPianoRollPlaybackPlacement(playbackPosition, nowMs);
    const measureStartQuarter = placement.measureOffset * QUARTER_NOTES_PER_MEASURE;
    if (measureStartQuarter < 0 || measureStartQuarter >= quarterNoteCount) {
      removePlaybackOverlayElements();
      return;
    }

    const measureEndQuarter = Math.min(
      quarterNoteCount,
      measureStartQuarter + QUARTER_NOTES_PER_MEASURE
    );
    const headQuarter =
      measureStartQuarter +
      (measureEndQuarter - measureStartQuarter) * placement.progress;
    const { measureEl, headEl } = ensurePlaybackOverlayElements();

    measureEl.style.left = `${(measureStartQuarter / quarterNoteCount) * 100}%`;
    measureEl.style.width = `${
      ((measureEndQuarter - measureStartQuarter) / quarterNoteCount) * 100
    }%`;
    headEl.style.left = `${(headQuarter / quarterNoteCount) * 100}%`;
  }

  function setPlaybackPosition(position: PianoRollPlaybackPosition | null): void {
    playbackPosition = position;
    if (playbackPosition === null) {
      stopPlaybackAnimation();
      removePlaybackOverlayElements();
      return;
    }

    syncPlaybackOverlay(performance.now());
    requestNextPlaybackFrame();
  }

  function render(data: PianoRollDisplayData, summary: string): void {
    const totalTicks = Math.max(1, data.totalTicks);
    quarterNoteCount = Math.max(1, totalTicks / data.division);
    const rowBoundaries = getPianoRollPitchRowBoundaries({
      minPitch: data.minPitch,
      maxPitch: data.maxPitch,
      contentHeightPx: PIANO_ROLL_HEIGHT_PX,
    });
    contentEl.replaceChildren();
    playbackMeasureEl = null;
    playbackHeadEl = null;
    contentEl.classList.remove("piano-roll__content--empty");
    contentEl.style.backgroundSize = `${100 / quarterNoteCount}% 100%`;

    for (const lineTopPx of rowBoundaries.slice(0, -1)) {
      const lineEl = document.createElement("div");
      lineEl.className = "piano-roll__row-line";
      lineEl.style.top = `${lineTopPx}px`;
      contentEl.append(lineEl);
    }

    for (const note of data.notes) {
      const noteEl = document.createElement("div");
      noteEl.className = `piano-roll__note piano-roll__note--${note.role}`;
      const rowMetrics = getPianoRollPitchRowMetrics({
        minPitch: data.minPitch,
        maxPitch: data.maxPitch,
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
      contentEl.append(noteEl);
    }

    if (playbackPosition !== null) {
      syncPlaybackOverlay(performance.now());
    }

    if (summary !== lastDebugSummary) {
      appendLog(summary);
      lastDebugSummary = summary;
    }
  }

  async function sync(): Promise<void> {
    const currentRequestId = ++requestId;
    const source = buildChordPlaybackSource(getInput());
    if (!source.ok) {
      clear();
      return;
    }

    try {
      const preview = await buildPianoRollPreviewFromSource(source, smfConverter);
      if (currentRequestId !== requestId) {
        return;
      }
      if (!preview.ok) {
        clear();
        return;
      }

      render(preview.data, preview.summary);
    } catch (error: unknown) {
      if (currentRequestId !== requestId) {
        return;
      }

      clear();
      appendLog(`ERROR: piano roll 表示に失敗しました: ${String(error)}`);
    }
  }

  return { clear, sync, setPlaybackPosition };
}

import {
  PIANO_ROLL_HEIGHT_PX,
  PIANO_ROLL_MIN_NOTE_WIDTH_PERCENT,
} from "./app-constants.ts";
import { buildChordPlaybackSource } from "./chord-playback-source.ts";
import { buildPianoRollPreviewFromSource } from "./piano-roll-preview.ts";
import type { createMmlabcToSmfConverter } from "./smf-export.ts";
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

export function createPianoRollPreviewController(
  options: PianoRollPreviewControllerOptions
): {
  clear(): void;
  sync(): Promise<void>;
} {
  const { contentEl, smfConverter, getInput, appendLog } = options;
  let requestId = 0;
  let lastDebugSummary: string | null = null;

  function clear(): void {
    contentEl.replaceChildren();
    contentEl.classList.add("piano-roll__content--empty");
    contentEl.style.removeProperty("background-size");
    lastDebugSummary = null;
  }

  function render(data: PianoRollDisplayData, summary: string): void {
    const totalTicks = Math.max(1, data.totalTicks);
    const quarterNoteCount = Math.max(1, totalTicks / data.division);
    const rowBoundaries = getPianoRollPitchRowBoundaries({
      minPitch: data.minPitch,
      maxPitch: data.maxPitch,
      contentHeightPx: PIANO_ROLL_HEIGHT_PX,
    });
    contentEl.replaceChildren();
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

  return { clear, sync };
}

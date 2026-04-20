import { parseNonNegativeInteger } from "../daw/post-config.ts";
import type { DawStatusResponse, DawStatusTiming } from "../daw/status.ts";
import type {
  PianoRollPlaybackLoop,
  PianoRollPlaybackPosition,
} from "../piano-roll/piano-roll-preview-controller.ts";

const NETWORK_COMPENSATION_MS = 0;

interface DawPlaybackVisualsOptions {
  status: DawStatusResponse | null;
  timing: DawStatusTiming | null;
  chordMeasureEl: HTMLInputElement;
  measureGridController: {
    setPlaybackMeasure(measure: number | null): void;
  };
  pianoRollPreview: {
    setPlaybackPosition(position: PianoRollPlaybackPosition | null): void;
  };
}

export function syncDawPlaybackVisuals(options: DawPlaybackVisualsOptions): void {
  const playbackMeasure = getDawPlaybackMeasure(options.status);
  options.measureGridController.setPlaybackMeasure(playbackMeasure);
  options.pianoRollPreview.setPlaybackPosition(
    getPianoRollPlaybackPosition(
      options.status,
      options.timing,
      options.chordMeasureEl.value
    )
  );
}

export function getDawPlaybackMeasure(status: DawStatusResponse | null): number | null {
  if (status === null || !isDawTransportActive(status)) {
    return null;
  }

  return status.play.currentMeasure;
}

export function getPianoRollPlaybackPosition(
  status: DawStatusResponse | null,
  timing: DawStatusTiming | null,
  chordMeasureValue: string
): PianoRollPlaybackPosition | null {
  if (status === null || timing === null) {
    return null;
  }

  const play = status.play;
  if (
    play.state === "idle" ||
    play.currentMeasureIndex === null ||
    play.measureElapsedMs === null ||
    play.measureDurationMs === null ||
    play.measureDurationMs <= 0
  ) {
    return null;
  }

  const chordMeasure = parseNonNegativeInteger(chordMeasureValue);
  if (chordMeasure === null) {
    return null;
  }

  const measureOffset = play.currentMeasureIndex - (chordMeasure - 1);
  if (measureOffset < 0) {
    return null;
  }
  const loop = getPianoRollPlaybackLoop(status, chordMeasure);

  return {
    measureOffset,
    elapsedMs: play.measureElapsedMs + NETWORK_COMPENSATION_MS,
    durationMs: play.measureDurationMs,
    receivedAtMs: timing.responseReceivedAtMs,
    ...(loop === null ? {} : { loop }),
  };
}

function getPianoRollPlaybackLoop(
  status: DawStatusResponse,
  chordMeasure: number
): PianoRollPlaybackLoop | null {
  const { loop } = status.play;
  if (
    !loop.enabled ||
    loop.startMeasure === null ||
    loop.endMeasure === null ||
    loop.endMeasure < loop.startMeasure
  ) {
    return null;
  }

  const chordMeasureIndex = chordMeasure - 1;
  return {
    startMeasureOffset: loop.startMeasure - 1 - chordMeasureIndex,
    endMeasureOffset: loop.endMeasure - 1 - chordMeasureIndex,
  };
}

function isDawTransportActive(status: DawStatusResponse): boolean {
  return status.play.isPlaying || status.play.isPreview;
}

import { chordToMml } from "./chord-to-mml.ts";
import { planMeasureInputs } from "./measure-input.ts";
import { sanitizeMmlForPost } from "./post-config.ts";

export interface StartupAbRepeatRange {
  startMeasure: number;
  endMeasure: number;
}

export interface DebouncedAbRepeatSync {
  schedule(): void;
  cancel(): void;
}

function getChordMeasureSpan(input: string, startMeasure: number): number {
  const mml = chordToMml(input);
  if (mml === null) {
    return 1;
  }

  const { mml: sanitizedMml } = sanitizeMmlForPost(mml);
  const plannedMeasures = planMeasureInputs(sanitizedMml, startMeasure);
  if (plannedMeasures === null || plannedMeasures.length === 0) {
    return 1;
  }

  return plannedMeasures.length;
}

export function getStartupAbRepeatRange(options: {
  input: string;
  chordMeasure: number;
}): StartupAbRepeatRange {
  const chordMeasureSpan = getChordMeasureSpan(options.input, options.chordMeasure);

  return {
    startMeasure: options.chordMeasure,
    endMeasure: options.chordMeasure + chordMeasureSpan - 1,
  };
}

export function isSameAbRepeatRange(
  left: StartupAbRepeatRange | null,
  right: StartupAbRepeatRange | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return (
    left.startMeasure === right.startMeasure &&
    left.endMeasure === right.endMeasure
  );
}

export function syncDebouncedAbRepeat(options: {
  isCmrtReady: boolean;
  nextRange: StartupAbRepeatRange | null;
  appliedRange: StartupAbRepeatRange | null;
  debouncedSync: DebouncedAbRepeatSync;
}): void {
  if (
    !options.isCmrtReady ||
    options.nextRange === null ||
    isSameAbRepeatRange(options.appliedRange, options.nextRange)
  ) {
    options.debouncedSync.cancel();
    return;
  }

  options.debouncedSync.schedule();
}

import { chordToMml } from "./chord-to-mml.ts";
import { planMeasureInputs } from "./measure-input.ts";
import { parsePositiveInteger, sanitizeMmlForPost } from "./post-config.ts";

export interface StartupAbRepeatRange {
  startMeasure: number;
  endMeasure: number;
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
  bassMeasureValue: string;
}): StartupAbRepeatRange {
  const bassMeasure =
    parsePositiveInteger(options.bassMeasureValue) ?? options.chordMeasure;
  const chordMeasureSpan = getChordMeasureSpan(options.input, options.chordMeasure);

  return {
    startMeasure: Math.min(options.chordMeasure, bassMeasure),
    endMeasure: Math.max(
      options.chordMeasure + chordMeasureSpan - 1,
      bassMeasure + chordMeasureSpan - 1
    ),
  };
}

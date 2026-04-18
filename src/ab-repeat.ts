import { chordToMml } from "./chord-to-mml.ts";
import { planMeasureInputs } from "./measure-input.ts";
import { resolveBassTargets } from "./post-config.ts";
import { sanitizeMmlForPost } from "./post-config.ts";

export interface StartupAbRepeatRange {
  startMeasure: number;
  endMeasure: number;
}

function getChordMeasureSpan(input: string, chordMeasure: number): number {
  const mml = chordToMml(input);
  if (mml === null) {
    return 1;
  }

  const { mml: sanitizedMml } = sanitizeMmlForPost(mml);
  const plannedMeasures = planMeasureInputs(sanitizedMml, chordMeasure);
  if (plannedMeasures === null || plannedMeasures.length === 0) {
    return 1;
  }

  return plannedMeasures.length;
}

export function getStartupAbRepeatRange(options: {
  input: string;
  chordTrack: number;
  chordMeasure: number;
  bassTrackValue: string;
  bassMeasureValue: string;
}): StartupAbRepeatRange {
  const bassTargets = resolveBassTargets(
    options.bassTrackValue,
    options.bassMeasureValue,
    {
      track: options.chordTrack,
      measure: options.chordMeasure,
    }
  );
  const chordMeasureSpan = getChordMeasureSpan(options.input, options.chordMeasure);

  return {
    startMeasure: Math.min(options.chordMeasure, bassTargets.measure),
    endMeasure: Math.max(
      options.chordMeasure + chordMeasureSpan - 1,
      bassTargets.measure + chordMeasureSpan - 1
    ),
  };
}

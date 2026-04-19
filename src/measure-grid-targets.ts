export interface MeasureGridTarget {
  track: number;
  measure: number;
  endMeasure?: number;
}

export interface MeasureGridHighlightTargets {
  chordTarget: MeasureGridTarget | null;
  bassTarget: MeasureGridTarget | null;
}

export type MeasureGridCellHighlight = "none" | "chord" | "bass" | "both";

export function getMeasureGridCellHighlight(
  track: number,
  measure: number,
  targets: MeasureGridHighlightTargets
): MeasureGridCellHighlight {
  const isChordTarget = isMeasureGridTargetMatch(track, measure, targets.chordTarget);
  const isBassTarget = isMeasureGridTargetMatch(track, measure, targets.bassTarget);

  if (isChordTarget && isBassTarget) {
    return "both";
  }
  if (isChordTarget) {
    return "chord";
  }
  if (isBassTarget) {
    return "bass";
  }
  return "none";
}

function isMeasureGridTargetMatch(
  track: number,
  measure: number,
  target: MeasureGridTarget | null
): boolean {
  if (target === null || target.track !== track) {
    return false;
  }

  const endMeasure = target.endMeasure ?? target.measure;
  return target.measure <= measure && measure <= endMeasure;
}

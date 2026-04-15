export const DEFAULT_TRACK = 1;
export const DEFAULT_MEASURE = 1;

export interface PostTargets {
  track: number;
  measure: number;
}

export function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function parseNonNegativeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}

export interface SanitizedMml {
  mml: string;
  removedTokens: string[];
}

export function resolveBassTargets(
  trackValue: string,
  measureValue: string,
  chordTargets: PostTargets
): PostTargets {
  return {
    track: parsePositiveInteger(trackValue) ?? chordTargets.track,
    measure: parsePositiveInteger(measureValue) ?? chordTargets.measure,
  };
}

export function formatPostErrorMessage(
  isMultipleMeasures: boolean,
  index: number,
  totalMeasures: number,
  role: "chord" | "bass",
  measure: number,
  errorMessage: string
): string {
  return isMultipleMeasures
    ? `ERROR: meas分割 ${index + 1}/${totalMeasures} (${role} measure ${measure}): ${errorMessage}`
    : `ERROR (${role} measure ${measure}): ${errorMessage}`;
}

export function sanitizeMmlForPost(mml: string): SanitizedMml {
  const removedTokens = mml.match(/v\d+/gi) ?? [];
  return {
    mml: mml.replace(/v\d+/gi, ""),
    removedTokens,
  };
}

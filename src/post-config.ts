export const DEFAULT_TRACK = 1;
export const DEFAULT_MEASURE = 1;

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

export interface SanitizedMml {
  mml: string;
  removedTokens: string[];
}

export function sanitizeMmlForPost(mml: string): SanitizedMml {
  const removedTokens = mml.match(/v\d+/gi) ?? [];
  return {
    mml: mml.replace(/v\d+/gi, ""),
    removedTokens,
  };
}

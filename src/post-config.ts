export const DEFAULT_TRACK = 1;
export const DEFAULT_MEASURE = 1;

export function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) {
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

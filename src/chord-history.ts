export const DEFAULT_MAX_CHORD_HISTORY_ENTRIES = 20;

export type ChordHistoryParseResult =
  | { ok: true; history: string[] }
  | { ok: false; message: string };

export function normalizeChordHistory(
  history: readonly string[],
  maxEntries = DEFAULT_MAX_CHORD_HISTORY_ENTRIES
): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawEntry of history) {
    const entry = rawEntry.trim();
    if (entry === "" || seen.has(entry)) {
      continue;
    }

    normalized.push(entry);
    seen.add(entry);
    if (normalized.length >= maxEntries) {
      break;
    }
  }

  return normalized;
}

export function addChordHistoryEntry(
  history: readonly string[],
  input: string,
  maxEntries = DEFAULT_MAX_CHORD_HISTORY_ENTRIES
): string[] {
  const entry = input.trim();
  if (entry === "") {
    return normalizeChordHistory(history, maxEntries);
  }

  return normalizeChordHistory([entry, ...history], maxEntries);
}

export function serializeChordHistory(history: readonly string[]): string {
  return JSON.stringify(normalizeChordHistory(history));
}

export function parseChordHistoryStorage(raw: string): ChordHistoryParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "JSON として読み取れませんでした" };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, message: "配列ではありません" };
  }

  for (const [index, value] of parsed.entries()) {
    if (typeof value !== "string") {
      return { ok: false, message: `${index + 1} 件目が文字列ではありません` };
    }
  }

  return {
    ok: true,
    history: normalizeChordHistory(parsed),
  };
}

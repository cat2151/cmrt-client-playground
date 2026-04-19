export const DEFAULT_MAX_TONE_INSTRUMENT_MML_HISTORY_ENTRIES = 100;

export type ToneInstrumentMmlHistoryParseResult =
  | { ok: true; history: string[] }
  | { ok: false; message: string };

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export function normalizeToneInstrumentMmlHistory(
  history: readonly string[],
  maxEntries = DEFAULT_MAX_TONE_INSTRUMENT_MML_HISTORY_ENTRIES
): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawEntry of history) {
    const entry = normalizeLineEndings(rawEntry).trim();
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

export function addToneInstrumentMmlHistoryEntry(
  history: readonly string[],
  input: string,
  maxEntries = DEFAULT_MAX_TONE_INSTRUMENT_MML_HISTORY_ENTRIES
): string[] {
  const entry = normalizeLineEndings(input).trim();
  if (entry === "") {
    return normalizeToneInstrumentMmlHistory(history, maxEntries);
  }

  return normalizeToneInstrumentMmlHistory([entry, ...history], maxEntries);
}

export function serializeToneInstrumentMmlHistory(history: readonly string[]): string {
  return JSON.stringify(normalizeToneInstrumentMmlHistory(history));
}

export function parseToneInstrumentMmlHistoryStorage(
  raw: string
): ToneInstrumentMmlHistoryParseResult {
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
    history: normalizeToneInstrumentMmlHistory(parsed),
  };
}

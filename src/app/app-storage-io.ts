import {
  APP_STORAGE_EXPORT_FILENAME,
  APP_STORAGE_KEYS,
  AUTO_ADJUST_CHORDS_STORAGE_KEY,
  BASS_TRACK_STORAGE_KEY,
  CHORD_HISTORY_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY,
  TONE_INSTRUMENT_VOLUME_STORAGE_KEY,
} from "./app-constants.ts";
import {
  parseAppStorageSnapshot,
  stringifyAppStorageSnapshot,
} from "./app-storage.ts";
import { parseChordHistoryStorage } from "../chords/chord-history.ts";
import { parseNonNegativeInteger } from "../daw/post-config.ts";
import { parseToneInstrumentMmlHistoryStorage } from "../tone/tone-instrument-history.ts";
import { isToneInstrumentVolume } from "../tone/tone-instruments.ts";

export interface LocalStorageAccess {
  readItem(key: string): string | null;
  writeItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
}

interface ValueElement {
  value: string;
}

export function createLocalStorageAccess(
  appendLog: (message: string) => void
): LocalStorageAccess {
  const reportedErrors = new Set<string>();

  function report(action: string, error: unknown): void {
    const message = `ERROR: local storage の${action}に失敗しました: ${String(error)}`;
    if (reportedErrors.has(message)) {
      return;
    }
    reportedErrors.add(message);
    appendLog(message);
  }

  return {
    readItem(key: string): string | null {
      try {
        return localStorage.getItem(key);
      } catch (error: unknown) {
        report(`読み取り(${key})`, error);
        return null;
      }
    },
    writeItem(key: string, value: string): boolean {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (error: unknown) {
        report(`保存(${key})`, error);
        return false;
      }
    },
    removeItem(key: string): boolean {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error: unknown) {
        report(`削除(${key})`, error);
        return false;
      }
    },
  };
}

export function loadStoredTarget(
  storage: LocalStorageAccess,
  key: string,
  fallback: number,
  element: HTMLInputElement
): boolean {
  const storedValue = storage.readItem(key);
  const parsed = storedValue === null ? null : parseNonNegativeInteger(storedValue);
  element.value = String(parsed ?? fallback);
  return parsed !== null;
}

export function loadStoredText(
  storage: LocalStorageAccess,
  key: string,
  fallback: string,
  element: ValueElement
): boolean {
  const storedValue = storage.readItem(key);
  element.value = storedValue ?? fallback;
  return storedValue !== null;
}

export function loadStoredBoolean(
  storage: LocalStorageAccess,
  key: string,
  fallback: boolean
): boolean {
  const storedValue = storage.readItem(key);
  if (storedValue === "true") {
    return true;
  }
  if (storedValue === "false") {
    return false;
  }
  return fallback;
}

export function saveTarget(
  storage: LocalStorageAccess,
  key: string,
  element: HTMLInputElement
): void {
  const parsed = parseNonNegativeInteger(element.value);
  if (parsed === null) {
    return;
  }
  storage.writeItem(key, String(parsed));
}

export function saveText(
  storage: LocalStorageAccess,
  key: string,
  value: string
): void {
  storage.writeItem(key, value);
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const downloadUrl = URL.createObjectURL(blob);
  const linkEl = document.createElement("a");
  linkEl.href = downloadUrl;
  linkEl.download = filename;
  document.body.append(linkEl);
  linkEl.click();
  linkEl.remove();
  URL.revokeObjectURL(downloadUrl);
}

function downloadTextFile(filename: string, content: string): void {
  downloadBlobFile(filename, new Blob([content], { type: "application/json" }));
}

export function downloadBinaryFile(
  filename: string,
  content: Uint8Array,
  mimeType: string
): void {
  downloadBlobFile(filename, new Blob([content], { type: mimeType }));
}

function collectManagedLocalStorageValues(
  storage: LocalStorageAccess
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of APP_STORAGE_KEYS) {
    const value = storage.readItem(key);
    if (value !== null) {
      values[key] = value;
    }
  }
  return values;
}

function validateImportedStorageValues(values: Record<string, string>): string | null {
  for (const key of [
    CHORD_TRACK_STORAGE_KEY,
    CHORD_MEASURE_STORAGE_KEY,
    BASS_TRACK_STORAGE_KEY,
  ]) {
    const value = values[key];
    if (value !== undefined && parseNonNegativeInteger(value) === null) {
      return `${key} には 0 以上の整数を指定してください`;
    }
  }

  const chordHistoryValue = values[CHORD_HISTORY_STORAGE_KEY];
  if (chordHistoryValue !== undefined) {
    const parsed = parseChordHistoryStorage(chordHistoryValue);
    if (!parsed.ok) {
      return `${CHORD_HISTORY_STORAGE_KEY} は chord history として読み取れません: ${parsed.message}`;
    }
  }

  const autoAdjustValue = values[AUTO_ADJUST_CHORDS_STORAGE_KEY];
  if (
    autoAdjustValue !== undefined &&
    autoAdjustValue !== "true" &&
    autoAdjustValue !== "false"
  ) {
    return `${AUTO_ADJUST_CHORDS_STORAGE_KEY} には true または false を指定してください`;
  }

  const toneInstrumentVolume = values[TONE_INSTRUMENT_VOLUME_STORAGE_KEY];
  if (
    toneInstrumentVolume !== undefined &&
    !isToneInstrumentVolume(toneInstrumentVolume)
  ) {
    return `${TONE_INSTRUMENT_VOLUME_STORAGE_KEY} には v1 から v15 を指定してください`;
  }

  const toneInstrumentHistoryValue = values[TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY];
  if (toneInstrumentHistoryValue !== undefined) {
    const parsed = parseToneInstrumentMmlHistoryStorage(toneInstrumentHistoryValue);
    if (!parsed.ok) {
      return `${TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY} は tone MML history として読み取れません: ${parsed.message}`;
    }
  }

  return null;
}

export function exportManagedLocalStorageSnapshot(options: {
  storage: LocalStorageAccess;
  persistState: () => void;
  appendLog: (message: string) => void;
}): void {
  options.persistState();
  const json = stringifyAppStorageSnapshot(
    collectManagedLocalStorageValues(options.storage)
  );
  downloadTextFile(APP_STORAGE_EXPORT_FILENAME, json);
  options.appendLog("local storage を JSON export しました");
}

export async function importManagedLocalStorageSnapshot(options: {
  file: File;
  storage: LocalStorageAccess;
  beforeImport: () => void;
  afterImport: () => void;
  appendLog: (message: string) => void;
}): Promise<void> {
  let raw: string;
  try {
    raw = await options.file.text();
  } catch (error: unknown) {
    options.appendLog(
      `ERROR: local storage JSON import の読み込みに失敗しました: ${String(error)}`
    );
    return;
  }

  const parsed = parseAppStorageSnapshot(raw, APP_STORAGE_KEYS);
  if (!parsed.ok) {
    options.appendLog(`ERROR: local storage JSON import に失敗しました: ${parsed.message}`);
    return;
  }

  const validationError = validateImportedStorageValues(parsed.snapshot.values);
  if (validationError !== null) {
    options.appendLog(`ERROR: local storage JSON import に失敗しました: ${validationError}`);
    return;
  }

  options.beforeImport();
  for (const key of APP_STORAGE_KEYS) {
    const value = parsed.snapshot.values[key];
    if (value === undefined) {
      options.storage.removeItem(key);
      continue;
    }
    options.storage.writeItem(key, value);
  }

  options.afterImport();
  options.appendLog("local storage を JSON import しました");
}

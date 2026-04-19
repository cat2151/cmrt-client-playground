import {
  TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY,
  TONE_INSTRUMENT_MML_STORAGE_KEY,
  TONE_INSTRUMENT_SELECTION_STORAGE_KEY,
  TONE_INSTRUMENT_VOLUME_STORAGE_KEY,
  TONE_INSTRUMENTS_URL,
} from "../app/app-constants.ts";
import type { LocalStorageAccess } from "../app/app-storage-io.ts";
import {
  addToneInstrumentMmlHistoryEntry,
  parseToneInstrumentMmlHistoryStorage,
  serializeToneInstrumentMmlHistory,
} from "./tone-instrument-history.ts";
import {
  formatToneInstrumentMmlWithVolume,
  normalizeToneInstrumentVolume,
  parseToneInstrumentMarkdown,
  type ToneInstrument,
} from "./tone-instruments.ts";

type ToneInstrumentLoadState = "loading" | "ready" | "error";

interface ToneInstrumentSettingsControllerOptions {
  instrumentSelectEl: HTMLSelectElement;
  instrumentMmlEl: HTMLTextAreaElement;
  instrumentMmlHistorySelectEl: HTMLSelectElement;
  instrumentVolumeSelectEl: HTMLSelectElement;
  storage: LocalStorageAccess;
  appendLog: (message: string) => void;
  onInstrumentMmlChange: () => void;
}

export interface ToneInstrumentSettingsController {
  getInstrumentMml(): string;
  loadToneInstruments(): Promise<void>;
  persistState(): void;
  restoreState(): void;
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function formatToneInstrumentHistoryOptionLabel(value: string): string {
  return value.replace(/\s+/g, " ");
}

export function createToneInstrumentSettingsController(
  options: ToneInstrumentSettingsControllerOptions
): ToneInstrumentSettingsController {
  const {
    instrumentSelectEl,
    instrumentMmlEl,
    instrumentMmlHistorySelectEl,
    instrumentVolumeSelectEl,
    storage,
    appendLog,
    onInstrumentMmlChange,
  } = options;

  let instruments: ToneInstrument[] = [];
  let loadState: ToneInstrumentLoadState = "loading";
  let selectedInstrumentName: string | null = null;
  let instrumentMmlHistory: string[] = [];

  function getVolume(): string {
    return normalizeToneInstrumentVolume(instrumentVolumeSelectEl.value);
  }

  function findSelectedInstrument(): ToneInstrument | null {
    if (selectedInstrumentName === null) {
      return null;
    }

    return (
      instruments.find((instrument) => instrument.name === selectedInstrumentName) ?? null
    );
  }

  function saveSelectedInstrument(): void {
    storage.writeItem(TONE_INSTRUMENT_SELECTION_STORAGE_KEY, selectedInstrumentName ?? "");
  }

  function saveInstrumentMml(): void {
    storage.writeItem(TONE_INSTRUMENT_MML_STORAGE_KEY, instrumentMmlEl.value);
  }

  function saveVolume(): void {
    storage.writeItem(TONE_INSTRUMENT_VOLUME_STORAGE_KEY, getVolume());
  }

  function saveHistory(): void {
    storage.writeItem(
      TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY,
      serializeToneInstrumentMmlHistory(instrumentMmlHistory)
    );
  }

  function renderInstrumentSelect(): void {
    instrumentSelectEl.replaceChildren();

    const placeholderEl = document.createElement("option");
    placeholderEl.value = "";
    placeholderEl.textContent =
      loadState === "loading"
        ? "Tone.js tone loading..."
        : loadState === "error"
          ? "Tone.js tone load failed"
          : instruments.length === 0
            ? "Tone.js tone empty"
            : "Tone.js tone";
    placeholderEl.disabled = true;
    instrumentSelectEl.append(placeholderEl);

    let selectedInstrument = false;
    if (loadState === "ready") {
      for (const instrument of instruments) {
        const optionEl = document.createElement("option");
        optionEl.value = instrument.name;
        optionEl.textContent = instrument.name;
        optionEl.title = instrument.name;
        if (instrument.name === selectedInstrumentName) {
          optionEl.selected = true;
          selectedInstrument = true;
        }
        instrumentSelectEl.append(optionEl);
      }
    }

    placeholderEl.selected = !selectedInstrument;
    instrumentSelectEl.disabled = loadState !== "ready" || instruments.length === 0;
  }

  function renderHistorySelect(): void {
    const currentMml = instrumentMmlEl.value.trim();
    instrumentMmlHistorySelectEl.replaceChildren();

    const placeholderEl = document.createElement("option");
    placeholderEl.value = "";
    placeholderEl.textContent =
      instrumentMmlHistory.length === 0 ? "tone MML history empty" : "tone MML history";
    placeholderEl.disabled = true;
    instrumentMmlHistorySelectEl.append(placeholderEl);

    let selectedHistoryEntry = false;
    for (const entry of instrumentMmlHistory) {
      const optionEl = document.createElement("option");
      optionEl.value = entry;
      optionEl.textContent = formatToneInstrumentHistoryOptionLabel(entry);
      optionEl.title = entry;
      if (entry === currentMml) {
        optionEl.selected = true;
        selectedHistoryEntry = true;
      }
      instrumentMmlHistorySelectEl.append(optionEl);
    }

    placeholderEl.selected = !selectedHistoryEntry;
    instrumentMmlHistorySelectEl.disabled = instrumentMmlHistory.length === 0;
  }

  function rememberCurrentInstrumentMml(): void {
    const nextHistory = addToneInstrumentMmlHistoryEntry(
      instrumentMmlHistory,
      instrumentMmlEl.value
    );
    if (areStringArraysEqual(instrumentMmlHistory, nextHistory)) {
      renderHistorySelect();
      return;
    }

    instrumentMmlHistory = nextHistory;
    saveHistory();
    renderHistorySelect();
  }

  function clearSelectedInstrumentIfMmlWasEdited(): void {
    if (selectedInstrumentName === null) {
      return;
    }

    const selectedInstrument = findSelectedInstrument();
    const expectedMml =
      selectedInstrument === null
        ? null
        : formatToneInstrumentMmlWithVolume(selectedInstrument.mml, getVolume());
    if (expectedMml !== null && instrumentMmlEl.value === expectedMml) {
      return;
    }

    selectedInstrumentName = null;
    saveSelectedInstrument();
    renderInstrumentSelect();
  }

  function setInstrumentMmlFromSelectedInstrument(instrument: ToneInstrument): void {
    instrumentMmlEl.value = formatToneInstrumentMmlWithVolume(instrument.mml, getVolume());
    saveInstrumentMml();
    rememberCurrentInstrumentMml();
    renderHistorySelect();
    onInstrumentMmlChange();
  }

  function selectInstrument(): void {
    const instrumentName = instrumentSelectEl.value;
    if (instrumentName === "") {
      return;
    }

    const instrument = instruments.find((candidate) => candidate.name === instrumentName);
    if (instrument === undefined) {
      return;
    }

    rememberCurrentInstrumentMml();
    selectedInstrumentName = instrument.name;
    saveSelectedInstrument();
    renderInstrumentSelect();
    setInstrumentMmlFromSelectedInstrument(instrument);
    instrumentSelectEl.focus();
  }

  function selectHistoryEntry(): void {
    const historyEntry = instrumentMmlHistorySelectEl.value;
    if (historyEntry === "") {
      return;
    }

    rememberCurrentInstrumentMml();
    selectedInstrumentName = null;
    saveSelectedInstrument();
    instrumentMmlEl.value = historyEntry;
    saveInstrumentMml();
    rememberCurrentInstrumentMml();
    renderInstrumentSelect();
    renderHistorySelect();
    onInstrumentMmlChange();
    instrumentMmlEl.focus();
  }

  instrumentSelectEl.addEventListener("change", selectInstrument);
  instrumentMmlHistorySelectEl.addEventListener("change", selectHistoryEntry);
  instrumentVolumeSelectEl.addEventListener("change", () => {
    instrumentVolumeSelectEl.value = getVolume();
    saveVolume();

    const selectedInstrument = findSelectedInstrument();
    if (selectedInstrument !== null) {
      setInstrumentMmlFromSelectedInstrument(selectedInstrument);
    }
  });
  instrumentMmlEl.addEventListener("input", () => {
    clearSelectedInstrumentIfMmlWasEdited();
    saveInstrumentMml();
    renderHistorySelect();
    onInstrumentMmlChange();
  });
  instrumentMmlEl.addEventListener("change", rememberCurrentInstrumentMml);

  return {
    getInstrumentMml(): string {
      return instrumentMmlEl.value;
    },
    async loadToneInstruments(): Promise<void> {
      loadState = "loading";
      renderInstrumentSelect();

      let response: Response;
      try {
        response = await fetch(TONE_INSTRUMENTS_URL, { cache: "no-store" });
      } catch (error: unknown) {
        instruments = [];
        loadState = "error";
        renderInstrumentSelect();
        appendLog(`ERROR: Tone.js 音色markdown の fetch に失敗しました: ${String(error)}`);
        return;
      }

      if (!response.ok) {
        instruments = [];
        loadState = "error";
        renderInstrumentSelect();
        appendLog(
          `ERROR: Tone.js 音色markdown の fetch に失敗しました: HTTP ${response.status} ${response.statusText}`
        );
        return;
      }

      let markdown: string;
      try {
        markdown = await response.text();
      } catch (error: unknown) {
        instruments = [];
        loadState = "error";
        renderInstrumentSelect();
        appendLog(`ERROR: Tone.js 音色markdown を読み取れませんでした: ${String(error)}`);
        return;
      }

      const parsed = parseToneInstrumentMarkdown(markdown);
      if (!parsed.ok) {
        instruments = [];
        loadState = "error";
        renderInstrumentSelect();
        appendLog(`ERROR: Tone.js 音色markdown の形式が不正です: ${parsed.message}`);
        return;
      }

      instruments = parsed.instruments;
      loadState = "ready";
      renderInstrumentSelect();
      appendLog(`Tone.js 音色markdown を読み込みました: ${instruments.length} 件`);
    },
    persistState(): void {
      saveSelectedInstrument();
      saveInstrumentMml();
      saveVolume();
      rememberCurrentInstrumentMml();
    },
    restoreState(): void {
      const storedInstrumentName = storage.readItem(TONE_INSTRUMENT_SELECTION_STORAGE_KEY);
      selectedInstrumentName =
        storedInstrumentName === null || storedInstrumentName.trim() === ""
          ? null
          : storedInstrumentName;

      instrumentVolumeSelectEl.value = normalizeToneInstrumentVolume(
        storage.readItem(TONE_INSTRUMENT_VOLUME_STORAGE_KEY)
      );
      instrumentMmlEl.value = storage.readItem(TONE_INSTRUMENT_MML_STORAGE_KEY) ?? "";

      const storedHistory = storage.readItem(TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY);
      if (storedHistory === null) {
        instrumentMmlHistory = [];
      } else {
        const parsed = parseToneInstrumentMmlHistoryStorage(storedHistory);
        if (parsed.ok) {
          instrumentMmlHistory = parsed.history;
        } else {
          instrumentMmlHistory = [];
          appendLog(`ERROR: tone MML history の復帰に失敗しました: ${parsed.message}`);
        }
      }

      renderInstrumentSelect();
      renderHistorySelect();
    },
  };
}

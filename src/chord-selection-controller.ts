import {
  CHORD_HISTORY_SELECT_MAX_CH,
  CHORD_HISTORY_SELECT_MIN_CH,
  CHORD_HISTORY_STORAGE_KEY,
  CHORD_TEMPLATE_URL,
} from "./app-constants.ts";
import {
  addChordHistoryEntry,
  parseChordHistoryStorage,
  serializeChordHistory,
} from "./chord-history.ts";
import {
  formatChordTemplateInput,
  formatChordTemplateOptionLabel,
  parseChordTemplates,
  type ChordTemplate,
} from "./chord-templates.ts";
import type { ChordProgressionEditor } from "./chord-progression-highlight.ts";
import type { LocalStorageAccess } from "./app-storage-io.ts";
import type { ToneChordPreviewInputSource } from "./tone-chord-preview-sync.ts";

interface ChordSelectionControllerOptions {
  inputEl: ChordProgressionEditor;
  chordHistorySelectEl: HTMLSelectElement;
  chordTemplateKeySelectEl: HTMLSelectElement;
  chordTemplateSelectEl: HTMLSelectElement;
  storage: LocalStorageAccess;
  appendLog: (message: string) => void;
  onInputChange: (source?: ToneChordPreviewInputSource) => void;
}

export interface ChordSelectionController {
  clearSelectedTemplate(): void;
  renderHistorySelect(): void;
  renderTemplateSelect(): void;
  loadChordTemplates(): Promise<void>;
  loadStoredChordHistory(): void;
  saveChordHistory(): void;
  rememberChordHistoryEntry(input: string): void;
  isCurrentInputFromSelectedTemplate(): boolean;
  applySelectedChordTemplateToInput(source: ToneChordPreviewInputSource): void;
  selectHistoryEntry(): void;
  selectTemplate(): void;
}

export function createChordSelectionController(
  options: ChordSelectionControllerOptions
): ChordSelectionController {
  const {
    inputEl,
    chordHistorySelectEl,
    chordTemplateKeySelectEl,
    chordTemplateSelectEl,
    storage,
    appendLog,
    onInputChange,
  } = options;

  let chordHistory: string[] = [];
  let chordTemplates: ChordTemplate[] = [];
  let chordTemplateLoadState: "loading" | "ready" | "error" = "loading";
  let selectedChordTemplateDegrees: string | null = null;

  function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function formatChordHistoryOptionLabel(value: string): string {
    return value.replace(/\s+/g, " ");
  }

  function syncChordHistorySelectWidth(): void {
    const longestLabelLength =
      chordHistory.length === 0
        ? "chord history".length
        : Math.max(
            ...chordHistory.map((entry) => formatChordHistoryOptionLabel(entry).length)
          );
    const widthCh = Math.min(
      CHORD_HISTORY_SELECT_MAX_CH,
      Math.max(CHORD_HISTORY_SELECT_MIN_CH, longestLabelLength)
    );
    chordHistorySelectEl.style.setProperty(
      "--chord-history-select-label-ch",
      String(widthCh)
    );
  }

  function renderHistorySelect(): void {
    const currentInput = inputEl.value.trim();
    chordHistorySelectEl.replaceChildren();

    const placeholderEl = document.createElement("option");
    placeholderEl.value = "";
    placeholderEl.textContent =
      chordHistory.length === 0 ? "chord history empty" : "chord history";
    placeholderEl.disabled = true;
    chordHistorySelectEl.append(placeholderEl);

    let selectedHistoryEntry = false;
    for (const entry of chordHistory) {
      const optionEl = document.createElement("option");
      optionEl.value = entry;
      optionEl.textContent = formatChordHistoryOptionLabel(entry);
      optionEl.title = entry;
      if (entry === currentInput) {
        optionEl.selected = true;
        selectedHistoryEntry = true;
      }
      chordHistorySelectEl.append(optionEl);
    }

    placeholderEl.selected = !selectedHistoryEntry;
    chordHistorySelectEl.disabled = chordHistory.length === 0;
    syncChordHistorySelectWidth();
  }

  function renderTemplateSelect(): void {
    chordTemplateSelectEl.replaceChildren();

    const placeholderEl = document.createElement("option");
    placeholderEl.value = "";
    placeholderEl.textContent =
      chordTemplateLoadState === "loading"
        ? "template loading..."
        : chordTemplateLoadState === "error"
          ? "template load failed"
          : chordTemplates.length === 0
            ? "template empty"
            : "template";
    placeholderEl.disabled = true;
    chordTemplateSelectEl.append(placeholderEl);

    let selectedTemplate = false;
    if (chordTemplateLoadState === "ready") {
      for (const template of chordTemplates) {
        const optionEl = document.createElement("option");
        optionEl.value = template.degrees;
        optionEl.textContent = formatChordTemplateOptionLabel(template);
        optionEl.title = optionEl.textContent;
        if (template.degrees === selectedChordTemplateDegrees) {
          optionEl.selected = true;
          selectedTemplate = true;
        }
        chordTemplateSelectEl.append(optionEl);
      }
    }

    placeholderEl.selected = !selectedTemplate;
    chordTemplateSelectEl.disabled =
      chordTemplateLoadState !== "ready" || chordTemplates.length === 0;
  }

  function getSelectedChordTemplateKey(): string {
    return chordTemplateKeySelectEl.value || "C";
  }

  function getSelectedChordTemplateInput(): string | null {
    if (selectedChordTemplateDegrees === null) {
      return null;
    }

    return formatChordTemplateInput(
      selectedChordTemplateDegrees,
      getSelectedChordTemplateKey()
    );
  }

  function isCurrentInputFromSelectedTemplate(): boolean {
    const templateInput = getSelectedChordTemplateInput();
    return templateInput !== null && inputEl.value === templateInput;
  }

  function applySelectedChordTemplateToInput(source: ToneChordPreviewInputSource): void {
    const templateInput = getSelectedChordTemplateInput();
    if (templateInput === null) {
      return;
    }

    inputEl.value = templateInput;
    onInputChange(source);
  }

  async function loadChordTemplates(): Promise<void> {
    chordTemplateLoadState = "loading";
    renderTemplateSelect();

    let response: Response;
    try {
      response = await fetch(CHORD_TEMPLATE_URL, { cache: "no-store" });
    } catch (error: unknown) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      appendLog(`ERROR: template JSON の fetch に失敗しました: ${String(error)}`);
      return;
    }

    if (!response.ok) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      appendLog(
        `ERROR: template JSON の fetch に失敗しました: HTTP ${response.status} ${response.statusText}`
      );
      return;
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch (error: unknown) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      appendLog(`ERROR: template JSON を JSON として読み取れませんでした: ${String(error)}`);
      return;
    }

    const parsed = parseChordTemplates(raw);
    if (!parsed.ok) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      appendLog(`ERROR: template JSON の形式が不正です: ${parsed.message}`);
      return;
    }

    chordTemplates = parsed.templates;
    chordTemplateLoadState = "ready";
    renderTemplateSelect();
    appendLog(`template JSON を読み込みました: ${chordTemplates.length} 件`);
  }

  function saveChordHistory(): void {
    storage.writeItem(CHORD_HISTORY_STORAGE_KEY, serializeChordHistory(chordHistory));
  }

  function loadStoredChordHistory(): void {
    const storedValue = storage.readItem(CHORD_HISTORY_STORAGE_KEY);
    if (storedValue === null) {
      chordHistory = [];
      renderHistorySelect();
      return;
    }

    const parsed = parseChordHistoryStorage(storedValue);
    if (!parsed.ok) {
      appendLog(`ERROR: chord history の復帰に失敗しました: ${parsed.message}`);
      chordHistory = [];
      renderHistorySelect();
      return;
    }

    chordHistory = parsed.history;
    renderHistorySelect();
  }

  function rememberChordHistoryEntry(input: string): void {
    const nextHistory = addChordHistoryEntry(chordHistory, input);
    if (areStringArraysEqual(chordHistory, nextHistory)) {
      renderHistorySelect();
      return;
    }

    chordHistory = nextHistory;
    saveChordHistory();
    renderHistorySelect();
  }

  return {
    clearSelectedTemplate(): void {
      selectedChordTemplateDegrees = null;
    },
    renderHistorySelect,
    renderTemplateSelect,
    loadChordTemplates,
    loadStoredChordHistory,
    saveChordHistory,
    rememberChordHistoryEntry,
    isCurrentInputFromSelectedTemplate,
    applySelectedChordTemplateToInput,
    selectHistoryEntry(): void {
      const selectedChord = chordHistorySelectEl.value;
      if (selectedChord === "") {
        return;
      }

      selectedChordTemplateDegrees = null;
      inputEl.value = selectedChord;
      rememberChordHistoryEntry(inputEl.value);
      onInputChange();
      inputEl.focus();
    },
    selectTemplate(): void {
      const selectedTemplate = chordTemplateSelectEl.value;
      if (selectedTemplate === "") {
        return;
      }

      selectedChordTemplateDegrees = selectedTemplate;
      applySelectedChordTemplateToInput("template");
      chordTemplateSelectEl.focus();
    },
  };
}

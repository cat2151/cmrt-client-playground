import {
  CHORD_HISTORY_SELECT_MAX_CH,
  CHORD_HISTORY_SELECT_MIN_CH,
  CHORD_HISTORY_STORAGE_KEY,
  CHORD_TEMPLATE_URL,
} from "../app/app-constants.ts";
import {
  addChordHistoryEntry,
  parseChordHistoryStorage,
  serializeChordHistory,
  shouldRememberChordHistoryInput,
} from "./chord-history.ts";
import {
  formatChordTemplateInput,
  formatChordTemplateOptionLabel,
  parseChordTemplates,
  type ChordTemplate,
} from "./chord-templates.ts";
import {
  createChordSelectionSearchController,
  type ChordTemplateLoadState,
} from "./chord-selection-search.ts";
import type { ChordProgressionEditor } from "./chord-progression-highlight.ts";
import type { LocalStorageAccess } from "../app/app-storage-io.ts";
import type { ToneChordPreviewInputSource } from "../tone/tone-chord-preview-sync.ts";

interface ChordSelectionControllerOptions {
  inputEl: ChordProgressionEditor;
  chordHistorySelectEl: HTMLSelectElement;
  chordSearchShellEl: HTMLDivElement;
  chordSearchButtonEl: HTMLButtonElement;
  chordSearchInputEl: HTMLInputElement;
  chordSearchResultsEl: HTMLDivElement;
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
  toggleSearch(): void;
  syncSearch(): void;
  closeSearch(): void;
  handleSearchKeydown(event: KeyboardEvent): void;
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
    chordSearchShellEl,
    chordSearchButtonEl,
    chordSearchInputEl,
    chordSearchResultsEl,
    chordTemplateKeySelectEl,
    chordTemplateSelectEl,
    storage,
    appendLog,
    onInputChange,
  } = options;

  let chordHistory: string[] = [];
  let chordTemplates: ChordTemplate[] = [];
  let chordTemplateLoadState: ChordTemplateLoadState = "loading";
  let selectedChordTemplateDegrees: string | null = null;

  const chordSearch = createChordSelectionSearchController({
    elements: {
      shellEl: chordSearchShellEl,
      buttonEl: chordSearchButtonEl,
      inputEl: chordSearchInputEl,
      resultsEl: chordSearchResultsEl,
    },
    onSelectHistory: (entry) => selectHistoryEntry(entry, "search", false),
    onSelectTemplate: (template) => selectTemplate(template, "search", false),
  });

  function areStringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  function getChordSearchState() {
    return {
      history: chordHistory,
      templates: chordTemplates,
      templateLoadState: chordTemplateLoadState,
      currentInput: inputEl.value,
      selectedTemplateDegrees: selectedChordTemplateDegrees,
    };
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
    chordSearch.sync(getChordSearchState());

    let response: Response;
    try {
      response = await fetch(CHORD_TEMPLATE_URL, { cache: "no-store" });
    } catch (error: unknown) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      chordSearch.sync(getChordSearchState());
      appendLog(`ERROR: template JSON の fetch に失敗しました: ${String(error)}`);
      return;
    }

    if (!response.ok) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      chordSearch.sync(getChordSearchState());
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
      chordSearch.sync(getChordSearchState());
      appendLog(`ERROR: template JSON を JSON として読み取れませんでした: ${String(error)}`);
      return;
    }

    const parsed = parseChordTemplates(raw);
    if (!parsed.ok) {
      chordTemplates = [];
      chordTemplateLoadState = "error";
      renderTemplateSelect();
      chordSearch.sync(getChordSearchState());
      appendLog(`ERROR: template JSON の形式が不正です: ${parsed.message}`);
      return;
    }

    chordTemplates = parsed.templates;
    chordTemplateLoadState = "ready";
    renderTemplateSelect();
    chordSearch.sync(getChordSearchState());
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
      chordSearch.sync(getChordSearchState());
      return;
    }

    const parsed = parseChordHistoryStorage(storedValue);
    if (!parsed.ok) {
      appendLog(`ERROR: chord history の復帰に失敗しました: ${parsed.message}`);
      chordHistory = [];
      renderHistorySelect();
      chordSearch.sync(getChordSearchState());
      return;
    }

    chordHistory = parsed.history;
    renderHistorySelect();
    chordSearch.sync(getChordSearchState());
  }

  function rememberChordHistoryEntry(input: string): void {
    const nextHistory = addChordHistoryEntry(chordHistory, input);
    if (areStringArraysEqual(chordHistory, nextHistory)) {
      renderHistorySelect();
      chordSearch.sync(getChordSearchState());
      return;
    }

    chordHistory = nextHistory;
    saveChordHistory();
    renderHistorySelect();
    chordSearch.sync(getChordSearchState());
  }

  function rememberCurrentCustomInput(): void {
    if (
      shouldRememberChordHistoryInput(
        inputEl.value,
        isCurrentInputFromSelectedTemplate()
      )
    ) {
      rememberChordHistoryEntry(inputEl.value);
    }
  }

  function selectHistoryEntry(
    selectedChord: string,
    source: ToneChordPreviewInputSource,
    shouldFocusInput: boolean
  ): void {
    if (selectedChord === "") {
      return;
    }

    rememberCurrentCustomInput();
    selectedChordTemplateDegrees = null;
    inputEl.value = selectedChord;
    rememberChordHistoryEntry(inputEl.value);
    onInputChange(source);
    chordSearch.sync(getChordSearchState());
    if (shouldFocusInput) {
      inputEl.focus();
    }
  }

  function selectTemplate(
    template: ChordTemplate,
    source: ToneChordPreviewInputSource,
    shouldFocusInput: boolean
  ): void {
    rememberCurrentCustomInput();
    selectedChordTemplateDegrees = template.degrees;
    applySelectedChordTemplateToInput(source);
    chordSearch.sync(getChordSearchState());
    if (shouldFocusInput) {
      inputEl.focus();
    }
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
    toggleSearch(): void {
      rememberCurrentCustomInput();
      chordSearch.toggle(getChordSearchState());
    },
    syncSearch(): void {
      chordSearch.sync(getChordSearchState());
    },
    closeSearch(): void {
      chordSearch.closeAndFocusToggle();
    },
    handleSearchKeydown(event: KeyboardEvent): void {
      chordSearch.handleInputKeydown(event);
    },
    isCurrentInputFromSelectedTemplate,
    applySelectedChordTemplateToInput,
    selectHistoryEntry(): void {
      selectHistoryEntry(chordHistorySelectEl.value, "other", true);
    },
    selectTemplate(): void {
      const selectedTemplate = chordTemplateSelectEl.value;
      if (selectedTemplate === "") {
        return;
      }

      selectTemplate({ degrees: selectedTemplate, description: "" }, "template", true);
      chordTemplateSelectEl.focus();
    },
  };
}

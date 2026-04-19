import {
  chordDegreeSequenceContains,
  formatChordDegreeNumberSearchLabel,
  formatChordDegreeRomanSearchLabel,
  formatChordTemplateOptionLabel,
  getChordDegreeSearchTokens,
  type ChordTemplate,
} from "./chord-templates.ts";

export type ChordTemplateLoadState = "loading" | "ready" | "error";

export interface ChordSelectionSearchElements {
  shellEl: HTMLDivElement;
  buttonEl: HTMLButtonElement;
  inputEl: HTMLInputElement;
  resultsEl: HTMLDivElement;
}

export interface ChordSelectionSearchState {
  history: readonly string[];
  templates: readonly ChordTemplate[];
  templateLoadState: ChordTemplateLoadState;
  currentInput: string;
  selectedTemplateDegrees: string | null;
}

export interface ChordSelectionSearchQuery {
  text: string;
  degreeTokens: string[];
  label: string;
  isActive: boolean;
}

export interface ChordSelectionSearchResult<T> {
  value: T;
  label: string;
  numberLabel: string | null;
  selected: boolean;
}

export interface ChordSelectionSearchResults {
  query: ChordSelectionSearchQuery;
  history: ChordSelectionSearchResult<string>[];
  templates: ChordSelectionSearchResult<ChordTemplate>[];
}

interface CreateChordSelectionSearchControllerOptions {
  elements: ChordSelectionSearchElements;
  onSelectHistory: (entry: string) => void;
  onSelectTemplate: (template: ChordTemplate) => void;
}

export interface ChordSelectionSearchController {
  toggle(state: ChordSelectionSearchState): void;
  sync(state: ChordSelectionSearchState): void;
  close(): void;
  closeAndFocusToggle(): void;
  handleInputKeydown(event: KeyboardEvent): void;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createChordSelectionSearchQuery(
  value: string
): ChordSelectionSearchQuery {
  const text = normalizeSearchText(value);
  const degreeTokens = getChordDegreeSearchTokens(value);
  return {
    text,
    degreeTokens,
    label: degreeTokens.length === 0 ? value.trim() : formatChordDegreeRomanSearchLabel(degreeTokens),
    isActive: text !== "",
  };
}

function matchesSearch(
  candidateText: string,
  candidateDegreeTokens: readonly string[],
  query: ChordSelectionSearchQuery
): boolean {
  if (!query.isActive) {
    return true;
  }
  if (query.degreeTokens.length > 0) {
    return chordDegreeSequenceContains(candidateDegreeTokens, query.degreeTokens);
  }

  return normalizeSearchText(candidateText).includes(query.text);
}

function formatSearchNumberLabel(degreeSource: string): string | null {
  const tokens = getChordDegreeSearchTokens(degreeSource);
  return tokens.length === 0 ? null : formatChordDegreeNumberSearchLabel(tokens);
}

export function getChordSelectionSearchResults(
  state: ChordSelectionSearchState,
  rawSearch: string
): ChordSelectionSearchResults {
  const query = createChordSelectionSearchQuery(rawSearch);
  const history = state.history
    .filter((entry) => matchesSearch(entry, getChordDegreeSearchTokens(entry), query))
    .map((entry) => ({
      value: entry,
      label: entry.replace(/\s+/g, " "),
      numberLabel: formatSearchNumberLabel(entry),
      selected: entry === state.currentInput.trim(),
    }));
  const templates =
    state.templateLoadState === "ready"
      ? state.templates
          .filter((template) =>
            matchesSearch(
              `${template.degrees} ${template.description}`,
              getChordDegreeSearchTokens(template.degrees),
              query
            )
          )
          .map((template) => ({
            value: template,
            label: formatChordTemplateOptionLabel(template),
            numberLabel: formatSearchNumberLabel(template.degrees),
            selected: template.degrees === state.selectedTemplateDegrees,
          }))
      : [];

  return { query, history, templates };
}

function createResultButton(
  label: string,
  numberLabel: string | null,
  selected: boolean
): HTMLButtonElement {
  const button = document.createElement("button");
  const textEl = document.createElement("span");
  button.type = "button";
  button.className = "chord-search-result";
  if (selected) {
    button.classList.add("chord-search-result--selected");
    button.setAttribute("aria-current", "true");
  }
  textEl.className = "chord-search-result__text";
  textEl.textContent = label;

  if (numberLabel !== null) {
    const numberEl = document.createElement("span");
    numberEl.className = "chord-search-result__number";
    numberEl.textContent = numberLabel;
    button.append(numberEl);
  } else {
    button.classList.add("chord-search-result--plain");
  }

  button.append(textEl);
  return button;
}

function createEmptyResult(text: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.className = "chord-search-results__empty";
  element.textContent = text;
  return element;
}

function createSection(title: string): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  section.className = "chord-search-results__section";
  heading.className = "chord-search-results__title";
  heading.textContent = title;
  section.append(heading);
  return section;
}

function focusResult(buttons: HTMLButtonElement[], index: number): void {
  buttons[index]?.focus();
}

export function createChordSelectionSearchController(
  options: CreateChordSelectionSearchControllerOptions
): ChordSelectionSearchController {
  const { elements, onSelectHistory, onSelectTemplate } = options;
  let lastState: ChordSelectionSearchState = {
    history: [],
    templates: [],
    templateLoadState: "loading",
    currentInput: "",
    selectedTemplateDegrees: null,
  };

  function isOpen(): boolean {
    return !elements.inputEl.hidden;
  }

  function getResultButtons(): HTMLButtonElement[] {
    return [...elements.resultsEl.querySelectorAll<HTMLButtonElement>(".chord-search-result")];
  }

  function focusSelectedResult(): void {
    const selectedButton = elements.resultsEl.querySelector<HTMLButtonElement>(
      ".chord-search-result--selected"
    );
    if (selectedButton === null) {
      elements.inputEl.focus();
      return;
    }

    selectedButton.focus();
  }

  function render(): void {
    const state = lastState;
    const results = getChordSelectionSearchResults(state, elements.inputEl.value);
    const historySection = createSection("history");
    const templateSection = createSection("template");
    elements.resultsEl.replaceChildren();

    if (results.history.length === 0) {
      historySection.append(
        createEmptyResult(state.history.length === 0 ? "history empty" : `no match: ${results.query.label}`)
      );
    } else {
      for (const result of results.history) {
        const button = createResultButton(
          result.label,
          result.numberLabel,
          result.selected
        );
        button.title = result.value;
        button.addEventListener("click", () => {
          onSelectHistory(result.value);
          focusSelectedResult();
        });
        historySection.append(button);
      }
    }

    if (state.templateLoadState !== "ready") {
      templateSection.append(
        createEmptyResult(
          state.templateLoadState === "loading" ? "template loading..." : "template load failed"
        )
      );
    } else if (results.templates.length === 0) {
      templateSection.append(
        createEmptyResult(
          state.templates.length === 0 ? "template empty" : `no match: ${results.query.label}`
        )
      );
    } else {
      for (const result of results.templates) {
        const button = createResultButton(
          result.label,
          result.numberLabel,
          result.selected
        );
        button.title = result.label;
        button.addEventListener("click", () => {
          onSelectTemplate(result.value);
          focusSelectedResult();
        });
        templateSection.append(button);
      }
    }

    elements.resultsEl.append(historySection, templateSection);
    elements.inputEl.title =
      results.query.degreeTokens.length === 0 ? "" : `normalized: ${results.query.label}`;
  }

  function open(state: ChordSelectionSearchState): void {
    lastState = state;
    elements.inputEl.hidden = false;
    elements.resultsEl.hidden = false;
    elements.buttonEl.setAttribute("aria-expanded", "true");
    render();
    elements.inputEl.focus();
    elements.inputEl.select();
  }

  function close(): void {
    elements.inputEl.value = "";
    elements.inputEl.hidden = true;
    elements.resultsEl.hidden = true;
    elements.buttonEl.setAttribute("aria-expanded", "false");
    render();
  }

  elements.resultsEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      elements.buttonEl.focus();
      return;
    }

    const buttons = getResultButtons();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(buttons, Math.min(currentIndex + 1, buttons.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusResult(buttons, Math.max(currentIndex - 1, 0));
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isOpen() || !(event.target instanceof Node)) {
      return;
    }
    if (elements.shellEl.contains(event.target)) {
      return;
    }

    close();
  });

  return {
    toggle(state): void {
      lastState = state;
      if (isOpen()) {
        close();
        elements.buttonEl.focus();
        return;
      }

      open(state);
    },
    sync(state): void {
      lastState = state;
      render();
    },
    close,
    closeAndFocusToggle(): void {
      close();
      elements.buttonEl.focus();
    },
    handleInputKeydown(event): void {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        elements.buttonEl.focus();
        return;
      }

      const buttons = getResultButtons();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusResult(buttons, 0);
      } else if (event.key === "Enter" && buttons.length === 1) {
        event.preventDefault();
        buttons[0].click();
      }
    },
  };
}

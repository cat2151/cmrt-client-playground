import {
  adjustChordProgression,
  type AutoAdjustResult,
} from "./auto-adjust.ts";
import type { ChordProgressionEditor } from "../chords/chord-progression-highlight.ts";

export interface AutoAdjustPanel {
  get enabled(): boolean;
  set enabled(value: boolean);
  get storageValue(): string;
  set storageValue(value: string | null);
  addChangeListener(listener: () => void): void;
  sync(rawInput: string): void;
  getEffectiveInput(rawInput: string): string;
}

function formatDiagnostics(result: AutoAdjustResult): string {
  if (result.ok) {
    const diagnostics = result.diagnostics.map((diagnostic) => diagnostic.message);
    return [result.summary, ...diagnostics].join("\n");
  }

  const diagnostics = result.diagnostics.map((diagnostic) => diagnostic.message);
  return [`ERROR: ${result.message}`, ...diagnostics].join("\n");
}

export function createAutoAdjustPanel(options: {
  enabledEl: HTMLInputElement;
  panelEl: HTMLElement;
  outputEl: Pick<ChordProgressionEditor, "value">;
  statusEl: HTMLElement;
}): AutoAdjustPanel {
  const { enabledEl, panelEl, outputEl, statusEl } = options;
  let latestRawInput: string | null = null;
  let latestResult: AutoAdjustResult | null = null;

  function renderDisabled(): void {
    latestRawInput = null;
    latestResult = null;
    panelEl.hidden = true;
    outputEl.value = "";
    statusEl.textContent = "";
    delete statusEl.dataset.state;
  }

  function renderResult(rawInput: string, result: AutoAdjustResult): void {
    panelEl.hidden = false;
    outputEl.value = result.ok ? result.adjustedInput : rawInput;
    statusEl.textContent = formatDiagnostics(result);
    statusEl.dataset.state = result.ok ? "ok" : "error";
  }

  function sync(rawInput: string): void {
    if (!enabledEl.checked) {
      renderDisabled();
      return;
    }

    latestRawInput = rawInput;
    latestResult = adjustChordProgression(rawInput);
    renderResult(rawInput, latestResult);
  }

  function ensureSynced(rawInput: string): void {
    if (enabledEl.checked && latestRawInput !== rawInput) {
      sync(rawInput);
    }
  }

  return {
    get enabled(): boolean {
      return enabledEl.checked;
    },
    set enabled(value: boolean) {
      enabledEl.checked = value;
    },
    get storageValue(): string {
      return enabledEl.checked ? "true" : "false";
    },
    set storageValue(value: string | null) {
      enabledEl.checked = value === "true";
    },
    addChangeListener(listener: () => void): void {
      enabledEl.addEventListener("change", listener);
    },
    sync,
    getEffectiveInput(rawInput: string): string {
      ensureSynced(rawInput);
      if (!enabledEl.checked || latestResult === null || !latestResult.ok) {
        return rawInput;
      }
      return latestResult.adjustedInput;
    },
  };
}

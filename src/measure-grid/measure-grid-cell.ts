import {
  getMeasureGridCaretPosition,
  type MeasureGridNavigationCaretOrigin,
  type MeasureGridNavigationSelectionBehavior,
} from "./measure-grid-navigation.ts";
import type { MeasureGridCellHighlight } from "./measure-grid-targets.ts";

export interface MeasureGridRenderedCellElements {
  shellEl: HTMLDivElement;
  previewEl: HTMLDivElement;
  inputEl: HTMLInputElement;
}

export function setMeasureGridCellHighlight(
  shellEl: HTMLDivElement,
  highlight: MeasureGridCellHighlight
): void {
  shellEl.classList.toggle(
    "measure-grid-cell--target-chord",
    highlight === "chord" || highlight === "both"
  );
  shellEl.classList.toggle(
    "measure-grid-cell--target-bass",
    highlight === "bass" || highlight === "both"
  );
  shellEl.classList.toggle("measure-grid-cell--target-both", highlight === "both");
}

export function setMeasureGridCellStatus(
  cell: MeasureGridRenderedCellElements,
  status: "idle" | "loading" | "syncing" | "error",
  title = ""
): void {
  const isBusy = status === "loading" || status === "syncing";
  const isInvalid = status === "error";
  const { shellEl, inputEl } = cell;

  shellEl.classList.toggle("measure-grid-cell--loading", status === "loading");
  shellEl.classList.toggle("measure-grid-cell--syncing", status === "syncing");
  shellEl.classList.toggle("measure-grid-cell--error", isInvalid);
  inputEl.title = title;

  if (isBusy) {
    inputEl.setAttribute("aria-busy", "true");
  } else {
    inputEl.removeAttribute("aria-busy");
  }

  if (isInvalid) {
    inputEl.setAttribute("aria-invalid", "true");
  } else {
    inputEl.removeAttribute("aria-invalid");
  }
}

export function syncMeasureGridCellPreview(
  previewEl: HTMLDivElement,
  value: string
): void {
  previewEl.textContent = value === "" ? "\u00a0" : value;
}

export function getMeasureGridCellExpandedWidthCh(value: string): number {
  return Math.max(1, value.length + 2);
}

export function syncMeasureGridCellExpandedWidth(
  shellEl: HTMLDivElement,
  value: string
): void {
  shellEl.style.setProperty(
    "--measure-grid-cell-expanded-width",
    `${getMeasureGridCellExpandedWidthCh(value)}ch`
  );
}

export function setMeasureGridCellValue(
  cell: MeasureGridRenderedCellElements,
  value: string
): void {
  cell.inputEl.value = value;
  syncMeasureGridCellPreview(cell.previewEl, value);
  syncMeasureGridCellExpandedWidth(cell.shellEl, value);
}

export function focusMeasureGridInput(
  inputEl: HTMLInputElement,
  selectionBehavior: MeasureGridNavigationSelectionBehavior,
  caretOffset = 0,
  caretOffsetOrigin: MeasureGridNavigationCaretOrigin = "start"
): void {
  inputEl.focus();
  const caretPosition = getMeasureGridCaretPosition(
    inputEl.value,
    selectionBehavior,
    caretOffset,
    caretOffsetOrigin
  );
  inputEl.setSelectionRange(caretPosition, caretPosition);
}

import { dawClientErrorMessage, type DawClient } from "../daw/daw-client.ts";
import { createDebouncedCallback } from "../utils/debounce.ts";
import {
  focusMeasureGridInput,
  setMeasureGridCellHighlight,
  setMeasureGridCellPlayback,
  setMeasureGridCellStatus,
  setMeasureGridCellValue,
  syncMeasureGridCellExpandedWidth,
  syncMeasureGridCellPreview,
  type MeasureGridRenderedCellElements,
} from "./measure-grid-cell.ts";
import {
  getVisibleMeasures,
  getVisibleTracks,
  type MeasureGridConfig,
} from "./measure-grid-config.ts";
import type { MeasureGridElements } from "./measure-grid-controls.ts";
import {
  formatMeasureGridMeasureLabel,
  formatMeasureGridTrackLabel,
} from "./measure-grid-labels.ts";
import { getMeasureGridArrowNavigationTarget } from "./measure-grid-navigation.ts";
import {
  getMeasureGridCellHighlight,
  type MeasureGridHighlightTargets,
} from "./measure-grid-targets.ts";
import { getMeasureGridCellKey } from "./measure-grid-keys.ts";
import { isStaleMeasureGridPostSync } from "./measure-grid-sync.ts";

export interface MeasureGridRowHeaderAction {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}

export type MeasureGridSyncer = ReturnType<typeof createDebouncedCallback>;

interface RenderMeasureGridOptions {
  elements: MeasureGridElements;
  config: MeasureGridConfig;
  values: Map<string, string>;
  inputs: Map<string, HTMLInputElement>;
  renderedCells: Map<string, MeasureGridRenderedCellElements>;
  measureHeaders: Map<number, HTMLTableCellElement>;
  syncers: Map<string, MeasureGridSyncer>;
  highlightTargets: MeasureGridHighlightTargets;
  playbackMeasure: number | null;
  dawClient: DawClient;
  appendLog: (message: string) => void;
  getRowHeaderActions?: (track: number) => MeasureGridRowHeaderAction[];
  autoSendDelayMs: number;
}

export function renderMeasureGrid(options: RenderMeasureGridOptions): void {
  cancelMeasureGridSyncers(options.syncers);
  options.inputs.clear();
  options.renderedCells.clear();
  options.measureHeaders.clear();
  options.elements.headEl.textContent = "";
  options.elements.bodyEl.textContent = "";

  const visibleTracks = getVisibleTracks(options.config);
  const visibleMeasures = getVisibleMeasures(options.config);
  renderMeasureGridHead(options, visibleMeasures);

  for (const track of visibleTracks) {
    options.elements.bodyEl.append(renderMeasureGridRow(options, track, visibleMeasures));
  }
}

function cancelMeasureGridSyncers(syncers: Map<string, MeasureGridSyncer>): void {
  for (const syncer of syncers.values()) {
    syncer.cancel();
  }
  syncers.clear();
}

function renderMeasureGridHead(
  options: RenderMeasureGridOptions,
  visibleMeasures: number[]
): void {
  const headRow = document.createElement("tr");
  const cornerCell = document.createElement("th");
  cornerCell.className = "measure-grid-corner-header";
  cornerCell.textContent = "track \\ meas";
  headRow.append(cornerCell);

  for (const measure of visibleMeasures) {
    const measureCell = document.createElement("th");
    measureCell.scope = "col";
    measureCell.textContent = formatMeasureGridMeasureLabel(measure);
    measureCell.classList.toggle(
      "measure-grid-measure-header--playing",
      measure === options.playbackMeasure
    );
    options.measureHeaders.set(measure, measureCell);
    headRow.append(measureCell);
  }

  options.elements.headEl.append(headRow);
}

function renderMeasureGridRow(
  options: RenderMeasureGridOptions,
  track: number,
  visibleMeasures: number[]
): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.append(renderMeasureGridRowHeader(options, track));

  for (const measure of visibleMeasures) {
    row.append(renderMeasureGridDataCell(options, track, measure, visibleMeasures));
  }

  return row;
}

function renderMeasureGridRowHeader(
  options: RenderMeasureGridOptions,
  track: number
): HTMLTableCellElement {
  const rowHeader = document.createElement("th");
  const rowHeaderContent = document.createElement("div");
  const rowHeaderTitle = document.createElement("span");
  rowHeader.scope = "row";
  rowHeader.className = "measure-grid-row-header";
  rowHeaderContent.className = "measure-grid-row-header__content";
  rowHeaderTitle.className = "measure-grid-row-header__title";
  rowHeaderTitle.textContent = formatMeasureGridTrackLabel(track);
  rowHeaderContent.append(rowHeaderTitle);

  const rowHeaderActions = options.getRowHeaderActions?.(track) ?? [];
  if (rowHeaderActions.length > 0) {
    rowHeaderContent.append(renderMeasureGridRowHeaderActions(rowHeaderActions));
  }

  rowHeader.append(rowHeaderContent);
  return rowHeader;
}

function renderMeasureGridRowHeaderActions(
  rowHeaderActions: MeasureGridRowHeaderAction[]
): HTMLDivElement {
  const actionsEl = document.createElement("div");
  actionsEl.className = "measure-grid-row-header__actions";
  for (const action of rowHeaderActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "measure-grid-row-header__action";
    button.textContent = action.label;
    button.setAttribute("aria-label", action.ariaLabel);
    button.title = action.ariaLabel;
    button.disabled = action.disabled ?? false;
    if (!button.disabled) {
      button.addEventListener("click", action.onClick);
    }
    actionsEl.append(button);
  }

  return actionsEl;
}

function renderMeasureGridDataCell(
  options: RenderMeasureGridOptions,
  track: number,
  measure: number,
  visibleMeasures: number[]
): HTMLTableCellElement {
  const cell = document.createElement("td");
  const shellEl = document.createElement("div");
  const previewEl = document.createElement("div");
  const input = document.createElement("input");
  const key = getMeasureGridCellKey(track, measure);
  let editVersion = 0;
  const renderedCell: MeasureGridRenderedCellElements = {
    shellEl,
    previewEl,
    inputEl: input,
  };
  const visibleTracks = getVisibleTracks(options.config);
  const syncer = createMeasureGridCellSyncer({
    ...options,
    track,
    measure,
    key,
    input,
    getEditVersion: () => editVersion,
    renderedCell,
  });

  shellEl.className = "measure-grid-cell-shell";
  previewEl.className = "measure-grid-cell-preview";
  previewEl.setAttribute("aria-hidden", "true");
  input.className = "measure-grid-cell";
  input.type = "text";
  input.dataset.dirty = "false";
  input.setAttribute(
    "aria-label",
    `${formatMeasureGridTrackLabel(track)} ${formatMeasureGridMeasureLabel(measure)}`
  );
  setMeasureGridCellValue(renderedCell, options.values.get(key) ?? "");
  setMeasureGridCellHighlight(
    shellEl,
    getMeasureGridCellHighlight(track, measure, options.highlightTargets)
  );
  setMeasureGridCellPlayback(shellEl, measure === options.playbackMeasure);
  input.addEventListener("input", () => {
    editVersion += 1;
    options.values.set(key, input.value);
    syncMeasureGridCellPreview(previewEl, input.value);
    syncMeasureGridCellExpandedWidth(shellEl, input.value);
    input.dataset.dirty = "true";
    setMeasureGridCellStatus(
      renderedCell,
      "syncing",
      `POST ${track}:${measure} を予約しました`
    );
    syncer.schedule();
  });
  input.addEventListener("keydown", (event) => {
    handleMeasureGridCellKeydown({
      event,
      options,
      input,
      track,
      measure,
      visibleTracks,
      visibleMeasures,
    });
  });

  options.inputs.set(key, input);
  options.renderedCells.set(key, renderedCell);
  options.syncers.set(key, syncer);
  shellEl.append(previewEl, input);
  cell.append(shellEl);
  return cell;
}

function createMeasureGridCellSyncer(options: RenderMeasureGridOptions & {
  track: number;
  measure: number;
  key: string;
  input: HTMLInputElement;
  getEditVersion: () => number;
  renderedCell: MeasureGridRenderedCellElements;
}): MeasureGridSyncer {
  return createDebouncedCallback(async () => {
    const sentValue = options.input.value;
    const sentEditVersion = options.getEditVersion();
    setMeasureGridCellStatus(
      options.renderedCell,
      "syncing",
      `POST ${options.track}:${options.measure} を cmrt と同期中`
    );

    const result = await options.dawClient.postMml(
      options.track,
      options.measure,
      sentValue
    );
    const isStaleResponse = isStaleMeasureGridPostSync({
      sentValue,
      currentValue: options.input.value,
      sentEditVersion,
      currentEditVersion: options.getEditVersion(),
    });
    if (isStaleResponse) {
      return;
    }

    if (result !== undefined) {
      const errorMessage = dawClientErrorMessage(result);
      setMeasureGridCellStatus(options.renderedCell, "error", errorMessage);
      options.appendLog(
        `ERROR: grid POST ${options.track}:${options.measure} に失敗しました: ${errorMessage}`
      );
      return;
    }

    options.values.set(options.key, sentValue);
    options.input.dataset.dirty = "false";
    setMeasureGridCellStatus(
      options.renderedCell,
      "idle",
      `POST ${options.track}:${options.measure} OK`
    );
    options.appendLog(`grid POST ${options.track}:${options.measure} OK: "${sentValue}"`);
  }, options.autoSendDelayMs);
}

function handleMeasureGridCellKeydown(options: {
  event: KeyboardEvent;
  options: RenderMeasureGridOptions;
  input: HTMLInputElement;
  track: number;
  measure: number;
  visibleTracks: number[];
  visibleMeasures: number[];
}): void {
  const navigationTarget = getMeasureGridArrowNavigationTarget({
    key: options.event.key,
    track: options.track,
    measure: options.measure,
    value: options.input.value,
    selectionStart: options.input.selectionStart,
    selectionEnd: options.input.selectionEnd,
    visibleTracks: options.visibleTracks,
    visibleMeasures: options.visibleMeasures,
    isComposing: options.event.isComposing,
    altKey: options.event.altKey,
    ctrlKey: options.event.ctrlKey,
    metaKey: options.event.metaKey,
    shiftKey: options.event.shiftKey,
  });
  if (navigationTarget === null) {
    return;
  }

  const nextInput = options.options.inputs.get(
    getMeasureGridCellKey(navigationTarget.track, navigationTarget.measure)
  );
  if (nextInput === undefined) {
    return;
  }

  options.event.preventDefault();
  focusMeasureGridInput(
    nextInput,
    navigationTarget.selectionBehavior,
    navigationTarget.caretOffset,
    navigationTarget.caretOffsetOrigin
  );
}

import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import { createDebouncedCallback } from "./debounce.ts";
import {
  focusMeasureGridInput,
  setMeasureGridCellHighlight,
  setMeasureGridCellStatus,
  setMeasureGridCellValue,
  syncMeasureGridCellExpandedWidth,
  syncMeasureGridCellPreview,
  type MeasureGridRenderedCellElements,
} from "./measure-grid-cell.ts";
import {
  expandMeasureGridConfigToInclude,
  getVisibleMeasures,
  getVisibleTracks,
  type MeasureGridConfig,
} from "./measure-grid-config.ts";
import {
  readMeasureGridConfigFromControls,
  syncMeasureGridControls,
  type MeasureGridElements,
} from "./measure-grid-controls.ts";
import {
  formatMeasureGridMeasureLabel,
  formatMeasureGridTrackLabel,
} from "./measure-grid-labels.ts";
import { getMeasureGridArrowNavigationTarget } from "./measure-grid-navigation.ts";
import {
  getMeasureGridCellHighlight,
  type MeasureGridHighlightTargets,
} from "./measure-grid-targets.ts";
import { getMmlsCellValue, isStaleMeasureGridPostSync } from "./measure-grid-sync.ts";

export {
  expandMeasureGridConfigToInclude,
  getVisibleMeasures,
  getVisibleTracks,
} from "./measure-grid-config.ts";
export { getMeasureGridCellExpandedWidthCh } from "./measure-grid-cell.ts";
export { formatMeasureGridMeasureLabel, formatMeasureGridTrackLabel } from "./measure-grid-labels.ts";
export {
  getMeasureGridArrowNavigationTarget,
  getMeasureGridCaretPosition,
} from "./measure-grid-navigation.ts";
export type { MeasureGridNavigationSelectionBehavior } from "./measure-grid-navigation.ts";
export { getMeasureGridCellHighlight } from "./measure-grid-targets.ts";
export type { MeasureGridHighlightTargets, MeasureGridTarget } from "./measure-grid-targets.ts";
export { getMmlsCellValue, isStaleMeasureGridPostSync } from "./measure-grid-sync.ts";
export type { MeasureGridConfig } from "./measure-grid-config.ts";

interface CreateMeasureGridControllerOptions {
  elements: MeasureGridElements;
  dawClient: DawClient;
  appendLog: (message: string) => void;
  getRowHeaderActions?: (track: number) => {
    label: string;
    ariaLabel: string;
    onClick: () => void;
    disabled?: boolean;
  }[];
  autoSendDelayMs: number;
  maxAutoExpandedTrackCount: number;
  maxAutoExpandedMeasureCount: number;
  initialConfig: MeasureGridConfig;
}

function getMeasureGridCellKey(track: number, measure: number): string {
  return `${track}:${measure}`;
}

export function createMeasureGridController(
  options: CreateMeasureGridControllerOptions
): {
  syncControls(): void;
  readConfigFromControls(): MeasureGridConfig | null;
  render(): void;
  applyConfig(config: MeasureGridConfig): void;
  setHighlightTargets(targets: MeasureGridHighlightTargets): void;
  reflectValue(track: number, measure: number, mml: string): void;
  loadFromCmrt(): Promise<void>;
} {
  const {
    elements,
    dawClient,
    appendLog,
    getRowHeaderActions,
    autoSendDelayMs,
    maxAutoExpandedTrackCount,
    maxAutoExpandedMeasureCount,
    initialConfig,
  } = options;
  const measureGridValues = new Map<string, string>();
  const measureGridInputs = new Map<string, HTMLInputElement>();
  const measureGridRenderedCells = new Map<string, MeasureGridRenderedCellElements>();
  const measureGridSyncers = new Map<
    string,
    ReturnType<typeof createDebouncedCallback>
  >();
  let measureGridConfig = { ...initialConfig };
  let lastFetchedEtag: string | null = null;
  let lastErrorMessage: string | null = null;
  let loadVersion = 0;
  let measureGridHighlightTargets: MeasureGridHighlightTargets = {
    chordTarget: null,
    bassTarget: null,
  };

  function cancelMeasureGridSyncers(): void {
    for (const syncer of measureGridSyncers.values()) {
      syncer.cancel();
    }
    measureGridSyncers.clear();
  }

  function syncControls(): void {
    syncMeasureGridControls(elements, measureGridConfig);
  }

  function readConfigFromControls(): MeasureGridConfig | null {
    return readMeasureGridConfigFromControls(elements, appendLog);
  }

  function updateMeasureGridHighlights(): void {
    for (const [key, cell] of measureGridRenderedCells.entries()) {
      const [trackText, measureText] = key.split(":");
      const track = Number(trackText);
      const measure = Number(measureText);
      setMeasureGridCellHighlight(
        cell.shellEl,
        getMeasureGridCellHighlight(track, measure, measureGridHighlightTargets)
      );
    }
  }

  function render(): void {
    cancelMeasureGridSyncers();
    measureGridInputs.clear();
    measureGridRenderedCells.clear();
    elements.headEl.textContent = "";
    elements.bodyEl.textContent = "";

    const visibleTracks = getVisibleTracks(measureGridConfig);
    const visibleMeasures = getVisibleMeasures(measureGridConfig);
    const headRow = document.createElement("tr");
    const cornerCell = document.createElement("th");
    cornerCell.className = "measure-grid-corner-header";
    cornerCell.textContent = "track \\ meas";
    headRow.append(cornerCell);

    for (const measure of visibleMeasures) {
      const measureCell = document.createElement("th");
      measureCell.scope = "col";
      measureCell.textContent = formatMeasureGridMeasureLabel(measure);
      headRow.append(measureCell);
    }

    elements.headEl.append(headRow);

    for (const track of visibleTracks) {
      const row = document.createElement("tr");
      const rowHeader = document.createElement("th");
      const rowHeaderContent = document.createElement("div");
      const rowHeaderTitle = document.createElement("span");
      rowHeader.scope = "row";
      rowHeader.className = "measure-grid-row-header";
      rowHeaderContent.className = "measure-grid-row-header__content";
      rowHeaderTitle.className = "measure-grid-row-header__title";
      rowHeaderTitle.textContent = formatMeasureGridTrackLabel(track);
      rowHeaderContent.append(rowHeaderTitle);

      const rowHeaderActions = getRowHeaderActions?.(track) ?? [];
      if (rowHeaderActions.length > 0) {
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
        rowHeaderContent.append(actionsEl);
      }

      rowHeader.append(rowHeaderContent);
      row.append(rowHeader);

      for (const measure of visibleMeasures) {
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
        const syncer = createDebouncedCallback(async () => {
          const sentValue = input.value;
          const sentEditVersion = editVersion;
          setMeasureGridCellStatus(
            renderedCell,
            "syncing",
            `POST ${track}:${measure} を cmrt と同期中`
          );

          const result = await dawClient.postMml(track, measure, sentValue);
          const isStaleResponse = isStaleMeasureGridPostSync({
            sentValue,
            currentValue: input.value,
            sentEditVersion,
            currentEditVersion: editVersion,
          });
          if (isStaleResponse) {
            return;
          }

          if (result !== undefined) {
            const errorMessage = dawClientErrorMessage(result);
            setMeasureGridCellStatus(renderedCell, "error", errorMessage);
            appendLog(`ERROR: grid POST ${track}:${measure} に失敗しました: ${errorMessage}`);
            return;
          }

          measureGridValues.set(key, sentValue);
          input.dataset.dirty = "false";
          setMeasureGridCellStatus(renderedCell, "idle", `POST ${track}:${measure} OK`);
          appendLog(`grid POST ${track}:${measure} OK: "${sentValue}"`);
        }, autoSendDelayMs);

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
        setMeasureGridCellValue(renderedCell, measureGridValues.get(key) ?? "");
        setMeasureGridCellHighlight(
          shellEl,
          getMeasureGridCellHighlight(track, measure, measureGridHighlightTargets)
        );
        input.addEventListener("input", () => {
          editVersion += 1;
          measureGridValues.set(key, input.value);
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
          const navigationTarget = getMeasureGridArrowNavigationTarget({
            key: event.key,
            track,
            measure,
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
            visibleTracks,
            visibleMeasures,
            isComposing: event.isComposing,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
          });
          if (navigationTarget === null) {
            return;
          }

          const nextInput = measureGridInputs.get(
            getMeasureGridCellKey(navigationTarget.track, navigationTarget.measure)
          );
          if (nextInput === undefined) {
            return;
          }

          event.preventDefault();
          focusMeasureGridInput(
            nextInput,
            navigationTarget.selectionBehavior,
            navigationTarget.caretOffset,
            navigationTarget.caretOffsetOrigin
          );
        });

        measureGridInputs.set(key, input);
        measureGridRenderedCells.set(key, renderedCell);
        measureGridSyncers.set(key, syncer);
        shellEl.append(previewEl, input);
        cell.append(shellEl);
        row.append(cell);
      }

      elements.bodyEl.append(row);
    }
  }

  function applyConfig(config: MeasureGridConfig): void {
    measureGridConfig = config;
    // 表示範囲が変わるため、次回は全データを取得し直す。
    lastFetchedEtag = null;
    loadVersion += 1;
    syncControls();
    render();
  }

  function setHighlightTargets(targets: MeasureGridHighlightTargets): void {
    measureGridHighlightTargets = targets;
    updateMeasureGridHighlights();
  }

  function ensureIncludes(track: number, measure: number): boolean {
    const nextConfig = expandMeasureGridConfigToInclude(
      measureGridConfig,
      track,
      measure,
      {
        maxTrackCount: maxAutoExpandedTrackCount,
        maxMeasureCount: maxAutoExpandedMeasureCount,
      }
    );
    if (nextConfig === null) {
      const requiredTrackCount =
        track < measureGridConfig.trackStart
          ? measureGridConfig.trackCount + (measureGridConfig.trackStart - track)
          : track - measureGridConfig.trackStart + 1;
      const requiredMeasureCount =
        measure < measureGridConfig.measureStart
          ? measureGridConfig.measureCount + (measureGridConfig.measureStart - measure)
          : measure - measureGridConfig.measureStart + 1;

      if (requiredTrackCount > maxAutoExpandedTrackCount) {
        appendLog(
          `grid 自動拡張をスキップ: track ${track} を表示するには ${requiredTrackCount} tracks が必要です。grid track start/count を明示的に変更してください`
        );
      }
      if (requiredMeasureCount > maxAutoExpandedMeasureCount) {
        appendLog(
          `grid 自動拡張をスキップ: meas ${measure} を表示するには ${requiredMeasureCount} meas が必要です。grid meas start/count を明示的に変更してください`
        );
      }
      return false;
    }

    if (
      nextConfig.trackStart !== measureGridConfig.trackStart ||
      nextConfig.trackCount !== measureGridConfig.trackCount ||
      nextConfig.measureStart !== measureGridConfig.measureStart ||
      nextConfig.measureCount !== measureGridConfig.measureCount
    ) {
      applyConfig(nextConfig);
    }

    return true;
  }

  function reflectValue(track: number, measure: number, mml: string): void {
    const key = getMeasureGridCellKey(track, measure);
    const didIncludeTarget = ensureIncludes(track, measure);
    if (!didIncludeTarget) {
      measureGridValues.set(key, mml);
      return;
    }

    const input = measureGridInputs.get(key);
    const renderedCell = measureGridRenderedCells.get(key);
    if (input === undefined || renderedCell === undefined) {
      measureGridValues.set(key, mml);
      return;
    }

    if (input.dataset.dirty === "true") {
      input.title = `web側の結果 ${track}:${measure} は、未送信の編集があるため上書きをスキップ`;
      appendLog(
        `grid 反映をスキップ: ${track}:${measure} には未送信の編集があるため web側の結果を上書きしません`
      );
      return;
    }

    measureGridValues.set(key, mml);
    setMeasureGridCellValue(renderedCell, mml);
    input.dataset.dirty = "false";
    setMeasureGridCellStatus(renderedCell, "idle", `web側の結果を ${track}:${measure} に反映済み`);
  }

  async function loadFromCmrt(): Promise<void> {
    const visibleTracks = getVisibleTracks(measureGridConfig);
    const visibleMeasures = getVisibleMeasures(measureGridConfig);
    const requestVersion = loadVersion;
    const requestEtag = lastFetchedEtag;
    const shouldShowLoading = requestEtag === null;
    for (const track of visibleTracks) {
      for (const measure of visibleMeasures) {
        const input = measureGridInputs.get(getMeasureGridCellKey(track, measure));
        const renderedCell = measureGridRenderedCells.get(getMeasureGridCellKey(track, measure));
        if (input !== undefined && renderedCell !== undefined && shouldShowLoading) {
          setMeasureGridCellStatus(renderedCell, "loading", `GET ${track}:${measure} を読み込み中`);
        }
      }
    }

    const snapshot = await dawClient.getMmls(requestEtag ?? undefined);
    if (requestVersion !== loadVersion) {
      return;
    }

    if (typeof snapshot === "object" && snapshot !== null && "kind" in snapshot) {
      const errorMessage = dawClientErrorMessage(snapshot);
      if (lastErrorMessage !== errorMessage) {
        appendLog(`ERROR: grid GET に失敗しました: ${errorMessage}`);
      }
      lastErrorMessage = errorMessage;
      for (const track of visibleTracks) {
        for (const measure of visibleMeasures) {
          const renderedCell = measureGridRenderedCells.get(
            getMeasureGridCellKey(track, measure)
          );
          if (renderedCell !== undefined) {
            setMeasureGridCellStatus(renderedCell, "error", errorMessage);
          }
        }
      }
      return;
    }

    lastErrorMessage = null;
    if (snapshot === null) {
      return;
    }

    lastFetchedEtag = snapshot.etag;
    for (const track of visibleTracks) {
      for (const measure of visibleMeasures) {
        const key = getMeasureGridCellKey(track, measure);
        const input = measureGridInputs.get(key);
        const renderedCell = measureGridRenderedCells.get(key);
        if (input === undefined || renderedCell === undefined) {
          continue;
        }

        const value = getMmlsCellValue(snapshot.tracks, track, measure);
        if (value === null) {
          setMeasureGridCellStatus(
            renderedCell,
            "error",
            `GET ${track}:${measure} は /mmls の範囲外です`
          );
          continue;
        }

        measureGridValues.set(key, value);
        if (input.dataset.dirty !== "true") {
          setMeasureGridCellValue(renderedCell, value);
        }
        setMeasureGridCellStatus(renderedCell, "idle", `GET ${track}:${measure} OK`);
      }
    }
  }

  return {
    syncControls,
    readConfigFromControls,
    render,
    applyConfig,
    setHighlightTargets,
    reflectValue,
    loadFromCmrt,
  };
}

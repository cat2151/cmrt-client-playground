import { DawClient, dawClientErrorMessage, type GetMmlsResponse } from "./daw-client.ts";
import { createDebouncedCallback } from "./debounce.ts";
import {
  expandMeasureGridConfigToInclude,
  getVisibleMeasures,
  getVisibleTracks,
  type MeasureGridConfig,
} from "./measure-grid-config.ts";
import { parseNonNegativeInteger, parsePositiveInteger } from "./post-config.ts";

export {
  expandMeasureGridConfigToInclude,
  getVisibleMeasures,
  getVisibleTracks,
} from "./measure-grid-config.ts";
export type { MeasureGridConfig } from "./measure-grid-config.ts";

export interface MeasureGridTarget {
  track: number;
  measure: number;
}

export interface MeasureGridHighlightTargets {
  chordTarget: MeasureGridTarget | null;
  bassTarget: MeasureGridTarget | null;
}

export type MeasureGridNavigationSelectionBehavior = "start" | "end" | "preserve";

type MeasureGridNavigationCaretOrigin = "start" | "end";

interface MeasureGridArrowNavigationRequest {
  key: string;
  track: number;
  measure: number;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  visibleTracks: number[];
  visibleMeasures: number[];
  isComposing: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

interface MeasureGridArrowNavigationTarget {
  track: number;
  measure: number;
  selectionBehavior: MeasureGridNavigationSelectionBehavior;
  caretOffset?: number;
  caretOffsetOrigin?: MeasureGridNavigationCaretOrigin;
}

interface MeasureGridRenderedCellElements {
  shellEl: HTMLDivElement;
  previewEl: HTMLDivElement;
  inputEl: HTMLInputElement;
}

interface MeasureGridElements {
  trackStartEl: HTMLInputElement;
  trackCountEl: HTMLInputElement;
  measureStartEl: HTMLInputElement;
  measureCountEl: HTMLInputElement;
  headEl: HTMLTableSectionElement;
  bodyEl: HTMLTableSectionElement;
}

interface CreateMeasureGridControllerOptions {
  elements: MeasureGridElements;
  dawClient: DawClient;
  appendLog: (message: string) => void;
  autoSendDelayMs: number;
  maxAutoExpandedTrackCount: number;
  maxAutoExpandedMeasureCount: number;
  initialConfig: MeasureGridConfig;
}

/**
 * POST送信時と応答受信時の入力状態を比較し、stale な応答かどうかを判定するためのスナップショット。
 */
interface MeasureGridPostSyncSnapshot {
  sentValue: string;
  currentValue: string;
  sentEditVersion: number;
  currentEditVersion: number;
}

function getMeasureGridCellKey(track: number, measure: number): string {
  return `${track}:${measure}`;
}

export function getMeasureGridArrowNavigationTarget(
  request: MeasureGridArrowNavigationRequest
): MeasureGridArrowNavigationTarget | null {
  if (
    request.isComposing ||
    request.altKey ||
    request.ctrlKey ||
    request.metaKey ||
    request.shiftKey
  ) {
    return null;
  }

  const trackIndex = request.visibleTracks.indexOf(request.track);
  const measureIndex = request.visibleMeasures.indexOf(request.measure);
  if (trackIndex === -1 || measureIndex === -1) {
    return null;
  }

  switch (request.key) {
    case "ArrowLeft":
      if (
        request.selectionStart === null ||
        request.selectionEnd === null ||
        request.selectionStart !== request.selectionEnd ||
        request.selectionStart !== 0 ||
        measureIndex === 0
      ) {
        return null;
      }
      return {
        track: request.track,
        measure: request.visibleMeasures[measureIndex - 1],
        selectionBehavior: "end",
      };
    case "ArrowRight":
      if (
        request.selectionStart === null ||
        request.selectionEnd === null ||
        request.selectionStart !== request.selectionEnd ||
        request.selectionEnd !== request.value.length ||
        measureIndex === request.visibleMeasures.length - 1
      ) {
        return null;
      }
      return {
        track: request.track,
        measure: request.visibleMeasures[measureIndex + 1],
        selectionBehavior: "start",
      };
    case "ArrowUp":
      if (trackIndex === 0) {
        return null;
      }
      return getMeasureGridVerticalNavigationTarget(
        request.visibleTracks[trackIndex - 1],
        request.measure,
        request.value,
        request.selectionStart
      );
    case "ArrowDown":
      if (trackIndex === request.visibleTracks.length - 1) {
        return null;
      }
      return getMeasureGridVerticalNavigationTarget(
        request.visibleTracks[trackIndex + 1],
        request.measure,
        request.value,
        request.selectionStart
      );
    default:
      return null;
  }
}

function getMeasureGridVerticalNavigationTarget(
  track: number,
  measure: number,
  value: string,
  selectionStart: number | null
): MeasureGridArrowNavigationTarget {
  const caretPosition = selectionStart ?? 0;
  if (caretPosition * 2 <= value.length) {
    return {
      track,
      measure,
      selectionBehavior: "preserve",
      caretOffset: caretPosition,
      caretOffsetOrigin: "start",
    };
  }

  return {
    track,
    measure,
    selectionBehavior: "preserve",
    caretOffset: value.length - caretPosition,
    caretOffsetOrigin: "end",
  };
}

export function getMeasureGridCaretPosition(
  value: string,
  selectionBehavior: MeasureGridNavigationSelectionBehavior,
  caretOffset = 0,
  caretOffsetOrigin: MeasureGridNavigationCaretOrigin = "start"
): number {
  switch (selectionBehavior) {
    case "start":
      return 0;
    case "end":
      return value.length;
    case "preserve":
      if (caretOffsetOrigin === "start") {
        return Math.min(value.length, caretOffset);
      }
      return Math.max(0, value.length - caretOffset);
    default:
      return 0;
  }
}

export function getMeasureGridCellHighlight(
  track: number,
  measure: number,
  targets: MeasureGridHighlightTargets
): "none" | "chord" | "bass" | "both" {
  const isChordTarget =
    targets.chordTarget?.track === track && targets.chordTarget?.measure === measure;
  const isBassTarget =
    targets.bassTarget?.track === track && targets.bassTarget?.measure === measure;

  if (isChordTarget && isBassTarget) {
    return "both";
  }
  if (isChordTarget) {
    return "chord";
  }
  if (isBassTarget) {
    return "bass";
  }
  return "none";
}

function setMeasureGridCellHighlight(
  shellEl: HTMLDivElement,
  highlight: "none" | "chord" | "bass" | "both"
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

function setMeasureGridCellStatus(
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

function syncMeasureGridCellPreview(previewEl: HTMLDivElement, value: string): void {
  previewEl.textContent = value === "" ? "\u00a0" : value;
}

export function getMeasureGridCellExpandedWidthCh(value: string): number {
  return Math.max(1, value.length + 2);
}

function syncMeasureGridCellExpandedWidth(shellEl: HTMLDivElement, value: string): void {
  shellEl.style.setProperty(
    "--measure-grid-cell-expanded-width",
    `${getMeasureGridCellExpandedWidthCh(value)}ch`
  );
}

function setMeasureGridCellValue(
  cell: MeasureGridRenderedCellElements,
  value: string
): void {
  cell.inputEl.value = value;
  syncMeasureGridCellPreview(cell.previewEl, value);
  syncMeasureGridCellExpandedWidth(cell.shellEl, value);
}

function focusMeasureGridInput(
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

/**
 * 入力値が変化した、または edit version が進んだ場合は、送信中により新しい編集が入ったとみなす。
 */
export function isStaleMeasureGridPostSync(
  snapshot: MeasureGridPostSyncSnapshot
): boolean {
  return (
    snapshot.currentValue !== snapshot.sentValue ||
    snapshot.currentEditVersion !== snapshot.sentEditVersion
  );
}

export function getMmlsCellValue(
  snapshot: GetMmlsResponse["tracks"],
  track: number,
  measure: number
): string | null {
  if (!Number.isInteger(track) || track < 0 || !Number.isInteger(measure) || measure < 0) {
    return null;
  }

  const trackValues = snapshot[track];
  if (trackValues === undefined) {
    return null;
  }

  const value = trackValues[measure];
  return typeof value === "string" ? value : null;
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
    elements.trackStartEl.value = String(measureGridConfig.trackStart);
    elements.trackCountEl.value = String(measureGridConfig.trackCount);
    elements.measureStartEl.value = String(measureGridConfig.measureStart);
    elements.measureCountEl.value = String(measureGridConfig.measureCount);
  }

  function readConfigFromControls(): MeasureGridConfig | null {
    const trackStart = parsePositiveInteger(elements.trackStartEl.value);
    if (trackStart === null) {
      appendLog("ERROR: grid track start には 1 以上の整数を指定してください");
      return null;
    }

    const trackCount = parsePositiveInteger(elements.trackCountEl.value);
    if (trackCount === null) {
      appendLog("ERROR: grid track count には 1 以上の整数を指定してください");
      return null;
    }

    const measureStart = parseNonNegativeInteger(elements.measureStartEl.value);
    if (measureStart === null) {
      appendLog("ERROR: grid meas start には 0 以上の整数を指定してください");
      return null;
    }

    const measureCount = parsePositiveInteger(elements.measureCountEl.value);
    if (measureCount === null) {
      appendLog("ERROR: grid meas count には 1 以上の整数を指定してください");
      return null;
    }

    return { trackStart, trackCount, measureStart, measureCount };
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
    cornerCell.textContent = "track \\ meas";
    headRow.append(cornerCell);

    for (const measure of visibleMeasures) {
      const measureCell = document.createElement("th");
      measureCell.scope = "col";
      measureCell.textContent = String(measure);
      headRow.append(measureCell);
    }

    elements.headEl.append(headRow);

    for (const track of visibleTracks) {
      const row = document.createElement("tr");
      const rowHeader = document.createElement("th");
      rowHeader.scope = "row";
      rowHeader.textContent = `track ${track}`;
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
        input.setAttribute("aria-label", `track ${track} measure ${measure}`);
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

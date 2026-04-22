import { dawClientErrorMessage, type DawClient } from "../daw/daw-client.ts";
import {
  setMeasureGridCellHighlight,
  setMeasureGridCellCacheState,
  setMeasureGridCellPlayback,
  setMeasureGridCellStatus,
  setMeasureGridCellValue,
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
  getMeasureGridCellHighlight,
  type MeasureGridHighlightTargets,
} from "./measure-grid-targets.ts";
import { getMeasureGridCellKey } from "./measure-grid-keys.ts";
import {
  renderMeasureGrid,
  type MeasureGridRowHeaderAction,
  type MeasureGridSyncer,
} from "./measure-grid-render.ts";
import {
  buildMeasureGridCacheStateMap,
  type MeasureGridCacheCells,
  type MeasureGridCacheState,
} from "./measure-grid-cache.ts";
import { getMmlsCellValue } from "./measure-grid-sync.ts";

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
  getRowHeaderActions?: (track: number) => MeasureGridRowHeaderAction[];
  autoSendDelayMs: number;
  maxAutoExpandedTrackCount: number;
  maxAutoExpandedMeasureCount: number;
  initialConfig: MeasureGridConfig;
}

export function createMeasureGridController(
  options: CreateMeasureGridControllerOptions
): {
  syncControls(): void;
  readConfigFromControls(): MeasureGridConfig | null;
  render(): void;
  applyConfig(config: MeasureGridConfig): void;
  setHighlightTargets(targets: MeasureGridHighlightTargets): void;
  setPlaybackMeasure(measure: number | null): void;
  setCacheCells(cells: MeasureGridCacheCells | null): void;
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
  const measureGridMeasureHeaders = new Map<number, HTMLTableCellElement>();
  const measureGridSyncers = new Map<string, MeasureGridSyncer>();
  let measureGridCacheStates = new Map<string, MeasureGridCacheState>();
  let measureGridConfig = { ...initialConfig };
  let lastFetchedEtag: string | null = null;
  let lastErrorMessage: string | null = null;
  let loadVersion = 0;
  let measureGridHighlightTargets: MeasureGridHighlightTargets = {
    chordTarget: null,
    bassTarget: null,
  };
  let playbackMeasure: number | null = null;

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

  function updateMeasureGridPlaybackMeasure(): void {
    for (const [measure, headerEl] of measureGridMeasureHeaders.entries()) {
      headerEl.classList.toggle(
        "measure-grid-measure-header--playing",
        measure === playbackMeasure
      );
    }
    for (const [key, cell] of measureGridRenderedCells.entries()) {
      const [, measureText] = key.split(":");
      setMeasureGridCellPlayback(cell.shellEl, Number(measureText) === playbackMeasure);
    }
  }

  function updateMeasureGridCacheStates(): void {
    for (const [key, cell] of measureGridRenderedCells.entries()) {
      setMeasureGridCellCacheState(cell.shellEl, measureGridCacheStates.get(key) ?? null);
    }
  }

  function render(): void {
    renderMeasureGrid({
      elements,
      config: measureGridConfig,
      values: measureGridValues,
      inputs: measureGridInputs,
      renderedCells: measureGridRenderedCells,
      measureHeaders: measureGridMeasureHeaders,
      syncers: measureGridSyncers,
      cacheStates: measureGridCacheStates,
      highlightTargets: measureGridHighlightTargets,
      playbackMeasure,
      dawClient,
      appendLog,
      getRowHeaderActions,
      autoSendDelayMs,
    });
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

  function setPlaybackMeasure(measure: number | null): void {
    if (playbackMeasure === measure) {
      return;
    }

    playbackMeasure = measure;
    updateMeasureGridPlaybackMeasure();
  }

  function setCacheCells(cells: MeasureGridCacheCells | null): void {
    measureGridCacheStates = buildMeasureGridCacheStateMap(cells);
    updateMeasureGridCacheStates();
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
    setPlaybackMeasure,
    setCacheCells,
    reflectValue,
    loadFromCmrt,
  };
}

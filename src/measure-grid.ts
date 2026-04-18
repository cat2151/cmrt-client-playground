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
  gridGetConcurrency: number;
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
  input: HTMLInputElement,
  highlight: "none" | "chord" | "bass" | "both"
): void {
  input.classList.toggle(
    "measure-grid-cell--target-chord",
    highlight === "chord" || highlight === "both"
  );
  input.classList.toggle(
    "measure-grid-cell--target-bass",
    highlight === "bass" || highlight === "both"
  );
  input.classList.toggle("measure-grid-cell--target-both", highlight === "both");
}

function setMeasureGridCellStatus(
  input: HTMLInputElement,
  status: "idle" | "loading" | "syncing" | "error",
  title = ""
): void {
  const isBusy = status === "loading" || status === "syncing";
  const isInvalid = status === "error";

  input.classList.toggle("measure-grid-cell--loading", status === "loading");
  input.classList.toggle("measure-grid-cell--syncing", status === "syncing");
  input.classList.toggle("measure-grid-cell--error", isInvalid);
  input.title = title;

  if (isBusy) {
    input.setAttribute("aria-busy", "true");
  } else {
    input.removeAttribute("aria-busy");
  }

  if (isInvalid) {
    input.setAttribute("aria-invalid", "true");
  } else {
    input.removeAttribute("aria-invalid");
  }
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
    gridGetConcurrency,
    maxAutoExpandedTrackCount,
    maxAutoExpandedMeasureCount,
    initialConfig,
  } = options;
  const measureGridValues = new Map<string, string>();
  const measureGridInputs = new Map<string, HTMLInputElement>();
  const measureGridSyncers = new Map<
    string,
    ReturnType<typeof createDebouncedCallback>
  >();
  let measureGridConfig = { ...initialConfig };
  let loadedSnapshotEtag: string | null = null;
  let previousLoadErrorMessage: string | null = null;
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
    for (const [key, input] of measureGridInputs.entries()) {
      const [trackText, measureText] = key.split(":");
      const track = Number(trackText);
      const measure = Number(measureText);
      setMeasureGridCellHighlight(
        input,
        getMeasureGridCellHighlight(track, measure, measureGridHighlightTargets)
      );
    }
  }

  function render(): void {
    cancelMeasureGridSyncers();
    measureGridInputs.clear();
    elements.headEl.textContent = "";
    elements.bodyEl.textContent = "";

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

    for (const track of getVisibleTracks(measureGridConfig)) {
      const row = document.createElement("tr");
      const rowHeader = document.createElement("th");
      rowHeader.scope = "row";
      rowHeader.textContent = `track ${track}`;
      row.append(rowHeader);

      for (const measure of visibleMeasures) {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        const key = getMeasureGridCellKey(track, measure);
        let editVersion = 0;
        const syncer = createDebouncedCallback(async () => {
          const sentValue = input.value;
          const sentEditVersion = editVersion;
          setMeasureGridCellStatus(
            input,
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
            setMeasureGridCellStatus(input, "error", errorMessage);
            appendLog(`ERROR: grid POST ${track}:${measure} に失敗しました: ${errorMessage}`);
            return;
          }

          measureGridValues.set(key, sentValue);
          input.dataset.dirty = "false";
          setMeasureGridCellStatus(input, "idle", `POST ${track}:${measure} OK`);
          appendLog(`grid POST ${track}:${measure} OK: "${sentValue}"`);
        }, autoSendDelayMs);

        input.className = "measure-grid-cell";
        input.type = "text";
        input.value = measureGridValues.get(key) ?? "";
        input.dataset.dirty = "false";
        input.setAttribute("aria-label", `track ${track} measure ${measure}`);
        setMeasureGridCellHighlight(
          input,
          getMeasureGridCellHighlight(track, measure, measureGridHighlightTargets)
        );
        input.addEventListener("input", () => {
          editVersion += 1;
          measureGridValues.set(key, input.value);
          input.dataset.dirty = "true";
          setMeasureGridCellStatus(
            input,
            "syncing",
            `POST ${track}:${measure} を予約しました`
          );
          syncer.schedule();
        });

        measureGridInputs.set(key, input);
        measureGridSyncers.set(key, syncer);
        cell.append(input);
        row.append(cell);
      }

      elements.bodyEl.append(row);
    }
  }

  function applyConfig(config: MeasureGridConfig): void {
    measureGridConfig = config;
    loadedSnapshotEtag = null;
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
    if (input === undefined) {
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
    input.value = mml;
    input.dataset.dirty = "false";
    setMeasureGridCellStatus(input, "idle", `web側の結果を ${track}:${measure} に反映済み`);
  }

  async function loadFromCmrt(): Promise<void> {
    const visibleTracks = getVisibleTracks(measureGridConfig);
    const visibleMeasures = getVisibleMeasures(measureGridConfig);
    const shouldShowLoading = loadedSnapshotEtag === null;
    for (const track of visibleTracks) {
      for (const measure of visibleMeasures) {
        const input = measureGridInputs.get(getMeasureGridCellKey(track, measure));
        if (input !== undefined && shouldShowLoading) {
          setMeasureGridCellStatus(input, "loading", `GET ${track}:${measure} を読み込み中`);
        }
      }
    }

    const snapshot = await dawClient.getMmls(loadedSnapshotEtag ?? undefined);
    if (typeof snapshot === "object" && snapshot !== null && "kind" in snapshot) {
      const errorMessage = dawClientErrorMessage(snapshot);
      if (previousLoadErrorMessage !== errorMessage) {
        appendLog(`ERROR: grid GET に失敗しました: ${errorMessage}`);
      }
      previousLoadErrorMessage = errorMessage;
      for (const track of visibleTracks) {
        for (const measure of visibleMeasures) {
          const input = measureGridInputs.get(getMeasureGridCellKey(track, measure));
          if (input !== undefined) {
            setMeasureGridCellStatus(input, "error", errorMessage);
          }
        }
      }
      return;
    }

    previousLoadErrorMessage = null;
    if (snapshot === null) {
      return;
    }

    loadedSnapshotEtag = snapshot.etag;
    for (const track of visibleTracks) {
      for (const measure of visibleMeasures) {
        const key = getMeasureGridCellKey(track, measure);
        const input = measureGridInputs.get(key);
        if (input === undefined) {
          continue;
        }

        const value = getMmlsCellValue(snapshot.tracks, track, measure);
        if (value === null) {
          setMeasureGridCellStatus(
            input,
            "error",
            `GET ${track}:${measure} は /mmls の範囲外です`
          );
          continue;
        }

        measureGridValues.set(key, value);
        if (input.dataset.dirty !== "true") {
          input.value = value;
        }
        setMeasureGridCellStatus(input, "idle", `GET ${track}:${measure} OK`);
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

import "./style.css";
import { splitBassRootMmlByTrack } from "./bass-root-mml.ts";
import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import { chordToMml } from "./chord-to-mml.ts";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  formatPostErrorMessage,
  parseNonNegativeInteger,
  parsePositiveInteger,
  resolveBassTargets,
  sanitizeMmlForPost,
} from "./post-config.ts";
import { createDebouncedCallback } from "./debounce.ts";
import {
  assignMeasuresToChunks,
  parseChordSegments,
  splitChordSegmentsByMeasure,
  splitSanitizedMmlIntoChordSegments,
  type PreparedMeasureInput,
} from "./measure-input.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const trackEl = document.getElementById("track") as HTMLInputElement;
const measureEl = document.getElementById("measure") as HTMLInputElement;
const bassTrackEl = document.getElementById("bass-track") as HTMLInputElement;
const bassMeasureEl = document.getElementById("bass-measure") as HTMLInputElement;
const sendBtn = document.getElementById("send") as HTMLButtonElement;
const gridTrackStartEl = document.getElementById("grid-track-start") as HTMLInputElement;
const gridTrackCountEl = document.getElementById("grid-track-count") as HTMLInputElement;
const gridMeasureStartEl = document.getElementById("grid-measure-start") as HTMLInputElement;
const gridMeasureCountEl = document.getElementById("grid-measure-count") as HTMLInputElement;
const gridReloadBtn = document.getElementById("grid-reload") as HTMLButtonElement;
const measureGridHeadEl = document.getElementById("measure-grid-head") as HTMLTableSectionElement;
const measureGridBodyEl = document.getElementById("measure-grid-body") as HTMLTableSectionElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const TRACK_STORAGE_KEY = "cmrt-client-playground.track";
const MEASURE_STORAGE_KEY = "cmrt-client-playground.measure";
const BASS_TRACK_STORAGE_KEY = "cmrt-client-playground.bass-track";
const BASS_MEASURE_STORAGE_KEY = "cmrt-client-playground.bass-measure";
const AUTO_SEND_DELAY_MS = 1000;
const GRID_GET_CONCURRENCY = 8;
const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;

interface MeasureGridConfig {
  trackStart: number;
  trackCount: number;
  measureStart: number;
  measureCount: number;
}

const measureGridValues = new Map<string, string>();
const measureGridInputs = new Map<string, HTMLInputElement>();
const measureGridSyncers = new Map<
  string,
  ReturnType<typeof createDebouncedCallback>
>();
const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 1,
  trackCount: 4,
  measureStart: 0,
  measureCount: 8,
};
const dawClient = DawClient.localDefault();
let measureGridConfig: MeasureGridConfig = { ...DEFAULT_MEASURE_GRID_CONFIG };

function appendLog(message: string): void {
  const timestamp = new Date().toISOString();
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function loadStoredTarget(
  key: string,
  fallback: number,
  element: HTMLInputElement
): void {
  try {
    const storedValue = localStorage.getItem(key);
    const parsed = storedValue === null ? fallback : parsePositiveInteger(storedValue);
    element.value = String(parsed ?? fallback);
  } catch {
    element.value = String(fallback);
  }
}

function saveTarget(key: string, element: HTMLInputElement): void {
  const parsed = parsePositiveInteger(element.value);
  if (parsed === null) {
    return;
  }

  try {
    localStorage.setItem(key, String(parsed));
  } catch {
    // Ignore storage errors and keep the UI usable.
  }
}

function getTargetValue(
  element: HTMLInputElement,
  name: string
): number | null {
  const parsed = parsePositiveInteger(element.value);
  if (parsed === null) {
    appendLog(`ERROR: ${name} には 1 以上の整数を指定してください`);
    return null;
  }
  return parsed;
}

function appendMeasureLog(
  isMultipleMeasures: boolean,
  index: number,
  totalMeasures: number,
  message: string
): void {
  if (isMultipleMeasures) {
    appendLog(`meas分割 ${index + 1}/${totalMeasures}: ${message}`);
    return;
  }

  appendLog(message);
}

function appendPostErrorLog(
  isMultipleMeasures: boolean,
  index: number,
  totalMeasures: number,
  role: "chord" | "bass",
  measure: number,
  errorMessage: string
): void {
  appendLog(
    formatPostErrorMessage(
      isMultipleMeasures,
      index,
      totalMeasures,
      role,
      measure,
      errorMessage
    )
  );
}

function formatQuarterNotes(durationInQuarterNotes: number): string {
  const rounded = Number(durationInQuarterNotes.toFixed(3));
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toString();
}

function getMeasureGridCellKey(track: number, measure: number): string {
  return `${track}:${measure}`;
}

function getVisibleTracks(config: MeasureGridConfig): number[] {
  return Array.from({ length: config.trackCount }, (_, index) => config.trackStart + index);
}

function getVisibleMeasures(config: MeasureGridConfig): number[] {
  return Array.from(
    { length: config.measureCount },
    (_, index) => config.measureStart + index
  );
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

function cancelMeasureGridSyncers(): void {
  for (const syncer of measureGridSyncers.values()) {
    syncer.cancel();
  }
  measureGridSyncers.clear();
}

function syncMeasureGridControls(config: MeasureGridConfig): void {
  gridTrackStartEl.value = String(config.trackStart);
  gridTrackCountEl.value = String(config.trackCount);
  gridMeasureStartEl.value = String(config.measureStart);
  gridMeasureCountEl.value = String(config.measureCount);
}

function readMeasureGridConfigFromControls(): MeasureGridConfig | null {
  const trackStart = parsePositiveInteger(gridTrackStartEl.value);
  if (trackStart === null) {
    appendLog("ERROR: grid track start には 1 以上の整数を指定してください");
    return null;
  }

  const trackCount = parsePositiveInteger(gridTrackCountEl.value);
  if (trackCount === null) {
    appendLog("ERROR: grid track count には 1 以上の整数を指定してください");
    return null;
  }

  const measureStart = parseNonNegativeInteger(gridMeasureStartEl.value);
  if (measureStart === null) {
    appendLog("ERROR: grid meas start には 0 以上の整数を指定してください");
    return null;
  }

  const measureCount = parsePositiveInteger(gridMeasureCountEl.value);
  if (measureCount === null) {
    appendLog("ERROR: grid meas count には 1 以上の整数を指定してください");
    return null;
  }

  return { trackStart, trackCount, measureStart, measureCount };
}

function renderMeasureGrid(): void {
  cancelMeasureGridSyncers();
  measureGridInputs.clear();
  measureGridHeadEl.textContent = "";
  measureGridBodyEl.textContent = "";

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

  measureGridHeadEl.append(headRow);

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
      const syncer = createDebouncedCallback(async () => {
        setMeasureGridCellStatus(
          input,
          "syncing",
          `POST ${track}:${measure} を cmrt と同期中`
        );

        const result = await dawClient.postMml(track, measure, input.value);
        if (result !== undefined) {
          const errorMessage = dawClientErrorMessage(result);
          setMeasureGridCellStatus(input, "error", errorMessage);
          appendLog(
            `ERROR: grid POST ${track}:${measure} に失敗しました: ${errorMessage}`
          );
          return;
        }

        measureGridValues.set(key, input.value);
        input.dataset.dirty = "false";
        setMeasureGridCellStatus(input, "idle", `POST ${track}:${measure} OK`);
        appendLog(`grid POST ${track}:${measure} OK: "${input.value}"`);
      }, AUTO_SEND_DELAY_MS);

      input.className = "measure-grid-cell";
      input.type = "text";
      input.value = measureGridValues.get(key) ?? "";
      input.dataset.dirty = "false";
      input.setAttribute("aria-label", `track ${track} measure ${measure}`);
      input.addEventListener("input", () => {
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

    measureGridBodyEl.append(row);
  }
}

function applyMeasureGridConfig(config: MeasureGridConfig): void {
  measureGridConfig = config;
  syncMeasureGridControls(config);
  renderMeasureGrid();
}

function ensureMeasureGridIncludes(track: number, measure: number): boolean {
  let nextConfig = measureGridConfig;

  if (track < nextConfig.trackStart) {
    const expandedTrackCount = nextConfig.trackCount + (nextConfig.trackStart - track);
    if (expandedTrackCount > MAX_AUTO_EXPANDED_TRACK_COUNT) {
      appendLog(
        `grid 自動拡張をスキップ: track ${track} を表示するには ${expandedTrackCount} tracks が必要です。grid track start/count を明示的に変更してください`
      );
      return false;
    }

    nextConfig = {
      ...nextConfig,
      trackCount: expandedTrackCount,
      trackStart: track,
    };
  } else if (track >= nextConfig.trackStart + nextConfig.trackCount) {
    const expandedTrackCount = track - nextConfig.trackStart + 1;
    if (expandedTrackCount > MAX_AUTO_EXPANDED_TRACK_COUNT) {
      appendLog(
        `grid 自動拡張をスキップ: track ${track} を表示するには ${expandedTrackCount} tracks が必要です。grid track start/count を明示的に変更してください`
      );
      return false;
    }

    nextConfig = {
      ...nextConfig,
      trackCount: expandedTrackCount,
    };
  }

  if (measure < nextConfig.measureStart) {
    const expandedMeasureCount =
      nextConfig.measureCount + (nextConfig.measureStart - measure);
    if (expandedMeasureCount > MAX_AUTO_EXPANDED_MEASURE_COUNT) {
      appendLog(
        `grid 自動拡張をスキップ: meas ${measure} を表示するには ${expandedMeasureCount} meas が必要です。grid meas start/count を明示的に変更してください`
      );
      return false;
    }

    nextConfig = {
      ...nextConfig,
      measureCount: expandedMeasureCount,
      measureStart: measure,
    };
  } else if (measure >= nextConfig.measureStart + nextConfig.measureCount) {
    const expandedMeasureCount = measure - nextConfig.measureStart + 1;
    if (expandedMeasureCount > MAX_AUTO_EXPANDED_MEASURE_COUNT) {
      appendLog(
        `grid 自動拡張をスキップ: meas ${measure} を表示するには ${expandedMeasureCount} meas が必要です。grid meas start/count を明示的に変更してください`
      );
      return false;
    }

    nextConfig = {
      ...nextConfig,
      measureCount: expandedMeasureCount,
    };
  }

  if (
    nextConfig.trackStart !== measureGridConfig.trackStart ||
    nextConfig.trackCount !== measureGridConfig.trackCount ||
    nextConfig.measureStart !== measureGridConfig.measureStart ||
    nextConfig.measureCount !== measureGridConfig.measureCount
  ) {
    applyMeasureGridConfig(nextConfig);
  }

  return true;
}

function reflectMeasureGridValue(track: number, measure: number, mml: string): void {
  const didIncludeTarget = ensureMeasureGridIncludes(track, measure);

  const key = getMeasureGridCellKey(track, measure);
  const input = measureGridInputs.get(key);
  if (input?.dataset.dirty === "true") {
    setMeasureGridCellStatus(
      input,
      "idle",
      `web側の結果 ${track}:${measure} は、未送信の編集があるため上書きをスキップ`
    );
    return;
  }

  measureGridValues.set(key, mml);

  if (!didIncludeTarget) {
    return;
  }

  if (input === undefined) {
    return;
  }

  input.value = mml;
  input.dataset.dirty = "false";
  setMeasureGridCellStatus(input, "idle", `web側の結果を ${track}:${measure} に反映済み`);
}

async function loadMeasureGridFromCmrt(): Promise<void> {
  const visibleTracks = getVisibleTracks(measureGridConfig);
  const visibleMeasures = getVisibleMeasures(measureGridConfig);
  const totalCells = visibleTracks.length * visibleMeasures.length;
  const lastTrack = visibleTracks[visibleTracks.length - 1];
  const lastMeasure = visibleMeasures[visibleMeasures.length - 1];

  appendLog(
    `grid GET開始: track ${visibleTracks[0]}-${lastTrack} / meas ${visibleMeasures[0]}-${lastMeasure}`
  );

  let okCount = 0;
  const cellTargets = visibleTracks.flatMap((track) =>
    visibleMeasures.map((measure) => ({ track, measure }))
  );

  for (let index = 0; index < cellTargets.length; index += GRID_GET_CONCURRENCY) {
    const chunk = cellTargets.slice(index, index + GRID_GET_CONCURRENCY);
    await Promise.all(
      chunk.map(async ({ track, measure }) => {
        const key = getMeasureGridCellKey(track, measure);
        const input = measureGridInputs.get(key);
        if (input === undefined) {
          return;
        }

        setMeasureGridCellStatus(input, "loading", `GET ${track}:${measure} を読み込み中`);
        const result = await dawClient.getMml(track, measure);
        if (measureGridInputs.get(key) !== input) {
          return;
        }

        if (typeof result !== "string") {
          setMeasureGridCellStatus(input, "error", dawClientErrorMessage(result));
          return;
        }

        measureGridValues.set(key, result);
        if (input.dataset.dirty !== "true") {
          input.value = result;
        }
        setMeasureGridCellStatus(input, "idle", `GET ${track}:${measure} OK`);
        okCount += 1;
      })
    );
  }

  appendLog(`grid GET完了: ${okCount}/${totalCells} セル同期`);
}

async function sendMml(): Promise<void> {
  const input = inputEl.value.trim();
  if (!input) {
    appendLog("ERROR: 入力が空です");
    return;
  }

  const client = dawClient;
  const chordTrack = getTargetValue(trackEl, "chord track");
  const chordMeasure = getTargetValue(measureEl, "chord meas");
  if (chordTrack === null || chordMeasure === null) {
    return;
  }
  const bassTargets = resolveBassTargets(bassTrackEl.value, bassMeasureEl.value, {
    track: chordTrack,
    measure: chordMeasure,
  });

  const mml = chordToMml(input);
  if (mml === null) {
    appendLog(`ERROR: コードを認識できませんでした: "${input}"`);
    return;
  }

  appendLog(`コード進行 → MML: ${mml}`);

  const { mml: sanitizedMml, removedTokens } = sanitizeMmlForPost(mml);
  if (removedTokens.length > 0) {
    appendLog(`POST前にMMLから削除: ${removedTokens.join(", ")} → ${sanitizedMml}`);
  }
  appendLog(`meas分割対象MML: ${sanitizedMml}`);

  const chordSegments = splitSanitizedMmlIntoChordSegments(sanitizedMml);
  if (sanitizedMml !== "" && chordSegments.length === 0) {
    appendLog(
      `ERROR: meas分割対象のMMLを chord配列 に分解できませんでした: ${sanitizedMml}`
    );
    return;
  }

  appendLog(`meas分割開始: chord配列 ${chordSegments.length} 要素を解析します`);
  for (const [index, chordSegment] of chordSegments.entries()) {
    appendLog(`chord配列 ${index + 1}/${chordSegments.length}: ${chordSegment}`);
  }

  const parsedChordSegments = parseChordSegments(chordSegments);
  if (parsedChordSegments === null) {
    appendLog("ERROR: chord配列の音長を解析できませんでした");
    return;
  }

  for (const [index, chordSegment] of parsedChordSegments.entries()) {
    appendLog(
      `chord配列 ${index + 1}/${parsedChordSegments.length}: ${chordSegment.mml} の音長は四分音符換算で ${formatQuarterNotes(chordSegment.durationInQuarterNotes)} 拍`
    );
  }

  const measureChunks = splitChordSegmentsByMeasure(parsedChordSegments);
  if (measureChunks === null) {
    appendLog("ERROR: chord配列を 1meas ごとに分割できませんでした");
    return;
  }

  const preparedMeasures: PreparedMeasureInput[] = assignMeasuresToChunks(
    measureChunks,
    chordMeasure
  );
  const isMultipleMeasures = preparedMeasures.length > 1;

  for (const [index, preparedMeasure] of preparedMeasures.entries()) {
    const splitMml = splitBassRootMmlByTrack(preparedMeasure.mml);

    appendMeasureLog(
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `${splitMml.chordMml} (合計 四分音符換算で ${formatQuarterNotes(preparedMeasure.durationInQuarterNotes)} 拍) を chord meas ${preparedMeasure.measure} に割り当て`
    );
    appendMeasureLog(
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `POST ${client.getBaseUrl()}/mml  { track: ${chordTrack}, measure: ${preparedMeasure.measure}, mml: "${splitMml.chordMml}" }`
    );

    const chordResult = await client.postMml(
      chordTrack,
      preparedMeasure.measure,
      splitMml.chordMml
    );
    if (chordResult !== undefined) {
      appendPostErrorLog(
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        "chord",
        preparedMeasure.measure,
        dawClientErrorMessage(chordResult)
      );
      return;
    }

    reflectMeasureGridValue(chordTrack, preparedMeasure.measure, splitMml.chordMml);

    if (splitMml.bassMml !== "") {
      // 複数小節分割時は、chord meas と bass meas を同じ index だけ進めて同期させる。
      const targetBassMeasure = bassTargets.measure + index;

      appendMeasureLog(
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        `${splitMml.bassMml} を bass meas ${targetBassMeasure} に割り当て`
      );
      appendMeasureLog(
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        `POST ${client.getBaseUrl()}/mml  { track: ${bassTargets.track}, measure: ${targetBassMeasure}, mml: "${splitMml.bassMml}" }`
      );

      const bassResult = await client.postMml(
        bassTargets.track,
        targetBassMeasure,
        splitMml.bassMml
      );
      if (bassResult !== undefined) {
        appendPostErrorLog(
          isMultipleMeasures,
          index,
          preparedMeasures.length,
          "bass",
          targetBassMeasure,
          dawClientErrorMessage(bassResult)
        );
        return;
      }

      reflectMeasureGridValue(bassTargets.track, targetBassMeasure, splitMml.bassMml);
    }

    appendMeasureLog(
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      isMultipleMeasures ? "OK" : "OK: POSTリクエスト成功"
    );
  }

  if (isMultipleMeasures) {
    appendLog(`meas分割完了: ${preparedMeasures.length} meas の送信に成功しました`);
  }
}

const debouncedSendMml = createDebouncedCallback(() => {
  if (!inputEl.value.trim()) {
    return;
  }

  return sendMml();
}, AUTO_SEND_DELAY_MS);

loadStoredTarget(TRACK_STORAGE_KEY, DEFAULT_TRACK, trackEl);
loadStoredTarget(MEASURE_STORAGE_KEY, DEFAULT_MEASURE, measureEl);
loadStoredTarget(BASS_TRACK_STORAGE_KEY, DEFAULT_TRACK, bassTrackEl);
loadStoredTarget(BASS_MEASURE_STORAGE_KEY, DEFAULT_MEASURE, bassMeasureEl);
syncMeasureGridControls(measureGridConfig);
renderMeasureGrid();

void loadMeasureGridFromCmrt();

trackEl.addEventListener("input", () => saveTarget(TRACK_STORAGE_KEY, trackEl));
measureEl.addEventListener("input", () =>
  saveTarget(MEASURE_STORAGE_KEY, measureEl)
);
bassTrackEl.addEventListener("input", () =>
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl)
);
bassMeasureEl.addEventListener("input", () =>
  saveTarget(BASS_MEASURE_STORAGE_KEY, bassMeasureEl)
);
inputEl.addEventListener("input", () => {
  if (!inputEl.value.trim()) {
    debouncedSendMml.cancel();
    return;
  }

  debouncedSendMml.schedule();
});
sendBtn.addEventListener("click", () => {
  debouncedSendMml.cancel();
  void sendMml();
});
gridReloadBtn.addEventListener("click", () => {
  const nextConfig = readMeasureGridConfigFromControls();
  if (nextConfig === null) {
    return;
  }

  applyMeasureGridConfig(nextConfig);
  void loadMeasureGridFromCmrt();
});

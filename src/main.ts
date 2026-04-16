import "./style.css";
import {
  selectAutoTargetTracks,
  type AutoTargetCandidate,
} from "./auto-targets.ts";
import { splitBassRootMmlByTrack } from "./bass-root-mml.ts";
import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import { chordToMml } from "./chord-to-mml.ts";
import {
  createMeasureGridController,
  type MeasureGridConfig,
} from "./measure-grid.ts";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  formatPostErrorMessage,
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
const INIT_MEASURE = 0;
const AUTO_TARGET_TRACK_SCAN_START = 1;
const AUTO_TARGET_TRACK_SCAN_END = 16;
const GRID_GET_CONCURRENCY = 8;
const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;

const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 1,
  trackCount: 4,
  measureStart: 0,
  measureCount: 8,
};
const dawClient = DawClient.localDefault();

function appendLog(message: string): void {
  const timestamp = new Date().toISOString();
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function loadStoredTarget(
  key: string,
  fallback: number,
  element: HTMLInputElement
): boolean {
  try {
    const storedValue = localStorage.getItem(key);
    const parsed = storedValue === null ? null : parsePositiveInteger(storedValue);
    element.value = String(parsed ?? fallback);
    return parsed !== null;
  } catch {
    element.value = String(fallback);
    return false;
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

const measureGridController = createMeasureGridController({
  elements: {
    trackStartEl: gridTrackStartEl,
    trackCountEl: gridTrackCountEl,
    measureStartEl: gridMeasureStartEl,
    measureCountEl: gridMeasureCountEl,
    headEl: measureGridHeadEl,
    bodyEl: measureGridBodyEl,
  },
  dawClient,
  appendLog,
  autoSendDelayMs: AUTO_SEND_DELAY_MS,
  gridGetConcurrency: GRID_GET_CONCURRENCY,
  maxAutoExpandedTrackCount: MAX_AUTO_EXPANDED_TRACK_COUNT,
  maxAutoExpandedMeasureCount: MAX_AUTO_EXPANDED_MEASURE_COUNT,
  initialConfig: DEFAULT_MEASURE_GRID_CONFIG,
});

function syncMeasureGridHighlightTargets(): void {
  const chordTrack = parsePositiveInteger(trackEl.value);
  const chordMeasure = parsePositiveInteger(measureEl.value);
  const bassTrack = parsePositiveInteger(bassTrackEl.value);
  const bassMeasure = parsePositiveInteger(bassMeasureEl.value);

  measureGridController.setHighlightTargets({
    chordTarget:
      chordTrack === null || chordMeasure === null
        ? null
        : { track: chordTrack, measure: chordMeasure },
    bassTarget:
      bassTrack === null || bassMeasure === null
        ? null
        : { track: bassTrack, measure: bassMeasure },
  });
}

async function autoSelectTracksFromCmrt(options: {
  shouldSelectChordTrack: boolean;
  shouldSelectBassTrack: boolean;
}): Promise<void> {
  if (!options.shouldSelectChordTrack && !options.shouldSelectBassTrack) {
    return;
  }

  const candidates: AutoTargetCandidate[] = [];
  for (
    let track = AUTO_TARGET_TRACK_SCAN_START;
    track <= AUTO_TARGET_TRACK_SCAN_END;
    track += 1
  ) {
    const result = await dawClient.getMeasureInfo(track, INIT_MEASURE);
    if (typeof result === "object" && "kind" in result) {
      break;
    }

    candidates.push({ track, filterName: result.filterName });
  }
  const selection = selectAutoTargetTracks(candidates);

  if (options.shouldSelectChordTrack && selection.chordTrack !== null) {
    trackEl.value = String(selection.chordTrack);
    saveTarget(TRACK_STORAGE_KEY, trackEl);
  }

  if (options.shouldSelectBassTrack && selection.bassTrack !== null) {
    bassTrackEl.value = String(selection.bassTrack);
    saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  }

  if (
    (options.shouldSelectChordTrack && selection.chordTrack !== null) ||
    (options.shouldSelectBassTrack && selection.bassTrack !== null)
  ) {
    const selectedTargets: string[] = [];
    if (options.shouldSelectChordTrack && selection.chordTrack !== null) {
      selectedTargets.push(`chord track=${selection.chordTrack}`);
    }
    if (options.shouldSelectBassTrack && selection.bassTrack !== null) {
      selectedTargets.push(`bass track=${selection.bassTrack}`);
    }
    appendLog(
      `起動時に track を自動選択: ${selectedTargets.join(", ")}`
    );
    syncMeasureGridHighlightTargets();
  }
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

    measureGridController.reflectValue(
      chordTrack,
      preparedMeasure.measure,
      splitMml.chordMml
    );

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

      measureGridController.reflectValue(
        bassTargets.track,
        targetBassMeasure,
        splitMml.bassMml
      );
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

const hasStoredChordTrack = loadStoredTarget(TRACK_STORAGE_KEY, DEFAULT_TRACK, trackEl);
loadStoredTarget(MEASURE_STORAGE_KEY, DEFAULT_MEASURE, measureEl);
const hasStoredBassTrack = loadStoredTarget(
  BASS_TRACK_STORAGE_KEY,
  DEFAULT_TRACK,
  bassTrackEl
);
loadStoredTarget(BASS_MEASURE_STORAGE_KEY, DEFAULT_MEASURE, bassMeasureEl);
measureGridController.syncControls();
measureGridController.render();
syncMeasureGridHighlightTargets();

void autoSelectTracksFromCmrt({
  shouldSelectChordTrack: !hasStoredChordTrack,
  shouldSelectBassTrack: !hasStoredBassTrack,
});
void measureGridController.loadFromCmrt();

trackEl.addEventListener("input", () => {
  saveTarget(TRACK_STORAGE_KEY, trackEl);
  syncMeasureGridHighlightTargets();
});
measureEl.addEventListener("input", () => {
  saveTarget(MEASURE_STORAGE_KEY, measureEl);
  syncMeasureGridHighlightTargets();
});
bassTrackEl.addEventListener("input", () => {
  saveTarget(BASS_TRACK_STORAGE_KEY, bassTrackEl);
  syncMeasureGridHighlightTargets();
});
bassMeasureEl.addEventListener("input", () => {
  saveTarget(BASS_MEASURE_STORAGE_KEY, bassMeasureEl);
  syncMeasureGridHighlightTargets();
});
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
  const nextConfig = measureGridController.readConfigFromControls();
  if (nextConfig === null) {
    return;
  }

  measureGridController.applyConfig(nextConfig);
  void measureGridController.loadFromCmrt();
});

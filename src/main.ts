import "./style.css";
import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import { chordToMml } from "./chord-to-mml.ts";
import {
  DEFAULT_MEASURE,
  DEFAULT_TRACK,
  parsePositiveInteger,
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
const sendBtn = document.getElementById("send") as HTMLButtonElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const TRACK_STORAGE_KEY = "cmrt-client-playground.track";
const MEASURE_STORAGE_KEY = "cmrt-client-playground.measure";
const AUTO_SEND_DELAY_MS = 1000;

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

function formatQuarterNotes(durationInQuarterNotes: number): string {
  const rounded = Number(durationInQuarterNotes.toFixed(3));
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toString();
}

async function sendMml(): Promise<void> {
  const input = inputEl.value.trim();
  if (!input) {
    appendLog("ERROR: 入力が空です");
    return;
  }

  const client = DawClient.localDefault();
  const track = getTargetValue(trackEl, "track");
  const measure = getTargetValue(measureEl, "meas");
  if (track === null || measure === null) {
    return;
  }

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
  appendLog(`meas分割入力MML: ${sanitizedMml}`);

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
    appendLog("ERROR: chord配列 の音長を解析できませんでした");
    return;
  }

  for (const [index, chordSegment] of parsedChordSegments.entries()) {
    appendLog(
      `chord配列 ${index + 1}/${parsedChordSegments.length}: ${chordSegment.mml} の音長は四分音符 ${formatQuarterNotes(chordSegment.durationInQuarterNotes)} つ分`
    );
  }

  const measureChunks = splitChordSegmentsByMeasure(parsedChordSegments);
  if (measureChunks === null) {
    appendLog("ERROR: chord配列 を 1meas ごとに分割できませんでした");
    return;
  }

  const preparedMeasures: PreparedMeasureInput[] = assignMeasuresToChunks(
    measureChunks,
    measure
  );
  const isMultipleMeasures = preparedMeasures.length > 1;

  for (const [index, preparedMeasure] of preparedMeasures.entries()) {
    appendMeasureLog(
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `${preparedMeasure.mml} (合計 四分音符 ${formatQuarterNotes(preparedMeasure.durationInQuarterNotes)} つ分) を meas ${preparedMeasure.measure} に割り当て`
    );
  }

  for (const [index, preparedMeasure] of preparedMeasures.entries()) {
    appendMeasureLog(
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `POST ${client.getBaseUrl()}/mml  { track: ${track}, measure: ${preparedMeasure.measure}, mml: "${preparedMeasure.mml}" }`
    );

    const result = await client.postMml(
      track,
      preparedMeasure.measure,
      preparedMeasure.mml
    );
    if (result === undefined) {
      appendMeasureLog(
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        isMultipleMeasures ? "OK" : "OK: POSTリクエスト成功"
      );
    } else {
      appendLog(
        isMultipleMeasures
          ? `ERROR: meas分割 ${index + 1}/${preparedMeasures.length} (measure ${preparedMeasure.measure}): ${dawClientErrorMessage(result)}`
          : `ERROR: ${dawClientErrorMessage(result)}`
      );
      return;
    }
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
trackEl.addEventListener("input", () => saveTarget(TRACK_STORAGE_KEY, trackEl));
measureEl.addEventListener("input", () =>
  saveTarget(MEASURE_STORAGE_KEY, measureEl)
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

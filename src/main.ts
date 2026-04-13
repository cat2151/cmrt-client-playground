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
  planMeasureInputs,
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

  const measureInputs = planMeasureInputs(input, measure);
  const isMultipleMeasures = measureInputs.length > 1;
  if (isMultipleMeasures) {
    appendLog(`meas分割開始: ${measureInputs.length} meas を順次送信します`);
  }

  const preparedMeasures: PreparedMeasureInput[] = [];
  for (const [index, measureInput] of measureInputs.entries()) {
    appendMeasureLog(
      isMultipleMeasures,
      index,
      measureInputs.length,
      `"${measureInput.chord}" を meas ${measureInput.measure} に割り当て`
    );

    const mml = chordToMml(measureInput.chord);
    if (mml === null) {
      appendMeasureLog(
        isMultipleMeasures,
        index,
        measureInputs.length,
        `ERROR: meas ${measureInput.measure} のコードを認識できませんでした: "${measureInput.chord}"`
      );
      return;
    }

    appendMeasureLog(
      isMultipleMeasures,
      index,
      measureInputs.length,
      `コード "${measureInput.chord}" → MML: ${mml}`
    );

    const { mml: sanitizedMml, removedTokens } = sanitizeMmlForPost(mml);
    if (removedTokens.length > 0) {
      appendMeasureLog(
        isMultipleMeasures,
        index,
        measureInputs.length,
        `POST前にMMLから削除: ${removedTokens.join(", ")} → ${sanitizedMml}`
      );
    }

    preparedMeasures.push({
      ...measureInput,
      sanitizedMml,
    });
  }

  for (const [index, preparedMeasure] of preparedMeasures.entries()) {
    appendMeasureLog(
      isMultipleMeasures,
      index,
      measureInputs.length,
      `POST ${client.getBaseUrl()}/mml  { track: ${track}, measure: ${preparedMeasure.measure}, mml: "${preparedMeasure.sanitizedMml}" }`
    );

    const result = await client.postMml(
      track,
      preparedMeasure.measure,
      preparedMeasure.sanitizedMml
    );
    if (result === undefined) {
      appendMeasureLog(
        isMultipleMeasures,
        index,
        measureInputs.length,
        isMultipleMeasures ? "OK" : "OK: POSTリクエスト成功"
      );
    } else {
      appendLog(
        isMultipleMeasures
          ? `ERROR: meas分割 ${index + 1}/${measureInputs.length} (measure ${preparedMeasure.measure}): ${dawClientErrorMessage(result)}`
          : `ERROR: ${dawClientErrorMessage(result)}`
      );
      return;
    }
  }

  if (isMultipleMeasures) {
    appendLog(`meas分割完了: ${measureInputs.length} meas の送信に成功しました`);
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

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

async function sendMml(): Promise<void> {
  const chord = inputEl.value.trim();
  if (!chord) {
    appendLog("ERROR: 入力が空です");
    return;
  }

  const mml = chordToMml(chord);
  if (mml === null) {
    appendLog(`ERROR: コードを認識できませんでした: "${chord}"`);
    return;
  }

  appendLog(`コード "${chord}" → MML: ${mml}`);
  const { mml: sanitizedMml, removedTokens } = sanitizeMmlForPost(mml);
  if (removedTokens.length > 0) {
    appendLog(
      `POST前にMMLから削除: ${removedTokens.join(", ")} → ${sanitizedMml}`
    );
  }

  const client = DawClient.localDefault();
  const track = getTargetValue(trackEl, "track");
  const measure = getTargetValue(measureEl, "meas");
  if (track === null || measure === null) {
    return;
  }

  appendLog(
    `POST ${client.getBaseUrl()}/mml  { track: ${track}, measure: ${measure}, mml: "${sanitizedMml}" }`
  );

  const result = await client.postMml(track, measure, sanitizedMml);
  if (result === undefined) {
    appendLog("OK: POSTリクエスト成功");
  } else {
    appendLog(`ERROR: ${dawClientErrorMessage(result)}`);
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

import { DawClient, dawClientErrorMessage } from "./daw-client.ts";
import { chordToMml } from "./chord-to-mml.ts";

const inputEl = document.getElementById("input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send") as HTMLButtonElement;
const logEl = document.getElementById("log") as HTMLDivElement;

function appendLog(message: string): void {
  const timestamp = new Date().toISOString();
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
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

  const client = DawClient.localDefault();
  const track = 1;
  const measure = 1;

  appendLog(
    `POST ${client.getBaseUrl()}/mml  { track: ${track}, measure: ${measure}, mml: "${mml}" }`
  );

  const result = await client.postMml(track, measure, mml);
  if (result === undefined) {
    appendLog("OK: POSTリクエスト成功");
  } else {
    appendLog(`ERROR: ${dawClientErrorMessage(result)}`);
  }
}

sendBtn.addEventListener("click", sendMml);

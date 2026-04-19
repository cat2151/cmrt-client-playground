import { buildChordPlaybackSource } from "../chords/chord-playback-source.ts";
import { playToneChordMml } from "../tone/tone-chord-playback.ts";
import { buildTonePlaybackMml } from "../tone/tone-playback-mml.ts";

export async function playCurrentToneChord(options: {
  getInput: () => string;
  getInstrumentMml: () => string;
  cancelTonePreview: () => void;
  clearTonePlaybackReset: () => void;
  scheduleTonePlaybackReset: (durationSeconds: number) => void;
  setPlaybackBackend: (backend: "tone") => void;
  appendLog: (message: string) => void;
  showChordAnalysisErrorBalloon: (message: string) => void;
}): Promise<boolean> {
  options.cancelTonePreview();
  options.clearTonePlaybackReset();

  const effectiveInput = options.getInput();
  const source = buildChordPlaybackSource(effectiveInput);
  if (!source.ok) {
    if (source.reason === "empty-input") {
      options.appendLog("ERROR: コード入力が空のため Tone.js chord play を開始できません");
    }
    if (source.reason === "unrecognized-chord") {
      const message = `コードを認識できませんでした: "${effectiveInput.trim()}"`;
      options.appendLog(`ERROR: ${message}`);
      options.showChordAnalysisErrorBalloon(message);
    }
    return false;
  }

  try {
    const durationSeconds = await playToneChordMml({
      mml: buildTonePlaybackMml(source, options.getInstrumentMml()),
    });
    options.appendLog("Tone.js chord play を開始しました");
    options.setPlaybackBackend("tone");
    options.scheduleTonePlaybackReset(durationSeconds);
    return true;
  } catch (error: unknown) {
    options.appendLog(`ERROR: Tone.js chord play の開始に失敗しました: ${String(error)}`);
    return false;
  }
}

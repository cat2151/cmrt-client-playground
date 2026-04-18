import { splitBassRootMmlByTrack } from "./bass-root-mml.ts";
import { dawClientErrorMessage, type DawClientError } from "./daw-client.ts";
import { chordToMml } from "./chord-to-mml.ts";
import {
  assignMeasuresToChunks,
  parseChordSegments,
  splitChordSegmentsByMeasure,
  splitSanitizedMmlIntoChordSegments,
} from "./measure-input.ts";
import {
  formatPostErrorMessage,
  resolveBassTargets,
  sanitizeMmlForPost,
} from "./post-config.ts";

export interface SendMmlClient {
  getBaseUrl(): string;
  postMml(track: number, measure: number, mml: string): Promise<void | DawClientError>;
}

export interface SendMmlOptions {
  input: string;
  chordTrack: number;
  chordMeasure: number;
  bassTrackValue: string;
  client: SendMmlClient;
  appendLog(message: string): void;
  reflectValue(track: number, measure: number, mml: string): void;
}

function appendMeasureLog(
  appendLog: (message: string) => void,
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
  appendLog: (message: string) => void,
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

export async function sendMml(options: SendMmlOptions): Promise<void> {
  const input = options.input.trim();
  if (!input) {
    options.appendLog("ERROR: 入力が空です");
    return;
  }

  const bassTargets = resolveBassTargets(
    options.bassTrackValue,
    {
      track: options.chordTrack,
      measure: options.chordMeasure,
    }
  );

  const mml = chordToMml(input);
  if (mml === null) {
    options.appendLog(`ERROR: コードを認識できませんでした: "${input}"`);
    return;
  }

  options.appendLog(`コード進行 → MML: ${mml}`);

  const { mml: sanitizedMml, removedTokens } = sanitizeMmlForPost(mml);
  if (removedTokens.length > 0) {
    options.appendLog(`POST前にMMLから削除: ${removedTokens.join(", ")} → ${sanitizedMml}`);
  }
  options.appendLog(`meas分割対象MML: ${sanitizedMml}`);

  const chordSegments = splitSanitizedMmlIntoChordSegments(sanitizedMml);
  if (sanitizedMml !== "" && chordSegments.length === 0) {
    options.appendLog(
      `ERROR: meas分割対象のMMLを chord配列 に分解できませんでした: ${sanitizedMml}`
    );
    return;
  }

  options.appendLog(`meas分割開始: chord配列 ${chordSegments.length} 要素を解析します`);
  for (const [index, chordSegment] of chordSegments.entries()) {
    options.appendLog(`chord配列 ${index + 1}/${chordSegments.length}: ${chordSegment}`);
  }

  const parsedChordSegments = parseChordSegments(chordSegments);
  if (parsedChordSegments === null) {
    options.appendLog("ERROR: chord配列の音長を解析できませんでした");
    return;
  }

  for (const [index, chordSegment] of parsedChordSegments.entries()) {
    options.appendLog(
      `chord配列 ${index + 1}/${parsedChordSegments.length}: ${chordSegment.mml} の音長は四分音符換算で ${formatQuarterNotes(chordSegment.durationInQuarterNotes)} 拍`
    );
  }

  const measureChunks = splitChordSegmentsByMeasure(parsedChordSegments);
  if (measureChunks === null) {
    options.appendLog("ERROR: chord配列を 1meas ごとに分割できませんでした");
    return;
  }

  const preparedMeasures = assignMeasuresToChunks(measureChunks, options.chordMeasure);
  const isMultipleMeasures = preparedMeasures.length > 1;

  for (const [index, preparedMeasure] of preparedMeasures.entries()) {
    const splitMml = splitBassRootMmlByTrack(preparedMeasure.mml);

    appendMeasureLog(
      options.appendLog,
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `${splitMml.chordMml} (合計 四分音符換算で ${formatQuarterNotes(preparedMeasure.durationInQuarterNotes)} 拍) を chord meas ${preparedMeasure.measure} に割り当て`
    );
    appendMeasureLog(
      options.appendLog,
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      `POST ${options.client.getBaseUrl()}/mml  { track: ${options.chordTrack}, measure: ${preparedMeasure.measure}, mml: "${splitMml.chordMml}" }`
    );

    const chordResult = await options.client.postMml(
      options.chordTrack,
      preparedMeasure.measure,
      splitMml.chordMml
    );
    if (chordResult !== undefined) {
      appendPostErrorLog(
        options.appendLog,
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        "chord",
        preparedMeasure.measure,
        dawClientErrorMessage(chordResult)
      );
      return;
    }

    options.reflectValue(options.chordTrack, preparedMeasure.measure, splitMml.chordMml);

    if (splitMml.bassMml !== "") {
      const targetBassMeasure = preparedMeasure.measure;

      appendMeasureLog(
        options.appendLog,
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        `${splitMml.bassMml} を bass track の measure ${targetBassMeasure} に割り当て`
      );
      appendMeasureLog(
        options.appendLog,
        isMultipleMeasures,
        index,
        preparedMeasures.length,
        `POST ${options.client.getBaseUrl()}/mml  { track: ${bassTargets.track}, measure: ${targetBassMeasure}, mml: "${splitMml.bassMml}" }`
      );

      const bassResult = await options.client.postMml(
        bassTargets.track,
        targetBassMeasure,
        splitMml.bassMml
      );
      if (bassResult !== undefined) {
        appendPostErrorLog(
          options.appendLog,
          isMultipleMeasures,
          index,
          preparedMeasures.length,
          "bass",
          targetBassMeasure,
          dawClientErrorMessage(bassResult)
        );
        return;
      }

      options.reflectValue(bassTargets.track, targetBassMeasure, splitMml.bassMml);
    }

    appendMeasureLog(
      options.appendLog,
      isMultipleMeasures,
      index,
      preparedMeasures.length,
      isMultipleMeasures ? "OK" : "OK: POSTリクエスト成功"
    );
  }

  if (isMultipleMeasures) {
    options.appendLog(`meas分割完了: ${preparedMeasures.length} meas の送信に成功しました`);
  }
}

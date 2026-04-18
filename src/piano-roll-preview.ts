import { splitBassRootMmlByTrack } from "./bass-root-mml.ts";
import {
  buildChordPlaybackSource,
  type ChordPlaybackSource,
} from "./chord-playback-source.ts";
import {
  assignMeasuresToChunks,
  parseChordSegments,
  splitChordSegmentsByMeasure,
  splitSanitizedMmlIntoChordSegments,
} from "./measure-input.ts";
import { type SmfConverter } from "./smf-export.ts";
import {
  buildPianoRollDisplayData,
  formatPianoRollDebugSummary,
  parseSmfToPianoRollData,
  type PianoRollData,
  type PianoRollDisplayData,
} from "./smf-piano-roll.ts";

export type PianoRollPreviewResult =
  | {
      ok: true;
      mml: string;
      data: PianoRollDisplayData;
      summary: string;
    }
  | {
      ok: false;
      reason: "empty-input" | "unrecognized-chord";
    };

export interface PianoRollPreviewMeasureTrack {
  measure: number;
  mml: string;
  chordMml: string;
  bassMml: string;
  tickOffsetInQuarterNotes: number;
}

export function planPianoRollPreviewMeasureTracks(
  mml: string,
  startMeasure = 0
): PianoRollPreviewMeasureTrack[] | null {
  const chordSegments = splitSanitizedMmlIntoChordSegments(mml);
  if (mml.trim() !== "" && chordSegments.length === 0) {
    return null;
  }

  const parsedChordSegments = parseChordSegments(chordSegments);
  if (parsedChordSegments === null) {
    return null;
  }

  const measureChunks = splitChordSegmentsByMeasure(parsedChordSegments);
  if (measureChunks === null) {
    return null;
  }

  let tickOffsetInQuarterNotes = 0;
  return assignMeasuresToChunks(measureChunks, startMeasure).map((preparedMeasure) => {
    const splitMml = splitBassRootMmlByTrack(preparedMeasure.mml);
    const plannedMeasure = {
      measure: preparedMeasure.measure,
      mml: preparedMeasure.mml,
      chordMml: splitMml.chordMml,
      bassMml: splitMml.bassMml,
      tickOffsetInQuarterNotes,
    };
    tickOffsetInQuarterNotes += preparedMeasure.durationInQuarterNotes;
    return plannedMeasure;
  });
}

function offsetPianoRollData(data: PianoRollData, tickOffset: number): PianoRollData {
  return {
    ...data,
    totalTicks: data.totalTicks + tickOffset,
    notes: data.notes.map((note) => ({
      ...note,
      startTick: note.startTick + tickOffset,
      endTick: note.endTick + tickOffset,
    })),
  };
}

function mergePianoRollData(parts: readonly PianoRollData[]): PianoRollData | null {
  if (parts.length === 0) {
    return null;
  }

  const division = parts[0].division;
  for (const part of parts) {
    if (part.division !== division) {
      throw new Error("SMF division が一致しません");
    }
  }

  const notes = parts
    .flatMap((part) => part.notes)
    .sort(
      (left, right) =>
        left.startTick - right.startTick ||
        left.pitch - right.pitch ||
        left.endTick - right.endTick ||
        left.track - right.track
    );
  if (notes.length === 0) {
    return null;
  }

  const pitches = notes.map((note) => note.pitch);
  return {
    division,
    totalTicks: Math.max(...notes.map((note) => note.endTick)),
    minPitch: Math.min(...pitches),
    maxPitch: Math.max(...pitches),
    notes,
  };
}

export async function buildPianoRollPreview(
  input: string,
  converter: SmfConverter
): Promise<PianoRollPreviewResult> {
  const source = buildChordPlaybackSource(input);
  return buildPianoRollPreviewFromSource(source, converter);
}

export async function buildPianoRollPreviewFromSource(
  source: ChordPlaybackSource,
  converter: SmfConverter
): Promise<PianoRollPreviewResult> {
  if (!source.ok) {
    return source;
  }

  const plannedMeasures = planPianoRollPreviewMeasureTracks(source.sanitizedMml);
  if (plannedMeasures === null) {
    throw new Error("preview 用の MML を measure ごとに分割できませんでした");
  }

  const measureResults = await Promise.all(
    plannedMeasures.map(async (plannedMeasure) => {
      const [chordSmfData, bassSmfData] = await Promise.all([
        converter.convertMmlToSmf(plannedMeasure.chordMml),
        plannedMeasure.bassMml === ""
          ? Promise.resolve(null)
          : converter.convertMmlToSmf(plannedMeasure.bassMml),
      ]);
      const chordData = parseSmfToPianoRollData(chordSmfData);
      const tickOffset = plannedMeasure.tickOffsetInQuarterNotes * chordData.division;

      return {
        chordData: offsetPianoRollData(chordData, tickOffset),
        bassData:
          bassSmfData === null
            ? null
            : offsetPianoRollData(parseSmfToPianoRollData(bassSmfData), tickOffset),
      };
    })
  );

  const chordData = mergePianoRollData(measureResults.map((result) => result.chordData));
  const bassData = mergePianoRollData(
    measureResults
      .map((result) => result.bassData)
      .filter((data): data is PianoRollData => data !== null)
  );
  if (chordData === null && bassData === null) {
    throw new Error("ピアノロール表示対象のノートがありません");
  }

  const data = buildPianoRollDisplayData({
    chordData,
    bassData,
  });

  return {
    ok: true,
    mml: source.sanitizedMml,
    data,
    summary: formatPianoRollDebugSummary({ mml: source.sanitizedMml, data }),
  };
}

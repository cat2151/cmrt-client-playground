export const QUARTER_NOTES_PER_MEASURE = 4;

const DURATION_EPSILON = 1e-9;

export interface ChordSegment {
  mml: string;
  durationInQuarterNotes: number;
}

export interface MeasureChunk {
  chordSegments: ChordSegment[];
  durationInQuarterNotes: number;
  mml: string;
}

export interface PreparedMeasureInput extends MeasureChunk {
  measure: number;
}

function stripChordQuotes(chordSegment: string): string | null {
  if (!/^'[^']*'$/.test(chordSegment)) {
    return null;
  }

  return chordSegment.slice(1, -1);
}

function getDotMultiplier(dotCount: number): number {
  let multiplier = 1;
  let addition = 0.5;

  for (let i = 0; i < dotCount; i++) {
    multiplier += addition;
    addition /= 2;
  }

  return multiplier;
}

function isMeasureComplete(durationInQuarterNotes: number): boolean {
  return (
    Math.abs(durationInQuarterNotes - QUARTER_NOTES_PER_MEASURE) <
    DURATION_EPSILON
  );
}

function exceedsMeasure(durationInQuarterNotes: number): boolean {
  return (
    durationInQuarterNotes - QUARTER_NOTES_PER_MEASURE > DURATION_EPSILON
  );
}

function createMeasureChunk(chordSegments: ChordSegment[]): MeasureChunk {
  const durationInQuarterNotes = chordSegments.reduce(
    (total, chordSegment) => total + chordSegment.durationInQuarterNotes,
    0
  );

  return {
    chordSegments,
    durationInQuarterNotes,
    mml: chordSegments.map((chordSegment) => chordSegment.mml).join(""),
  };
}

export function splitSanitizedMmlIntoChordSegments(mml: string): string[] {
  const trimmed = mml.trim();
  if (trimmed === "") {
    return [];
  }

  const chordSegments = trimmed.match(/'[^']*'/g) ?? [];
  const leftover = trimmed.replace(/'[^']*'/g, "").trim();
  if (chordSegments.length === 0 || leftover !== "") {
    return [];
  }

  return chordSegments;
}

export function getChordSegmentDurationInQuarterNotes(
  chordSegment: string
): number | null {
  const body = stripChordQuotes(chordSegment);
  if (body === null || body === "") {
    return null;
  }

  const match = body.match(/^[<>]*[a-gr][+#-]?(\d+)?(\.*)/i);
  if (match === null) {
    return null;
  }

  const lengthText = match[1];
  const dotText = match[2] ?? "";
  const length = lengthText === undefined ? 1 : Number.parseInt(lengthText, 10);
  if (!Number.isSafeInteger(length) || length <= 0) {
    return null;
  }

  return (QUARTER_NOTES_PER_MEASURE / length) * getDotMultiplier(dotText.length);
}

export function parseChordSegments(
  chordSegments: string[]
): ChordSegment[] | null {
  const parsedChordSegments: ChordSegment[] = [];

  for (const chordSegment of chordSegments) {
    const durationInQuarterNotes =
      getChordSegmentDurationInQuarterNotes(chordSegment);
    if (durationInQuarterNotes === null) {
      return null;
    }

    parsedChordSegments.push({
      mml: chordSegment,
      durationInQuarterNotes,
    });
  }

  return parsedChordSegments;
}

export function splitChordSegmentsByMeasure(
  chordSegments: ChordSegment[]
): MeasureChunk[] | null {
  const measureChunks: MeasureChunk[] = [];
  let currentChordSegments: ChordSegment[] = [];
  let currentDurationInQuarterNotes = 0;

  for (const chordSegment of chordSegments) {
    if (exceedsMeasure(chordSegment.durationInQuarterNotes)) {
      // 単一の chord segment 自体が 1meas を超える場合は分割できない。
      return null;
    }

    const nextDurationInQuarterNotes =
      currentDurationInQuarterNotes + chordSegment.durationInQuarterNotes;
    if (currentChordSegments.length > 0 && exceedsMeasure(nextDurationInQuarterNotes)) {
      // chord segment を追加すると meas 境界をまたぐ場合は分割できない。
      return null;
    }

    currentChordSegments = [...currentChordSegments, chordSegment];
    currentDurationInQuarterNotes = nextDurationInQuarterNotes;

    if (isMeasureComplete(currentDurationInQuarterNotes)) {
      measureChunks.push(createMeasureChunk(currentChordSegments));
      currentChordSegments = [];
      currentDurationInQuarterNotes = 0;
    }
  }

  if (currentChordSegments.length > 0) {
    measureChunks.push(createMeasureChunk(currentChordSegments));
  }

  return measureChunks;
}

export function assignMeasuresToChunks(
  measureChunks: MeasureChunk[],
  startMeasure: number
): PreparedMeasureInput[] {
  return measureChunks.map((measureChunk, index) => ({
    ...measureChunk,
    measure: startMeasure + index,
  }));
}

export function planMeasureInputs(
  mml: string,
  startMeasure: number
): PreparedMeasureInput[] | null {
  if (mml.trim() === "") {
    return [];
  }

  const chordSegments = splitSanitizedMmlIntoChordSegments(mml);
  if (chordSegments.length === 0) {
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

  return assignMeasuresToChunks(measureChunks, startMeasure);
}

import { splitBassRootChordSegment } from "../chords/bass-root-mml.ts";
import { chordToMml } from "../chords/chord-to-mml.ts";
import { splitSanitizedMmlIntoChordSegments } from "../measures/measure-input.ts";
import { sanitizeMmlForPost } from "../daw/post-config.ts";
import { parseChordSegmentRelativePitches } from "../music/note-numbers.ts";

export interface ChordMetrics {
  bassPitch: number | null;
  topPitch: number;
  centerPitch: number;
  chordSemitoneIntervalCount: number;
}

export interface Candidate {
  text: string;
  inversion: number;
  upperOffset: number;
  lowerOffset: number;
  metrics: ChordMetrics;
  notationPenalty: number;
  order: number;
}

const OCTAVE_OFFSETS = [-1, 0, 1] as const;
const INVERSION_COUNTS = [0, 1, 2, 3] as const;

function octaveOffsetText(offset: number): string {
  if (offset > 0) {
    return "'".repeat(offset);
  }
  if (offset < 0) {
    return ",".repeat(-offset);
  }
  return "";
}

function formatAdjustmentSuffix(
  inversion: number,
  upperOffset: number,
  lowerOffset: number
): string {
  const inversionText = inversion === 0 ? "" : `^${inversion}`;
  if (upperOffset === lowerOffset) {
    return `${inversionText}${octaveOffsetText(upperOffset)}`;
  }

  return `${inversionText}${octaveOffsetText(upperOffset)}/${octaveOffsetText(
    lowerOffset
  )}`;
}

function formatCandidateText(
  baseText: string,
  inversion: number,
  upperOffset: number,
  lowerOffset: number
): string {
  return `${baseText}${formatAdjustmentSuffix(inversion, upperOffset, lowerOffset)}`;
}

function buildEvaluationInput(preamble: string, chordText: string): string {
  return preamble === "" ? chordText : `${preamble} ${chordText}`;
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function countSemitoneIntervals(pitches: readonly number[]): number {
  const sortedPitches = [...pitches].sort((left, right) => left - right);
  let count = 0;
  for (let index = 1; index < sortedPitches.length; index += 1) {
    if (sortedPitches[index] - sortedPitches[index - 1] === 1) {
      count += 1;
    }
  }
  return count;
}

function evaluateCandidate(
  preamble: string,
  chordText: string
): ChordMetrics | null {
  const mml = chordToMml(buildEvaluationInput(preamble, chordText));
  if (mml === null) {
    return null;
  }

  const { mml: sanitizedMml } = sanitizeMmlForPost(mml);
  const chordSegments = splitSanitizedMmlIntoChordSegments(sanitizedMml);
  if (chordSegments.length !== 1) {
    return null;
  }

  const split = splitBassRootChordSegment(chordSegments[0]);
  const chordPitches = parseChordSegmentRelativePitches(split.chordMml);
  if (chordPitches === null || chordPitches.length === 0) {
    return null;
  }

  const bassPitches =
    split.bassMml === "" ? null : parseChordSegmentRelativePitches(split.bassMml);
  if (split.bassMml !== "" && bassPitches === null) {
    return null;
  }

  return {
    bassPitch: bassPitches?.[0] ?? null,
    topPitch: Math.max(...chordPitches),
    centerPitch: mean(chordPitches),
    chordSemitoneIntervalCount: countSemitoneIntervals(chordPitches),
  };
}

function createCandidate(
  preamble: string,
  baseText: string,
  inversion: number,
  upperOffset: number,
  lowerOffset: number,
  order: number
): Candidate | null {
  const text = formatCandidateText(baseText, inversion, upperOffset, lowerOffset);
  const metrics = evaluateCandidate(preamble, text);
  if (metrics === null) {
    return null;
  }

  return {
    text,
    inversion,
    upperOffset,
    lowerOffset,
    metrics,
    notationPenalty:
      Math.abs(upperOffset) +
      Math.abs(lowerOffset) +
      inversion * 0.4 +
      (upperOffset === lowerOffset ? 0 : 0.15),
    order,
  };
}

function candidateSortKey(candidate: Candidate): number {
  return candidate.notationPenalty * 100 + candidate.order;
}

export function buildCandidates(preamble: string, baseText: string): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  let order = 0;

  for (const inversion of INVERSION_COUNTS) {
    for (const upperOffset of OCTAVE_OFFSETS) {
      for (const lowerOffset of OCTAVE_OFFSETS) {
        const text = formatCandidateText(
          baseText,
          inversion,
          upperOffset,
          lowerOffset
        );
        if (seen.has(text)) {
          continue;
        }
        seen.add(text);
        const candidate = createCandidate(
          preamble,
          baseText,
          inversion,
          upperOffset,
          lowerOffset,
          order
        );
        order += 1;
        if (candidate !== null) {
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates.sort(
    (left, right) => candidateSortKey(left) - candidateSortKey(right)
  );
}

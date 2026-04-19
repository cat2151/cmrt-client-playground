import {
  buildCandidates,
  type Candidate,
} from "./auto-adjust-candidates.ts";
import {
  extractAnalysisPreamble,
  tokenizeAdjustableChords,
  type ChordToken,
} from "./auto-adjust-tokenize.ts";

export type AutoAdjustDiagnosticSeverity = "warning" | "error";

export interface AutoAdjustDiagnostic {
  severity: AutoAdjustDiagnosticSeverity;
  message: string;
}

export type AutoAdjustResult =
  | {
      ok: true;
      adjustedInput: string;
      chordCount: number;
      maxBassJump: number | null;
      maxTopJump: number | null;
      summary: string;
      diagnostics: AutoAdjustDiagnostic[];
    }
  | {
      ok: false;
      adjustedInput: string;
      message: string;
      diagnostics: AutoAdjustDiagnostic[];
    };

function rangePenalty(value: number, min: number, max: number, weight: number): number {
  if (value < min) {
    return (min - value) * weight;
  }
  if (value > max) {
    return (value - max) * weight;
  }
  return 0;
}

function baseScore(candidate: Candidate): number {
  const bassRangePenalty =
    candidate.metrics.bassPitch === null
      ? 0
      : rangePenalty(candidate.metrics.bassPitch, -24, 0, 4);
  return (
    candidate.notationPenalty +
    bassRangePenalty +
    rangePenalty(candidate.metrics.topPitch, 0, 24, 3)
  );
}

function jumpPenalty(
  left: number,
  right: number,
  freeSemitones: number,
  weight: number,
  extraWeight: number
): number {
  const jump = Math.abs(left - right);
  const extra = Math.max(0, jump - freeSemitones);
  return jump * weight + extra * extra * extraWeight;
}

function transitionScore(previous: Candidate, next: Candidate): number {
  const bassScore =
    previous.metrics.bassPitch === null || next.metrics.bassPitch === null
      ? 0
      : jumpPenalty(previous.metrics.bassPitch, next.metrics.bassPitch, 5, 4, 1.5);
  return (
    bassScore +
    jumpPenalty(previous.metrics.topPitch, next.metrics.topPitch, 4, 3, 1) +
    jumpPenalty(previous.metrics.centerPitch, next.metrics.centerPitch, 4, 1.2, 0.3)
  );
}

function chooseBestCandidates(candidateSets: Candidate[][]): Candidate[] {
  const costs: number[][] = [];
  const previousIndexes: number[][] = [];

  costs[0] = candidateSets[0].map(baseScore);
  previousIndexes[0] = candidateSets[0].map(() => -1);

  for (let tokenIndex = 1; tokenIndex < candidateSets.length; tokenIndex += 1) {
    costs[tokenIndex] = [];
    previousIndexes[tokenIndex] = [];
    for (
      let candidateIndex = 0;
      candidateIndex < candidateSets[tokenIndex].length;
      candidateIndex += 1
    ) {
      let bestCost = Number.POSITIVE_INFINITY;
      let bestPreviousIndex = -1;
      const candidate = candidateSets[tokenIndex][candidateIndex];
      for (
        let previousIndex = 0;
        previousIndex < candidateSets[tokenIndex - 1].length;
        previousIndex += 1
      ) {
        const previous = candidateSets[tokenIndex - 1][previousIndex];
        const cost =
          costs[tokenIndex - 1][previousIndex] +
          transitionScore(previous, candidate) +
          baseScore(candidate);
        if (cost < bestCost) {
          bestCost = cost;
          bestPreviousIndex = previousIndex;
        }
      }
      costs[tokenIndex][candidateIndex] = bestCost;
      previousIndexes[tokenIndex][candidateIndex] = bestPreviousIndex;
    }
  }

  const lastCosts = costs[costs.length - 1];
  let bestLastIndex = 0;
  for (let index = 1; index < lastCosts.length; index += 1) {
    if (lastCosts[index] < lastCosts[bestLastIndex]) {
      bestLastIndex = index;
    }
  }

  const selected: Candidate[] = [];
  let selectedIndex = bestLastIndex;
  for (let tokenIndex = candidateSets.length - 1; tokenIndex >= 0; tokenIndex -= 1) {
    selected.unshift(candidateSets[tokenIndex][selectedIndex]);
    selectedIndex = previousIndexes[tokenIndex][selectedIndex];
  }
  return selected;
}

function replaceTokens(
  input: string,
  tokens: readonly ChordToken[],
  selectedCandidates: readonly Candidate[]
): string {
  let output = "";
  let lastIndex = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    output += input.slice(lastIndex, tokens[index].start);
    output += selectedCandidates[index].text;
    lastIndex = tokens[index].end;
  }
  output += input.slice(lastIndex);
  return output;
}

function formatJump(jump: number | null): string {
  return jump === null ? "-" : String(Number(jump.toFixed(2)));
}

function summarizeResult(
  chordCount: number,
  maxBassJump: number | null,
  maxTopJump: number | null
): string {
  return `自動調整: ${chordCount} chords / bass max jump ${formatJump(
    maxBassJump
  )} / top max jump ${formatJump(maxTopJump)}`;
}

function collectJumpDiagnostics(
  maxBassJump: number | null,
  maxTopJump: number | null
): AutoAdjustDiagnostic[] {
  const diagnostics: AutoAdjustDiagnostic[] = [];
  if (maxBassJump !== null && maxBassJump > 7) {
    diagnostics.push({
      severity: "warning",
      message: `bass jump が ${formatJump(maxBassJump)} 半音残っています`,
    });
  }
  if (maxTopJump !== null && maxTopJump > 7) {
    diagnostics.push({
      severity: "warning",
      message: `top note jump が ${formatJump(maxTopJump)} 半音残っています`,
    });
  }
  return diagnostics;
}

function collectMaxJumps(selectedCandidates: readonly Candidate[]): {
  maxBassJump: number | null;
  maxTopJump: number | null;
} {
  let maxBassJump: number | null = null;
  let maxTopJump: number | null = null;
  for (let index = 1; index < selectedCandidates.length; index += 1) {
    const previous = selectedCandidates[index - 1].metrics;
    const current = selectedCandidates[index].metrics;
    if (previous.bassPitch !== null && current.bassPitch !== null) {
      const jump = Math.abs(current.bassPitch - previous.bassPitch);
      maxBassJump = Math.max(maxBassJump ?? 0, jump);
    }
    const topJump = Math.abs(current.topPitch - previous.topPitch);
    maxTopJump = Math.max(maxTopJump ?? 0, topJump);
  }

  return { maxBassJump, maxTopJump };
}

export function adjustChordProgression(input: string): AutoAdjustResult {
  const tokens = tokenizeAdjustableChords(input);
  if (tokens.length === 0) {
    return {
      ok: false,
      adjustedInput: input,
      message: "調整対象のコードがありません",
      diagnostics: [],
    };
  }

  const preamble = extractAnalysisPreamble(input);
  const candidateSets = tokens.map((token) =>
    buildCandidates(preamble, token.baseText)
  );
  const firstEmptyIndex = candidateSets.findIndex((candidates) => candidates.length === 0);
  if (firstEmptyIndex !== -1) {
    const message = `${firstEmptyIndex + 1}番目のコード "${tokens[firstEmptyIndex].text}" の候補を作れません`;
    return {
      ok: false,
      adjustedInput: input,
      message,
      diagnostics: [{ severity: "error", message }],
    };
  }

  const selectedCandidates = chooseBestCandidates(candidateSets);
  const adjustedInput = replaceTokens(input, tokens, selectedCandidates);
  const { maxBassJump, maxTopJump } = collectMaxJumps(selectedCandidates);
  const diagnostics = collectJumpDiagnostics(maxBassJump, maxTopJump);

  return {
    ok: true,
    adjustedInput,
    chordCount: tokens.length,
    maxBassJump,
    maxTopJump,
    summary: summarizeResult(tokens.length, maxBassJump, maxTopJump),
    diagnostics,
  };
}

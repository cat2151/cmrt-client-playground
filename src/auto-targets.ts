export interface AutoTargetCandidate {
  track: number;
  filterName: string | null;
}

export interface AutoTargetSelection {
  chordTrack: number | null;
  bassTrack: number | null;
}

function hasKeyword(filterName: string | null, keyword: string): boolean {
  return filterName?.toLowerCase().includes(keyword) ?? false;
}

export function selectAutoTargetTracks(
  candidates: readonly AutoTargetCandidate[]
): AutoTargetSelection {
  return {
    chordTrack:
      candidates.find((candidate) => hasKeyword(candidate.filterName, "pad"))?.track ?? null,
    bassTrack:
      candidates.find((candidate) => hasKeyword(candidate.filterName, "bass"))?.track ?? null,
  };
}

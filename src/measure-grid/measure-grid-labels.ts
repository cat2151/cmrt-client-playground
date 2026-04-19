export function formatMeasureGridTrackLabel(track: number): string {
  return track === 0 ? "Conductor" : `track ${track}`;
}

export function formatMeasureGridMeasureLabel(measure: number): string {
  return measure === 0 ? "init" : String(measure);
}

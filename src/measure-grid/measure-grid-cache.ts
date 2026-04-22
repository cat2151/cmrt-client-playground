import { getMeasureGridCellKey } from "./measure-grid-keys.ts";

export type MeasureGridCacheState = "empty" | "pending" | "rendering" | "ready" | "error";

export interface MeasureGridCacheCellLike {
  state: string;
}

export type MeasureGridCacheCells = readonly (readonly MeasureGridCacheCellLike[])[];

export function parseMeasureGridCacheState(state: string): MeasureGridCacheState | null {
  switch (state) {
    case "empty":
    case "pending":
    case "rendering":
    case "ready":
    case "error":
      return state;
    default:
      return null;
  }
}

export function readMeasureGridCacheState(
  cells: MeasureGridCacheCells,
  track: number,
  measure: number
): MeasureGridCacheState | null {
  const cell = cells[track]?.[measure];
  if (cell === undefined) {
    return null;
  }

  return parseMeasureGridCacheState(cell.state);
}

export function buildMeasureGridCacheStateMap(
  cells: MeasureGridCacheCells | null
): Map<string, MeasureGridCacheState> {
  const states = new Map<string, MeasureGridCacheState>();
  if (cells === null) {
    return states;
  }

  for (const [track, row] of cells.entries()) {
    for (const [measure, cell] of row.entries()) {
      const state = parseMeasureGridCacheState(cell.state);
      if (state !== null) {
        states.set(getMeasureGridCellKey(track, measure), state);
      }
    }
  }

  return states;
}

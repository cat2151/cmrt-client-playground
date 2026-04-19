import type { MeasureGridConfig } from "./measure-grid-config.ts";
import { parseNonNegativeInteger, parsePositiveInteger } from "../daw/post-config.ts";

export interface MeasureGridElements {
  trackStartEl: HTMLInputElement;
  trackCountEl: HTMLInputElement;
  measureStartEl: HTMLInputElement;
  measureCountEl: HTMLInputElement;
  headEl: HTMLTableSectionElement;
  bodyEl: HTMLTableSectionElement;
}

export function syncMeasureGridControls(
  elements: MeasureGridElements,
  config: MeasureGridConfig
): void {
  elements.trackStartEl.value = String(config.trackStart);
  elements.trackCountEl.value = String(config.trackCount);
  elements.measureStartEl.value = String(config.measureStart);
  elements.measureCountEl.value = String(config.measureCount);
}

export function readMeasureGridConfigFromControls(
  elements: MeasureGridElements,
  appendLog: (message: string) => void
): MeasureGridConfig | null {
  const trackStart = parseNonNegativeInteger(elements.trackStartEl.value);
  if (trackStart === null) {
    appendLog("ERROR: grid track start には 0 以上の整数を指定してください");
    return null;
  }

  const trackCount = parsePositiveInteger(elements.trackCountEl.value);
  if (trackCount === null) {
    appendLog("ERROR: grid track count には 1 以上の整数を指定してください");
    return null;
  }

  const measureStart = parseNonNegativeInteger(elements.measureStartEl.value);
  if (measureStart === null) {
    appendLog("ERROR: grid meas start には 0 以上の整数を指定してください");
    return null;
  }

  const measureCount = parsePositiveInteger(elements.measureCountEl.value);
  if (measureCount === null) {
    appendLog("ERROR: grid meas count には 1 以上の整数を指定してください");
    return null;
  }

  return { trackStart, trackCount, measureStart, measureCount };
}

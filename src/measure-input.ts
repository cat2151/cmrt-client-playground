export interface MeasureInput {
  chord: string;
  measure: number;
}

export function splitInputIntoMeasures(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function planMeasureInputs(
  input: string,
  startMeasure: number
): MeasureInput[] {
  return splitInputIntoMeasures(input).map((chord, index) => ({
    chord,
    measure: startMeasure + index,
  }));
}

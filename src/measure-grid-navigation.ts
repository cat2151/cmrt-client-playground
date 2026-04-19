export type MeasureGridNavigationSelectionBehavior = "start" | "end" | "preserve";

export type MeasureGridNavigationCaretOrigin = "start" | "end";

interface MeasureGridArrowNavigationRequest {
  key: string;
  track: number;
  measure: number;
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  visibleTracks: number[];
  visibleMeasures: number[];
  isComposing: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface MeasureGridArrowNavigationTarget {
  track: number;
  measure: number;
  selectionBehavior: MeasureGridNavigationSelectionBehavior;
  caretOffset?: number;
  caretOffsetOrigin?: MeasureGridNavigationCaretOrigin;
}

export function getMeasureGridArrowNavigationTarget(
  request: MeasureGridArrowNavigationRequest
): MeasureGridArrowNavigationTarget | null {
  if (
    request.isComposing ||
    request.altKey ||
    request.ctrlKey ||
    request.metaKey ||
    request.shiftKey
  ) {
    return null;
  }

  const trackIndex = request.visibleTracks.indexOf(request.track);
  const measureIndex = request.visibleMeasures.indexOf(request.measure);
  if (trackIndex === -1 || measureIndex === -1) {
    return null;
  }

  switch (request.key) {
    case "ArrowLeft":
      if (
        request.selectionStart === null ||
        request.selectionEnd === null ||
        request.selectionStart !== request.selectionEnd ||
        request.selectionStart !== 0 ||
        measureIndex === 0
      ) {
        return null;
      }
      return {
        track: request.track,
        measure: request.visibleMeasures[measureIndex - 1],
        selectionBehavior: "end",
      };
    case "ArrowRight":
      if (
        request.selectionStart === null ||
        request.selectionEnd === null ||
        request.selectionStart !== request.selectionEnd ||
        request.selectionEnd !== request.value.length ||
        measureIndex === request.visibleMeasures.length - 1
      ) {
        return null;
      }
      return {
        track: request.track,
        measure: request.visibleMeasures[measureIndex + 1],
        selectionBehavior: "start",
      };
    case "ArrowUp":
      if (trackIndex === 0) {
        return null;
      }
      return getMeasureGridVerticalNavigationTarget(
        request.visibleTracks[trackIndex - 1],
        request.measure,
        request.value,
        request.selectionStart
      );
    case "ArrowDown":
      if (trackIndex === request.visibleTracks.length - 1) {
        return null;
      }
      return getMeasureGridVerticalNavigationTarget(
        request.visibleTracks[trackIndex + 1],
        request.measure,
        request.value,
        request.selectionStart
      );
    default:
      return null;
  }
}

function getMeasureGridVerticalNavigationTarget(
  track: number,
  measure: number,
  value: string,
  selectionStart: number | null
): MeasureGridArrowNavigationTarget {
  const caretPosition = selectionStart ?? 0;
  if (caretPosition * 2 <= value.length) {
    return {
      track,
      measure,
      selectionBehavior: "preserve",
      caretOffset: caretPosition,
      caretOffsetOrigin: "start",
    };
  }

  return {
    track,
    measure,
    selectionBehavior: "preserve",
    caretOffset: value.length - caretPosition,
    caretOffsetOrigin: "end",
  };
}

export function getMeasureGridCaretPosition(
  value: string,
  selectionBehavior: MeasureGridNavigationSelectionBehavior,
  caretOffset = 0,
  caretOffsetOrigin: MeasureGridNavigationCaretOrigin = "start"
): number {
  switch (selectionBehavior) {
    case "start":
      return 0;
    case "end":
      return value.length;
    case "preserve":
      if (caretOffsetOrigin === "start") {
        return Math.min(value.length, caretOffset);
      }
      return Math.max(0, value.length - caretOffset);
    default:
      return 0;
  }
}

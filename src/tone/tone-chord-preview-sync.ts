export type ToneChordPreviewInputSource = "textarea" | "template" | "search" | "other";

export function syncToneChordPreviewAfterInputChange(options: {
  isToneFallbackMode: boolean;
  source: ToneChordPreviewInputSource;
  cancelPreview: () => void;
  syncPreview: () => void;
}): void {
  if (
    options.isToneFallbackMode &&
    (options.source === "textarea" ||
      options.source === "template" ||
      options.source === "search")
  ) {
    options.cancelPreview();
  }

  options.syncPreview();
}

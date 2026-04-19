export type ToneChordPreviewInputSource = "textarea" | "template" | "other";

export function syncToneChordPreviewAfterInputChange(options: {
  isToneFallbackMode: boolean;
  source: ToneChordPreviewInputSource;
  cancelPreview: () => void;
  syncPreview: () => void;
}): void {
  if (
    options.isToneFallbackMode &&
    (options.source === "textarea" || options.source === "template")
  ) {
    options.cancelPreview();
  }

  options.syncPreview();
}

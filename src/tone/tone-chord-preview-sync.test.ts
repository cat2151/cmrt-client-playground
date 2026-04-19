import { describe, expect, it, vi } from "vitest";
import { syncToneChordPreviewAfterInputChange } from "./tone-chord-preview-sync.ts";

describe("syncToneChordPreviewAfterInputChange", () => {
  it("restarts Tone preview immediately for textarea changes in fallback mode", () => {
    const cancelPreview = vi.fn();
    const syncPreview = vi.fn();

    syncToneChordPreviewAfterInputChange({
      isToneFallbackMode: true,
      source: "textarea",
      cancelPreview,
      syncPreview,
    });

    expect(cancelPreview).toHaveBeenCalledTimes(1);
    expect(syncPreview).toHaveBeenCalledTimes(1);
  });

  it("restarts Tone preview immediately for template changes in fallback mode", () => {
    const cancelPreview = vi.fn();
    const syncPreview = vi.fn();

    syncToneChordPreviewAfterInputChange({
      isToneFallbackMode: true,
      source: "template",
      cancelPreview,
      syncPreview,
    });

    expect(cancelPreview).toHaveBeenCalledTimes(1);
    expect(syncPreview).toHaveBeenCalledTimes(1);
  });

  it("does not cancel the current preview outside fallback mode", () => {
    const cancelPreview = vi.fn();
    const syncPreview = vi.fn();

    syncToneChordPreviewAfterInputChange({
      isToneFallbackMode: false,
      source: "textarea",
      cancelPreview,
      syncPreview,
    });

    expect(cancelPreview).not.toHaveBeenCalled();
    expect(syncPreview).toHaveBeenCalledTimes(1);
  });

  it("does not force a restart for unrelated input sources", () => {
    const cancelPreview = vi.fn();
    const syncPreview = vi.fn();

    syncToneChordPreviewAfterInputChange({
      isToneFallbackMode: true,
      source: "other",
      cancelPreview,
      syncPreview,
    });

    expect(cancelPreview).not.toHaveBeenCalled();
    expect(syncPreview).toHaveBeenCalledTimes(1);
  });
});

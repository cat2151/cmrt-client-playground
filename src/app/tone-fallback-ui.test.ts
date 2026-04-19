import { describe, expect, it } from "vitest";
import { syncToneFallbackUiVisibility } from "./tone-fallback-ui.ts";

describe("syncToneFallbackUiVisibility", () => {
  it("shows the cmrt notice and hides the measure grid in Tone.js fallback mode", () => {
    const elements = {
      cmrtTargetSettingsEl: { hidden: true },
      toneFallbackNoticeEl: { hidden: true },
      measureGridPanelEl: { hidden: false },
    };

    syncToneFallbackUiVisibility(elements);

    expect(elements.toneFallbackNoticeEl.hidden).toBe(false);
    expect(elements.measureGridPanelEl.hidden).toBe(true);
  });

  it("hides the cmrt notice and shows the measure grid outside Tone.js fallback mode", () => {
    const elements = {
      cmrtTargetSettingsEl: { hidden: false },
      toneFallbackNoticeEl: { hidden: false },
      measureGridPanelEl: { hidden: true },
    };

    syncToneFallbackUiVisibility(elements);

    expect(elements.toneFallbackNoticeEl.hidden).toBe(true);
    expect(elements.measureGridPanelEl.hidden).toBe(false);
  });
});

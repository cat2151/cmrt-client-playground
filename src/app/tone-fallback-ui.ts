interface HiddenElement {
  hidden: boolean;
}

export interface ToneFallbackUiVisibilityElements {
  cmrtTargetSettingsEl: HiddenElement;
  toneFallbackNoticeEl: HiddenElement;
  measureGridPanelEl: HiddenElement;
}

interface ToneFallbackUiElements extends ToneFallbackUiVisibilityElements {
  cmrtTargetSettingsEl: HTMLElement;
}

export function syncToneFallbackUiVisibility(
  elements: ToneFallbackUiVisibilityElements
): void {
  const isToneFallbackMode = elements.cmrtTargetSettingsEl.hidden;
  elements.toneFallbackNoticeEl.hidden = !isToneFallbackMode;
  elements.measureGridPanelEl.hidden = isToneFallbackMode;
}

export function initializeToneFallbackUi(elements: ToneFallbackUiElements): MutationObserver {
  const sync = () => syncToneFallbackUiVisibility(elements);
  const observer = new MutationObserver(sync);
  observer.observe(elements.cmrtTargetSettingsEl, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  sync();
  return observer;
}

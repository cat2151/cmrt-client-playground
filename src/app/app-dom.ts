export interface AppDomElements {
  appShellEl: HTMLDivElement;
  startupOverlayEl: HTMLDivElement;
  startupOverlayTitleEl: HTMLHeadingElement;
  startupOverlayMessageEl: HTMLParagraphElement;
  startupOverlayDetailEl: HTMLPreElement;
  playStartButtonEl: HTMLButtonElement;
  playStopButtonEl: HTMLButtonElement;
  chordAnalysisErrorBalloonEl: HTMLSpanElement;
  chordHistorySelectEl: HTMLSelectElement;
  chordSearchShellEl: HTMLDivElement;
  chordSearchButtonEl: HTMLButtonElement;
  chordSearchInputEl: HTMLInputElement;
  chordSearchResultsEl: HTMLDivElement;
  chordTemplateKeySelectEl: HTMLSelectElement;
  chordTemplateSelectEl: HTMLSelectElement;
  inputEditorEl: HTMLDivElement;
  pianoRollContentEl: HTMLDivElement;
  toneFallbackNoticeEl: HTMLParagraphElement;
  localStorageExportButtonEl: HTMLButtonElement;
  localStorageImportButtonEl: HTMLButtonElement;
  localStorageImportFileEl: HTMLInputElement;
  toneInstrumentSelectEl: HTMLSelectElement;
  toneInstrumentPlayButtonEl: HTMLButtonElement;
  toneInstrumentMmlEl: HTMLTextAreaElement;
  toneInstrumentMmlHistorySelectEl: HTMLSelectElement;
  toneInstrumentVolumeSelectEl: HTMLSelectElement;
  cmrtTargetSettingsEl: HTMLDivElement;
  chordTrackEl: HTMLInputElement;
  chordMeasureEl: HTMLInputElement;
  bassTrackEl: HTMLInputElement;
  autoAdjustChordsEl: HTMLInputElement;
  autoAdjustOutputPanelEl: HTMLDivElement;
  autoAdjustOutputEditorEl: HTMLDivElement;
  autoAdjustStatusEl: HTMLParagraphElement;
  gridTrackStartEl: HTMLInputElement;
  gridTrackCountEl: HTMLInputElement;
  gridMeasureStartEl: HTMLInputElement;
  gridMeasureCountEl: HTMLInputElement;
  measureGridPanelEl: HTMLElement;
  measureGridHeadEl: HTMLTableSectionElement;
  measureGridBodyEl: HTMLTableSectionElement;
  logToggleButtonEl: HTMLButtonElement;
  smfExportButtonEl: HTMLButtonElement;
  logEl: HTMLDivElement;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Missing element: #${id}`);
  }
  return element as T;
}

export function getAppDomElements(): AppDomElements {
  return {
    appShellEl: getElement("app-shell"),
    startupOverlayEl: getElement("startup-overlay"),
    startupOverlayTitleEl: getElement("startup-overlay-title"),
    startupOverlayMessageEl: getElement("startup-overlay-message"),
    startupOverlayDetailEl: getElement("startup-overlay-detail"),
    playStartButtonEl: getElement("play-start"),
    playStopButtonEl: getElement("play-stop"),
    chordAnalysisErrorBalloonEl: getElement("chord-analysis-error-balloon"),
    chordHistorySelectEl: getElement("chord-history"),
    chordSearchShellEl: getElement("chord-search-shell"),
    chordSearchButtonEl: getElement("chord-search-toggle"),
    chordSearchInputEl: getElement("chord-search"),
    chordSearchResultsEl: getElement("chord-search-results"),
    chordTemplateKeySelectEl: getElement("chord-template-key"),
    chordTemplateSelectEl: getElement("chord-template"),
    inputEditorEl: getElement("input"),
    pianoRollContentEl: getElement("piano-roll-content"),
    toneFallbackNoticeEl: getElement("tone-fallback-cmrt-notice"),
    localStorageExportButtonEl: getElement("local-storage-export"),
    localStorageImportButtonEl: getElement("local-storage-import"),
    localStorageImportFileEl: getElement("local-storage-import-file"),
    toneInstrumentSelectEl: getElement("tone-instrument-select"),
    toneInstrumentPlayButtonEl: getElement("tone-instrument-play"),
    toneInstrumentMmlEl: getElement("tone-instrument-mml"),
    toneInstrumentMmlHistorySelectEl: getElement("tone-instrument-mml-history"),
    toneInstrumentVolumeSelectEl: getElement("tone-instrument-volume"),
    cmrtTargetSettingsEl: getElement("cmrt-target-settings"),
    chordTrackEl: getElement("track"),
    chordMeasureEl: getElement("measure"),
    bassTrackEl: getElement("bass-track"),
    autoAdjustChordsEl: getElement("auto-adjust-chords"),
    autoAdjustOutputPanelEl: getElement("auto-adjust-output-panel"),
    autoAdjustOutputEditorEl: getElement("auto-adjust-output-editor"),
    autoAdjustStatusEl: getElement("auto-adjust-status"),
    gridTrackStartEl: getElement("grid-track-start"),
    gridTrackCountEl: getElement("grid-track-count"),
    gridMeasureStartEl: getElement("grid-measure-start"),
    gridMeasureCountEl: getElement("grid-measure-count"),
    measureGridPanelEl: getElement("measure-grid-panel"),
    measureGridHeadEl: getElement("measure-grid-head"),
    measureGridBodyEl: getElement("measure-grid-body"),
    logToggleButtonEl: getElement("log-toggle"),
    smfExportButtonEl: getElement("smf-export"),
    logEl: getElement("log"),
  };
}

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
  chordTemplateKeySelectEl: HTMLSelectElement;
  chordTemplateSelectEl: HTMLSelectElement;
  inputEditorEl: HTMLDivElement;
  pianoRollContentEl: HTMLDivElement;
  localStorageExportButtonEl: HTMLButtonElement;
  localStorageImportButtonEl: HTMLButtonElement;
  localStorageImportFileEl: HTMLInputElement;
  cmrtTargetSettingsEl: HTMLDivElement;
  chordTrackEl: HTMLInputElement;
  chordMeasureEl: HTMLInputElement;
  bassTrackEl: HTMLInputElement;
  autoAdjustChordsEl: HTMLInputElement;
  autoAdjustOutputPanelEl: HTMLDivElement;
  autoAdjustOutputEl: HTMLTextAreaElement;
  autoAdjustStatusEl: HTMLParagraphElement;
  gridTrackStartEl: HTMLInputElement;
  gridTrackCountEl: HTMLInputElement;
  gridMeasureStartEl: HTMLInputElement;
  gridMeasureCountEl: HTMLInputElement;
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
    chordTemplateKeySelectEl: getElement("chord-template-key"),
    chordTemplateSelectEl: getElement("chord-template"),
    inputEditorEl: getElement("input"),
    pianoRollContentEl: getElement("piano-roll-content"),
    localStorageExportButtonEl: getElement("local-storage-export"),
    localStorageImportButtonEl: getElement("local-storage-import"),
    localStorageImportFileEl: getElement("local-storage-import-file"),
    cmrtTargetSettingsEl: getElement("cmrt-target-settings"),
    chordTrackEl: getElement("track"),
    chordMeasureEl: getElement("measure"),
    bassTrackEl: getElement("bass-track"),
    autoAdjustChordsEl: getElement("auto-adjust-chords"),
    autoAdjustOutputPanelEl: getElement("auto-adjust-output-panel"),
    autoAdjustOutputEl: getElement("auto-adjust-output"),
    autoAdjustStatusEl: getElement("auto-adjust-status"),
    gridTrackStartEl: getElement("grid-track-start"),
    gridTrackCountEl: getElement("grid-track-count"),
    gridMeasureStartEl: getElement("grid-measure-start"),
    gridMeasureCountEl: getElement("grid-measure-count"),
    measureGridHeadEl: getElement("measure-grid-head"),
    measureGridBodyEl: getElement("measure-grid-body"),
    logToggleButtonEl: getElement("log-toggle"),
    smfExportButtonEl: getElement("smf-export"),
    logEl: getElement("log"),
  };
}

import { downloadBinaryFile } from "./app-storage-io.ts";
import type { ChordProgressionEditor } from "./chord-progression-highlight.ts";
import {
  convertChordProgressionToSmf,
  createMmlabcToSmfConverter,
  SMF_EXPORT_FILENAME,
} from "./smf-export.ts";

interface SmfExportControllerOptions {
  inputEl: ChordProgressionEditor;
  smfExportButtonEl: HTMLButtonElement;
  smfConverter: ReturnType<typeof createMmlabcToSmfConverter>;
  getInput: () => string;
  isCurrentInputFromSelectedTemplate: () => boolean;
  rememberChordHistoryEntry: (input: string) => void;
  showChordAnalysisErrorBalloon: (message: string) => void;
  appendLog: (message: string) => void;
}

export function createSmfExportController(options: SmfExportControllerOptions): {
  exportCurrentSmf(): Promise<void>;
} {
  let isExporting = false;

  async function exportCurrentSmf(): Promise<void> {
    if (isExporting) {
      return;
    }

    isExporting = true;
    options.smfExportButtonEl.disabled = true;
    try {
      if (
        options.inputEl.value.trim() !== "" &&
        !options.isCurrentInputFromSelectedTemplate()
      ) {
        options.rememberChordHistoryEntry(options.inputEl.value);
      }

      const result = await convertChordProgressionToSmf(
        options.getInput(),
        options.smfConverter
      );
      if (!result.ok) {
        options.appendLog(`ERROR: ${result.message}`);
        if (result.chordAnalysisMessage !== undefined) {
          options.showChordAnalysisErrorBalloon(result.chordAnalysisMessage);
        }
        return;
      }

      options.appendLog(`コード進行 → MML(SMF export): ${result.mml}`);
      downloadBinaryFile(SMF_EXPORT_FILENAME, result.smfData, "audio/midi");
      options.appendLog(
        `SMF export: ${SMF_EXPORT_FILENAME} (${result.smfData.byteLength} bytes)`
      );
    } finally {
      isExporting = false;
      options.smfExportButtonEl.disabled = false;
    }
  }

  return { exportCurrentSmf };
}

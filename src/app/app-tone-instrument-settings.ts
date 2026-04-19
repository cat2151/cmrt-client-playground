import type { AppDomElements } from "./app-dom.ts";
import type { LocalStorageAccess } from "./app-storage-io.ts";
import {
  createToneInstrumentSettingsController,
  type ToneInstrumentSettingsController,
} from "../tone/tone-instrument-settings-controller.ts";

export function createAppToneInstrumentSettings(options: {
  dom: AppDomElements;
  storage: LocalStorageAccess;
  appendLog: (message: string) => void;
  onInstrumentMmlChange: () => void;
}): ToneInstrumentSettingsController {
  return createToneInstrumentSettingsController({
    instrumentSelectEl: options.dom.toneInstrumentSelectEl,
    instrumentMmlEl: options.dom.toneInstrumentMmlEl,
    instrumentMmlHistorySelectEl: options.dom.toneInstrumentMmlHistorySelectEl,
    instrumentVolumeSelectEl: options.dom.toneInstrumentVolumeSelectEl,
    storage: options.storage,
    appendLog: options.appendLog,
    onInstrumentMmlChange: options.onInstrumentMmlChange,
  });
}

import type { MeasureGridConfig } from "../measure-grid/measure-grid.ts";

export const INPUT_STORAGE_KEY = "cmrt-client-playground.input";
export const CHORD_HISTORY_STORAGE_KEY = "cmrt-client-playground.chord.history";
export const CHORD_TRACK_STORAGE_KEY = "cmrt-client-playground.chord.track";
export const CHORD_MEASURE_STORAGE_KEY = "cmrt-client-playground.chord.measure";
export const BASS_TRACK_STORAGE_KEY = "cmrt-client-playground.bass-track";
export const AUTO_ADJUST_CHORDS_STORAGE_KEY =
  "cmrt-client-playground.auto-adjust-chords";
export const TONE_INSTRUMENT_SELECTION_STORAGE_KEY =
  "cmrt-client-playground.tone.instrument.selection";
export const TONE_INSTRUMENT_MML_STORAGE_KEY =
  "cmrt-client-playground.tone.instrument.mml";
export const TONE_INSTRUMENT_VOLUME_STORAGE_KEY =
  "cmrt-client-playground.tone.instrument.volume";
export const TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY =
  "cmrt-client-playground.tone.instrument.mml.history";

export const CHORD_TEMPLATE_URL =
  "https://raw.githubusercontent.com/cat2151/cat-music-patterns/main/chord-progressions.json";
export const TONE_INSTRUMENTS_URL =
  "https://raw.githubusercontent.com/cat2151/cat-music-patterns/main/tonejs-mml-instruments.md";
export const APP_STORAGE_EXPORT_FILENAME =
  "cmrt-client-playground-local-storage.json";
export const APP_STORAGE_KEYS = [
  INPUT_STORAGE_KEY,
  CHORD_HISTORY_STORAGE_KEY,
  CHORD_TRACK_STORAGE_KEY,
  CHORD_MEASURE_STORAGE_KEY,
  BASS_TRACK_STORAGE_KEY,
  AUTO_ADJUST_CHORDS_STORAGE_KEY,
  TONE_INSTRUMENT_SELECTION_STORAGE_KEY,
  TONE_INSTRUMENT_MML_STORAGE_KEY,
  TONE_INSTRUMENT_VOLUME_STORAGE_KEY,
  TONE_INSTRUMENT_MML_HISTORY_STORAGE_KEY,
] as const;

export const AUTO_SEND_DELAY_MS = 1000;
export const INIT_MEASURE = 0;
export const AUTO_TARGET_TRACK_SCAN_START = 1;
export const AUTO_TARGET_TRACK_SCAN_END = 16;
export const GRID_AUTO_FETCH_INTERVAL_MS = 1000;
export const STARTUP_CONNECTIVITY_RETRY_MS = 1000;
export const MAX_AUTO_EXPANDED_TRACK_COUNT = 16;
export const MAX_AUTO_EXPANDED_MEASURE_COUNT = 32;
export const CHORD_HISTORY_SELECT_MIN_CH = 12;
export const CHORD_HISTORY_SELECT_MAX_CH = 24;
export const CHORD_ANALYSIS_ERROR_BALLOON_MS = 5000;
export const CHORD_ANALYSIS_ERROR_BALLOON_VIEWPORT_MARGIN_PX = 8;
export const PIANO_ROLL_HEIGHT_PX = 192;
export const PIANO_ROLL_MIN_NOTE_WIDTH_PERCENT = 0.6;

export const DEFAULT_MEASURE_GRID_CONFIG: MeasureGridConfig = {
  trackStart: 0,
  trackCount: 4,
  measureStart: 0,
  measureCount: 8,
};

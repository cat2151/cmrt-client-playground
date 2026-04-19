import type { ChordPlaybackSource } from "../chords/chord-playback-source.ts";

type ReadyChordPlaybackSource = Extract<ChordPlaybackSource, { ok: true }>;

export function buildTonePlaybackMml(source: ReadyChordPlaybackSource): string {
  return source.sanitizedMml;
}

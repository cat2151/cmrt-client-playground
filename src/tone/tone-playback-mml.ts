import type { ChordPlaybackSource } from "../chords/chord-playback-source.ts";

type ReadyChordPlaybackSource = Extract<ChordPlaybackSource, { ok: true }>;

export function buildTonePlaybackMml(
  source: ReadyChordPlaybackSource,
  instrumentMml = ""
): string {
  const prefix = instrumentMml.trim();
  if (prefix === "") {
    return source.sanitizedMml;
  }

  return `${prefix}\n${source.sanitizedMml}`;
}

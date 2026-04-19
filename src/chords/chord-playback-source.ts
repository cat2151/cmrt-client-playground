import { splitBassRootMmlByTrack } from "./bass-root-mml.ts";
import { chordToMml } from "./chord-to-mml.ts";
import { sanitizeMmlForPost } from "../daw/post-config.ts";

export type ChordPlaybackSource =
  | {
      ok: false;
      reason: "empty-input" | "unrecognized-chord";
    }
  | {
      ok: true;
      input: string;
      mml: string;
      sanitizedMml: string;
      chordMml: string;
      bassMml: string;
      removedTokens: string[];
    };

export function buildChordPlaybackSource(input: string): ChordPlaybackSource {
  const trimmedInput = input.trim();
  if (trimmedInput === "") {
    return {
      ok: false,
      reason: "empty-input",
    };
  }

  const mml = chordToMml(trimmedInput);
  if (mml === null) {
    return {
      ok: false,
      reason: "unrecognized-chord",
    };
  }

  const { mml: sanitizedMml, removedTokens } = sanitizeMmlForPost(mml);
  const splitMml = splitBassRootMmlByTrack(sanitizedMml);
  return {
    ok: true,
    input: trimmedInput,
    mml,
    sanitizedMml,
    chordMml: splitMml.chordMml,
    bassMml: splitMml.bassMml,
    removedTokens,
  };
}

import { splitSanitizedMmlIntoChordSegments } from "./measure-input.ts";

interface ParsedNoteToken {
  raw: string;
  prefix: string;
  pitch: string;
  lengthText: string;
  dotText: string;
}

export interface SplitMmlByTrack {
  chordMml: string;
  bassMml: string;
}

function isBassRootPattern(tokens: ParsedNoteToken[]): boolean {
  if (tokens.length < 2) {
    return false;
  }

  const [bassToken, chordRootToken] = tokens;
  const hasMatchingPitchLater = tokens
    .slice(1)
    .some((token) => token.pitch === bassToken.pitch);
  return (
    chordRootToken.lengthText === "" &&
    chordRootToken.dotText === "" &&
    (bassToken.prefix !== "" ||
      (bassToken.lengthText !== "" && hasMatchingPitchLater))
  );
}

function normalizeOctavePrefix(prefix: string): string {
  let octaveOffset = 0;
  for (const char of prefix) {
    if (char === ">") {
      octaveOffset += 1;
    } else if (char === "<") {
      octaveOffset -= 1;
    }
  }

  if (octaveOffset > 0) {
    return ">".repeat(octaveOffset);
  }
  if (octaveOffset < 0) {
    return "<".repeat(-octaveOffset);
  }
  return "";
}

function parseChordSegmentBody(body: string): ParsedNoteToken[] | null {
  const tokens: ParsedNoteToken[] = [];
  let rest = body;

  while (rest !== "") {
    // prefix: オクターブ移動、note: 音名、accidental: 臨時記号、
    // lengthText: 音長、dotText: 付点。
    const match = rest.match(
      /^(?<prefix>[<>]*)(?<note>[a-gr])(?<accidental>[+#-]?)(?<lengthText>\d*)(?<dotText>\.*)/i
    );
    if (match?.groups === undefined) {
      return null;
    }

    const raw = match[0];
    const { prefix, note, accidental, lengthText, dotText } = match.groups;
    if (raw === "") {
      return null;
    }

    tokens.push({
      raw,
      prefix,
      pitch: `${note.toLowerCase()}${accidental}`,
      lengthText,
      dotText,
    });
    rest = rest.slice(raw.length);
  }

  return tokens;
}

export function splitBassRootChordSegment(chordSegment: string): SplitMmlByTrack {
  if (!/^'[^']*'$/.test(chordSegment)) {
    return { chordMml: chordSegment, bassMml: "" };
  }

  const body = chordSegment.slice(1, -1);
  const tokens = parseChordSegmentBody(body);
  if (tokens === null || !isBassRootPattern(tokens)) {
    return { chordMml: chordSegment, bassMml: "" };
  }

  if (tokens[0].prefix === "") {
    const chordRootWithLength = `${tokens[1].prefix}${tokens[1].pitch}${tokens[0].lengthText}${tokens[0].dotText}`;
    const remainingNotes = tokens.slice(2).map((token) => token.raw).join("");
    return {
      chordMml: `'${chordRootWithLength}${remainingNotes}'`,
      bassMml: `'${tokens[0].raw}'`,
    };
  }

  const chordRootPrefix = normalizeOctavePrefix(`${tokens[0].prefix}${tokens[1].prefix}`);
  const chordRootWithLength = `${chordRootPrefix}${tokens[1].pitch}${tokens[0].lengthText}${tokens[0].dotText}`;
  const remainingNotes = tokens.slice(2).map((token) => token.raw).join("");

  return {
    chordMml: `'${chordRootWithLength}${remainingNotes}'`,
    bassMml: `'${tokens[0].raw}'`,
  };
}

export function splitBassRootMmlByTrack(mml: string): SplitMmlByTrack {
  const chordSegments = splitSanitizedMmlIntoChordSegments(mml);
  if (mml.trim() !== "" && chordSegments.length === 0) {
    return { chordMml: mml, bassMml: "" };
  }

  const splitSegments = chordSegments.map(splitBassRootChordSegment);
  return {
    chordMml: splitSegments.map((segment) => segment.chordMml).join(""),
    bassMml: splitSegments
      .map((segment) => segment.bassMml)
      .filter((segment) => segment !== "")
      .join(""),
  };
}

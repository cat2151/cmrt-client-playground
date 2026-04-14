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

function parseChordSegmentBody(body: string): ParsedNoteToken[] | null {
  const tokens: ParsedNoteToken[] = [];
  let rest = body;

  while (rest !== "") {
    // [<>]*: オクターブ移動、[a-gr][+#-]?: 音名、(\d*): 音長、(\.*): 付点
    const match = rest.match(/^([<>]*)([a-gr])([+#-]?)(\d*)(\.*)/i);
    if (match === null) {
      return null;
    }

    const [raw, prefix, note, accidental, lengthText, dotText] = match;
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
  if (
    tokens === null ||
    tokens.length < 2 ||
    !tokens[0].prefix.includes(">") ||
    tokens[0].lengthText === "" ||
    tokens[1].lengthText !== "" ||
    tokens[1].dotText !== "" ||
    tokens[0].pitch !== tokens[1].pitch
  ) {
    return { chordMml: chordSegment, bassMml: "" };
  }

  return {
    chordMml: `'${tokens[1].pitch}${tokens[0].lengthText}${tokens[0].dotText}${tokens
      .slice(2)
      .map((token) => token.raw)
      .join("")}'`,
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

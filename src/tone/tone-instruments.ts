export interface ToneInstrument {
  name: string;
  mml: string;
}

export type ToneInstrumentMarkdownParseResult =
  | { ok: true; instruments: ToneInstrument[] }
  | { ok: false; message: string };

export const DEFAULT_TONE_INSTRUMENT_VOLUME = "v10";

const TONE_INSTRUMENT_VOLUME_PATTERN = /^v(?:[1-9]|1[0-5])$/;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function trimBlankLines(value: string): string {
  const lines = normalizeLineEndings(value).split("\n");
  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.join("\n");
}

export function isToneInstrumentVolume(value: string): boolean {
  return TONE_INSTRUMENT_VOLUME_PATTERN.test(value);
}

export function normalizeToneInstrumentVolume(value: string | null): string {
  if (value !== null && isToneInstrumentVolume(value)) {
    return value;
  }

  return DEFAULT_TONE_INSTRUMENT_VOLUME;
}

export function formatToneInstrumentMmlWithVolume(
  instrumentMml: string,
  volume: string
): string {
  const mml = trimBlankLines(instrumentMml);
  const normalizedVolume = normalizeToneInstrumentVolume(volume);
  return mml === "" ? normalizedVolume : `${mml}\n${normalizedVolume}`;
}

export function parseToneInstrumentMarkdown(
  markdown: string
): ToneInstrumentMarkdownParseResult {
  const lines = normalizeLineEndings(markdown).split("\n");
  const instruments: ToneInstrument[] = [];
  const seenNames = new Set<string>();
  let pendingName: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(lines[index]);
    if (headingMatch !== null) {
      pendingName = headingMatch[1].trim();
      continue;
    }

    if (pendingName === null || lines[index].trim() !== "```tonejs-mml") {
      continue;
    }

    const blockLines: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "```") {
      blockLines.push(lines[index]);
      index += 1;
    }

    if (index >= lines.length) {
      return {
        ok: false,
        message: `${pendingName} の tonejs-mml code fence が閉じられていません`,
      };
    }

    const mml = trimBlankLines(blockLines.join("\n"));
    if (pendingName !== "" && mml !== "" && !seenNames.has(pendingName)) {
      seenNames.add(pendingName);
      instruments.push({ name: pendingName, mml });
    }
    pendingName = null;
  }

  return { ok: true, instruments };
}

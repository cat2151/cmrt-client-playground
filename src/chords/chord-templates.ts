export interface ChordTemplate {
  degrees: string;
  description: string;
}

const ROMAN_DEGREE_TO_NUMBER = new Map([
  ["I", "1"],
  ["II", "2"],
  ["III", "3"],
  ["IV", "4"],
  ["V", "5"],
  ["VI", "6"],
  ["VII", "7"],
]);

const NUMBER_TO_ROMAN_DEGREE = new Map(
  [...ROMAN_DEGREE_TO_NUMBER.entries()].map(([roman, number]) => [number, roman])
);

const ROMAN_DEGREE_PATTERN = /^(b|#)?(VII|III|VI|IV|II|V|I)(.*)$/;
const NUMBER_DEGREE_PATTERN = /^(b|#)?([1-7])(.*)$/;
const CHORD_DEGREE_SUFFIX_PATTERN =
  /^(?:$|m|M|maj|min|7|6|9|13|sus|add|aug|dim|\()/;

export type ChordTemplatesParseResult =
  | { ok: true; templates: ChordTemplate[] }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChordTemplates(raw: unknown): ChordTemplatesParseResult {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "JSON の最上位が array ではありません" };
  }

  const templates: ChordTemplate[] = [];
  const seenDegrees = new Set<string>();
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item)) {
      return { ok: false, message: `${index + 1} 件目が object ではありません` };
    }
    if (typeof item.degrees !== "string") {
      return { ok: false, message: `${index + 1} 件目の degrees が文字列ではありません` };
    }
    if (typeof item.description !== "string") {
      return {
        ok: false,
        message: `${index + 1} 件目の description が文字列ではありません`,
      };
    }

    const degrees = item.degrees.trim();
    if (degrees === "" || seenDegrees.has(degrees)) {
      continue;
    }

    seenDegrees.add(degrees);
    templates.push({
      degrees,
      description: item.description.trim(),
    });
  }

  return { ok: true, templates };
}

export function formatChordTemplateOptionLabel(template: ChordTemplate): string {
  if (template.description === "") {
    return template.degrees;
  }

  return `${template.degrees}: ${template.description}`;
}

export function formatChordTemplateInput(degrees: string, key: string): string {
  return `Key=${key} Bass is root. ${degrees}`;
}

function normalizeAccidental(value: string): string {
  return value.replace(/♭/g, "b").replace(/♯/g, "#");
}

function isChordDegreeSuffix(suffix: string): boolean {
  return CHORD_DEGREE_SUFFIX_PATTERN.test(suffix);
}

function extractChordDegreeToken(rawToken: string): string[] {
  const token = normalizeAccidental(rawToken.trim());
  if (/^[1-7]+$/.test(token)) {
    return [...token];
  }

  const numberMatch = NUMBER_DEGREE_PATTERN.exec(token);
  if (numberMatch !== null && isChordDegreeSuffix(numberMatch[3] ?? "")) {
    return [`${numberMatch[1] ?? ""}${numberMatch[2]}`];
  }

  const romanMatch = ROMAN_DEGREE_PATTERN.exec(token);
  if (romanMatch !== null && isChordDegreeSuffix(romanMatch[3] ?? "")) {
    const number = ROMAN_DEGREE_TO_NUMBER.get(romanMatch[2]);
    if (number !== undefined) {
      return [`${romanMatch[1] ?? ""}${number}`];
    }
  }

  return [];
}

export function getChordDegreeSearchTokens(value: string): string[] {
  return normalizeAccidental(value)
    .split(/[\s\-_,|/:.]+/)
    .flatMap(extractChordDegreeToken);
}

export function formatChordDegreeNumberSearchLabel(tokens: readonly string[]): string {
  return tokens.join("-");
}

export function formatChordDegreeRomanSearchLabel(tokens: readonly string[]): string {
  return tokens
    .map((token) => {
      const match = /^(b|#)?([1-7])$/.exec(token);
      if (match === null) {
        return token;
      }

      return `${match[1] ?? ""}${NUMBER_TO_ROMAN_DEGREE.get(match[2]) ?? match[2]}`;
    })
    .join("-");
}

export function chordDegreeSequenceContains(
  candidateTokens: readonly string[],
  searchTokens: readonly string[]
): boolean {
  if (searchTokens.length === 0) {
    return true;
  }
  if (searchTokens.length > candidateTokens.length) {
    return false;
  }

  for (let index = 0; index <= candidateTokens.length - searchTokens.length; index += 1) {
    const matches = searchTokens.every(
      (token, tokenIndex) => candidateTokens[index + tokenIndex] === token
    );
    if (matches) {
      return true;
    }
  }

  return false;
}

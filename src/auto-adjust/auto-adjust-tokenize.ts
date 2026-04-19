export interface ChordToken {
  start: number;
  end: number;
  text: string;
  baseText: string;
}

const KEY_DIRECTIVE_PATTERN = /^Key=[A-G](?:#|b)?/;
const BASS_IS_ROOT_PATTERN = /^bass is root\.?/i;
const ROMAN_ROOT_PATTERN = /^(?:#{1,2}|b{1,2})?(?:VII|III|II|IV|VI|V|I|vii|iii|ii|iv|vi|v|i)/;
const NOTE_ROOT_PATTERN = /^[A-G](?:#|b)?/;
const CHORD_SEPARATOR_PATTERN = /[\s\-・→]/;

function isBoundaryCharacter(character: string | undefined): boolean {
  return character === undefined || /\s|[-([{,;:]/.test(character);
}

export function extractAnalysisPreamble(input: string): string {
  const parts: string[] = [];
  const keyMatch = input.match(/\bKey=[A-G](?:#|b)?/);
  if (keyMatch !== null) {
    parts.push(keyMatch[0]);
  }
  const bassIsRootMatch = input.match(/\bbass is root\.?/i);
  if (bassIsRootMatch !== null) {
    parts.push(bassIsRootMatch[0]);
  }
  return parts.join(" ");
}

function getRootMatch(input: string, start: number): RegExpMatchArray | null {
  const rest = input.slice(start);
  return rest.match(ROMAN_ROOT_PATTERN) ?? rest.match(NOTE_ROOT_PATTERN);
}

function stripLocalAdjustments(symbol: string): string {
  let base = symbol.trim();
  base = base.replace(/[',]*\/[',]*$/g, "");
  base = base.replace(/\^\d+/g, "");
  base = base.replace(/[',]/g, "");
  return base;
}

export function tokenizeAdjustableChords(input: string): ChordToken[] {
  const tokens: ChordToken[] = [];
  let index = 0;

  while (index < input.length) {
    const remaining = input.slice(index);
    const keyMatch = remaining.match(KEY_DIRECTIVE_PATTERN);
    if (isBoundaryCharacter(input[index - 1]) && keyMatch !== null) {
      index += keyMatch[0].length;
      continue;
    }

    const bassIsRootMatch = remaining.match(BASS_IS_ROOT_PATTERN);
    if (isBoundaryCharacter(input[index - 1]) && bassIsRootMatch !== null) {
      index += bassIsRootMatch[0].length;
      continue;
    }

    if (!isBoundaryCharacter(input[index - 1])) {
      index += 1;
      continue;
    }

    const rootMatch = getRootMatch(input, index);
    if (rootMatch === null) {
      index += 1;
      continue;
    }

    let end = index + rootMatch[0].length;
    while (end < input.length && !CHORD_SEPARATOR_PATTERN.test(input[end])) {
      end += 1;
    }

    const text = input.slice(index, end);
    const baseText = stripLocalAdjustments(text);
    if (baseText !== "" && !baseText.includes("/")) {
      tokens.push({
        start: index,
        end,
        text,
        baseText,
      });
    }
    index = end;
  }

  return tokens;
}

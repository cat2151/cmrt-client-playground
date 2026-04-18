export type ChordProgressionTokenKind =
  | "roman"
  | "suffix"
  | "annotation"
  | "key-prefix"
  | "key-root"
  | "separator";

export interface ChordProgressionToken {
  text: string;
  kind: ChordProgressionTokenKind;
}

export interface ChordProgressionEditor {
  value: string;
  focus(): void;
  addEventListener(
    type: "input",
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
}

const KEY_ROOT_PATTERN = /^[A-G](?:#|b)?/;
const ROMAN_PATTERN = /^(?:#{1,2}|b{1,2})?(?:VII|III|II|IV|VI|V|I)/;
const BASS_IS_ROOT_PATTERN = /^bass is root\.?/i;
const INVERSION_PATTERN = /^\^\d+/;
const OCTAVE_PATTERN = /^[',]+/;

function isBoundaryCharacter(character: string | undefined): boolean {
  return character === undefined || /\s|[-([{,;:]/.test(character);
}

function tokenizeChordSymbol(input: string, startIndex: number): ChordProgressionToken[] | null {
  if (!isBoundaryCharacter(input[startIndex - 1])) {
    return null;
  }

  const initialMatch = input.slice(startIndex).match(ROMAN_PATTERN);
  if (initialMatch === null) {
    return null;
  }

  const tokens: ChordProgressionToken[] = [
    {
      text: initialMatch[0],
      kind: "roman",
    },
  ];
  let index = startIndex + initialMatch[0].length;

  while (index < input.length) {
    const remaining = input.slice(index);
    if (remaining.startsWith("-") || /^\s/.test(remaining)) {
      break;
    }

    const inversionMatch = remaining.match(INVERSION_PATTERN);
    if (inversionMatch !== null) {
      tokens.push({
        text: inversionMatch[0],
        kind: "annotation",
      });
      index += inversionMatch[0].length;
      continue;
    }

    const octaveMatch = remaining.match(OCTAVE_PATTERN);
    if (octaveMatch !== null) {
      tokens.push({
        text: octaveMatch[0],
        kind: "annotation",
      });
      index += octaveMatch[0].length;
      continue;
    }

    let suffixEnd = index;
    while (suffixEnd < input.length) {
      const character = input[suffixEnd];
      if (
        character === "-" ||
        /\s/.test(character) ||
        character === "^" ||
        character === "'" ||
        character === ","
      ) {
        break;
      }
      suffixEnd += 1;
    }

    if (suffixEnd === index) {
      break;
    }

    tokens.push({
      text: input.slice(index, suffixEnd),
      kind: "suffix",
    });
    index = suffixEnd;
  }

  return tokens;
}

export function tokenizeChordProgression(input: string): ChordProgressionToken[] {
  const tokens: ChordProgressionToken[] = [];
  let index = 0;

  while (index < input.length) {
    const remaining = input.slice(index);

    if (isBoundaryCharacter(input[index - 1]) && remaining.startsWith("Key=")) {
      const keyRootMatch = remaining.slice("Key=".length).match(KEY_ROOT_PATTERN);
      tokens.push({
        text: "Key=",
        kind: "key-prefix",
      });
      index += "Key=".length;
      if (keyRootMatch !== null) {
        tokens.push({
          text: keyRootMatch[0],
          kind: "key-root",
        });
        index += keyRootMatch[0].length;
      }
      continue;
    }

    if (isBoundaryCharacter(input[index - 1])) {
      const bassIsRootMatch = remaining.match(BASS_IS_ROOT_PATTERN);
      if (bassIsRootMatch !== null) {
        tokens.push({
          text: bassIsRootMatch[0],
          kind: "annotation",
        });
        index += bassIsRootMatch[0].length;
        continue;
      }
    }

    if (remaining.startsWith("-")) {
      tokens.push({
        text: "-",
        kind: "separator",
      });
      index += 1;
      continue;
    }

    const chordTokens = tokenizeChordSymbol(input, index);
    if (chordTokens !== null) {
      tokens.push(...chordTokens);
      index += chordTokens.reduce((total, token) => total + token.text.length, 0);
      continue;
    }

    tokens.push({
      text: input[index],
      kind: "annotation",
    });
    index += 1;
  }

  return tokens;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function getTokenColor(kind: ChordProgressionTokenKind): string {
  switch (kind) {
    case "roman":
      return "#f8f8f2";
    case "suffix":
      return "#fd971f";
    case "key-root":
      return "#e6db74";
    case "key-prefix":
    case "annotation":
    case "separator":
      return "#a59f85";
    default:
      return "#a59f85";
  }
}

function appendToken(fragment: DocumentFragment, token: ChordProgressionToken): void {
  const parts = token.text.split("\n");
  parts.forEach((part, index) => {
    if (part !== "") {
      const span = document.createElement("span");
      span.className = "chord-input-editor__token";
      span.style.color = getTokenColor(token.kind);
      span.textContent = part;
      fragment.append(span);
    }
    if (index < parts.length - 1) {
      fragment.append(document.createElement("br"));
    }
  });
}

function renderChordProgression(element: HTMLElement, value: string): void {
  element.replaceChildren();
  if (value === "") {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const token of tokenizeChordProgression(value)) {
    appendToken(fragment, token);
  }
  element.append(fragment);
}

function readEditorValue(element: HTMLElement): string {
  return normalizeLineEndings(element.innerText);
}

function moveCaretToEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (selection === null) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function createChordProgressionEditor(options: {
  element: HTMLElement;
}): ChordProgressionEditor {
  const { element } = options;
  let currentValue = normalizeLineEndings(element.innerText);

  renderChordProgression(element, currentValue);

  element.addEventListener("input", () => {
    currentValue = readEditorValue(element);
    renderChordProgression(element, currentValue);
    element.focus();
    moveCaretToEnd(element);
  });

  return {
    get value(): string {
      return currentValue;
    },
    set value(nextValue: string) {
      currentValue = normalizeLineEndings(nextValue);
      renderChordProgression(element, currentValue);
    },
    focus(): void {
      element.focus();
      moveCaretToEnd(element);
    },
    addEventListener(
      type: "input",
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions
    ): void {
      element.addEventListener(type, listener, options);
    },
  };
}

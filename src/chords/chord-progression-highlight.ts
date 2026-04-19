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
      return "#ffb454";
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

function getTokenClassName(kind: ChordProgressionTokenKind): string {
  return `chord-input-editor__token chord-input-editor__token--${kind}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderChordProgressionHtml(value: string): string {
  if (value === "") {
    return "";
  }

  const rendered = tokenizeChordProgression(value)
    .map(
      (token) =>
        `<span class="${getTokenClassName(token.kind)}" style="color:${getTokenColor(token.kind)}">${escapeHtml(token.text)}</span>`
    )
    .join("");
  return value.endsWith("\n") ? `${rendered}&#8203;` : rendered;
}

function renderChordProgression(element: HTMLElement, value: string): void {
  element.innerHTML = renderChordProgressionHtml(value);
}

export function createChordProgressionEditor(options: {
  element: HTMLElement;
}): ChordProgressionEditor {
  const { element } = options;
  const overlayNode = element.querySelector(".chord-input-editor__overlay");
  const textareaNode = element.querySelector(".chord-input-editor__textarea");
  if (!(overlayNode instanceof HTMLDivElement) || !(textareaNode instanceof HTMLTextAreaElement)) {
    throw new Error("chord progression editor requires overlay and textarea elements");
  }
  const overlayEl: HTMLDivElement = overlayNode;
  const textareaEl: HTMLTextAreaElement = textareaNode;

  function syncOverlayScroll(): void {
    overlayEl.scrollTop = textareaEl.scrollTop;
    overlayEl.scrollLeft = textareaEl.scrollLeft;
  }

  let currentValue = normalizeLineEndings(textareaEl.value);

  function renderCurrentValue(): void {
    renderChordProgression(overlayEl, currentValue);
    syncOverlayScroll();
  }

  renderCurrentValue();

  textareaEl.addEventListener("input", () => {
    currentValue = normalizeLineEndings(textareaEl.value);
    renderCurrentValue();
  });
  textareaEl.addEventListener("scroll", syncOverlayScroll, { passive: true });

  return {
    get value(): string {
      return currentValue;
    },
    set value(nextValue: string) {
      currentValue = normalizeLineEndings(nextValue);
      textareaEl.value = currentValue;
      renderCurrentValue();
    },
    focus(): void {
      textareaEl.focus();
    },
    addEventListener(
      type: "input",
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions
    ): void {
      textareaEl.addEventListener(type, listener, options);
    },
  };
}

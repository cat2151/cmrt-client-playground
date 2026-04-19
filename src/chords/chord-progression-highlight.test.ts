import { describe, expect, it } from "vitest";
import {
  renderChordProgressionHtml,
  tokenizeChordProgression,
} from "./chord-progression-highlight.ts";

describe("tokenizeChordProgression", () => {
  it("tokenizes key, annotation, roman numerals, suffixes, inversions, octaves, and separators", () => {
    expect(tokenizeChordProgression("Key=C Bass is root. IM7^2'-bVIIM7^2-IV-I^1'")).toEqual([
      { text: "Key=", kind: "key-prefix" },
      { text: "C", kind: "key-root" },
      { text: " ", kind: "annotation" },
      { text: "Bass is root.", kind: "annotation" },
      { text: " ", kind: "annotation" },
      { text: "I", kind: "roman" },
      { text: "M7", kind: "suffix" },
      { text: "^2", kind: "annotation" },
      { text: "'", kind: "annotation" },
      { text: "-", kind: "separator" },
      { text: "bVII", kind: "roman" },
      { text: "M7", kind: "suffix" },
      { text: "^2", kind: "annotation" },
      { text: "-", kind: "separator" },
      { text: "IV", kind: "roman" },
      { text: "-", kind: "separator" },
      { text: "I", kind: "roman" },
      { text: "^1", kind: "annotation" },
      { text: "'", kind: "annotation" },
    ]);
  });

  it("treats bass is root case-insensitively and with an optional trailing period", () => {
    expect(tokenizeChordProgression("bass is root")).toEqual([
      { text: "bass is root", kind: "annotation" },
    ]);
    expect(tokenizeChordProgression("BaSs Is RoOt.")).toEqual([
      { text: "BaSs Is RoOt.", kind: "annotation" },
    ]);
  });

  it("supports octave and inversion markers in either order", () => {
    expect(tokenizeChordProgression("I',^2m7-I^2',m7")).toEqual([
      { text: "I", kind: "roman" },
      { text: "',", kind: "annotation" },
      { text: "^2", kind: "annotation" },
      { text: "m7", kind: "suffix" },
      { text: "-", kind: "separator" },
      { text: "I", kind: "roman" },
      { text: "^2", kind: "annotation" },
      { text: "',", kind: "annotation" },
      { text: "m7", kind: "suffix" },
    ]);
  });

  it("treats suffix text after roman numerals as orange-highlighted suffixes", () => {
    expect(tokenizeChordProgression("#IVsus4add9-bVIIalt(#11)")).toEqual([
      { text: "#IV", kind: "roman" },
      { text: "sus4add9", kind: "suffix" },
      { text: "-", kind: "separator" },
      { text: "bVII", kind: "roman" },
      { text: "alt(#11)", kind: "suffix" },
    ]);
  });

  it("leaves unrelated text as annotation text instead of forcing chord parsing", () => {
    expect(tokenizeChordProgression("This is not a chord")).toEqual([
      { text: "T", kind: "annotation" },
      { text: "h", kind: "annotation" },
      { text: "i", kind: "annotation" },
      { text: "s", kind: "annotation" },
      { text: " ", kind: "annotation" },
      { text: "i", kind: "annotation" },
      { text: "s", kind: "annotation" },
      { text: " ", kind: "annotation" },
      { text: "n", kind: "annotation" },
      { text: "o", kind: "annotation" },
      { text: "t", kind: "annotation" },
      { text: " ", kind: "annotation" },
      { text: "a", kind: "annotation" },
      { text: " ", kind: "annotation" },
      { text: "c", kind: "annotation" },
      { text: "h", kind: "annotation" },
      { text: "o", kind: "annotation" },
      { text: "r", kind: "annotation" },
      { text: "d", kind: "annotation" },
    ]);
  });
});

describe("renderChordProgressionHtml", () => {
  it("renders highlighted token spans for overlay display", () => {
    expect(renderChordProgressionHtml("Key=C\nIM7-bVII")).toBe(
      '<span class="chord-input-editor__token chord-input-editor__token--key-prefix" style="color:#a59f85">Key=</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--key-root" style="color:#e6db74">C</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--annotation" style="color:#a59f85">\n</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--roman" style="color:#f8f8f2">I</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--suffix" style="color:#ffb454">M7</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--separator" style="color:#a59f85">-</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--roman" style="color:#f8f8f2">bVII</span>'
    );
  });

  it("escapes html and preserves a trailing newline for the overlay", () => {
    expect(renderChordProgressionHtml("I<sus>\n")).toBe(
      '<span class="chord-input-editor__token chord-input-editor__token--roman" style="color:#f8f8f2">I</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--suffix" style="color:#ffb454">&lt;sus&gt;</span>' +
        '<span class="chord-input-editor__token chord-input-editor__token--annotation" style="color:#a59f85">\n</span>&#8203;'
    );
  });
});

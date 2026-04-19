import { describe, expect, it } from "vitest";
import {
  addToneInstrumentMmlHistoryEntry,
  parseToneInstrumentMmlHistoryStorage,
  serializeToneInstrumentMmlHistory,
} from "./tone-instrument-history.ts";
import {
  formatToneInstrumentMmlWithVolume,
  normalizeToneInstrumentVolume,
  parseToneInstrumentMarkdown,
} from "./tone-instruments.ts";

describe("tone instrument markdown", () => {
  it("parses tonejs-mml fenced blocks under level 2 headings", () => {
    const parsed = parseToneInstrumentMarkdown(`
# ignored title

## FM harmonicity 1 modulation 20

\`\`\`tonejs-mml
@FMSynth{
  "harmonicity": 1
}
\`\`\`

## DuoSynth
\`\`\`tonejs-mml
@DuoSynth
\`\`\`
`);

    expect(parsed).toEqual({
      ok: true,
      instruments: [
        {
          name: "FM harmonicity 1 modulation 20",
          mml: '@FMSynth{\n  "harmonicity": 1\n}',
        },
        {
          name: "DuoSynth",
          mml: "@DuoSynth",
        },
      ],
    });
  });

  it("reports an unclosed tonejs-mml fence", () => {
    expect(
      parseToneInstrumentMarkdown(`
## Broken
\`\`\`tonejs-mml
@Synth
`)
    ).toEqual({
      ok: false,
      message: "Broken の tonejs-mml code fence が閉じられていません",
    });
  });

  it("formats selected instrument MML with a v1-v15 volume", () => {
    expect(formatToneInstrumentMmlWithVolume("@DuoSynth\n", "v12")).toBe(
      "@DuoSynth\nv12"
    );
    expect(formatToneInstrumentMmlWithVolume("@DuoSynth", "v99")).toBe(
      "@DuoSynth\nv10"
    );
    expect(normalizeToneInstrumentVolume("v15")).toBe("v15");
    expect(normalizeToneInstrumentVolume("v16")).toBe("v10");
  });
});

describe("tone instrument MML history", () => {
  it("normalizes, serializes, and parses history entries", () => {
    const history = addToneInstrumentMmlHistoryEntry(
      [" @Synth  ", "@DuoSynth"],
      "@Synth"
    );

    expect(history).toEqual(["@Synth", "@DuoSynth"]);
    expect(parseToneInstrumentMmlHistoryStorage(serializeToneInstrumentMmlHistory(history))).toEqual(
      {
        ok: true,
        history: ["@Synth", "@DuoSynth"],
      }
    );
  });

  it("rejects invalid history storage", () => {
    expect(parseToneInstrumentMmlHistoryStorage(JSON.stringify([1]))).toEqual({
      ok: false,
      message: "1 件目が文字列ではありません",
    });
  });
});

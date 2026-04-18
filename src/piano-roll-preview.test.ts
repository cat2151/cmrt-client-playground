import { describe, expect, it, vi } from "vitest";
import {
  buildPianoRollPreview,
  planPianoRollPreviewMeasureTracks,
} from "./piano-roll-preview.ts";
import { createMmlabcToSmfConverter, type SmfConverter } from "./smf-export.ts";

describe("buildPianoRollPreview", () => {
  it("plans preview conversion per measure and per track", () => {
    expect(planPianoRollPreviewMeasureTracks("'>f1<fa<c''>g1<gb<d'")).toEqual([
      {
        measure: 0,
        mml: "'>f1<fa<c'",
        chordMml: "'f1a<c'",
        bassMml: "'>f1'",
        tickOffsetInQuarterNotes: 0,
      },
      {
        measure: 1,
        mml: "'>g1<gb<d'",
        chordMml: "'g1b<d'",
        bassMml: "'>g1'",
        tickOffsetInQuarterNotes: 4,
      },
    ]);
  });

  it("does not invoke the converter for empty input", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    await expect(buildPianoRollPreview("   ", converter)).resolves.toEqual({
      ok: false,
      reason: "empty-input",
    });
    expect(converter.convertMmlToSmf).not.toHaveBeenCalled();
  });

  it("does not invoke the converter for unrecognized chords", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    await expect(buildPianoRollPreview("ZZZZZ", converter)).resolves.toEqual({
      ok: false,
      reason: "unrecognized-chord",
    });
    expect(converter.convertMmlToSmf).not.toHaveBeenCalled();
  });

  it("converts each measure independently for IV V", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array([0x4d, 0x54, 0x68, 0x64])),
    };

    await expect(buildPianoRollPreview("IV V", converter)).rejects.toThrow();
    expect(converter.convertMmlToSmf).toHaveBeenNthCalledWith(1, "'f1a<c'");
    expect(converter.convertMmlToSmf).toHaveBeenNthCalledWith(2, "'g1b<d'");
    expect(converter.convertMmlToSmf).toHaveBeenCalledTimes(2);
  });

  it("distinguishes F and F^1 through the actual preview route", async () => {
    const converter = createMmlabcToSmfConverter();
    const fPreview = await buildPianoRollPreview("F", converter);
    const fInversionPreview = await buildPianoRollPreview("F^1", converter);

    if (!fPreview.ok || !fInversionPreview.ok) {
      throw new Error(
        `expected both previews to succeed: ${JSON.stringify({ fPreview, fInversionPreview })}`
      );
    }

    expect(fPreview.summary).toBe("piano roll preview: mml='f1a<c' note numbers=[65, 69, 72]");
    expect(fInversionPreview.summary).toBe(
      "piano roll preview: mml='a1<cf' note numbers=[69, 72, 77]"
    );
  });

  it("keeps IV V measure voicings independent through the actual preview route", async () => {
    const converter = createMmlabcToSmfConverter();
    const preview = await buildPianoRollPreview("IV V", converter);

    if (!preview.ok) {
      throw new Error(`expected preview to succeed: ${JSON.stringify(preview)}`);
    }

    expect(preview.summary).toBe(
      "piano roll preview: mml='f1a<c''g1b<d' note numbers=[65, 69, 72, 67, 71, 74]"
    );
  });
});

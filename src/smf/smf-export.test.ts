import { describe, expect, it, vi } from "vitest";
import { formatPianoRollDebugSummary, parseSmfToPianoRollData } from "../piano-roll/smf-piano-roll.ts";
import { buildPianoRollPreview } from "../piano-roll/piano-roll-preview.ts";
import {
  convertChordProgressionToSmf,
  createMmlabcToSmfConverter,
  type SmfConverter,
} from "./smf-export.ts";

describe("convertChordProgressionToSmf", () => {
  it("returns SMF data from a recognized chord progression", async () => {
    let receivedMml = "";
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async (mml: string) => {
        receivedMml = mml;
        return new Uint8Array([0x4d, 0x54, 0x68, 0x64]);
      }),
    };

    const result = await convertChordProgressionToSmf("C", converter);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(receivedMml).toContain("c");
    expect(receivedMml).toContain("e");
    expect(receivedMml).toContain("g");
    expect(result.smfData).toEqual(new Uint8Array([0x4d, 0x54, 0x68, 0x64]));
    expect(converter.convertMmlToSmf).toHaveBeenCalledTimes(1);
  });

  it("does not invoke the converter for empty input", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    const result = await convertChordProgressionToSmf("  ", converter);

    expect(result).toEqual({ ok: false, message: "入力が空です" });
    expect(converter.convertMmlToSmf).not.toHaveBeenCalled();
  });

  it("returns a chord analysis message for unknown chords", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    const result = await convertChordProgressionToSmf("ZZZZZ", converter);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected conversion to fail");
    }
    expect(result.message).toBe('コードを認識できませんでした: "ZZZZZ"');
    expect(result.chordAnalysisMessage).toBe(result.message);
    expect(converter.convertMmlToSmf).not.toHaveBeenCalled();
  });

  it("wraps converter failures", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => {
        throw new Error("boom");
      }),
    };

    const result = await convertChordProgressionToSmf("C", converter);

    expect(result).toEqual({
      ok: false,
      message: "SMF変換に失敗しました: boom",
    });
  });

  it("produces different piano-roll summaries for F and F^1 with the real converter", async () => {
    const converter = createMmlabcToSmfConverter();
    const fResult = await convertChordProgressionToSmf("F", converter);
    const fInversionResult = await convertChordProgressionToSmf("F^1", converter);

    if (!fResult.ok || !fInversionResult.ok) {
      throw new Error(
        `expected both conversions to succeed: ${JSON.stringify({
          fResult,
          fInversionResult,
        })}`
      );
    }

    const fSummary = formatPianoRollDebugSummary({
      mml: fResult.mml,
      data: parseSmfToPianoRollData(fResult.smfData),
    });
    const fInversionSummary = formatPianoRollDebugSummary({
      mml: fInversionResult.mml,
      data: parseSmfToPianoRollData(fInversionResult.smfData),
    });

    expect(fSummary).toBe(
      "preview 最終出力 note number列: MML=\"v11'f1a<c'\" note number列=[65, 69, 72]"
    );
    expect(fInversionSummary).toBe(
      "preview 最終出力 note number列: MML=\"v11'a1<cf'\" note number列=[69, 72, 77]"
    );
  });

  it("matches the preview-route summaries for F and F^1", async () => {
    const converter = createMmlabcToSmfConverter();
    const fPreview = await buildPianoRollPreview("F", converter);
    const fInversionPreview = await buildPianoRollPreview("F^1", converter);

    if (!fPreview.ok || !fInversionPreview.ok) {
      throw new Error(
        `expected both previews to succeed: ${JSON.stringify({ fPreview, fInversionPreview })}`
      );
    }

    expect(fPreview.summary).toBe(
      "preview 最終出力 note number列: MML=\"'f1a<c'\" note number列=[65, 69, 72]"
    );
    expect(fInversionPreview.summary).toBe(
      "preview 最終出力 note number列: MML=\"'a1<cf'\" note number列=[69, 72, 77]"
    );
  });
});

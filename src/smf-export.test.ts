import { describe, expect, it, vi } from "vitest";
import { convertChordProgressionToSmf, type SmfConverter } from "./smf-export.ts";

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
});

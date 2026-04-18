import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPianoRollPreview } from "./piano-roll-preview.ts";
import { convertChordProgressionToSmf, type SmfConverter } from "./smf-export.ts";
import { sendMml, type SendMmlClient } from "./send-mml.ts";

const { chordToMmlMock } = vi.hoisted(() => ({
  chordToMmlMock: vi.fn<(input: string) => string | null>(),
}));

vi.mock("./chord-to-mml.ts", () => ({
  chordToMml: chordToMmlMock,
}));

describe("input forwarding to chordToMml", () => {
  beforeEach(() => {
    chordToMmlMock.mockReset();
    chordToMmlMock.mockReturnValue(null);
  });

  it("passes textarea single quotes through sendMml unchanged", async () => {
    const client: SendMmlClient = {
      getBaseUrl: () => "http://127.0.0.1:62151",
      postMml: async () => {
        throw new Error("postMml should not be called after chord analysis failure");
      },
    };

    await sendMml({
      input: "IV ' V",
      chordTrack: 2,
      chordMeasure: 5,
      bassTrackValue: "9",
      client,
      appendLog: () => undefined,
      reflectValue: () => {
        throw new Error("reflectValue should not be called after chord analysis failure");
      },
    });

    expect(chordToMmlMock).toHaveBeenCalledWith("IV ' V");
    expect(chordToMmlMock).toHaveBeenCalledTimes(1);
  });

  it("passes textarea single quotes through the preview route unchanged", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    await expect(buildPianoRollPreview("IV ' V", converter)).resolves.toEqual({
      ok: false,
      reason: "unrecognized-chord",
    });

    expect(chordToMmlMock).toHaveBeenCalledWith("IV ' V");
    expect(chordToMmlMock).toHaveBeenCalledTimes(1);
  });

  it("passes textarea single quotes through the SMF export route unchanged", async () => {
    const converter: SmfConverter = {
      convertMmlToSmf: vi.fn(async () => new Uint8Array()),
    };

    await expect(convertChordProgressionToSmf("IV ' V", converter)).resolves.toEqual({
      ok: false,
      message: 'コードを認識できませんでした: "IV \' V"',
      chordAnalysisMessage: 'コードを認識できませんでした: "IV \' V"',
    });

    expect(chordToMmlMock).toHaveBeenCalledWith("IV ' V");
    expect(chordToMmlMock).toHaveBeenCalledTimes(1);
  });
});

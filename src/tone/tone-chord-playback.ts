import {
  SequencerNodes,
  playSequence,
  type SequenceEvent,
} from "tonejs-json-sequencer";
import {
  applyToneMmlVolumeToSequence,
  extractToneMmlVolume,
  stripToneMmlVolumeTokens,
} from "./tone-mml-volume.ts";

const nodes = new SequencerNodes();
const TONEJS_MML_TO_JSON_ASSET_ROOT = "vendor/tonejs-mml-to-json";
let initializePromise: Promise<void> | null = null;
let tonePromise: Promise<typeof import("tone")> | null = null;
let toneModule: typeof import("tone") | null = null;
let tonejsMmlToJsonPromise: Promise<{
  initWasm(): Promise<void>;
  mml2json(mml: string): SequenceEvent[];
}> | null = null;

function getAssetBaseUri(): string {
  const runtimeDocument = (globalThis as { document?: { baseURI?: string } }).document;
  if (runtimeDocument?.baseURI !== undefined) {
    return runtimeDocument.baseURI;
  }

  throw new Error("Tone.js MML asset base URI could not be resolved");
}

function resolveToneMmlAssetHref(path: string): string {
  return new URL(`${TONEJS_MML_TO_JSON_ASSET_ROOT}/${path}`, getAssetBaseUri()).href;
}

async function loadToneModule(): Promise<typeof import("tone")> {
  if (tonePromise === null) {
    tonePromise = import("tone").then((module) => {
      toneModule = module;
      return module;
    });
  }

  return tonePromise;
}

async function loadTonejsMmlToJsonModule(): Promise<{
  initWasm(): Promise<void>;
  mml2json(mml: string): SequenceEvent[];
}> {
  if (tonejsMmlToJsonPromise === null) {
    tonejsMmlToJsonPromise = import(
      /* @vite-ignore */ resolveToneMmlAssetHref("dist/index.js")
    ).then((module) => ({
      initWasm: module.initWasm,
      mml2json: module.mml2json as (mml: string) => SequenceEvent[],
    }));
  }

  return tonejsMmlToJsonPromise;
}

function resolveToneTimeSeconds(
  Tone: typeof import("tone"),
  value: string | number | undefined
): number {
  if (value === undefined) {
    return 0;
  }

  return Tone.Time(value).toSeconds();
}

export function estimateToneSequenceDurationSeconds(
  Tone: typeof import("tone"),
  sequence: readonly SequenceEvent[]
): number {
  let endSeconds = 0;
  for (const event of sequence) {
    if (event.eventType !== "triggerAttackRelease") {
      continue;
    }

    const [, duration, startTime] = event.args;
    endSeconds = Math.max(
      endSeconds,
      resolveToneTimeSeconds(Tone, startTime) + resolveToneTimeSeconds(Tone, duration)
    );
  }

  return endSeconds;
}

export function stopToneChordPlayback(): void {
  toneModule?.Transport.stop();
  toneModule?.Transport.cancel();
  nodes.disposeAll();
}

export async function initializeToneChordPlayback(): Promise<void> {
  if (initializePromise === null) {
    initializePromise = loadTonejsMmlToJsonModule()
      .then((module) => module.initWasm())
      .catch((error: unknown) => {
        initializePromise = null;
        throw error;
      });
  }

  await initializePromise;
}

export async function playToneChordMml(options: {
  mml: string;
  shouldContinue?: () => boolean;
}): Promise<number> {
  const [Tone, tonejsMmlToJson] = await Promise.all([
    loadToneModule(),
    loadTonejsMmlToJsonModule(),
  ]);
  await initializeToneChordPlayback();
  if (options.shouldContinue !== undefined && !options.shouldContinue()) {
    return 0;
  }

  await Tone.start();
  if (options.shouldContinue !== undefined && !options.shouldContinue()) {
    return 0;
  }

  const volume = extractToneMmlVolume(options.mml);
  const sequence = applyToneMmlVolumeToSequence(
    tonejsMmlToJson.mml2json(stripToneMmlVolumeTokens(options.mml)),
    volume
  );
  if (options.shouldContinue !== undefined && !options.shouldContinue()) {
    return 0;
  }

  await playSequence(Tone, nodes, sequence);
  if (options.shouldContinue !== undefined && !options.shouldContinue()) {
    stopToneChordPlayback();
    return 0;
  }

  Tone.Transport.start(undefined, 0);
  return estimateToneSequenceDurationSeconds(Tone, sequence);
}

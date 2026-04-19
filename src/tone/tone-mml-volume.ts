import type { SequenceEvent } from "tonejs-json-sequencer";

const TONE_MML_VOLUME_TOKEN_PATTERN =
  /(^|[^A-Za-z0-9_])v(1[0-5]|[1-9])(?=$|[^A-Za-z0-9_])/gi;

export function extractToneMmlVolume(mml: string): number | null {
  let volume: number | null = null;
  for (const match of mml.matchAll(TONE_MML_VOLUME_TOKEN_PATTERN)) {
    volume = Number.parseInt(match[2], 10);
  }
  return volume;
}

export function stripToneMmlVolumeTokens(mml: string): string {
  return mml.replace(TONE_MML_VOLUME_TOKEN_PATTERN, "$1");
}

export function toneMmlVolumeToVelocity(volume: number): number {
  return Math.min(1, Math.max(0, volume / 15));
}

export function applyToneMmlVolumeToSequence(
  sequence: readonly SequenceEvent[],
  volume: number | null
): SequenceEvent[] {
  if (volume === null) {
    return [...sequence];
  }

  const velocity = toneMmlVolumeToVelocity(volume);
  return sequence.map((event) => {
    if (event.eventType !== "triggerAttackRelease") {
      return event;
    }

    return {
      ...event,
      args: [...event.args.slice(0, 3), velocity] as unknown as typeof event.args,
    };
  });
}

import type { GetMmlsResponse } from "../daw/daw-client.ts";

/**
 * POST送信時と応答受信時の入力状態を比較し、stale な応答かどうかを判定するためのスナップショット。
 */
interface MeasureGridPostSyncSnapshot {
  sentValue: string;
  currentValue: string;
  sentEditVersion: number;
  currentEditVersion: number;
}

/**
 * 入力値が変化した、または edit version が進んだ場合は、送信中により新しい編集が入ったとみなす。
 */
export function isStaleMeasureGridPostSync(
  snapshot: MeasureGridPostSyncSnapshot
): boolean {
  return (
    snapshot.currentValue !== snapshot.sentValue ||
    snapshot.currentEditVersion !== snapshot.sentEditVersion
  );
}

export function getMmlsCellValue(
  snapshot: GetMmlsResponse["tracks"],
  track: number,
  measure: number
): string | null {
  if (!Number.isInteger(track) || track < 0 || !Number.isInteger(measure) || measure < 0) {
    return null;
  }

  const trackValues = snapshot[track];
  if (trackValues === undefined) {
    return null;
  }

  const value = trackValues[measure];
  return typeof value === "string" ? value : null;
}

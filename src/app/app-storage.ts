export const APP_STORAGE_EXPORT_VERSION = 1;

export interface AppStorageSnapshot {
  version: number;
  exportedAt: string;
  values: Record<string, string>;
}

export type AppStorageParseResult =
  | { ok: true; snapshot: AppStorageSnapshot }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringifyAppStorageSnapshot(
  values: Record<string, string>,
  exportedAt = new Date().toISOString()
): string {
  return JSON.stringify(
    {
      version: APP_STORAGE_EXPORT_VERSION,
      exportedAt,
      values,
    },
    null,
    2
  );
}

export function parseAppStorageSnapshot(
  raw: string,
  allowedKeys: readonly string[]
): AppStorageParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "JSON として読み取れませんでした" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, message: "JSON の最上位が object ではありません" };
  }
  if (parsed.version !== APP_STORAGE_EXPORT_VERSION) {
    return {
      ok: false,
      message: `version=${APP_STORAGE_EXPORT_VERSION} の JSON を指定してください`,
    };
  }
  if (typeof parsed.exportedAt !== "string") {
    return { ok: false, message: "exportedAt が文字列ではありません" };
  }
  if (!isRecord(parsed.values)) {
    return { ok: false, message: "values が object ではありません" };
  }

  const allowedKeySet = new Set(allowedKeys);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.values)) {
    if (!allowedKeySet.has(key)) {
      continue;
    }
    if (typeof value !== "string") {
      return {
        ok: false,
        message: `values.${key} が文字列ではありません`,
      };
    }
    values[key] = value;
  }

  return {
    ok: true,
    snapshot: {
      version: APP_STORAGE_EXPORT_VERSION,
      exportedAt: parsed.exportedAt,
      values,
    },
  };
}

export interface ChordTemplate {
  degrees: string;
  description: string;
}

export type ChordTemplatesParseResult =
  | { ok: true; templates: ChordTemplate[] }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChordTemplates(raw: unknown): ChordTemplatesParseResult {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "JSON の最上位が array ではありません" };
  }

  const templates: ChordTemplate[] = [];
  const seenDegrees = new Set<string>();
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item)) {
      return { ok: false, message: `${index + 1} 件目が object ではありません` };
    }
    if (typeof item.degrees !== "string") {
      return { ok: false, message: `${index + 1} 件目の degrees が文字列ではありません` };
    }
    if (typeof item.description !== "string") {
      return {
        ok: false,
        message: `${index + 1} 件目の description が文字列ではありません`,
      };
    }

    const degrees = item.degrees.trim();
    if (degrees === "" || seenDegrees.has(degrees)) {
      continue;
    }

    seenDegrees.add(degrees);
    templates.push({
      degrees,
      description: item.description.trim(),
    });
  }

  return { ok: true, templates };
}

export function formatChordTemplateOptionLabel(template: ChordTemplate): string {
  if (template.description === "") {
    return template.degrees;
  }

  return `${template.degrees}: ${template.description}`;
}

export function formatChordTemplateInput(degrees: string, key: string): string {
  return `Key=${key} Bass is root. ${degrees}`;
}

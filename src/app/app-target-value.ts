import { parseNonNegativeInteger } from "../daw/post-config.ts";

export function getTargetValue(
  element: HTMLInputElement,
  name: string,
  appendLog: (message: string) => void
): number | null {
  const parsed = parseNonNegativeInteger(element.value);
  if (parsed === null) {
    appendLog(`ERROR: ${name} には 0 以上の整数を指定してください`);
    return null;
  }

  return parsed;
}

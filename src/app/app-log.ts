import { formatLogTimestamp } from "../utils/log-timestamp.ts";

export function createAppendLog(logEl: HTMLDivElement): (message: string) => void {
  return (message: string): void => {
    const timestamp = formatLogTimestamp();
    logEl.textContent += `[${timestamp}] ${message}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  };
}

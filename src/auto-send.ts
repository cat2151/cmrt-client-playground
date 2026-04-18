export interface DebouncedAutoSend {
  schedule(): void;
  cancel(): void;
}

export function syncDebouncedAutoSend(
  value: string,
  debouncedAutoSend: DebouncedAutoSend,
  shouldSchedule = true
): void {
  if (!value.trim() || !shouldSchedule) {
    debouncedAutoSend.cancel();
    return;
  }

  debouncedAutoSend.schedule();
}

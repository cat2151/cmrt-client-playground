export interface DebouncedAutoSend {
  schedule(): void;
  cancel(): void;
}

export function syncDebouncedAutoSend(
  value: string,
  debouncedAutoSend: DebouncedAutoSend
): void {
  if (!value.trim()) {
    debouncedAutoSend.cancel();
    return;
  }

  debouncedAutoSend.schedule();
}

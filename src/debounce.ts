export function createDebouncedCallback(
  callback: () => void | Promise<void>,
  delayMs: number
): { schedule: () => void; cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  return {
    schedule() {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }

      timerId = setTimeout(() => {
        timerId = undefined;
        void Promise.resolve().then(callback).catch(() => {});
      }, delayMs);
    },
    cancel() {
      if (timerId === undefined) {
        return;
      }

      clearTimeout(timerId);
      timerId = undefined;
    },
  };
}

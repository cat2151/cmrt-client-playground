import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedCallback } from "./debounce.ts";

describe("createDebouncedCallback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs callback once after the delay", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 1000);

    debounced.schedule();
    debounced.schedule();
    vi.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending callback", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 1000);

    debounced.schedule();
    debounced.cancel();
    vi.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });
});

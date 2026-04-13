import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedCallback } from "./debounce.ts";

describe("createDebouncedCallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs callback once after the delay", async () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const debounced = createDebouncedCallback(callback, 1000);

    debounced.schedule();
    debounced.schedule();
    vi.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
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

  it("swallows callback rejections from async callbacks", async () => {
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const callback = vi.fn().mockRejectedValue(new Error("boom"));
    const debounced = createDebouncedCallback(callback, 1000);

    debounced.schedule();
    await vi.advanceTimersByTimeAsync(1000);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

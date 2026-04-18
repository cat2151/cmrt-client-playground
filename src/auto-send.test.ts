import { describe, expect, it, vi } from "vitest";
import { syncDebouncedAutoSend } from "./auto-send.ts";

describe("syncDebouncedAutoSend", () => {
  it("schedules auto send when the input has content", () => {
    const debouncedAutoSend = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };

    syncDebouncedAutoSend("C Am G7", debouncedAutoSend);

    expect(debouncedAutoSend.schedule).toHaveBeenCalledTimes(1);
    expect(debouncedAutoSend.cancel).not.toHaveBeenCalled();
  });

  it("cancels auto send when the input is blank", () => {
    const debouncedAutoSend = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };

    syncDebouncedAutoSend("   ", debouncedAutoSend);

    expect(debouncedAutoSend.cancel).toHaveBeenCalledTimes(1);
    expect(debouncedAutoSend.schedule).not.toHaveBeenCalled();
  });

  it("cancels auto send when scheduling is disabled", () => {
    const debouncedAutoSend = {
      schedule: vi.fn(),
      cancel: vi.fn(),
    };

    syncDebouncedAutoSend("C Am G7", debouncedAutoSend, false);

    expect(debouncedAutoSend.cancel).toHaveBeenCalledTimes(1);
    expect(debouncedAutoSend.schedule).not.toHaveBeenCalled();
  });
});

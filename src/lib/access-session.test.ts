import { afterEach, describe, expect, it, vi } from "vitest";
import { explorationSignal, updateExplorationAccess } from "./access-session";
afterEach(() => { updateExplorationAccess(false); vi.useRealTimers(); });
describe("expiry request guard", () => {
  it("blocks new calls at the exact deadline even before a UI timer runs", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
    updateExplorationAccess(true, Date.now() + 1000);
    const signal = explorationSignal();
    vi.advanceTimersByTime(1000);
    expect(() => explorationSignal()).toThrow("Subscribe");
    expect(signal.aborted).toBe(true);
  });
  it("cancels requests when access is withdrawn", () => {
    updateExplorationAccess(true);
    const signal = explorationSignal();
    updateExplorationAccess(false);
    expect(signal.aborted).toBe(true);
    expect(() => explorationSignal()).toThrow();
  });
});
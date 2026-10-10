import { describe, expect, it } from "vitest";
import { hasSubscriptionAccess, validSubscriptionSettings } from "./subscription";

describe("subscription access", () => {
  const now = Date.parse("2026-10-10T00:00:00Z");
  it("allows anonymous visitors while the admin keeps the site free", () => {
    expect(hasSubscriptionAccess({ paidMode: false, admin: false }, now)).toBe(true);
  });
  it("lets administrators use the site in paid mode", () => {
    expect(hasSubscriptionAccess({ paidMode: true, admin: true }, now)).toBe(true);
  });
  it("expires a two-day trial at its exact deadline", () => {
    const input = { paidMode: true, admin: false, trialEndsAt: "2026-10-12T00:00:00Z" };
    expect(hasSubscriptionAccess(input, now + 2 * 86400000 - 1)).toBe(true);
    expect(hasSubscriptionAccess(input, now + 2 * 86400000)).toBe(false);
  });
  it("only accepts one or two trial days", () => {
    expect(validSubscriptionSettings(1, null, null, false)).toBe(true);
    expect(validSubscriptionSettings(2, null, null, false)).toBe(true);
    expect(validSubscriptionSettings(3, null, null, false)).toBe(false);
  });
  it("requires both positive prices before paid mode", () => {
    expect(validSubscriptionSettings(2, null, 500, true)).toBe(false);
    expect(validSubscriptionSettings(2, 0, 500, true)).toBe(false);
    expect(validSubscriptionSettings(2, 50, 500, true)).toBe(true);
  });
  it("only allows unexpired subscription access", () => {
    expect(hasSubscriptionAccess({ paidMode: true, admin: false, subscriptionEndsAt: "2026-11-10T00:00:00Z" }, now)).toBe(true);
    expect(hasSubscriptionAccess({ paidMode: true, admin: false, subscriptionEndsAt: "2026-10-09T00:00:00Z" }, now)).toBe(false);
    expect(hasSubscriptionAccess({ paidMode: true, admin: false }, now)).toBe(false);
  });
});
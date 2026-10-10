import { describe, expect, it } from "vitest";
import { hasSubscriptionAccess, validSubscriptionSettings, showAdminNavigation } from "./subscription";

describe("subscription access", () => {
  it("only exposes admin navigation to signed-in administrators", () => {
    expect(showAdminNavigation(true, true)).toBe(true);
    expect(showAdminNavigation(true, false)).toBe(false);
    expect(showAdminNavigation(false, false)).toBe(false);
    expect(showAdminNavigation(false, true)).toBe(false);
  });
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
  it("accepts integer trial durations from 1 to 15 days", () => {
    expect(validSubscriptionSettings(1, null, null, false)).toBe(true);
    expect(validSubscriptionSettings(2, null, null, false)).toBe(true);
    for (let days = 1; days <= 15; days++) expect(validSubscriptionSettings(days, null, null, false)).toBe(true);
    for (const days of [0, 16, 1.5, NaN]) expect(validSubscriptionSettings(days, null, null, false)).toBe(false);
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
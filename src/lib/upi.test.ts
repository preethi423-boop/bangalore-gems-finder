import { describe, expect, it } from "vitest";
import { upiUri, validUpi } from "./upi";
describe("UPI setup", () => {
  it("requires a receiving account and payee name", () => {
    expect(validUpi("owner@bank", "Owner")).toBe(true);
    expect(validUpi("invalid", "Owner")).toBe(false);
    expect(validUpi("owner@bank", " ")).toBe(false);
  });
  it("generates exact INR amounts separately for monthly and yearly plans", () => {
    const monthly = new URL(upiUri("owner@bank", "Owner", 99, "Monthly"));
    const yearly = new URL(upiUri("owner@bank", "Owner", 999, "Yearly"));
    expect(monthly.searchParams.get("am")).toBe("99.00");
    expect(yearly.searchParams.get("am")).toBe("999.00");
    expect(monthly.searchParams.get("cu")).toBe("INR");
    expect(monthly.searchParams.get("pa")).toBe("owner@bank");
    expect(yearly.searchParams.get("tn")).toBe("Namma Spot Yearly subscription");
    expect(() => upiUri("owner@bank", "Owner", 0, "Monthly")).toThrow();
  });
});
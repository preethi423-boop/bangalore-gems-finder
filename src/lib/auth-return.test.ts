import { expect, it } from "vitest";
import { safeAuthReturn } from "./auth-return";

it("returns buyers to subscription plans after sign-in without accepting external redirects", () => {
  expect(safeAuthReturn("/subscription")).toBe("/subscription");
  expect(safeAuthReturn("/")).toBe("/");
  expect(safeAuthReturn("https://example.com")).toBeUndefined();
  expect(safeAuthReturn("//example.com")).toBeUndefined();
});
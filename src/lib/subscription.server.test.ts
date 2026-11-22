import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), request: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: mocks.request }));
import { requireSubscriptionAccess } from "./subscription.server";

describe("server Maps and AI access", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    mocks.request.mockReturnValue(new Request("https://example.invalid"));
  });
  it("does not bypass paid-mode checks for signed-out visitors", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requireSubscriptionAccess()).rejects.toThrow("subscribe");
  });
  it("blocks an expired signed-in user before Google or AI can be called", async () => {
    mocks.request.mockReturnValue(new Request("https://example.invalid", { headers: { authorization: "Bearer expired-account-test-token" } }));
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requireSubscriptionAccess()).rejects.toThrow("subscribe");
  });
  it("allows a database-approved free or unexpired account", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(requireSubscriptionAccess()).resolves.toBeUndefined();
  });
  it("blocks requests when the access check fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(requireSubscriptionAccess()).rejects.toThrow("subscribe");
  });
});
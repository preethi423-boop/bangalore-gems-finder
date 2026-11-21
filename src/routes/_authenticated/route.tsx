import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const response = await fetch("/api/auth/session", { credentials: "include" });
    if (!response.ok) throw redirect({ to: "/auth" });
    const { user } = (await response.json()) as { user: { id: number; email: string; name: string | null; picture_url: string | null } };
    return { user };
  },
  component: () => <Outlet />,
});

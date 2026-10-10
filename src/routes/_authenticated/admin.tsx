import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Trash2, Plus, MapPin, LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubscriptionAdmin } from "@/components/SubscriptionAdmin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Access & promotions admin — Namma Spot" },
      {
        name: "description",
        content:
          "Admin area for Namma Spot: create, edit and retire the sponsored offers and product promotions shown next to Bengaluru places.",
      },
      { property: "og:title", content: "Access & promotions admin — Namma Spot" },
      {
        property: "og:description",
        content: "Manage sponsored offers and product promotions shown in Namma Spot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type Promotion = {
  id: string;
  title: string;
  offer: string;
  sponsor: string;
  active: boolean;
  sort_order: number;
};

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", offer: "", sponsor: "", sort_order: 0 });

  const promos = useQuery({
    queryKey: ["promotions", "all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id,title,offer,sponsor,active,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Promotion[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["promotions"] });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("promotions").insert({
        title: form.title,
        offer: form.offer,
        sponsor: form.sponsor,
        sort_order: Number(form.sort_order) || 0,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", offer: "", sponsor: "", sort_order: 0 });
      invalidate();
    },
  });

  const toggle = useMutation({
    mutationFn: async (p: Promotion) => {
      const { error } = await supabase
        .from("promotions")
        .update({ active: !p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto size-6 text-destructive" />
          <h1 className="mt-2 text-base font-semibold">Admins only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This account can't manage promotions. The first account created on this app is the
            admin.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={signOut}>
              Sign out
            </Button>
            <Button asChild size="sm">
              <Link to="/">Back to map</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Site administration</h1>
            <p className="text-sm text-muted-foreground">
              These appear in the sponsored strip under every place.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <MapPin className="size-4" /> Map
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>

        {user ? <SubscriptionAdmin userId={user.id} /> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold">Add a promotion</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Product / title</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer">Offer</Label>
              <Input
                id="offer"
                required
                value={form.offer}
                onChange={(e) => setForm({ ...form, offer: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sponsor">Sponsor</Label>
              <Input
                id="sponsor"
                required
                value={form.sponsor}
                onChange={(e) => setForm({ ...form, sponsor: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order">Display order</Label>
              <Input
                id="order"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add promotion
          </Button>
          {create.isError ? (
            <p className="text-sm text-destructive">Could not save that promotion.</p>
          ) : null}
        </form>

        <div className="mt-5 space-y-2">
          {promos.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading promotions…</p>
          ) : promos.data?.length ? (
            promos.data.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-primary">{p.offer}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.sponsor} · order {p.sort_order}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.active}
                    onCheckedChange={() => toggle.mutate(p)}
                    aria-label={`${p.active ? "Hide" : "Show"} ${p.title}`}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${p.title}`}
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No promotions yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}

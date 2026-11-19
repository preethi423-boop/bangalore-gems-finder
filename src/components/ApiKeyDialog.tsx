import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminMapsSettings, saveAdminMapsSettings } from "@/lib/maps-settings.functions";
import { clearMapsKeyRejected } from "@/lib/user-key";

export function ApiKeyDialog({ controlledOpen, onControlledOpenChange }: { controlledOpen: boolean; onControlledOpenChange: (open: boolean) => void }) {
  const [browserKey, setBrowserKey] = useState("");
  const [serverKey, setServerKey] = useState("");
  const read = useServerFn(getAdminMapsSettings);
  const save = useServerFn(saveAdminMapsSettings);
  const settings = useQuery({ queryKey: ["admin-maps-settings"], queryFn: () => read(), enabled: controlledOpen, retry: false });
  const mutation = useMutation({ mutationFn: (reset: boolean) => save({ data: { browserKey, serverKey, reset } }), onSuccess: () => { clearMapsKeyRejected(); window.location.reload(); } });
  return <Dialog open={controlledOpen} onOpenChange={onControlledOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Shared Google Maps keys</DialogTitle><DialogDescription>These settings apply to everyone. Existing saved keys remain unchanged when a field is left empty.</DialogDescription></DialogHeader>
    <label className="space-y-2 text-sm">Map display key<Input type="password" value={browserKey} onChange={e => setBrowserKey(e.target.value)} placeholder={settings.data?.browserConfigured ? "Configured — enter a replacement" : "AIza…"} autoComplete="off" spellCheck={false} aria-label="Map display key" /></label>
    <p className="text-xs text-muted-foreground">Enable Maps JavaScript API and allow your website addresses. Google needs this key in visitors’ browsers to display maps.</p>
    <label className="space-y-2 text-sm">Search and routes server key<Input type="password" value={serverKey} onChange={e => setServerKey(e.target.value)} placeholder={settings.data?.serverConfigured ? "Configured — enter a replacement" : "AIza…"} autoComplete="off" spellCheck={false} aria-label="Search and routes server key" /></label>
    <p className="text-xs text-muted-foreground">Enable Places API (New) and Routes API. Use a separate key without website restrictions; this key stays on the server.</p>
    {settings.isError || mutation.isError ? <p role="alert" className="text-sm text-destructive">{(mutation.error ?? settings.error)?.message}</p> : null}
    <DialogFooter><Button variant="outline" disabled={mutation.isPending || !settings.data} onClick={() => mutation.mutate(true)}>Restore defaults</Button><Button disabled={mutation.isPending || !settings.data || (!browserKey.trim() && !serverKey.trim())} onClick={() => mutation.mutate(false)}>{mutation.isPending ? "Saving…" : "Save for everyone"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

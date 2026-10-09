import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Sparkles, ArrowUpRight, Loader2, Square, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { explorationCandidates, distanceKm, type RecommendationResult } from "@/lib/exploration";
import type { PlaceDetails, NearbyGroup } from "@/lib/places.functions";

export function ExploreNearby({ details, nearby, rangeKm, session, isAdmin, onSelect }: {
  details: PlaceDetails; nearby: NearbyGroup[]; rangeKm: number; session: Session | null;
  isAdmin: boolean; onSelect: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const controller = useRef<AbortController | null>(null);
  const candidates = useMemo(() => explorationCandidates(nearby, details, rangeKm), [nearby, details, rangeKm]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false); setResult(null); setError(null); setReasoning(""); setStopped(false);
  }, [nearby, session?.user.id]);

  const recommend = async (resume = false) => {
    if (!session || busy || prompt.trim().length < 3) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true); setError(null); setResult(null); setReasoning(""); setStopped(false);
    try {
      const response = await fetch("/api/public/explore", {
        method: "POST", signal: active.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: prompt.trim(), location: { name: details.name, lat: details.lat, lng: details.lng }, rangeKm, places: candidates, resume }),
      });
      if (!response.ok) {
        const payload = await response.json() as { message?: string; paused?: boolean };
        setPaused(payload.paused ?? false);
        throw new Error(payload.message ?? `Recommendations unavailable (${response.status}).`);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No recommendation response was received.");
      const decoder = new TextDecoder();
      let buffer = "";
      let terminal = false;
      const consume = (line: string) => {
        if (!line.trim() || active.signal.aborted) return;
        const event = JSON.parse(line);
        if (event.type === "reasoning") setReasoning(value => value + event.text);
        if (event.type === "result") { setResult(event); setPaused(false); terminal = true; }
        if (event.type === "error") { setError(event.message); setPaused(event.paused); terminal = true; }
        if (event.type === "stopped") { setStopped(true); terminal = true; }
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        lines.forEach(consume);
      }
      buffer += decoder.decode(); consume(buffer);
      if (!terminal && !active.signal.aborted) throw new Error("Recommendations ended before a result arrived.");
    } catch (err) {
      if (controller.current !== active) return;
      if (active.signal.aborted) setStopped(true);
      else setError(err instanceof Error ? err.message : "Recommendations are unavailable right now.");
    } finally {
      if (controller.current === active) { setBusy(false); controller.current = null; }
    }
  };
  return (
    <section className="mt-5 border-y border-border py-4" aria-labelledby="explore-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="explore-title" className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-accent" />Explore your way</h3>
        <span className="text-xs text-muted-foreground">Near {details.name}</span>
      </div>
      <form className="mt-3" onSubmit={e => { e.preventDefault(); void recommend(); }}>
        <label htmlFor="explore-interests" className="text-xs font-medium">What would you like to explore?</label>
        <Textarea id="explore-interests" className="mt-1.5 min-h-20 resize-y" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={800} disabled={busy}
          placeholder="Local street food, a peaceful park, and somewhere to shop…" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{candidates.length} nearby places · within {rangeKm} km</span>
          {!session ? <Button asChild size="sm" variant="outline"><Link to="/auth" search={{ returnTo: "/", place: details.id }}>Sign in for recommendations</Link></Button>
            : busy ? <Button type="button" size="sm" variant="outline" onClick={() => { controller.current?.abort(); setBusy(false); setStopped(true); }}><Square className="size-3" />Stop</Button>
              : paused && isAdmin ? <Button type="button" size="sm" onClick={() => void recommend(true)} disabled={!candidates.length || prompt.trim().length < 3}>Resume after access restored</Button>
                : <Button size="sm" type="submit" disabled={paused || !candidates.length || prompt.trim().length < 3}><Sparkles className="size-3.5" />Find my spots</Button>}
        </div>
      </form>
      {!candidates.length ? <p className="mt-2 text-xs text-muted-foreground">No attraction, food or shopping results in this range. Try a larger range or another spot.</p> : null}
      <div aria-live="polite">
        {busy ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Finding nearby matches…</p> : null}
        {stopped ? <p className="mt-2 text-xs text-muted-foreground">Recommendations stopped.</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
      {reasoning ? <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">AI notes</summary><p className="mt-2 whitespace-pre-wrap leading-relaxed">{reasoning}</p></details> : null}
      {result ? <div className="mt-3">
        <p className="text-sm leading-relaxed">{result.summary}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.recommendations.map(r => {
            const p = candidates.find(c => c.id === r.placeId);
            if (!p) return null;
            return <li key={p.id} className="rounded-lg border border-border bg-background p-3">
              <Button variant="link" className="h-auto w-full justify-between whitespace-normal p-0 text-left" onClick={() => onSelect(p.id)}><span>{p.name}</span><ArrowUpRight className="size-4 shrink-0" /></Button>
              <p className="mt-1 text-xs text-muted-foreground">{p.address}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="size-3" />{distanceKm(details, p).toFixed(1)} km straight-line</span>{p.rating ? <span className="flex items-center gap-1"><Star className="size-3 text-gold" />{p.rating.toFixed(1)}</span> : null}</div>
              <p className="mt-2 text-sm leading-relaxed">{r.reason}</p>
            </li>;
          })}
        </ul>
      </div> : null}
    </section>
  );
}
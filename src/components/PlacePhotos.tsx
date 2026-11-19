import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ChevronLeft, ChevronRight, Loader2, Maximize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getPlacePhoto, type PlaceDetails } from "@/lib/places.functions";
import { getPlacePhotoWithKey } from "@/lib/places-direct";
import { activeUserKey } from "@/lib/user-key";
import { explorationSignal } from "@/lib/access-session";
import { useAuth } from "@/hooks/useAuth";

export function PlacePhotos({ details }: { details: PlaceDetails }) {
  const photos = details.photos ?? [];
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [failedUri, setFailedUri] = useState<string>();
  const { session } = useAuth();
  const key = activeUserKey();
  const loadPhoto = useServerFn(getPlacePhoto);
  const photo = photos[index];
  const query = useQuery({
    queryKey: ["place-photo", details.id, photo?.name, key ? "personal" : "managed"],
    enabled: Boolean(photo && (session || key)),
    queryFn: async () => {
      explorationSignal();
      if (!photo) throw new Error("Photo unavailable.");
      return key ? getPlacePhotoWithKey(key, photo.name) : loadPhoto({ data: { name: photo.name } });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const failed = query.isError || Boolean(query.data && query.data === failedUri);
  const attribution = photo?.authors.map((author, i) => author.uri ? (
    <a key={i} href={author.uri} target="_blank" rel="noreferrer" className="underline underline-offset-2">{author.name}</a>
  ) : <span key={i}>{author.name}</span>);

  return (
    <section className="mt-4" aria-label="Place photos">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Camera className="size-4 text-primary" />Photos of {details.name}</h3>
        {photos.length > 0 && <span className="shrink-0 text-xs text-muted-foreground">{index + 1} / {photos.length}</span>}
      </div>
      {!photo ? <p className="text-xs text-muted-foreground">No photos available for this place.</p> : !session && !key ? (
        <Button asChild variant="outline" size="sm"><Link to="/auth">Sign in to view photos</Link></Button>
      ) : (
        <>
          <div className="relative flex aspect-[16/9] max-h-80 items-center justify-center overflow-hidden rounded-md bg-muted">
            {failed ? <div role="alert" className="p-4 text-center text-sm text-muted-foreground">Photo could not be loaded.<Button variant="outline" size="sm" className="ml-2" onClick={() => { setFailedUri(undefined); void query.refetch(); }}><RefreshCw className="size-4" />Retry</Button></div> : query.data ? (
              <><img src={query.data} alt={`${details.name} — place photo ${index + 1}`} className="h-full w-full object-cover" onError={() => setFailedUri(query.data)} /><Button size="icon" variant="secondary" className="absolute right-2 top-2" aria-label="Enlarge photo" title="Enlarge photo" onClick={() => setExpanded(true)}><Maximize2 className="size-4" /></Button></>
            ) : <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading photo" />}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">Google Maps{attribution?.length ? <> · {attribution}</> : null}</p>
            <div className="flex shrink-0 gap-1">
              <Button variant="outline" size="icon" aria-label="Previous photo" title="Previous photo" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Next photo" title="Next photo" disabled={index >= photos.length - 1} onClick={() => setIndex(index + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <Dialog open={expanded} onOpenChange={setExpanded}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-4xl p-4">
              <DialogTitle className="pr-8">{details.name}</DialogTitle>
              <div className="flex aspect-[4/3] max-h-[65vh] items-center justify-center bg-muted">{query.data && <img src={query.data} alt={`${details.name} — enlarged photo`} className="h-full w-full object-contain" />}</div>
              <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">Google Maps · {attribution}</p>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
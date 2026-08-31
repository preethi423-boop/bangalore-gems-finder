import { useEffect, useState } from "react";
import { Heart, Star, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getFavorites, removeFavorite, type Favorite } from "@/lib/favorites";

export function FavoritesSheet({
  onOpenPlace,
  version,
}: {
  onOpenPlace: (placeId: string) => void;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Favorite[]>([]);

  useEffect(() => setItems(getFavorites()), [version, open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-foreground"
        >
          <Heart className="size-3.5" /> Favorites
          {items.length ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
              {items.length}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Heart className="size-4 text-primary" /> Saved places
          </SheetTitle>
        </SheetHeader>
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No favorites yet. Open a place and tap “Save” to keep it here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-2 rounded-xl border border-border bg-card p-3"
              >
                <button
                  onClick={() => {
                    setOpen(false);
                    onOpenPlace(f.id);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {f.address}
                  </span>
                  {f.rating ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-foreground">
                      <Star className="size-3 fill-gold text-gold" />
                      {f.rating.toFixed(1)}
                    </span>
                  ) : null}
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${f.name} from favorites`}
                  onClick={() => setItems(removeFavorite(f.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

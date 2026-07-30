import { useState } from "react";
import { KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserKey, setUserKey } from "@/lib/user-key";

export function ApiKeyDialog({ hasKey }: { hasKey: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(getUserKey());
      }}
    >
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition hover:border-primary/50 hover:text-foreground"
          aria-label="Google API key settings"
        >
          <KeyRound className="size-3.5" />
          {hasKey ? "Your API key" : "Add your Google API key"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your Google Maps API key</DialogTitle>
          <DialogDescription>
            Paste a Google Cloud API key with Maps JavaScript API, Places API (New) and Routes API
            enabled. It stays on this device and is used for the map, search, place details and
            routing.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="AIza…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Google API key"
        />
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setUserKey("");
              window.location.reload();
            }}
          >
            Remove key
          </Button>
          <Button
            onClick={() => {
              setUserKey(value);
              window.location.reload();
            }}
          >
            Save & reload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
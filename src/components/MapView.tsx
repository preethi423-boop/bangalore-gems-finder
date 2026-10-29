import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon, Satellite } from "lucide-react";
import type { PlaceLite } from "@/lib/places.functions";
import { effectiveMapsKey } from "@/lib/user-key";

declare global {
  interface Window {
    google?: any;
    __initBlrMap?: () => void;
  }
}

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<void>((resolve, reject) => {
    const key = effectiveMapsKey();
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    window.__initBlrMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&loading=async&callback=__initBlrMap&channel=${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load map"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export type MapMarker = PlaceLite & { kind?: string };

export const MARKER_STYLE: Record<string, { color: string; glyph: string; label: string }> = {
  main: { color: "#c2410c", glyph: "", label: "Selected place" },
  parking: { color: "#2563eb", glyph: "P", label: "Parking" },
  streetfood: { color: "#ea580c", glyph: "", label: "Street food" },
  shopping: { color: "#7c3aed", glyph: "", label: "Shopping" },
  sights: { color: "#0f766e", glyph: "", label: "Must see" },
  cafes: { color: "#b45309", glyph: "", label: "Cafes & eats" },
  evcar: { color: "#16a34a", glyph: "⚡", label: "Car charging" },
  evbike: { color: "#84cc16", glyph: "⚡", label: "Bike charging" },
};

type Props = {
  center: { lat: number; lng: number };
  main?: PlaceLite | null;
  markers: MapMarker[];
  onMarkerClick?: (p: PlaceLite) => void;
  onPoiSelect?: (placeId: string) => void;
  routePolyline?: string | null;
  threeD?: boolean;
};

export function MapView({
  center,
  main,
  markers,
  onMarkerClick,
  onPoiSelect,
  routePolyline,
  threeD,
}: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const drawn = useRef<any[]>([]);
  const line = useRef<any>(null);
  const poiRef = useRef(onPoiSelect);
  poiRef.current = onPoiSelect;
  const [satellite, setSatellite] = useState(false);
  const satelliteRef = useRef(satellite);
  satelliteRef.current = satellite;

  const legend = useMemo(() => {
    const keys = Array.from(new Set(markers.map((m) => m.kind).filter(Boolean) as string[]));
    return keys.filter((k) => MARKER_STYLE[k]);
  }, [markers]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !el.current || !window.google) return;
        if (!map.current) {
          map.current = new window.google.maps.Map(el.current, {
            center,
            zoom: 14,
            disableDefaultUI: true,
            zoomControl: true,
            rotateControl: true,
            tiltInteractionEnabled: true,
            gestureHandling: "greedy",
          });
          // Tapping any Google POI on the map loads that place's full details.
          map.current.addListener("click", (e: any) => {
            if (e?.placeId) {
              e.stop?.();
              poiRef.current?.(e.placeId);
            }
          });
        }
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.panTo(center);
  }, [center.lat, center.lng]);

  // Swap to a tilted 3D aerial view once a place is selected.
  useEffect(() => {
    if (threeD) setSatellite(true);
    else setSatellite(false);
  }, [threeD, center.lat, center.lng]);

  useEffect(() => {
    let raf = 0;
    const apply = () => {
      if (!map.current || !window.google) {
        raf = window.setTimeout(apply, 200) as unknown as number;
        return;
      }
      map.current.setMapTypeId(
        satellite ? window.google.maps.MapTypeId.HYBRID : window.google.maps.MapTypeId.ROADMAP
      );
    };
    apply();
    return () => clearTimeout(raf);
  }, [satellite]);

  useEffect(() => {
    let raf = 0;
    const apply = () => {
      if (!map.current || !window.google) {
        raf = window.setTimeout(apply, 200) as unknown as number;
        return;
      }
      if (threeD) {
        map.current.setCenter(center);
        map.current.setZoom(19);
        // 45° aerial imagery only kicks in once the tiles for this zoom exist,
        // so re-apply tilt/heading after the first tile load.
        const tiltIn = () => {
          map.current.setTilt(45);
          map.current.setHeading(45);
        };
        tiltIn();
        window.google.maps.event.addListenerOnce(map.current, "tilesloaded", tiltIn);
        window.google.maps.event.addListenerOnce(map.current, "idle", tiltIn);
      } else {
        map.current.setTilt(0);
        map.current.setHeading(0);
        map.current.setZoom(14);
      }
    };
    apply();
    return () => clearTimeout(raf);
  }, [threeD, center.lat, center.lng]);

  useEffect(() => {
    if (!map.current || !window.google) return;
    drawn.current.forEach((m) => m.setMap(null));
    drawn.current = [];
    const all: MapMarker[] = [...(main ? [{ ...main, kind: "main" }] : []), ...markers];
    all.forEach((p) => {
      const style = MARKER_STYLE[p.kind ?? ""] ?? { color: "#0f766e", glyph: "" };
      const isMain = p.kind === "main";
      const marker = new window.google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: map.current,
        title: p.name,
        zIndex: isMain ? 999 : p.kind?.startsWith("ev") ? 500 : 1,
        label: style.glyph
          ? { text: style.glyph, color: "#ffffff", fontSize: "11px", fontWeight: "700" }
          : undefined,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isMain ? 11 : style.glyph ? 9 : 6,
          fillColor: style.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onMarkerClick?.(p));
      drawn.current.push(marker);
    });
  }, [main?.id, markers, onMarkerClick]);

  useEffect(() => {
    if (!map.current || !window.google?.maps?.geometry) return;
    if (line.current) {
      line.current.setMap(null);
      line.current = null;
    }
    if (!routePolyline) return;
    const path = window.google.maps.geometry.encoding.decodePath(routePolyline);
    line.current = new window.google.maps.Polyline({
      path,
      map: map.current,
      strokeColor: "#c2410c",
      strokeOpacity: 0.9,
      strokeWeight: 5,
    });
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((pt: any) => bounds.extend(pt));
    map.current.fitBounds(bounds, 60);
  }, [routePolyline]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" aria-label="Map of the selected place" />
      <button
        type="button"
        onClick={() => setSatellite((s) => !s)}
        aria-pressed={satellite}
        title={satellite ? "Switch to normal map" : "Switch to satellite view"}
        className="absolute right-3 top-[3.75rem] z-10 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-card-foreground shadow-[var(--shadow-card)] backdrop-blur transition-colors hover:bg-accent"
      >
        {satellite ? <MapIcon className="size-4" /> : <Satellite className="size-4" />}
        {satellite ? "Normal" : "Satellite"}
      </button>
      {legend.length ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl border border-border bg-card/90 p-2 text-[11px] shadow-[var(--shadow-card)] backdrop-blur">
          <p className="mb-1 font-semibold text-card-foreground">Map legend</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full ring-2 ring-background"
                style={{ backgroundColor: MARKER_STYLE.main.color }}
              />
              <span className="text-muted-foreground">Selected place</span>
            </li>
            {legend.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span
                  className="inline-flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-background"
                  style={{ backgroundColor: MARKER_STYLE[k].color }}
                >
                  {MARKER_STYLE[k].glyph}
                </span>
                <span className="text-muted-foreground">{MARKER_STYLE[k].label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

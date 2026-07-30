import { useEffect, useRef } from "react";
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

type Props = {
  center: { lat: number; lng: number };
  main?: PlaceLite | null;
  markers: PlaceLite[];
  onMarkerClick?: (p: PlaceLite) => void;
  routePolyline?: string | null;
};

export function MapView({ center, main, markers, onMarkerClick, routePolyline }: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const drawn = useRef<any[]>([]);
  const line = useRef<any>(null);

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
            gestureHandling: "greedy",
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

  useEffect(() => {
    if (!map.current || !window.google) return;
    drawn.current.forEach((m) => m.setMap(null));
    drawn.current = [];
    const all = [...(main ? [main] : []), ...markers];
    all.forEach((p, i) => {
      const isMain = Boolean(main) && i === 0;
      const marker = new window.google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: map.current,
        title: p.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isMain ? 10 : 6,
          fillColor: isMain ? "#c2410c" : "#0f766e",
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

  return <div ref={el} className="h-full w-full" aria-label="Map of the selected place" />;
}

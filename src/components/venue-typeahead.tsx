"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReceiptVenue } from "@/lib/types";

type PlacePrediction = {
  placeId: string;
  name: string;
  secondary: string;
  provider: "mapbox" | "apple";
  lat?: number | null;
  lng?: number | null;
  formattedAddress?: string | null;
  category?: string | null;
};

type Props = {
  value: string;
  venue: ReceiptVenue | null;
  receiptDate?: string | null;
  onChangeName: (name: string) => void;
  onChangeVenue: (venue: ReceiptVenue | null) => void;
  fieldClass?: string;
};

function newSession() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function typedVenue(name: string): ReceiptVenue {
  return {
    name: name.trim(),
    placeId: null,
    provider: null,
    formattedAddress: null,
    lat: null,
    lng: null,
    category: null,
    source: "typed",
    confirmedAt: new Date().toISOString(),
  };
}

export function formatReceiptDateLabel(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function VenueTypeahead({
  value,
  venue,
  receiptDate,
  onChangeName,
  onChangeVenue,
  fieldClass,
}: Props) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const sessionRef = useRef(newSession());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  const placeConfirmed = venue?.source === "places" && Boolean(venue.name.trim());
  const address = venue?.formattedAddress?.trim() || null;
  const dateLabel = formatReceiptDateLabel(receiptDate);

  useEffect(() => {
    if (!navigator.geolocation) {
      setHint("Location off — search by name only.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHint("Using nearby places to rank results.");
      },
      () => setHint("Location off — search by name only."),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (lockedRef.current) {
        setPredictions([]);
        return;
      }
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setPredictions([]);
        return;
      }
      timerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const params = new URLSearchParams({
              q: trimmed,
              session: sessionRef.current,
            });
            if (coords) {
              params.set("lat", String(coords.lat));
              params.set("lng", String(coords.lng));
            }
            const res = await fetch(`/api/places/autocomplete?${params}`);
            const data = (await res.json()) as {
              predictions?: PlacePrediction[];
              configured?: boolean;
            };
            if (!data.configured) {
              setPredictions([]);
              setHint((h) => h ?? "Type the place name (Places API not configured).");
              return;
            }
            setPredictions(data.predictions ?? []);
          } catch {
            setPredictions([]);
          }
        })();
      }, 280);
    },
    [coords],
  );

  const onChangeText = (text: string) => {
    lockedRef.current = false;
    onChangeName(text);
    onChangeVenue(null);
    runSearch(text);
  };

  const onSelect = async (row: PlacePrediction) => {
    lockedRef.current = true;
    onChangeName(row.name);
    setPredictions([]);
    onChangeVenue({
      name: row.name,
      placeId: row.placeId,
      provider: row.provider,
      formattedAddress: row.secondary || row.formattedAddress || null,
      lat: row.lat ?? null,
      lng: row.lng ?? null,
      category: row.category ?? null,
      source: "places",
      confirmedAt: new Date().toISOString(),
    });
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(row.placeId)}&session=${encodeURIComponent(sessionRef.current)}`,
      );
      if (!res.ok) throw new Error("details");
      const data = (await res.json()) as {
        place: {
          placeId: string;
          name: string;
          formattedAddress: string | null;
          lat: number | null;
          lng: number | null;
          category: string | null;
          provider: "mapbox" | "apple";
        };
      };
      onChangeVenue({
        name: data.place.name || row.name,
        placeId: data.place.placeId,
        provider: data.place.provider === "apple" ? "apple" : "mapbox",
        formattedAddress: row.secondary || data.place.formattedAddress || null,
        lat: data.place.lat,
        lng: data.place.lng,
        category: data.place.category,
        source: "places",
        confirmedAt: new Date().toISOString(),
      });
      sessionRef.current = newSession();
    } catch {
      /* keep optimistic venue from dropdown row */
    }
  };

  const clearSelection = () => {
    lockedRef.current = false;
    onChangeVenue(null);
    onChangeName("");
    setPredictions([]);
  };

  if (placeConfirmed) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border px-3.5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{venue!.name}</div>
          {address ? (
            <div className="mt-0.5 text-[12px] text-muted-foreground">{address}</div>
          ) : null}
          {dateLabel ? (
            <div className="mt-2 text-[12px] text-muted-foreground">
              Receipt date · {dateLabel}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 text-[13px] font-semibold text-primary"
          onClick={clearSelection}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor="restaurant" className="mb-2 text-[13px] font-medium">
        Restaurant or bar
      </Label>
      <Input
        id="restaurant"
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder="Start typing the place"
        className={fieldClass}
        autoComplete="organization"
      />
      {hint ? <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p> : null}
      {dateLabel ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Receipt date · {dateLabel}</p>
      ) : null}
      {predictions.length > 0 ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {predictions.map((row) => (
            <li key={row.placeId}>
              <button
                type="button"
                className="w-full px-3.5 py-3 text-left hover:bg-muted/40"
                onClick={() => void onSelect(row)}
              >
                <div className="text-[15px] font-semibold">{row.name}</div>
                {row.secondary ? (
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{row.secondary}</div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ensureVenueForPublish(
  restaurant: string,
  venue: ReceiptVenue | null,
): ReceiptVenue {
  if (venue && venue.name.trim()) return venue;
  return typedVenue(restaurant);
}

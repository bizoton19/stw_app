"use client";

import { useEffect, useState } from "react";
import {
  formatPlaceCategory,
  formatPlaceRating,
  httpHref,
  placeDetailsQuery,
  placePhotos,
  readPlaceDetail,
  type NearbyPlaceCard,
  type PlaceDetail,
} from "@/lib/nearby-place-card";

function Hero({ url, className }: { url: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={className ?? "h-[220px] w-full rounded-2xl bg-[var(--stw-chrome)] object-cover"}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Place detail. Photos are the nearby card’s `photoUrls` (at most two).
 * Rating, review count, and website come from `GET /api/places/google`.
 */
export function NearbyPlaceDetail({
  card,
  detail: detailProp,
  onDetail,
}: {
  card: NearbyPlaceCard;
  /** Pass to skip the fetch (tests). Omit to load Place Details for this place. */
  detail?: PlaceDetail | null;
  onDetail?: (detail: PlaceDetail | null) => void;
}) {
  const [fetched, setFetched] = useState<PlaceDetail | null>(null);
  const detail = detailProp !== undefined ? detailProp : fetched;

  useEffect(() => {
    if (detailProp !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(placeDetailsQuery(card.placeId));
        const next = await readPlaceDetail(res);
        if (cancelled) return;
        setFetched(next);
        onDetail?.(next);
      } catch {
        if (!cancelled) onDetail?.(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.placeId, detailProp, onDetail]);

  const photos = placePhotos(card);
  const rating = formatPlaceRating(detail?.rating, detail?.userRatingCount);
  const category = formatPlaceCategory(detail?.category ?? card.category);
  const address = detail?.formattedAddress ?? card.formattedAddress;
  const website = httpHref(detail?.websiteUri);
  const maps = httpHref(detail?.googleMapsUri ?? card.googleMapsUri);

  return (
    <div className="space-y-3">
      {photos.length === 1 ? <Hero url={photos[0]!} /> : null}
      {photos.length > 1 ? (
        <div className="flex h-[168px] gap-2">
          {photos.map((url, index) => (
            <Hero
              key={`${url}-${index}`}
              url={url}
              className="h-full min-w-0 flex-1 rounded-2xl bg-[var(--stw-chrome)] object-cover"
            />
          ))}
        </div>
      ) : null}
      {address ? <p className="text-[14px] leading-5 text-muted-foreground">{address}</p> : null}
      {rating ? <p className="text-[14px] font-semibold">{rating}</p> : null}
      {category ? <p className="text-[13px] text-muted-foreground">{category}</p> : null}
      {website || maps ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-semibold text-primary"
            >
              Website
            </a>
          ) : null}
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noreferrer"
              className="text-[15px] font-semibold text-primary"
            >
              Maps
            </a>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">Powered by Google</p>
    </div>
  );
}

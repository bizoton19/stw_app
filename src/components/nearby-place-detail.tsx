"use client";

import { useState } from "react";
import {
  formatPlaceCategory,
  formatPlaceRating,
  httpHref,
  placePhotos,
  type NearbyPlaceCard,
} from "@/lib/nearby-place-card";

function Hero({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-[220px] w-full rounded-2xl bg-[var(--stw-chrome)] object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Place detail. Photos are only the proxied URLs already on the card. */
export function NearbyPlaceDetail({ card }: { card: NearbyPlaceCard }) {
  const photos = placePhotos(card);
  const [hero, ...rest] = photos;
  const rating = formatPlaceRating(card.rating, card.userRatingCount);
  const category = formatPlaceCategory(card.category);
  const website = httpHref(card.websiteUri);
  const maps = httpHref(card.googleMapsUri);

  return (
    <div className="space-y-3">
      {hero ? <Hero url={hero} /> : null}
      {rest.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {rest.map((url) => (
            <li key={url} className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-[72px] w-[96px] rounded-xl object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {card.formattedAddress ? (
        <p className="text-[14px] leading-5 text-muted-foreground">{card.formattedAddress}</p>
      ) : null}
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

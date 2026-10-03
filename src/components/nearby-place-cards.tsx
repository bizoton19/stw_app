"use client";

import { useState } from "react";
import { formatPlaceCategory, placePhotos, type NearbyPlaceCard } from "@/lib/nearby-place-card";

function CardPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="h-full min-w-0 flex-1 bg-[var(--stw-chrome)]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-full min-w-0 flex-1 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

/** Short horizontal swipe of nearby places. A tap opens detail; it does not select. */
export function NearbyPlaceCards({
  places,
  onSelect,
}: {
  places: NearbyPlaceCard[];
  onSelect: (card: NearbyPlaceCard) => void;
}) {
  if (places.length === 0) return null;
  return (
    <div className="mt-3 min-w-0 max-w-full">
      <p className="mb-2 text-[12px] font-semibold text-muted-foreground">Nearby</p>
      <ul className="flex w-full min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {places.map((card) => {
          const photos = placePhotos(
            card,
            typeof window === "undefined" ? "" : window.location.origin,
          );
          const category = formatPlaceCategory(card.category);
          const ink = photos.length > 0 ? "text-[var(--stw-paper)]" : "text-foreground";
          return (
            <li key={card.placeId} className="w-[min(17.5rem,78%)] shrink-0 snap-start">
              <button
                type="button"
                className="relative h-[220px] w-full overflow-hidden rounded-2xl text-left"
                onClick={() => onSelect(card)}
              >
                <span className="absolute inset-0 flex">
                  {photos.length === 0 ? (
                    <span className="h-full flex-1 bg-[var(--stw-chrome)]" />
                  ) : (
                    photos.map((url, index) => <CardPhoto key={`${url}-${index}`} url={url} />)
                  )}
                </span>
                <span
                  className={
                    photos.length > 0
                      ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(36,28,20,0.82)] via-[rgba(36,28,20,0.28)] to-transparent px-3 pb-2.5 pt-8"
                      : "absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8"
                  }
                >
                  <span className={`line-clamp-1 text-[16px] font-semibold leading-5 ${ink}`}>
                    {card.name}
                  </span>
                  {card.formattedAddress ? (
                    <span className={`mt-0.5 line-clamp-1 text-[12px] leading-4 ${ink} opacity-90`}>
                      {card.formattedAddress}
                    </span>
                  ) : null}
                  {category ? (
                    <span className={`mt-0.5 line-clamp-1 text-[11px] leading-4 ${ink} opacity-80`}>
                      {category}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">Powered by Google</p>
    </div>
  );
}

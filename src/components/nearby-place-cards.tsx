"use client";

import { useState } from "react";
import { placePhotos, type NearbyPlaceCard } from "@/lib/nearby-place-card";

function CardPhoto({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <span className="absolute inset-0 bg-[var(--stw-chrome)]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
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
          const photo = placePhotos(card)[0] ?? null;
          return (
            <li key={card.placeId} className="w-[min(17.5rem,78%)] shrink-0 snap-start">
              <button
                type="button"
                className="relative h-[148px] w-full overflow-hidden rounded-2xl text-left"
                onClick={() => onSelect(card)}
              >
                <CardPhoto url={photo} />
                <span
                  className={
                    photo
                      ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(36,28,20,0.82)] via-[rgba(36,28,20,0.28)] to-transparent px-3 pb-3 pt-10"
                      : "absolute inset-x-0 bottom-0 px-3 pb-3 pt-10"
                  }
                >
                  <span
                    className={
                      photo
                        ? "line-clamp-2 text-[16px] font-semibold leading-5 text-[var(--stw-paper)]"
                        : "line-clamp-2 text-[16px] font-semibold leading-5 text-foreground"
                    }
                  >
                    {card.name}
                  </span>
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

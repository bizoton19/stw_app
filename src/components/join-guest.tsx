"use client";

import { useState } from "react";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGuest, type GuestIdentity } from "@/lib/session";

export function JoinGuest({
  receiptId,
  restaurant,
  onJoined,
  isHost = false,
  hasImage = false,
}: {
  receiptId: string;
  restaurant: string;
  onJoined: (guest: GuestIdentity) => void;
  isHost?: boolean;
  hasImage?: boolean;
}) {
  const place = restaurant.trim() || "tonight’s check";
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  return (
    <InterviewChrome
      step={1}
      total={3}
      kicker={place}
      title={isHost ? "You're hosting — claim under what name?" : `Here is the tab for ${place}`}
      stepKey="join"
      footer={
        <ContinueButton
          disabled={!name.trim()}
          onClick={() => {
            const guest = { name: name.trim(), contact: contact.trim() };
            saveGuest(receiptId, guest);
            onJoined(guest);
          }}
        >
          See the check
        </ContinueButton>
      }
    >
      <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
        {isHost
          ? "Pick what you ordered too. Leftovers can still land on you when you close claiming."
          : "Your host has added you to the tab. You can claim items that you consumed by starting with adding your name and contact."}
      </p>
      {hasImage ? (
        <a
          href={`/api/receipts/${receiptId}/image`}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-flex rounded-full border border-border bg-[#FFFcf8] px-3 py-2 text-[13px] font-semibold text-primary"
        >
          View tab photo
        </a>
      ) : null}
      <Label htmlFor="guest-name" className="mb-2 text-[13px] font-medium">
        Name
      </Label>
      <Input
        id="guest-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-xl border-border bg-transparent text-base"
        placeholder="Alex"
        autoComplete="name"
      />
      <Label htmlFor="guest-contact" className="mt-4 mb-2 text-[13px] font-medium">
        Contact <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        id="guest-contact"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="h-12 rounded-xl border-border bg-transparent text-base"
        placeholder="phone, Venmo, or email"
        autoComplete="tel"
      />
    </InterviewChrome>
  );
}

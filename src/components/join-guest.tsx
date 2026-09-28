"use client";

import { useState } from "react";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import {
  emptyContactField,
  GuestContactField,
  resolveGuestContact,
} from "@/components/guest-contact-field";
import { ReceiptImageButton } from "@/components/receipt-image-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGuest, type GuestIdentity } from "@/lib/session";

export function JoinGuest({
  receiptId,
  restaurant,
  onJoined,
  isHost = false,
  hasImage = false,
  hostNote = null,
}: {
  receiptId: string;
  restaurant: string;
  onJoined: (guest: GuestIdentity) => void;
  isHost?: boolean;
  hasImage?: boolean;
  hostNote?: string | null;
}) {
  const place = restaurant.trim() || "tonight’s check";
  const [name, setName] = useState("");
  const [contactValue, setContactValue] = useState(emptyContactField);
  const [contactError, setContactError] = useState<string | null>(null);

  function submit() {
    const resolved = resolveGuestContact(contactValue);
    if (!resolved.ok) {
      setContactError(resolved.message);
      return;
    }
    setContactError(null);
    const guest = { name: name.trim(), contact: resolved.contact };
    saveGuest(receiptId, guest);
    onJoined(guest);
  }

  return (
    <InterviewChrome
      step={1}
      total={3}
      hideProgress
      kicker={place}
      title={isHost ? "You're hosting — claim under what name?" : `Here is the tab for ${place}`}
      stepKey="join"
      footer={
        <ContinueButton disabled={!name.trim()} onClick={submit}>
          See the check
        </ContinueButton>
      }
    >
      <HostMessage note={hostNote} />
      <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
        {isHost
          ? "Pick what you ordered too. Leftovers can still land on you when you close claiming."
          : "Your host has added you to the tab. You can claim items that you consumed by starting with adding your name and contact."}
      </p>
      {hasImage ? <ReceiptImageButton receiptId={receiptId} hasImage /> : null}
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
      <GuestContactField
        value={contactValue}
        onChange={(next) => {
          setContactValue(next);
          setContactError(null);
        }}
        error={contactError}
      />
    </InterviewChrome>
  );
}

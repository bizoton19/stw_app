"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGuest, type GuestIdentity } from "@/lib/session";

export function JoinGuest({
  receiptId,
  restaurant,
  onJoined,
  isHost = false,
  defaultName = "",
}: {
  receiptId: string;
  restaurant: string;
  onJoined: (guest: GuestIdentity) => void;
  isHost?: boolean;
  defaultName?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState("");

  return (
    <InterviewChrome
      step={1}
      total={3}
      kicker={restaurant || "At the table"}
      title={isHost ? "You're hosting — claim under what name?" : "What should we call you?"}
      stepKey="join"
      onBack={() => router.push("/")}
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
      <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
        {isHost
          ? "Pick what you ordered too. Leftovers can still land on you when you close claiming."
          : "A name is enough. Add a handle so the host can reach you if something looks off."}
      </p>
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

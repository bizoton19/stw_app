"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGuest, type GuestIdentity } from "@/lib/session";

export function JoinGuest({
  receiptId,
  restaurant,
  onJoined,
}: {
  receiptId: string;
  restaurant: string;
  onJoined: (guest: GuestIdentity) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  return (
    <InterviewChrome
      step={1}
      total={2}
      kicker={restaurant || "You're at the table"}
      title="What should we call you?"
      onBack={() => {
        router.push("/");
      }}
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
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        No account. A name is enough to claim. Add a number or handle so the
        host can reach you if something looks off.
      </p>
      <Label htmlFor="guest-name" className="mb-2">
        Name
      </Label>
      <Input
        id="guest-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-xl text-base"
        placeholder="Alex"
        autoComplete="name"
      />
      <Label htmlFor="guest-contact" className="mt-4 mb-2">
        Contact <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        id="guest-contact"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        className="h-12 rounded-xl text-base"
        placeholder="phone, Venmo, or email"
        autoComplete="tel"
      />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Hosting this check?{" "}
        <Link href={`/r/${receiptId}?host=1`} className="font-semibold text-primary">
          Open host tools
        </Link>
      </p>
    </InterviewChrome>
  );
}

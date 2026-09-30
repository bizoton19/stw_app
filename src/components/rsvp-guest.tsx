"use client";

import { useMemo, useState } from "react";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, saveGuest } from "@/lib/session";
import type { PublicReceipt } from "@/lib/types";

export function RsvpGuest({
  receipt,
  inviteToken,
  onDone,
}: {
  receipt: PublicReceipt;
  inviteToken: string;
  onDone: (next: PublicReceipt) => void;
}) {
  const inviteMatch = inviteToken
    ? receipt.invitees?.find((row) => row.response === "invited")
    : undefined;
  const [name, setName] = useState(inviteMatch?.personName ?? "");
  const [contact, setContact] = useState(inviteMatch?.personContact ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"going" | "maybe" | "cant" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const whenLabel = useMemo(() => {
    if (!receipt.nightAt) return null;
    return new Date(receipt.nightAt).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [receipt.nightAt]);

  const place = receipt.restaurant?.trim() || "the outing";
  const goingCount =
    receipt.invitees?.filter((row) => row.response === "going").length ?? 0;

  async function submit(response: "going" | "maybe" | "cant") {
    if (!inviteToken && !name.trim()) {
      setErr("Add your name so the host knows who’s in.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { receipt: next } = await api<{ receipt: PublicReceipt }>(
        `/api/receipts/${receipt.id}/rsvp`,
        {
          method: "POST",
          body: JSON.stringify({
            response,
            personName: name.trim() || undefined,
            personContact: contact.trim() || null,
            inviteToken: inviteToken || null,
          }),
        },
      );
      saveGuest(receipt.id, {
        name: name.trim() || inviteMatch?.personName || "Guest",
        contact: contact.trim(),
      });
      setDone(response);
      onDone(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t send RSVP");
    } finally {
      setBusy(false);
    }
  }

  return (
    <InterviewChrome
      step={1}
      total={2}
      hideProgress
      kicker={whenLabel || "Upcoming"}
      title={place}
      stepKey="rsvp"
      footer={
        done ? (
          <p className="px-1 py-2 text-center text-[15px] leading-[22px] text-ink-soft">
            {done === "going"
              ? "You’re going — claim opens when the host uploads the check."
              : done === "maybe"
                ? "Got it — maybe. You can change this anytime from this link."
                : "Noted. Thanks for letting them know."}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <ContinueButton disabled={busy} onClick={() => void submit("going")}>
              Going
            </ContinueButton>
            <QuietButton disabled={busy} onClick={() => void submit("maybe")}>
              Maybe
            </QuietButton>
            <QuietButton disabled={busy} onClick={() => void submit("cant")}>
              Can’t
            </QuietButton>
          </div>
        )
      }
    >
      <HostMessage note={receipt.hostInfo?.note} />
      <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
        {inviteToken
          ? "You’re invited. RSVP now — you’ll claim what you had after the check is up."
          : "RSVP for this outing. The host will open claiming once the check is uploaded."}
      </p>
      {goingCount > 0 ? (
        <p className="mb-3 text-[13px] text-muted-foreground">{goingCount} going so far</p>
      ) : null}
      {err ? <p className="mb-3 text-[14px] text-destructive">{err}</p> : null}
      {!done ? (
        <>
          <Label htmlFor="rsvp-name" className="mb-2 text-[13px] font-medium">
            Name
          </Label>
          <Input
            id="rsvp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl border-border bg-transparent text-base"
            placeholder="Alex"
            autoComplete="name"
          />
          <Label htmlFor="rsvp-contact" className="mt-4 mb-2 text-[13px] font-medium">
            Contact <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="rsvp-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="h-12 rounded-xl border-border bg-transparent text-base"
            placeholder="phone, Venmo, or email"
            autoComplete="tel"
          />
        </>
      ) : null}
    </InterviewChrome>
  );
}

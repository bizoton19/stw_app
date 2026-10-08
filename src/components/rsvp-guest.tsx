"use client";

import { useMemo, useState } from "react";
import { ContinueButton, InterviewChrome } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RsvpConfirmation } from "@/components/rsvp-confirmation";
import { api, getGuest, saveGuest } from "@/lib/session";
import type { PublicReceipt } from "@/lib/types";
import { cn } from "@/lib/utils";

type RsvpResponse = "going" | "maybe" | "cant";

const CHOICES: { value: RsvpResponse; label: string }[] = [
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "cant", label: "Can’t" },
];

export function RsvpGuest({
  receipt,
  inviteToken,
  onDone,
}: {
  receipt: PublicReceipt;
  inviteToken: string;
  onDone: (next: PublicReceipt) => void;
}) {
  const saved = getGuest(receipt.id);
  const already =
    receipt.invitees?.find(
      (row) =>
        (row.response === "going" ||
          row.response === "maybe" ||
          row.response === "cant") &&
        saved?.name &&
        row.personName.toLowerCase() === saved.name.toLowerCase(),
    ) ?? null;

  const [name, setName] = useState(already?.personName || saved?.name || "");
  const [contact, setContact] = useState(
    already?.personContact || saved?.contact || "",
  );
  const [note, setNote] = useState(already?.note ?? "");
  const [response, setResponse] = useState<RsvpResponse | null>(
    already?.response === "going" || already?.response === "maybe" || already?.response === "cant"
      ? already.response
      : null,
  );
  const [busy, setBusy] = useState(false);
  const initialDone =
    already?.response === "going" || already?.response === "maybe" || already?.response === "cant"
      ? already.response
      : null;
  const [done, setDone] = useState<RsvpResponse | null>(initialDone);
  const [showForm, setShowForm] = useState(!initialDone);
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

  const canSave = Boolean(name.trim() && response) && !busy;

  async function save() {
    if (!name.trim()) {
      setErr("Add your name so the host knows who’s in.");
      return;
    }
    if (!response) {
      setErr("Pick Going, Maybe, or Can’t.");
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
            personName: name.trim(),
            personContact: contact.trim() || null,
            inviteToken: inviteToken || null,
            note: note.trim() || null,
          }),
        },
      );
      saveGuest(receipt.id, {
        name: name.trim(),
        contact: contact.trim(),
      });
      // Host push fires server-side only after this POST succeeds.
      setDone(response);
      setShowForm(false);
      onDone(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t send RSVP");
    } finally {
      setBusy(false);
    }
  }

  if (done && !showForm) {
    return (
      <RsvpConfirmation
        receipt={receipt}
        response={done}
        busy={busy}
        onChangeRsvp={() => {
          setResponse(done);
          setShowForm(true);
        }}
      />
    );
  }

  return (
    <InterviewChrome
      step={1}
      total={2}
      hideProgress
      kicker={whenLabel || "Upcoming"}
      motif="coupe-pair"
      title={place}
      stepKey="rsvp"
      footer={
        <ContinueButton disabled={!canSave} onClick={() => void save()}>
          {busy ? "Saving…" : "Save RSVP"}
        </ContinueButton>
      }
    >
      <HostMessage note={receipt.hostInfo?.note} />
      <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
        RSVP for this outing. Same link for everyone — you can change your answer later.
      </p>
      {goingCount > 0 ? (
        <p className="mb-3 text-[13px] text-muted-foreground">{goingCount} going so far</p>
      ) : null}
      {err ? <p className="mb-3 text-[14px] text-destructive">{err}</p> : null}

      <Label className="mb-2 text-[13px] font-medium">Your answer</Label>
      <div className="mb-4 flex gap-2" role="radiogroup" aria-label="RSVP answer">
        {CHOICES.map((choice) => {
          const on = response === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => {
                setResponse(choice.value);
                setErr(null);
              }}
              className={cn(
                "h-12 flex-1 rounded-xl border text-[15px] font-semibold transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-ink-soft",
              )}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

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
      <Label htmlFor="rsvp-note" className="mt-4 mb-2 text-[13px] font-medium">
        Note <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Textarea
        id="rsvp-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="min-h-[72px] rounded-xl border-border bg-transparent text-base"
        placeholder="Bringing a +1, running late…"
        maxLength={280}
      />
    </InterviewChrome>
  );
}

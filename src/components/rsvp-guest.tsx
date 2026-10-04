"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getGuest, saveGuest } from "@/lib/session";
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

  const seeded =
    already?.response === "going" || already?.response === "maybe" || already?.response === "cant"
      ? already.response
      : null;
  const [name, setName] = useState(already?.personName || saved?.name || "");
  const [contact, setContact] = useState(
    already?.personContact || saved?.contact || "",
  );
  const [note, setNote] = useState(already?.note ?? "");
  const [choice, setChoice] = useState<"going" | "maybe" | "cant" | null>(seeded);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(() => ({
    response: seeded,
    name: seeded ? (already?.personName || "").trim() : "",
    contact: seeded ? (already?.personContact || "").trim() : "",
    note: seeded ? (already?.note || "").trim() : "",
  }));
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

  const draftMatchesSave =
    choice === committed.response &&
    name.trim() === committed.name &&
    contact.trim() === committed.contact &&
    note.trim() === committed.note;
  const saveDisabled = busy || choice == null || draftMatchesSave;

  async function save() {
    if (!choice || busy || draftMatchesSave) return;
    if (!name.trim()) {
      setErr("Add your name so the host knows who’s in.");
      return;
    }
    const response = choice;
    const personName = name.trim();
    const personContact = contact.trim();
    const personNote = note.trim();
    setBusy(true);
    setErr(null);
    try {
      const { receipt: next } = await api<{ receipt: PublicReceipt }>(
        `/api/receipts/${receipt.id}/rsvp`,
        {
          method: "POST",
          body: JSON.stringify({
            response,
            personName,
            personContact: personContact || null,
            inviteToken: inviteToken || null,
            note: personNote || null,
          }),
        },
      );
      saveGuest(receipt.id, {
        name: personName,
        contact: personContact,
      });
      setCommitted({
        response,
        name: personName,
        contact: personContact,
        note: personNote,
      });
      onDone(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t send RSVP");
    } finally {
      setBusy(false);
    }
  }

  const thanks =
    committed.response === "going"
      ? "You’re going — claim opens when the host uploads the check."
      : committed.response === "maybe"
        ? "Got it — maybe. Change anytime below."
        : committed.response === "cant"
          ? "Noted. You can change this anytime below."
          : null;

  const pinRef = useRef<HTMLDivElement>(null);
  usePinAboveKeyboard(pinRef);

  return (
    <div ref={pinRef} className="flex min-h-0 flex-1 flex-col">
      <InterviewChrome
        step={1}
        total={2}
        hideProgress
        kicker={whenLabel || "Upcoming"}
        motif="coupe-pair"
        title={place}
        stepKey="rsvp"
      >
        <HostMessage note={receipt.hostInfo?.note} />
        <p className="mb-4 text-[15px] leading-[22px] text-muted-foreground">
          RSVP for this outing. Same link for everyone — you can change your answer later.
        </p>
        {thanks ? (
          <p className="px-1 py-2 text-center text-[15px] leading-[22px] text-ink-soft">
            {thanks}
          </p>
        ) : null}
        {goingCount > 0 ? (
          <p className="mb-3 text-[13px] text-muted-foreground">{goingCount} going so far</p>
        ) : null}
        {err ? <p className="mb-3 text-[14px] text-destructive">{err}</p> : null}
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
        <div className="mt-1 flex flex-col gap-1">
          <QuietButton
            aria-pressed={choice === "going"}
            className={choice === "going" ? "border-[1.5px] border-primary" : undefined}
            onClick={() => setChoice("going")}
          >
            Going
          </QuietButton>
          <QuietButton
            aria-pressed={choice === "maybe"}
            className={choice === "maybe" ? "border-[1.5px] border-primary" : undefined}
            onClick={() => setChoice("maybe")}
          >
            Maybe
          </QuietButton>
          <QuietButton
            aria-pressed={choice === "cant"}
            className={choice === "cant" ? "border-[1.5px] border-primary" : undefined}
            onClick={() => setChoice("cant")}
          >
            Can’t
          </QuietButton>
          <ContinueButton disabled={saveDisabled} onClick={() => void save()}>
            Save
          </ContinueButton>
        </div>
      </InterviewChrome>
    </div>
  );
}

/**
 * RSVP only. Shrink this column with `visualViewport` so a focused field
 * can scroll above the keyboard. Save stays in the scroll — it is not pinned.
 * Other pages and PhoneShell are unchanged.
 */
function usePinAboveKeyboard(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;

    const sync = () => {
      const parent = el.parentElement;
      if (!parent) return;
      // Parent rect is in visual-viewport coordinates, so offsetTop is already
      // included. Keyboard closed → overflow ~0 and the column stays on flex.
      const overflow = parent.getBoundingClientRect().bottom - vv.height;
      el.style.marginBottom = overflow > 1 ? `${overflow}px` : "";
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    const parent = el.parentElement;
    const observer = parent ? new ResizeObserver(sync) : null;
    if (parent && observer) observer.observe(parent);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer?.disconnect();
      el.style.marginBottom = "";
    };
  }, [ref]);
}

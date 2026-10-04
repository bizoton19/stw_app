"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ContinueButton, InterviewChrome, QuietButton } from "@/components/interview-chrome";
import { HostMessage } from "@/components/host-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CALLING_COUNTRIES,
  DEFAULT_COUNTRY_ID,
  composeE164,
  countryById,
  fieldsFromStoredPhone,
  nationalPlaceholder,
  rsvpPhoneSaveError,
} from "@/lib/phone-e164";
import { readRsvpDraft, writeRsvpDraft } from "@/lib/rsvp-draft";
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
  const guest = getGuest(receipt.id);
  const [name, setName] = useState(guest?.name || "");
  const [countryId, setCountryId] = useState(DEFAULT_COUNTRY_ID);
  const [nationalNumber, setNationalNumber] = useState("");
  const [contact, setContact] = useState(guest?.contact || "");
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"going" | "maybe" | "cant" | null>(null);
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState<{
    response: "going" | "maybe" | "cant" | null;
    name: string;
    phone: string;
    contact: string;
    note: string;
  }>({
    response: null,
    name: "",
    phone: "",
    contact: "",
    note: "",
  });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const draft = readRsvpDraft(receipt.id);
    if (!draft) return;
    const stored = fieldsFromStoredPhone(draft.phone);
    setName(draft.name);
    setCountryId(stored.countryId);
    setNationalNumber(stored.nationalNumber);
    setContact(draft.contact);
    setNote(draft.note);
    setChoice(draft.response);
    setCommitted({
      response: draft.response,
      name: draft.name.trim(),
      phone: draft.phone,
      contact: draft.contact.trim(),
      note: draft.note.trim(),
    });
  }, [receipt.id]);

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

  const phone = composeE164(countryId, nationalNumber) ?? "";
  const draftMatchesSave =
    choice === committed.response &&
    name.trim() === committed.name &&
    phone === committed.phone &&
    contact.trim() === committed.contact &&
    note.trim() === committed.note;
  const saveDisabled = busy || choice == null || draftMatchesSave;

  async function save() {
    if (!choice || busy || draftMatchesSave) return;
    if (!name.trim()) {
      setErr("Add your name so the host knows who’s in.");
      return;
    }
    const phoneError = rsvpPhoneSaveError(countryId, nationalNumber);
    if (phoneError || !phone) {
      setErr(phoneError ?? "That phone number doesn’t look complete.");
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
            phone,
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
      writeRsvpDraft(receipt.id, {
        response,
        name: personName,
        countryId,
        nationalNumber,
        contact: personContact,
        note: personNote,
        phone,
      });
      setCommitted({
        response,
        name: personName,
        phone,
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
          {receipt.hostName?.trim()
            ? `${receipt.hostName.trim()} has invited you to RSVP.`
            : "You’ve been invited to RSVP."}
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
          placeholder="Robert Baratheon"
          autoComplete="name"
        />
        <Label htmlFor="rsvp-phone" className="mt-4 mb-2 text-[13px] font-medium">
          Phone
        </Label>
        <div className="flex gap-2">
          <div className="relative h-12 w-[7.5rem] shrink-0">
            <div
              aria-hidden
              className="flex h-12 items-center rounded-xl border border-border bg-transparent px-3 text-base text-foreground"
            >
              {countryById(countryId).abbr} {countryById(countryId).callingCode}
            </div>
            <select
              aria-label="Country"
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {CALLING_COUNTRIES.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name} {country.callingCode}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="rsvp-phone"
            type="tel"
            value={nationalNumber}
            onChange={(e) => setNationalNumber(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-xl border-border bg-transparent text-base"
            placeholder={nationalPlaceholder(countryId)}
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <Label htmlFor="rsvp-contact" className="mt-4 mb-2 text-[13px] font-medium">
          Contact <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="rsvp-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          className="h-12 rounded-xl border-border bg-transparent text-base"
          placeholder=""
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

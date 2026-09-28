"use client";

import { useMemo, useState } from "react";
import {
  DIAL_CODES,
  DEFAULT_DIAL,
  digitsOnly,
  findDialByIso,
  type GuestContactKind,
  validateOptionalGuestContact,
} from "@/lib/contact";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ContactFieldValue = {
  kind: GuestContactKind;
  email: string;
  phoneNational: string;
  dialIso: string;
};

export function emptyContactField(): ContactFieldValue {
  return { kind: "", email: "", phoneNational: "", dialIso: DEFAULT_DIAL.iso };
}

export function resolveGuestContact(
  value: ContactFieldValue,
): { ok: true; contact: string } | { ok: false; message: string } {
  return validateOptionalGuestContact({
    kind: value.kind,
    email: value.email,
    phoneNational: value.phoneNational,
    dialIso: value.dialIso,
  });
}

export function GuestContactField({
  value,
  onChange,
  error,
}: {
  value: ContactFieldValue;
  onChange: (next: ContactFieldValue) => void;
  error?: string | null;
}) {
  const dial = useMemo(() => findDialByIso(value.dialIso), [value.dialIso]);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <Label className="mb-2 text-[13px] font-medium">
        Contact <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <div className="mb-2 flex gap-2">
        {(
          [
            ["", "None"],
            ["email", "Email"],
            ["phone", "Phone"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange({ ...value, kind })}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
              value.kind === kind
                ? "border-[var(--merlot,#6E2E35)] bg-[rgba(110,46,53,0.08)] text-[var(--merlot,#6E2E35)]"
                : "border-border bg-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {value.kind === "email" ? (
        <Input
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          className="h-12 rounded-xl border-border bg-transparent text-base"
          placeholder="alex@email.com"
          autoComplete="email"
          inputMode="email"
        />
      ) : null}

      {value.kind === "phone" ? (
        <div className="flex gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-12 min-w-[5.5rem] items-center justify-center gap-1 rounded-xl border border-border bg-transparent px-2 text-[15px] font-semibold"
              aria-label="Country code"
            >
              {dial.dial}
              <span className="text-muted-foreground">▾</span>
            </button>
            {open ? (
              <div className="absolute left-0 z-20 mt-1 max-h-56 w-64 overflow-auto rounded-xl border border-border bg-[var(--background,#f6f4f1)] shadow-md">
                {DIAL_CODES.map((c) => (
                  <button
                    key={c.iso + c.dial}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-[14px] hover:bg-black/5"
                    onClick={() => {
                      onChange({ ...value, dialIso: c.iso });
                      setOpen(false);
                    }}
                  >
                    <span>
                      {c.name} ({c.iso})
                    </span>
                    <span className="font-semibold text-muted-foreground">{c.dial}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Input
            value={value.phoneNational}
            onChange={(e) =>
              onChange({
                ...value,
                phoneNational: digitsOnly(e.target.value).slice(0, 15),
              })
            }
            className="h-12 flex-1 rounded-xl border-border bg-transparent text-base"
            placeholder="Phone number"
            autoComplete="tel"
            inputMode="tel"
          />
        </div>
      ) : null}

      {error ? <p className="mt-1.5 text-[12px] text-red-700">{error}</p> : null}
    </div>
  );
}

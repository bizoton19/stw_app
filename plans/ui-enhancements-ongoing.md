# UI enhancements — ongoing

**Status:** active checklist  
**Scope:** guest claim + settle + host ready (mobile first; web parity where noted)  
**Related:** [ui-enhance.guide.md](./ui-enhance.guide.md), [requirements.md](./requirements.md)

Track shippable UI polish. Mark items `[x]` when done in code.

---

## Checklist

- [x] **UE-1 · Claim join copy** — Landing “What should we call you?” for guests: title **Here is the tab for {restaurant}**; body **Your host has added you to the tab, you can claim items that you consumed by starting with adding your name and contact.**
- [x] **UE-2 · Tap-to-select claim lines** — “What did you have?” uses full-row tap select (bottle-green selected state). No checkbox / multi-check chrome (web + native).
- [x] **UE-3 · No Home on claim** — Remove Home / Back-home quiet actions from the guest claim flow screens (join, pick, closed). On-back may still leave the flow.
- [x] **UE-4 · Claim CTA → next screen** — Remove “Running totals” secondary CTA. Primary claim action advances (qty when needed, else settle). Drop competing total buttons.
- [x] **UE-5 · Qty Finish** — “How many of each?” primary button label is **Finish**; on success open settle.
- [x] **UE-6 · Settle Payment + leave confirm** — Guest settle title **Settle Payment**. Tapping an openable pay method first confirms: you are now leaving Split the Wine.
- [x] **UE-7 · Host ready table image** — “Ready to split / Got the check” host intro shows a restaurant-table photo (stock), not only WineMark.
- [x] **UE-8 · View receipt image** — Claimants can open the tab photo in a contained viewer and download/share when the host uploaded one (`GET /api/receipts/:id/image`, `hasImage` on receipt).
- [x] **UE-9 · Still-on-table price** — Live board “still on the table” / remaining rows show **item price before** the “N left” count.
- [x] **UE-10 · Blank join name** — Do not autofill the guest name field from the host’s payment handle; leave name blank.
- [x] **UE-11 · Remaining = unit × left** — Live board / settle show **unit price × units left** and a running **still on the table** dollar total that moves down on claim and up on unclaim (SSE/refresh).
- [x] **UE-12 · Race claim copy** — On concurrent claim loss (`409 not_enough_remaining`), show **“{item} has already been claimed by {user}”** (or partial-left variant) using `claimedBy` from the API.

**Related plan (not UI checklist):** [bottle-glass-claiming.md](./bottle-glass-claiming.md) — hybrid host-confirmed bottle → glasses for wine packages.

---

## Notes

- Prefer mobile `apps/mobile` changes first; mirror web `src/components` when the same surface exists.
- Host-facing live board titles stay “Live board” where useful; **Settle Payment** is the guest settle headline.
- Receipt image requires persisting bytes at parse time and a public `GET` image route.
- Remaining line dollars use `remainingLineCents` (slice of `unitCentsArray`) so pennies stay fair when qty does not divide evenly.

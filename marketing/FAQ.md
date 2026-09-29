# Split the Wine — FAQ

## What is Split the Wine?

Split the Wine is a fast, account-free way for a group to divide a restaurant check after the restaurant hands the table one itemized bill.

One person scans the receipt. The app turns it into items. Guests open a private link, claim what they had, split shared food and drinks, and see exactly what they owe.

It is built for the common moment when a restaurant does not want to create many separate checks for a large group.

---

## What problem does it solve?

Restaurants often prefer one check for a large party because separating orders, handling shared dishes, reallocating tax and gratuity, and processing many cards slows the closeout process.

The usual workaround is also bad:

- One person pays the full check
- The group does mental math or opens a calculator
- Someone forgets an appetizer, bottle of wine, service charge, or tax
- The payer has to chase people later

Split the Wine makes the receipt—not the restaurant POS—the source of truth. The restaurant closes one check; the group independently agrees on who owes what.

---

## Does the restaurant need to use Split the Wine?

No. The restaurant does not install anything, create an account, change its POS system, or display a table QR code.

Split the Wine is a diner-side product. It works from the itemized receipt the restaurant already provides.

---

## Does everyone need to download the app or make an account?

No.

The person organizing the split creates a temporary private session after scanning the receipt. They share an invitation link through the phone’s **Share** button (Messages, WhatsApp, Signal, email, AirDrop, Nearby Share when available) or display a **QR code** of the same link.

Guests open the link in a browser (or the app if they have it), enter a display name, and claim items. No Split the Wine account is required.

---

## How do I share the claim link at the table?

There is one claim link. How you deliver it depends on who is sitting with you. There is **no** common nearby protocol that works from iPhone to Android or Android to iPhone—AirDrop and Nearby Share do not cross platforms.

Use these cards as the share playbook (and as the source for a marketing sliding-card UI):

### Card 1 — At the table (mixed phones)

**Best: QR**

1. Host taps **QR** on the share screen.
2. Hold the bright code up or pass the phone.
3. Everyone scans with Camera (iOS or Android).

No contacts needed. Works when the table is a mix of iPhones and Androids.

### Card 2 — iPhone → iPhone

**Share → AirDrop** (not AirPlay)

1. Guest: Control Center → AirDrop on (Contacts Only or Everyone for 10 Minutes).
2. Host taps **Share** → **AirDrop** → their name.
3. Often one person at a time.

Also fine: Messages, or the same QR.

### Card 3 — iPhone → Android

**No AirDrop / no Nearby path.**

Use **QR**, or **Share** into Messages / WhatsApp / email if you already chat with them. Copy link is the fallback.

### Card 4 — Android → Android

**Share → Nearby Share / Quick Share** (name varies by phone brand).

Both need Bluetooth/Wi‑Fi on; pick the nearby device. QR still works if Nearby fails.

### Card 5 — Android → iPhone

**No Nearby / no AirDrop path.**

Use **QR**, or **Share** into a chat app you both have. Copy link is the fallback.

### Quick matrix

| From → To | Nearby / AirDrop? | What to use |
|---|---|---|
| Any → mixed table | No single nearby path | **QR** |
| iPhone → iPhone | AirDrop | **Share → AirDrop** or QR |
| Android → Android | Nearby / Quick Share | **Share → Nearby** or QR |
| iPhone → Android | No | **QR** or chat app |
| Android → iPhone | No | **QR** or chat app |

**Product rule:** the Share button opens the OS share sheet. Split the Wine does not invent a cross-platform nearby stack—QR is the universal “everyone at the table” path.

---

## Why use a link and a QR code instead of a short join code?

The private invitation link is the authorization mechanism. It contains a long, random token that is difficult to guess.

The QR code is simply a camera-friendly representation of the exact same link. It is useful for people sitting nearby, while a shared message link works better for the rest of a large table.

A short typed code adds little value when people already have a link, while creating extra friction, typos, and a potential brute-force target. Split the Wine should not need a public “find your table” or code-entry workflow in its core experience.

---

## What happens when a restaurant will not split the check?

That is the primary use case.

One person can pay the restaurant once. The group then uses Split the Wine to allocate the bill fairly and reimburse that person using the payment method they already prefer.

The product is not trying to make the restaurant process eight cards. It helps eight people settle a single check among themselves.

---

## How does the receipt scan work?

The app uses receipt extraction and AI-assisted interpretation to identify line items, quantities, prices, subtotal, tax, fees, gratuity, discounts, and total.

It should validate the arithmetic deterministically:

```text
items + tax + fees + tip = receipt total
```

If the scan is uncertain, the app should highlight only the uncertain line or field rather than force the user to review every item. Users can correct an item in one tap.

---

## What does AI do beyond OCR?

AI should make hard restaurant receipts easier to resolve, not make opaque financial decisions for the group.

Useful AI capabilities include:

- Flagging unreadable or low-confidence receipt lines
- Classifying likely shared items such as bottles, pitchers, appetizers, desserts, tasting menus, service charges, and discounts
- Detecting a mismatch between claimed items and the receipt total
- Identifying an unassigned line item and proposing a restrained hypothesis
- Explaining a likely wine package, bottle count, or per-glass estimate
- Turning a natural-language instruction into a proposed split action

For example:

> “There is one unassigned $60 item. The receipt label is unclear, but it may be a bottle of wine. Is that right?”

The user can then choose **Split among wine drinkers**, **Choose people**, **Edit item**, or **Not wine**.

AI should suggest. People should confirm.

---

## How does the app handle wine bottles and wine packages?

Wine is a common source of splitting mistakes because it is shared, receipt labels may be abbreviated, and a package may show a unit price and quantity rather than a plain-language description.

When the receipt supports it, Split the Wine can present a transparent estimate, such as:

```text
Wine package — $345
Likely: 5 bottles × $69
Estimated: about 25 standard pours
Approximate cost: $13.80 per standard pour
```

A typical 750 mL wine bottle yields about five 5-ounce pours, but restaurant pour sizes vary. The app should label this as an estimate, never treat it as proof of who consumed what.

The group then chooses the allocation: equal among selected people, by number of glasses, or manual amounts.

---

## How are shared food, tax, tip, and service charges handled?

The app should make shared allocation simple:

- Select an item and choose the diners sharing it
- Split equally by default
- Offer custom shares only when needed
- Apply tax and tip proportionally by default
- Detect likely included gratuity or service charge and ask whether an additional tip should be added
- Reconcile the final allocation to the printed receipt total

The goal is to avoid hidden math. Every diner should be able to see:

```text
Your items:       $42.00
Shared items:     $15.00
Tax share:         $4.20
Tip share:         $8.40
Total owed:       $69.60
```

---

## How do people pay each other?

Split the Wine determines the amounts owed. It does not need to hold money, operate a wallet, or become a payment processor.

The payer can add a payment destination for that individual split, such as a Venmo profile, PayPal payment link, Zelle information, Cash App handle, or another method. Each guest sees their amount and can open or copy the appropriate payment details.

The product promise is:

> Split the bill here. Pay in the app you already use.

---

## Does Split the Wine confirm that someone paid?

Not automatically in the account-free version.

Because Split the Wine does not require users to link Venmo, PayPal, bank, or card accounts, it should not claim it can independently confirm a payment. A diner may mark **I sent it**, and the organizer may mark **Received**, but those are user-reported statuses.

The product should use accurate language:

- Not marked sent
- Payment app opened
- Marked sent by guest
- Marked received by organizer
- Awaiting confirmation

It should not say “payment confirmed” unless a future payment-provider integration can actually verify it.

---

## How is this different from Amex Send & Split?

Amex Send & Split is useful after an eligible Amex cardholder already knows what each person owes. It can send and track repayment requests through linked Venmo or PayPal accounts.

Split the Wine addresses the step before that: figuring out a fair allocation from a real restaurant receipt.

| Question | Amex Send & Split | Split the Wine |
|---|---|---|
| Who can use it? | Eligible Amex cardholder with linked payment rail | Any group, regardless of card or payment method |
| Reads an itemized restaurant receipt? | No | Yes |
| Lets diners claim food and drinks? | No | Yes |
| Resolves wine, shared dishes, fees, and unclear lines? | Manual allocation required | AI-assisted, group-confirmed allocation |
| Sends formal repayment requests? | Yes, through Venmo/PayPal | Not in the account-free core product |
| Automatically tracks those provider requests? | Yes, for requests in that integrated flow | No; status is optional and user-reported |

Amex is primarily a repayment-request and collection layer. Split the Wine is a receipt-understanding and fair-allocation layer.

---

## What is the wedge or edge differentiator?

### The wedge

**Restaurants will not split the check. Split the Wine makes one check easy to split fairly.**

The narrow, high-pain entry point is the large restaurant table where separate checks are unavailable, inconvenient, or slow. The organizer scans the receipt; the group claims items; everyone learns what they owe.

This is not a generic expense tracker and not a generic peer-to-peer payment product. It starts at a highly specific, emotionally familiar moment: a group is ready to leave, one bill arrives, and no one wants to do the math.

### The edge

**Receipt intelligence for the ambiguous, shared parts of restaurant bills.**

Many bill-splitting products can divide a number evenly or let one person type in custom amounts. The difficult part is translating a messy restaurant receipt into a trustworthy allocation:

- A wine package listed as “5 × $69”
- A $60 abbreviated line that may be an unclaimed bottle
- Shared appetizers and desserts
- Included gratuity versus an additional tip
- Discounts and card surcharges
- Poor OCR, hidden items, duplicate-looking lines, and totals that do not reconcile

Split the Wine’s differentiated intelligence should identify these moments, explain why something is uncertain, and ask one clear question rather than force the organizer into spreadsheet work.

### The durable product principle

> AI finds what people forget to split. People decide how to split it.

That is more trustworthy than an app that silently assigns consumption or makes financial assumptions. It also preserves the low-friction philosophy: AI reduces review and coordination without adding accounts, payment custody, restaurant integration, or complex setup.

---

## What is the ideal experience?

A group of ten finishes dinner. The restaurant gives them one itemized check and will not split it.

1. One person pays the restaurant.
2. They scan the receipt with Split the Wine.
3. The app creates a private temporary session.
4. The organizer shares a link to the existing group chat and optionally shows the same link as a QR code.
5. Guests claim entrées and drinks; shared dishes are split among selected people.
6. The app notices an unassigned $60 line and asks whether it was the bottle of wine.
7. The group confirms the allocation, tax, and tip.
8. Each diner sees a clear total and pays the organizer in the payment app they already use.

No restaurant integration. No guest accounts. No app download requirement. No passing a phone around. No hidden math.

---

## What should Split the Wine avoid?

To preserve its low-friction philosophy, the product should avoid:

- Mandatory accounts, phone verification, or social graphs
- Becoming a wallet, funds custodian, or payment processor
- Requiring restaurants to integrate a POS, menu system, or table QR code
- A public short-code lookup mechanism as the standard join flow
- Complex long-term expense tracking by default
- Restaurant discovery, wine ratings, social feeds, and unrelated lifestyle features
- Claiming payment confirmation without a verified payment-provider integration
- AI that silently assigns costs or alleges that a person consumed alcohol

The product should be a temporary, private utility: finish the split, settle up elsewhere, and move on.

---

## What is the one-sentence pitch?

**Restaurant will not split the check? Scan the receipt, share one private link, and let everyone claim their part.**

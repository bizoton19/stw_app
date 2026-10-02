# guestId contract

Locked for web and for Expo to mirror. Issue #18.

`guestId` is who a person is. The display name is cosmetic and may collide. Claim delete stays token-based; `guestId` is not an auth secret.

## Fields

| Where | Field | Meaning |
| --- | --- | --- |
| Device guest record | `guestId` | UUID. Stable for this device on this receipt. |
| Device guest record | `name` | Cosmetic display name. Not unique. |
| Device guest record | `contact` | Optional phone, Venmo, or email. Cosmetic. |
| Claim and person total | `guestId` | Same UUID, copied onto each claim. Omitted on legacy claims. |
| Claim and person total | `personName` | Cosmetic display name stored on the claim. Same role as `name`. |
| Claim and person total | `personContact` | Optional. Same role as `contact`. |

There is no `displayName` field. Do not rename `personName`.

`guestId` is lowercase UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Web mints it with `crypto.randomUUID()`.

## When it is minted

Once per device per receipt, the first time that device joins:

- Web: **See the check** on `/r/[id]`, or RSVP save on a planning link (same guest record, so the later claim uses the same id).
- Editing the name reuses the stored `guestId`. It does not mint a new one.

Legacy records with only `name` / `contact` get a `guestId` the next time they are read, then rewritten.

Claims created without `guestId` (current Expo until it ships this) still group by exact `personName`. New web claims always send `guestId`.

## Persistence

| Client | Storage | Key | Value |
| --- | --- | --- | --- |
| Web | **localStorage** | `stw-guest:{receiptId}` | `{"guestId":"<uuid>","name":"Alex","contact":""}` |
| Expo | **AsyncStorage** | `stw-guest:{receiptId}` | same JSON |

Scope is one guest per receipt per browser profile (web) or app install (Expo). Two people on one profile share the key; a second person needs another profile, private window, or device.

Web migrates a legacy `sessionStorage` value at `stw-guest:{receiptId}` into localStorage on read and mints `guestId` if it was missing. Host tokens (`stw-host:`) and claim owner tokens (`stw-tokens:`) stay in sessionStorage on web and AsyncStorage on Expo. Do not move those.

## API

`POST /api/receipts/:id/claims`

```json
{
  "guestId": "2f1c0a2e-7b3d-4e1a-9c55-0b6e8a1d4f20",
  "personName": "Alex",
  "personContact": "@alex",
  "claims": [{ "itemId": "it_…", "units": 1 }]
}
```

Single-claim body (`itemId`, `units`, no `claims` array) accepts the same `guestId`, `personName`, and `personContact`.

- `personName` is required.
- `guestId` is optional for legacy clients. When present it must be a UUID or the API returns `400` `invalid`.
- The claim is stored with that `guestId`. Later claims with the same `guestId` rewrite `personName` / `personContact` on that guest’s existing claims so the label stays cosmetic.
- Response claims include `guestId` when set. `ownerToken` is only in the claim response / `tokens` map, never on the public receipt.

`POST /api/receipts/:id/guest`

```json
{ "guestId": "<uuid>", "personName": "Alex", "personContact": "" }
```

Rewrites the cosmetic label on claims that already have this `guestId`. Does not create claims and does not change who may delete them. `guestId` and `personName` are required.

Public receipt `claims[]` include `guestId` and `personName`. They omit `ownerToken` and `autoLeftover`.

## Mine, share so far, settle

Totals group by `guestId` when the claim has one. Claims with no `guestId` still group by exact `personName` (legacy).

Two claims named "Alex" with different `guestId`s are two people. Two claims with the same `guestId` are one person even if the label changed. The row’s `personName` is the latest label for that id.

On the device:

- Your row is `people.find((p) => p.guestId === guest.guestId)`.
- Do not fall back to `personName` when this device has a `guestId`. A same display name is someone else.
- That row’s `totalCents` is **your share so far** on the claim board and **you owe** on settle.
- `(you)` is the row whose `guestId` matches this device.

`PersonTotal` adds optional `guestId` next to the existing `personName` fields.

## Claim ownership (unchanged)

Deleting a claim still requires `x-claim-token` equal to that claim’s `ownerToken`, or `x-host-token` for the host. `guestId` does not authorize unclaim. Web keeps owner tokens in `sessionStorage` key `stw-tokens:{receiptId}` (`{ [claimId]: ownerToken }`). Expo keeps the same key in AsyncStorage.

## Expo follow

Mirror this file. Do not key claim-board mine, share, or settle by `name` / `personName`. Suggested shape:

```ts
type GuestIdentity = { guestId: string; name: string; contact: string };
type Claim = { guestId?: string; personName: string; personContact?: string; /* … */ };
```

Mint `guestId` when saving `stw-guest:{receiptId}`, send it on `POST /claims`, and match totals with `guestId`. RSVP invitee rows are still name-based; that roster is not this contract.

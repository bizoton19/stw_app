export type ReceiptStatus = "planning" | "draft" | "open" | "finalized";

export type InviteeResponse = "invited" | "going" | "maybe" | "cant";

export type Invitee = {
  id: string;
  personName: string;
  personContact?: string | null;
  /** Legacy personalized-invite token; new flow uses one group link only. */
  inviteToken: string;
  response: InviteeResponse;
  /** Optional note from the guest when they RSVP or change it. */
  note?: string | null;
  inviteSentAt?: string | null;
  updatedAt: string;
};
export type PayMethod =
  | "venmo"
  | "paypal"
  | "zelle"
  | "cashapp"
  | "moncash"
  | "natcash"
  | "other";

export type ItemKind = "food" | "drink";

export type ItemPour = {
  mode: "as_printed" | "glasses";
  glassesPerPrintedUnit: number;
};

export type Item = {
  id: string;
  name: string;
  qty: number;
  totalCents: number;
  kind?: ItemKind | null;
  pour?: ItemPour | null;
};

export type Fee = {
  id: string;
  name: string;
  amountCents: number;
};

export type Claim = {
  id: string;
  itemId: string;
  /** Stable joiner id. Missing on claims saved before guest identity shipped. */
  guestId?: string;
  personName: string;
  personContact?: string;
  units: number;
  createdAt: string;
};

export type HostPayment = {
  method: PayMethod;
  handle: string;
};

export type HostInfo = {
  /** One or more ways people can pay the host. */
  payments: HostPayment[];
  /** Optional note shown to claimers (expandable on the claim link). */
  note?: string | null;
};

export type ParseReviewChoice = "looks_good" | "remove_items" | "needs_edits";

export type VenueSource = "places" | "typed";

export type ReceiptVenue = {
  name: string;
  placeId?: string | null;
  provider?: "google" | "apple" | "mapbox" | null;
  formattedAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  source: VenueSource;
  confirmedAt: string;
  /** Google rating (1–5) after Place Details for a picked place. Nearby omits this. */
  rating?: number | null;
  /** Count behind `rating`. Nearby omits this. */
  userRatingCount?: number | null;
  /** Proxied `/api/places/photo` URL. Never a Google URL with an API key. */
  photoUrl?: string | null;
  websiteUri?: string | null;
  googleMapsUri?: string | null;
};

export type Receipt = {
  id: string;
  status: ReceiptStatus;
  restaurant: string;
  venue?: ReceiptVenue | null;
  /** Date printed on the check, if found — ISO `YYYY-MM-DD`. */
  receiptDate?: string | null;
  nightAt?: string | null;
  /** Host's display name on the public RSVP. Not the host note. */
  hostName?: string | null;
  expectedPartySize?: number | null;
  invitees?: Invitee[];
  items: Item[];
  fees: Fee[];
  claims: Claim[];
  hostInfo?: HostInfo;
  createdAt: string;
  imageName?: string;
  hasImage?: boolean;
  parseFlag?: string;
  parseReview?: ParseReviewChoice;
  parseReviewAt?: string;
};

export type PersonTotal = {
  guestId?: string;
  personName: string;
  personContact?: string;
  itemCents: number;
  feeCents: number;
  totalCents: number;
  lines: { itemId: string; itemName: string; units: number; cents: number }[];
};

export type Totals = {
  itemSubtotalCents: number;
  feeTotalCents: number;
  grandTotalCents: number;
  claimedItemCents: number;
  unclaimedItemCents: number;
  people: PersonTotal[];
};

export type PublicReceipt = Receipt & {
  remaining: Record<string, number>;
};

export type GuestIdentity = { guestId: string; name: string; contact: string };

/** Join / RSVP payload. `guestId` is omitted on first join and reused from storage. */
export type GuestDraft = { guestId?: string; name: string; contact: string };

export type PickedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

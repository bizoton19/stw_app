export type ReceiptStatus = "draft" | "open" | "finalized";

export type PayMethod =
  | "venmo"
  | "paypal"
  | "zelle"
  | "cashapp"
  | "moncash"
  | "natcash"
  | "other";

export type ItemKind = "food" | "drink";

export type Item = {
  id: string;
  name: string;
  qty: number;
  totalCents: number;
  /** Vision (or heuristic) food vs drink — optional for older receipts. */
  kind?: ItemKind | null;
};

export type Fee = {
  id: string;
  name: string;
  amountCents: number;
};

export type Claim = {
  id: string;
  itemId: string;
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
};

export type ParseReviewChoice = "looks_good" | "remove_items" | "needs_edits";

export type VenueSource = "places" | "typed";

/** Structured venue on the receipt (Phase 2). Lives and dies with the tab. */
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
};

export type Receipt = {
  id: string;
  status: ReceiptStatus;
  restaurant: string;
  /** Optional structured place — mirrors restaurant name when set. */
  venue?: ReceiptVenue | null;
  /** Date printed on the check, if vision found one — ISO `YYYY-MM-DD`. */
  receiptDate?: string | null;
  items: Item[];
  fees: Fee[];
  claims: Claim[];
  hostInfo?: HostInfo;
  createdAt: string;
  imageName?: string;
  /** True when tab photo bytes are stored for claimants. */
  hasImage?: boolean;
  parseFlag?: string;
  /** Host judgment of vision parse quality — used for model eval. */
  parseReview?: ParseReviewChoice;
  parseReviewAt?: string;
};

export type PersonTotal = {
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

export type ParseResult = {
  restaurant: string;
  /** Check date printed on the receipt, if readable — ISO `YYYY-MM-DD`. */
  receiptDate?: string | null;
  items: { name: string; qty: number; total: number; kind?: ItemKind | null }[];
  fees: { name: string; amount: number }[];
};

export type LiveEvent = {
  type: "snapshot" | "claim" | "unclaim" | "finalized" | "reopened" | "updated";
  receipt: PublicReceipt;
};

export type PublicClaim = Claim;

export type PublicReceipt = Omit<Receipt, never> & {
  remaining: Record<string, number>;
};

export type PublicClaimResult = {
  claim: PublicClaim;
  ownerToken: string;
  remaining: number;
};

export type ReceiptStatus = "draft" | "open" | "finalized";

export type PayMethod = "venmo" | "zelle" | "cashapp" | "other";

export type Item = {
  id: string;
  name: string;
  qty: number;
  totalCents: number;
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

export type HostInfo = {
  method: PayMethod;
  handle: string;
};

export type Receipt = {
  id: string;
  status: ReceiptStatus;
  restaurant: string;
  items: Item[];
  fees: Fee[];
  claims: Claim[];
  hostInfo?: HostInfo;
  createdAt: string;
  imageName?: string;
  parseFlag?: string;
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
  items: { name: string; qty: number; total: number }[];
  fees: { name: string; amount: number }[];
};

export type LiveEvent = {
  type: "snapshot" | "claim" | "unclaim" | "finalized" | "updated";
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

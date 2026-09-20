import { ClaimPage } from "@/components/claim-page";

export default async function ReceiptClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const host = query.host;
  const hostQuery =
    host === "1" ||
    host === "true" ||
    (Array.isArray(host) && (host.includes("1") || host.includes("true")));
  return <ClaimPage receiptId={id} hostQuery={hostQuery} />;
}

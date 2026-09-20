import { SettlePage } from "@/components/settle-page";

export default async function ReceiptSettlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SettlePage receiptId={id} />;
}

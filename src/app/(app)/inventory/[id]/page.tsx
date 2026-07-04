import { DonationItemDetail } from "./donation-item-detail";

export default async function DonationItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DonationItemDetail id={id} />;
}

import { AddDonationForm } from "./add-donation-form";

export default async function AddDonationPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string }>;
}) {
  const { slotId } = await searchParams;
  return <AddDonationForm preselectedSlotId={slotId ?? null} />;
}

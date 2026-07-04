import { SlotDetail } from "./slot-detail";

export default async function SlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SlotDetail id={id} />;
}

import { ListSkeleton } from "@/components/list-skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <ListSkeleton count={3} />
      <ListSkeleton count={3} />
      <ListSkeleton count={3} />
    </div>
  );
}

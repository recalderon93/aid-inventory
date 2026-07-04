import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { es } from "@/locales/es";

export default function UsersLoading() {
  return (
    <div className="space-y-4">
      <PageHeader
        title={es.users.title}
        description={es.users.description}
        action={<Skeleton className="h-9 w-36 rounded-lg" />}
      />
      <Skeleton className="h-5 w-32" />
      <ListSkeleton count={2} />
      <Skeleton className="h-5 w-28" />
      <ListSkeleton count={5} />
    </div>
  );
}

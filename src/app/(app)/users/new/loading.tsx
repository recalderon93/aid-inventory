import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { es } from "@/locales/es";

export default function NewUserLoading() {
  return (
    <div className="space-y-4">
      <PageHeader
        title={es.users.create}
        action={<Skeleton className="h-9 w-24 rounded-lg" />}
      />

      <Card className="border-border bg-surface-1">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-11 w-32 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}

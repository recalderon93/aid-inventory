"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canManageUsers } from "@/lib/permissions";
import { useRefreshableList } from "@/hooks/use-refreshable-list";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { ListPageShell } from "@/components/list-page-shell";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { Profile, UserStatus } from "@/types/database";
import { Users, Plus, Download, ClipboardList } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent } from "@/components/ui/card";

export default function UsersPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const { showToast } = useToast();
  const [canLoad, setCanLoad] = useState(false);
  const scrollKey = listScrollKey(queryKeys.users());
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "disable" | "hold" | "soft_delete";
  } | null>(null);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile || !canManageUsers(profile.role)) {
      router.replace("/slots");
      return;
    }
    setCanLoad(true);
  }, [profile, profileLoading, router]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (!res.ok) return [] as Profile[];
    return (await res.json()) as Profile[];
  }, []);

  const { data: users = [], initialLoading, refreshing, hasCachedData, refresh } = useRefreshableList(
    queryKeys.users(),
    loadUsers,
    {
      enabled: canLoad,
      pollIntervalMs: 120_000,
    }
  );

  async function handleAction(id: string, action: "disable" | "hold" | "reactivate" | "soft_delete") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      const messages = {
        disable: es.users.disabled,
        hold: es.users.held,
        reactivate: es.users.reactivated,
        soft_delete: es.users.disabled,
      };
      showToast(messages[action]);
      await refresh();
    }
    setConfirmAction(null);
  }

  if (profileLoading || !canLoad) {
    return (
      <div className="space-y-4">
        <ListPageShell title={es.users.title} description={es.users.description} onRefresh={() => {}}>
          <ListSkeleton count={5} />
        </ListPageShell>
      </div>
    );
  }

  return (
    <ListPageShell
      title={es.users.title}
      description={es.users.description}
      onRefresh={refresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
      action={
        <Link href="/users/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {es.users.create}
          </Button>
        </Link>
      }
    >

      <section className="space-y-3">
        <SectionHeader title={es.users.dataSection} />
        <Link href="/users/export">
          <Card className="border-border bg-surface-1 transition-colors hover:bg-surface-2">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{es.export.title}</p>
                <p className="text-sm text-muted">{es.export.adminDescription}</p>
              </div>
              <Download className="h-5 w-5 shrink-0 text-muted" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/import-review">
          <Card className="border-border bg-surface-1 transition-colors hover:bg-surface-2">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{es.importReview.title}</p>
                <p className="text-sm text-muted">{es.importReview.description}</p>
              </div>
              <ClipboardList className="h-5 w-5 shrink-0 text-muted" />
            </CardContent>
          </Card>
        </Link>
      </section>

      <SectionHeader title={es.users.usersSection} />

      {initialLoading ? (
        <ListSkeleton count={5} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={es.users.empty}
          description={es.users.emptyDescription}
          action={
            <Link href="/users/new">
              <Button size="sm">{es.users.create}</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="motion-safe:animate-in rounded-xl border border-border bg-surface-1 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.name}
                  </p>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="text-xs text-muted">
                    {es.users.created}: {formatDate(user.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary">{es.users.roles[user.role]}</Badge>
                  <Badge
                    variant={
                      user.status === "active"
                        ? "success"
                        : user.status === "on_hold"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {es.users.statuses[user.status as UserStatus] ?? user.status}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/users/${user.id}`}>
                  <Button size="sm" variant="outline">
                    {es.app.view}
                  </Button>
                </Link>
                {user.status === "active" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmAction({ id: user.id, action: "hold" })}
                    >
                      {es.users.hold}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmAction({ id: user.id, action: "disable" })}
                    >
                      {es.users.disable}
                    </Button>
                  </>
                )}
                {(user.status === "disabled" || user.status === "on_hold") && (
                  <Button size="sm" variant="outline" onClick={() => handleAction(user.id, "reactivate")}>
                    {es.users.enable}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "hold"
                ? es.users.confirmHold
                : confirmAction?.action === "soft_delete"
                  ? es.users.confirmDelete
                  : es.users.confirmDisable}
            </DialogTitle>
            <DialogDescription>{es.app.confirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              {es.app.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmAction && handleAction(confirmAction.id, confirmAction.action)}
            >
              {es.app.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListPageShell>
  );
}

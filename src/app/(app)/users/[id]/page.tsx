"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { Profile, UserStatus } from "@/types/database";
import { UserX } from "lucide-react";

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { profile: currentUser, loading: profileLoading } = useUserProfile();
  const { showToast } = useToast();
  const [user, setUser] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<{ id: string; order_number: string; status: string; created_at: string }[]>([]);
  const [transactions, setTransactions] = useState<{ id: string; type: string; quantity: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: userData }, { data: ordersData }, { data: txData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase
        .from("orders")
        .select("id, order_number, status, created_at")
        .or(`created_by_user_id.eq.${id},prepared_by_user_id.eq.${id},completed_by_user_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("inventory_transactions")
        .select("id, type, quantity, created_at")
        .eq("created_by_user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setUser(userData);
    setOrders(ordersData ?? []);
    setTransactions(txData ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (profileLoading) return;
    if (!currentUser || !canManageUsers(currentUser.role)) {
      router.replace("/slots");
      return;
    }
    void load();
  }, [currentUser, profileLoading, id, router, load]);

  async function handleAction(action: "disable" | "hold" | "reactivate") {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      showToast(action === "reactivate" ? es.users.reactivated : es.users.disabled);
      await load();
    }
  }

  if (loading) return <ListSkeleton variant="detail" />;
  if (!user) {
    return (
      <EmptyState
        icon={UserX}
        title={es.app.notFound}
        action={
          <Link href="/users">
            <Button variant="outline">{es.app.back}</Button>
          </Link>
        }
      />
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title={displayName}
        description={es.users.detail}
        action={
          <Link href="/users">
            <Button variant="outline" size="sm">
              {es.app.back}
            </Button>
          </Link>
        }
      />

      <Card className="border-border bg-surface-1">
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-2">
            <Badge variant="secondary">{es.users.roles[user.role]}</Badge>
            <Badge variant={user.status === "active" ? "success" : "warning"}>
              {es.users.statuses[user.status as UserStatus] ?? user.status}
            </Badge>
          </div>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{es.auth.email}</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{es.menu.phone}</dt>
              <dd>{user.phone || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{es.users.created}</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{es.users.lastActivity}</dt>
              <dd>{user.last_login_at ? formatDate(user.last_login_at) : "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            {user.status === "active" && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleAction("hold")}>
                  {es.users.hold}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleAction("disable")}>
                  {es.users.disable}
                </Button>
              </>
            )}
            {user.status !== "active" && (
              <Button size="sm" onClick={() => handleAction("reactivate")}>
                {es.users.enable}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader title={es.orders.title} description={es.users.activityDescription} />
        {orders.length === 0 ? (
          <p className="text-sm text-muted">{es.orders.emptyHandled}</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-xl border border-border bg-surface-1 p-3 motion-safe:animate-in"
              >
                <p className="font-medium">{o.order_number}</p>
                <p className="text-xs text-muted">{formatDate(o.created_at)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title={es.transactions.title} />
        {transactions.length === 0 ? (
          <p className="text-sm text-muted">{es.transactions.empty}</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="rounded-xl border border-border bg-surface-1 p-3">
                <p className="text-sm font-medium">
                  {es.transactions.types[tx.type as keyof typeof es.transactions.types] ?? tx.type}
                </p>
                <p className="text-xs text-muted">
                  {es.inventory.quantity}: {tx.quantity} · {formatDate(tx.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

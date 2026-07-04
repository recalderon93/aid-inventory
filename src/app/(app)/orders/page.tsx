"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canCreateOrders, getOrderStatusVariant } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Order, OrderStatus } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { ClipboardList, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderWithHandler = Order & {
  prepared_by?: { name: string; first_name: string | null; last_name: string | null } | null;
  completed_by?: { name: string; first_name: string | null; last_name: string | null } | null;
};

function handlerName(p?: { name: string; first_name: string | null; last_name: string | null } | null) {
  if (!p) return null;
  const n = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return n || p.name;
}

export default function OrdersPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [orders, setOrders] = useState<OrderWithHandler[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select(
          "*, prepared_by:profiles!orders_prepared_by_user_id_fkey(name, first_name, last_name), completed_by:profiles!orders_completed_by_user_id_fkey(name, first_name, last_name)"
        )
        .order("created_at", { ascending: false });
      setOrders((data as OrderWithHandler[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleOrderClick(order: OrderWithHandler) {
    if (order.status === "pending") {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("orders")
          .update({
            status: "in_progress",
            prepared_by_user_id: user.id,
            prepared_at: new Date().toISOString(),
          })
          .eq("id", order.id);
        await supabase.from("order_history").insert({
          order_id: order.id,
          changed_by: user.id,
          field: "status",
          old_value: "pending",
          new_value: "in_progress",
        });
      }
    }
    router.push(`/orders/${order.id}`);
  }

  const pending = orders.filter((o) => o.status === "pending" || o.status === "in_progress");
  const handled = orders
    .filter((o) => o.status === "completed")
    .sort((a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime());

  const canCreate = profile && canCreateOrders(profile.role);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title={es.orders.title} description={es.orders.description} />
        <ListSkeleton count={3} />
        <ListSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={es.orders.title}
        description={es.orders.description}
        action={
          canCreate ? (
            <Link href="/orders/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {es.orders.create}
              </Button>
            </Link>
          ) : undefined
        }
      />

      <section className="space-y-3">
        <SectionHeader title={es.orders.pending} description={es.orders.pendingDescription} />
        {pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={es.orders.emptyPending}
            description={es.orders.emptyPendingDescription}
          />
        ) : (
          <div className="space-y-2">
            {pending.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => handleOrderClick(order)}
                className="w-full rounded-xl border border-border bg-surface-1 p-4 text-left transition-colors hover:bg-surface-2 motion-safe:animate-in"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{order.order_number}</p>
                    <p className="text-sm">{order.requester_name}</p>
                    <p className="text-xs text-muted">{formatDate(order.created_at)}</p>
                    {handlerName(order.prepared_by) && (
                      <p className="mt-1 text-xs text-muted">
                        {es.orders.preparingBy}: {handlerName(order.prepared_by)}
                      </p>
                    )}
                  </div>
                  <Badge variant={getOrderStatusVariant(order.status)}>
                    {es.orders.statuses[order.status as OrderStatus]}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title={es.orders.handled} description={es.orders.handledDescription} />
        {handled.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={es.orders.emptyHandled}
            description={es.orders.emptyHandledDescription}
          />
        ) : (
          <div className="space-y-2">
            {handled.map((order) => {
              const isMine = profile && order.completed_by_user_id === profile.id;
              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={cn(
                    "block rounded-xl border p-4 transition-colors hover:bg-surface-2 motion-safe:animate-in",
                    isMine ? "border-foreground bg-surface-2" : "border-border bg-surface-1"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {order.order_number}
                        {isMine && (
                          <span className="ml-2 text-xs font-normal text-muted">({es.orders.yourOrder})</span>
                        )}
                      </p>
                      <p className="text-sm">{order.requester_name}</p>
                      <p className="text-xs text-muted">
                        {order.completed_at ? formatDate(order.completed_at) : formatDate(order.created_at)}
                      </p>
                      {handlerName(order.completed_by) && (
                        <p className="mt-1 text-xs text-muted">
                          {es.orders.handledBy}: {handlerName(order.completed_by)}
                        </p>
                      )}
                    </div>
                    <Badge variant="success">{es.orders.statuses.completed}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

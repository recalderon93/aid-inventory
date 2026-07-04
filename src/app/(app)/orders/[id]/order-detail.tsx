"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  canCompleteOrderWithIssues,
  canEditOrders,
  canHandleOrders,
  canPickOnOrder,
} from "@/lib/permissions";
import {
  canUserCompleteOrder,
  countOrderProgress,
} from "@/lib/order-fulfillment";
import { completeOrder, startOrder } from "@/lib/orders-api";
import { queryKeys } from "@/lib/query-keys";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { useToast } from "@/components/ui/toast";
import type { Order, OrderHistory, OrderItem } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { OrderDetailHeader } from "./order-detail-header";
import { OrderItemPickCard } from "./order-item-pick-card";

type OrderWithProfiles = Order & {
  created_by?: { name: string } | null;
  prepared_by?: { name: string } | null;
  completed_by?: { name: string } | null;
};

export function OrderDetail({ id }: { id: string }) {
  const { profile } = useUserProfile();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<OrderWithProfiles | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [stockByItemId, setStockByItemId] = useState<
    Record<string, { slot_id: string; quantity: number; slot_number: string }[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const supabase = createClient();
    const [
      { data: orderData, error: orderError },
      { data: itemsData, error: itemsError },
      { data: historyData, error: historyError },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "*, created_by:profiles!orders_created_by_user_id_fkey(name), prepared_by:profiles!orders_prepared_by_user_id_fkey(name), completed_by:profiles!orders_completed_by_user_id_fkey(name)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("order_items")
        .select("*, donation_item:donation_items(*)")
        .eq("order_id", id),
      supabase.from("order_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    ]);

    if (orderError) {
      console.error("OrderDetail load order", orderError.message);
      setOrder(null);
      setLoadError(orderError.message);
      setLoading(false);
      return;
    }

    if (itemsError) {
      console.error("OrderDetail load items", itemsError.message);
      setLoadError(itemsError.message);
    }

    if (historyError) {
      console.error("OrderDetail load history", historyError.message);
    }

    setOrder(orderData as OrderWithProfiles);
    setItems(itemsData ?? []);
    setHistory(historyError ? [] : (historyData ?? []));

    const stock: Record<string, { slot_id: string; quantity: number; slot_number: string }[]> = {};
    for (const item of itemsData ?? []) {
      if (!item.donation_item_id) continue;
      const { data: inv } = await supabase
        .from("inventory")
        .select("slot_id, quantity, slot:slots(number)")
        .eq("donation_item_id", item.donation_item_id)
        .gt("quantity", 0);

      stock[item.id] = (inv ?? []).map((row) => {
        const slot = row.slot as unknown as { number: string } | null;
        return {
          slot_id: row.slot_id,
          quantity: row.quantity,
          slot_number: slot?.number ?? row.slot_id,
        };
      });
    }
    setStockByItemId(stock);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePrepare() {
    setPreparing(true);
    const { error } = await startOrder(id);
    setPreparing(false);
    if (error) {
      showToast(error.message);
      return;
    }
    await load();
    await queryClient.invalidateQueries({ queryKey: queryKeys.ordersPending() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.ordersInProgress() });
  }

  async function handleComplete() {
    if (!profile) return;
    const completion = canUserCompleteOrder(items, profile.role);
    if (!completion.allowed) {
      showToast(
        completion.reason === "ISSUES_NOT_ALLOWED"
          ? es.orders.orderInProgressByOther
          : es.orders.completeBlocked
      );
      return;
    }

    setCompleting(true);
    const { data, error } = await completeOrder(id);
    setCompleting(false);

    if (error) {
      showToast(error.message);
      return;
    }

    const message = data?.has_issues
      ? es.orders.completed_with_issues
      : es.orders.completed_success;
    showToast(message);
    await load();
    await queryClient.invalidateQueries({ queryKey: queryKeys.ordersInProgress() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.ordersCompleted() });
  }

  if (loading) return <ListSkeleton variant="detail" />;
  if (!order) {
    return (
      <div className="space-y-3">
        <p>{loadError ?? es.app.error}</p>
        <Link href="/orders">
          <Button variant="outline">{es.orders.back}</Button>
        </Link>
      </div>
    );
  }

  const progress = countOrderProgress(items);
  const canEdit = profile && canEditOrders(profile.role);
  const canHandle = profile && canHandleOrders(profile.role);
  const canPick =
    profile &&
    canPickOnOrder(profile.role, order.prepared_by_user_id, profile.id);
  const completionCheck = profile ? canUserCompleteOrder(items, profile.role) : { allowed: false };
  const showComplete =
    order.status === "in_progress" &&
    canHandle &&
    (canPick || canCompleteOrderWithIssues(profile!.role)) &&
    completionCheck.allowed;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-end gap-2">
        {canEdit && order.status !== "completed" && order.status !== "cancelled" && (
          <Link href={`/orders/${id}/edit`}>
            <Button variant="outline" size="sm">
              {es.orders.edit}
            </Button>
          </Link>
        )}
      </div>

      <OrderDetailHeader order={order} progressLabel={progress.label} />

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{es.orders.items}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <OrderItemPickCard
              key={item.id}
              item={item}
              order={order}
              role={profile?.role ?? "collaborator"}
              currentUserId={profile?.id ?? null}
              stockRows={stockByItemId[item.id] ?? []}
              onUpdated={load}
              onError={showToast}
              onSuccess={showToast}
            />
          ))}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <section className="space-y-2">
          <SectionHeader title={es.orders.history} />
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-border bg-surface-1 p-3 text-sm">
                <p>
                  <span className="font-medium">{h.field}</span>: {h.old_value} → {h.new_value}
                </p>
                <p className="text-xs text-muted">{formatDate(h.created_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {order.status === "pending" && canHandle && (
        <Button onClick={handlePrepare} disabled={preparing}>
          {preparing ? es.app.loading : es.orders.prepare}
        </Button>
      )}

      {showComplete && (
        <Button onClick={handleComplete} disabled={completing}>
          {completing ? es.app.loading : es.orders.fulfill}
        </Button>
      )}

      {order.status === "in_progress" && !completionCheck.allowed && canHandle && (
        <p className="text-sm text-muted">{es.orders.completeBlocked}</p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { suggestSlotsForItem, getOrderStatusVariant, canEditOrders } from "@/lib/permissions";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DonationItemPreview } from "@/components/donation-item-preview";
import { SectionHeader } from "@/components/section-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { useToast } from "@/components/ui/toast";
import type { Order, OrderItem, OrderHistory, OrderStatus } from "@/types/database";
import { formatDate } from "@/lib/utils";

interface FulfillmentSuggestion {
  order_item_id: string;
  description: string;
  suggestions: { slot_id: string; slot_number: string; quantity: number }[];
}

type OrderWithProfiles = Order & {
  prepared_by?: { name: string; first_name: string | null; last_name: string | null } | null;
  completed_by?: { name: string; first_name: string | null; last_name: string | null } | null;
};

function handlerName(p?: { name: string; first_name: string | null; last_name: string | null } | null) {
  if (!p) return null;
  const n = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return n || p.name;
}

export function OrderDetail({ id }: { id: string }) {
  const { profile } = useUserProfile();
  const { showToast } = useToast();
  const [order, setOrder] = useState<OrderWithProfiles | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [suggestions, setSuggestions] = useState<FulfillmentSuggestion[]>([]);
  const [availabilityByItemId, setAvailabilityByItemId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: orderData }, { data: itemsData }, { data: historyData }] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "*, prepared_by:profiles!orders_prepared_by_user_id_fkey(name, first_name, last_name), completed_by:profiles!orders_completed_by_user_id_fkey(name, first_name, last_name)"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("order_items")
        .select("*, donation_item:donation_items(*)")
        .eq("order_id", id),
      supabase.from("order_history").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    ]);
    setOrder(orderData as OrderWithProfiles);
    setItems(itemsData ?? []);
    setHistory(historyData ?? []);

    const suggs: FulfillmentSuggestion[] = [];
    const availability: Record<string, number> = {};
    for (const item of itemsData ?? []) {
      if (!item.donation_item_id) continue;
      const { data: inv } = await supabase
        .from("inventory")
        .select("slot_id, quantity, slot:slots(number)")
        .eq("donation_item_id", item.donation_item_id)
        .gt("quantity", 0);

      const totalAvailable = (inv ?? []).reduce((sum, row) => sum + row.quantity, 0);
      availability[item.id] = totalAvailable;

      const { suggestions: s } = suggestSlotsForItem(
        (inv ?? []).map((r) => {
          const slot = r.slot as unknown as { number: string } | null;
          return {
            slot_id: r.slot_id,
            quantity: r.quantity,
            slot: slot ?? undefined,
          };
        }),
        item.requested_quantity
      );

      suggs.push({
        order_item_id: item.id,
        description: item.donation_item?.description ?? "",
        suggestions: s,
      });
    }
    setSuggestions(suggs);
    setAvailabilityByItemId(availability);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePrepare() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("orders")
      .update({
        status: "in_progress",
        prepared_by_user_id: user?.id,
        prepared_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (user) {
      await supabase.from("order_history").insert({
        order_id: id,
        changed_by: user.id,
        field: "status",
        old_value: order?.status ?? "pending",
        new_value: "in_progress",
      });
    }
    await load();
  }

  async function handleFulfill() {
    setFulfilling(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    for (const sugg of suggestions) {
      const orderItem = items.find((i) => i.id === sugg.order_item_id);
      if (!orderItem?.donation_item_id) continue;

      let fulfilled = 0;
      for (const pick of sugg.suggestions) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("*")
          .eq("slot_id", pick.slot_id)
          .eq("donation_item_id", orderItem.donation_item_id)
          .single();

        if (!inv) continue;

        const newQty = inv.quantity - pick.quantity;
        await supabase.from("inventory").update({ quantity: newQty }).eq("id", inv.id);

        await supabase.from("inventory_transactions").insert({
          type: "order_fulfillment",
          donation_item_id: orderItem.donation_item_id,
          from_slot_id: pick.slot_id,
          order_id: id,
          quantity: pick.quantity,
          created_by_user_id: user?.id,
          notes: `Order ${order?.order_number}`,
        });

        fulfilled += pick.quantity;
      }

      await supabase
        .from("order_items")
        .update({
          fulfilled_quantity: fulfilled,
          status: fulfilled >= orderItem.requested_quantity ? "fulfilled" : "partially_fulfilled",
        })
        .eq("id", orderItem.id);
    }

    await supabase
      .from("orders")
      .update({
        status: "completed",
        completed_by_user_id: user?.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (user) {
      await supabase.from("order_history").insert({
        order_id: id,
        changed_by: user.id,
        field: "status",
        old_value: order?.status ?? "in_progress",
        new_value: "completed",
      });
    }

    setFulfilling(false);
    showToast(es.orders.completed_success);
    await load();
  }

  if (loading) return <ListSkeleton variant="detail" />;
  if (!order) return <p>{es.app.error}</p>;

  const canEdit = profile && canEditOrders(profile.role);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{order.order_number}</h2>
          <Badge className="mt-2" variant={getOrderStatusVariant(order.status)}>
            {es.orders.statuses[order.status as OrderStatus]}
          </Badge>
        </div>
        {canEdit && order.status !== "completed" && (
          <Link href={`/orders/${id}/edit`}>
            <Button variant="outline" size="sm">
              {es.orders.edit}
            </Button>
          </Link>
        )}
      </div>

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{es.orders.requester}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{order.requester_name}</p>
          {order.requester_phone && <p>{order.requester_phone}</p>}
          {order.requester_city && (
            <p>
              {order.requester_city}, {order.requester_state}
            </p>
          )}
          {order.requester_notes && (
            <p className="text-muted">
              {es.orders.notes}: {order.requester_notes}
            </p>
          )}
          <p className="text-muted">{formatDate(order.created_at)}</p>
          <p className="text-muted">Actualizado: {formatDate(order.updated_at)}</p>
          {handlerName(order.prepared_by) && (
            <p className="text-muted">
              {es.orders.preparingBy}: {handlerName(order.prepared_by)}
            </p>
          )}
          {handlerName(order.completed_by) && (
            <p className="text-muted">
              {es.orders.handledBy}: {handlerName(order.completed_by)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{es.orders.items}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3">
              <DonationItemPreview
                description={item.donation_item?.description ?? ""}
                presentation={item.donation_item?.presentation}
                unit_of_measurement={item.donation_item?.unit_of_measurement}
                subcategory={item.donation_item?.subcategory}
                category={item.donation_item?.category}
                status={item.donation_item?.status}
                quantity={availabilityByItemId[item.id]}
                showQuantity={false}
              />
              <p className="mt-1 text-xs text-muted">
                {es.orders.requested}: {item.requested_quantity} · {es.orders.fulfill}:{" "}
                {item.fulfilled_quantity}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card className="border-border bg-surface-1">
          <CardHeader>
            <CardTitle>{es.orders.suggestedSlots}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s) => {
              const orderItem = items.find((item) => item.id === s.order_item_id);
              const donationItem = orderItem?.donation_item;
              return (
                <div key={s.order_item_id}>
                  <DonationItemPreview
                    description={donationItem?.description ?? s.description}
                    presentation={donationItem?.presentation}
                    unit_of_measurement={donationItem?.unit_of_measurement}
                    subcategory={donationItem?.subcategory}
                    category={donationItem?.category}
                    status={donationItem?.status}
                    quantity={availabilityByItemId[s.order_item_id]}
                    showQuantity={false}
                  />
                  {s.suggestions.map((pick) => (
                    <p key={pick.slot_id} className="mt-1 text-xs text-muted">
                      {es.slots.title} {pick.slot_number}: {pick.quantity}
                    </p>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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

      {order.status === "pending" && <Button onClick={handlePrepare}>{es.orders.prepare}</Button>}
      {(order.status === "pending" || order.status === "in_progress") && (
        <Button onClick={handleFulfill} disabled={fulfilling}>
          {fulfilling ? es.app.loading : es.orders.fulfill}
        </Button>
      )}
    </div>
  );
}

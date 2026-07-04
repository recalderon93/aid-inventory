"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestSlotsForItem } from "@/lib/permissions";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Order, OrderItem } from "@/types/database";
import { formatDate } from "@/lib/utils";

interface FulfillmentSuggestion {
  order_item_id: string;
  description: string;
  suggestions: { slot_id: string; slot_number: string; quantity: number }[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [suggestions, setSuggestions] = useState<FulfillmentSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);

  async function load() {
    const supabase = createClient();
    const [{ data: orderData }, { data: itemsData }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase
        .from("order_items")
        .select("*, donation_item:donation_items(*)")
        .eq("order_id", id),
    ]);
    setOrder(orderData);
    setItems(itemsData ?? []);

    const suggs: FulfillmentSuggestion[] = [];
    for (const item of itemsData ?? []) {
      if (!item.donation_item_id) continue;
      const { data: inv } = await supabase
        .from("inventory")
        .select("slot_id, quantity, slot:slots(number)")
        .eq("donation_item_id", item.donation_item_id)
        .gt("quantity", 0);

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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handlePrepare() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("orders").update({
      status: "in_progress",
      prepared_by_user_id: user?.id,
      prepared_at: new Date().toISOString(),
    }).eq("id", id);
    await load();
  }

  async function handleFulfill() {
    setFulfilling(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

      await supabase.from("order_items").update({
        fulfilled_quantity: fulfilled,
        status: fulfilled >= orderItem.requested_quantity ? "fulfilled" : "partially_fulfilled",
      }).eq("id", orderItem.id);
    }

    await supabase.from("orders").update({
      status: "completed",
      completed_by_user_id: user?.id,
      completed_at: new Date().toISOString(),
    }).eq("id", id);

    setFulfilling(false);
    await load();
  }

  if (loading) return <p>{es.app.loading}</p>;
  if (!order) return <p>{es.app.error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{order.order_number}</h2>
          <Badge className="mt-2">{es.orders.statuses[order.status]}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{es.orders.requester}</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{order.requester_name}</p>
          <p>{order.requester_phone}</p>
          <p>{order.requester_city}, {order.requester_state}</p>
          <p className="text-neutral-500">{formatDate(order.created_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{es.orders.items}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <p className="font-medium">{item.donation_item?.description}</p>
              <p className="text-sm">
                {es.orders.requested}: {item.requested_quantity} · {es.orders.fulfill}: {item.fulfilled_quantity}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{es.orders.suggestedSlots}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.order_item_id}>
                <p className="font-medium">{s.description}</p>
                {s.suggestions.map((pick) => (
                  <p key={pick.slot_id} className="text-sm text-neutral-600">
                    {es.slots.title} {pick.slot_number}: {pick.quantity}
                  </p>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {order.status === "pending" && (
        <Button onClick={handlePrepare}>{es.orders.prepare}</Button>
      )}
      {(order.status === "pending" || order.status === "in_progress") && (
        <Button onClick={handleFulfill} disabled={fulfilling}>
          {fulfilling ? es.app.loading : es.orders.fulfill}
        </Button>
      )}
    </div>
  );
}

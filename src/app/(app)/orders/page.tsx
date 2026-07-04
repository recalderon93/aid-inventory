"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{es.orders.title}</h2>
        <Link href="/orders/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {es.orders.create}
          </Button>
        </Link>
      </div>

      {loading ? (
        <p>{es.app.loading}</p>
      ) : orders.length === 0 ? (
        <p className="text-neutral-500">{es.app.noResults}</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{order.order_number}</p>
                  <p className="text-sm">{order.requester_name}</p>
                  <p className="text-xs text-neutral-500">{formatDate(order.created_at)}</p>
                </div>
                <Badge variant="secondary">{es.orders.statuses[order.status]}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

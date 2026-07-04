"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Slot, InventoryRow } from "@/types/database";
import { formatDate } from "@/lib/utils";

export default function SlotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: slotData }, { data: invData }] = await Promise.all([
        supabase.from("slots").select("*").eq("id", id).single(),
        supabase
          .from("inventory")
          .select("*, donation_item:donation_items(*)")
          .eq("slot_id", id)
          .gt("quantity", 0),
      ]);
      setSlot(slotData);
      setInventory(invData ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p>{es.app.loading}</p>;
  if (!slot) return <p>{es.app.error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {es.slots.detail}: {slot.number}
          </h2>
          <Badge className="mt-2">{es.slots.statuses[slot.status]}</Badge>
        </div>
        <Link href={`/inventory/add?slotId=${slot.id}`}>
          <Button>{es.slots.addDonation}</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{es.slots.itemsInSlot}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventory.length === 0 ? (
            <p className="text-neutral-500">{es.app.noResults}</p>
          ) : (
            inventory.map((row) => (
              <Link
                key={row.id}
                href={`/inventory/${row.donation_item_id}`}
                className="block rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-800"
              >
                <p className="font-medium">{row.donation_item?.description}</p>
                <p className="text-sm text-neutral-500">
                  {row.donation_item?.subcategory} · {row.donation_item?.presentation}
                </p>
                <p className="mt-1 font-semibold">
                  {es.inventory.quantity}: {row.quantity}{" "}
                  {row.donation_item?.unit_of_measurement ?? ""}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-neutral-500">
        {es.slots.status}: {formatDate(slot.updated_at)}
      </p>
    </div>
  );
}

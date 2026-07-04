"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DonationItemPreview } from "@/components/donation-item-preview";
import type { Slot, InventoryRow } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { Package } from "lucide-react";

export function SlotDetail({ id }: { id: string }) {
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

  if (loading) return <ListSkeleton variant="detail" />;
  if (!slot) return <p>{es.app.error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {es.slots.detail}: {slot.number}
          </h2>
          <Badge className="mt-2" variant="secondary">{es.slots.statuses[slot.status]}</Badge>
        </div>
        <Link href={`/inventory/add?slotId=${slot.id}`}>
          <Button>{es.slots.addDonation}</Button>
        </Link>
      </div>

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{es.slots.itemsInSlot}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventory.length === 0 ? (
            <EmptyState
              icon={Package}
              title={es.app.noResults}
              description={es.slots.emptyDescription}
              action={
                <Link href={`/inventory/add?slotId=${slot.id}`}>
                  <Button size="sm">{es.slots.addDonation}</Button>
                </Link>
              }
            />
          ) : (
            inventory.map((row) => (
              <Link
                key={row.id}
                href={`/inventory/${row.donation_item_id}`}
                className="block rounded-lg border border-border p-3 transition-colors hover:bg-surface-2"
              >
                <DonationItemPreview
                  description={row.donation_item?.description ?? ""}
                  presentation={row.donation_item?.presentation}
                  unit_of_measurement={row.donation_item?.unit_of_measurement}
                  subcategory={row.donation_item?.subcategory}
                  category={row.donation_item?.category}
                  status={row.donation_item?.status}
                  quantity={row.quantity}
                />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted">
        {es.slots.status}: {formatDate(slot.updated_at)}
      </p>
    </div>
  );
}

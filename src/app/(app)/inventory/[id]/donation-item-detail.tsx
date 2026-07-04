"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import type { DonationItem, InventoryRow } from "@/types/database";
import { Boxes } from "lucide-react";

export function DonationItemDetail({ id }: { id: string }) {
  const [item, setItem] = useState<DonationItem | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: itemData }, { data: invData }] = await Promise.all([
        supabase.from("donation_items").select("*").eq("id", id).single(),
        supabase
          .from("inventory")
          .select("*, slot:slots(number)")
          .eq("donation_item_id", id)
          .gt("quantity", 0),
      ]);
      setItem(itemData);
      setInventory(invData ?? []);
      setTotalQty((invData ?? []).reduce((sum, r) => sum + r.quantity, 0));
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <ListSkeleton variant="detail" />;
  if (!item) return <EmptyState icon={Boxes} title={es.app.notFound} />;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{es.inventory.detail}</h2>

      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>{item.description}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>{es.inventory.subcategory}:</strong> {item.subcategory}
          </p>
          <p>
            <strong>{es.inventory.category}:</strong> {item.category}
          </p>
          <p>
            <strong>{es.inventory.presentation}:</strong> {item.presentation ?? "—"}
          </p>
          <p>
            <strong>{es.inventory.unit}:</strong> {item.unit_of_measurement ?? "—"}
          </p>
          <p className="text-lg font-bold">
            {es.inventory.totalAvailable}: {totalQty}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionHeader title={es.inventory.slotsWithItem} />
        <Card className="border-border bg-surface-1">
          <CardContent className="space-y-2 p-4">
            {inventory.length === 0 ? (
              <p className="text-sm text-muted">{es.app.noResults}</p>
            ) : (
              inventory.map((row) => (
                <Link
                  key={row.id}
                  href={`/slots/${row.slot_id}`}
                  className="flex justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-2"
                >
                  <span>
                    {es.slots.title} {(row.slot as { number: string })?.number}
                  </span>
                  <span className="font-semibold">{row.quantity}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

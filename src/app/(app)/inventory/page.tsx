"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus } from "lucide-react";

interface InventoryListItem {
  donation_item_id: string;
  description: string;
  subcategory: string | null;
  presentation: string | null;
  unit_of_measurement: string | null;
  status: string;
  total_quantity: number;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: inventory } = await supabase
        .from("inventory")
        .select(
          "quantity, donation_item:donation_items(id, description, subcategory, presentation, unit_of_measurement, status)"
        )
        .gt("quantity", 0);

      const map = new Map<string, InventoryListItem>();
      for (const row of inventory ?? []) {
        const item = row.donation_item as unknown as InventoryListItem & { id: string };
        if (!item?.id) continue;
        const existing = map.get(item.id);
        if (existing) {
          existing.total_quantity += row.quantity;
        } else {
          map.set(item.id, {
            donation_item_id: item.id,
            description: item.description,
            subcategory: item.subcategory,
            presentation: item.presentation,
            unit_of_measurement: item.unit_of_measurement,
            status: item.status,
            total_quantity: row.quantity,
          });
        }
      }

      const list = Array.from(map.values()).sort((a, b) => {
        if (a.status === "out_of_stock" && b.status !== "out_of_stock") return 1;
        if (b.status === "out_of_stock" && a.status !== "out_of_stock") return -1;
        return a.description.localeCompare(b.description, "es");
      });

      setItems(list);
      setLoading(false);
    }
    load();
  }, []);

  const categories = [...new Set(items.map((i) => i.subcategory).filter(Boolean))] as string[];

  const filtered = items.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.description.toLowerCase().includes(q) ||
      (item.subcategory?.toLowerCase().includes(q) ?? false) ||
      (item.presentation?.toLowerCase().includes(q) ?? false);
    const matchesCategory = !categoryFilter || item.subcategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={es.inventory.title}
        description={es.inventory.description}
        action={
          <Link href="/inventory/add">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {es.inventory.addDonation}
            </Button>
          </Link>
        }
      />

      <Input
        placeholder={es.inventory.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="text-xs text-muted">{es.inventory.searchHint}</p>

      <select
        className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
        value={categoryFilter}
        onChange={(e) => setCategoryFilter(e.target.value)}
      >
        <option value="">{es.inventory.subcategory} (todas)</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {loading ? (
        <ListSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || categoryFilter ? es.app.noResults : es.inventory.empty}
          description={
            search || categoryFilter ? undefined : es.inventory.emptyDescription
          }
          action={
            !search && !categoryFilter ? (
              <Link href="/inventory/add">
                <Button size="sm">{es.inventory.addDonation}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Link
              key={item.donation_item_id}
              href={`/inventory/${item.donation_item_id}`}
              className="block rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2 motion-safe:animate-in"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-sm text-muted">
                    {item.subcategory} · {item.presentation}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{item.total_quantity}</p>
                  <p className="text-xs text-muted">{item.unit_of_measurement}</p>
                </div>
              </div>
              {item.status === "needed" && (
                <Badge variant="warning" className="mt-2">
                  {es.inventory.needed}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

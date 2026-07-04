"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { InventoryTransaction } from "@/types/database";
import { formatDate } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("inventory_transactions")
        .select(
          "*, donation_item:donation_items(description), from_slot:slots!inventory_transactions_from_slot_id_fkey(number), to_slot:slots!inventory_transactions_to_slot_id_fkey(number)"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title={es.transactions.title} description={es.transactions.description} />

      {loading ? (
        <ListSkeleton count={5} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={es.transactions.empty}
          description={es.transactions.emptyDescription}
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="rounded-xl border border-border bg-surface-1 p-4 motion-safe:animate-in"
            >
              <div className="flex justify-between">
                <span className="font-medium">{es.transactions.types[tx.type]}</span>
                <span className="text-sm text-muted">{formatDate(tx.created_at)}</span>
              </div>
              <p className="text-sm">{tx.donation_item?.description}</p>
              <p className="text-sm text-muted">
                {es.inventory.quantity}: {tx.quantity}
                {tx.from_slot && ` · ${es.slots.title} ${tx.from_slot.number}`}
                {tx.to_slot && ` → ${es.slots.title} ${tx.to_slot.number}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

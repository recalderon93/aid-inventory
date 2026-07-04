"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import type { InventoryTransaction } from "@/types/database";
import { formatDate } from "@/lib/utils";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("inventory_transactions")
        .select("*, donation_item:donation_items(description), from_slot:slots!inventory_transactions_from_slot_id_fkey(number), to_slot:slots!inventory_transactions_to_slot_id_fkey(number)")
        .order("created_at", { ascending: false })
        .limit(100);
      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{es.transactions.title}</h2>

      {loading ? (
        <p>{es.app.loading}</p>
      ) : transactions.length === 0 ? (
        <p className="text-neutral-500">{es.transactions.empty}</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex justify-between">
                <span className="font-medium">
                  {es.transactions.types[tx.type]}
                </span>
                <span className="text-sm text-neutral-500">{formatDate(tx.created_at)}</span>
              </div>
              <p className="text-sm">{tx.donation_item?.description}</p>
              <p className="text-sm text-neutral-500">
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

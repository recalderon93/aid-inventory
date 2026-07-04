"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Slot } from "@/types/database";
import { Plus } from "lucide-react";

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [newNumber, setNewNumber] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadSlots() {
    const supabase = createClient();
    const { data } = await supabase
      .from("slots")
      .select("*")
      .is("deleted_at", null)
      .order("number");
    setSlots(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSlots();
  }, []);

  async function handleCreate() {
    const number = newNumber.trim();
    if (!number) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("slots").insert({
      number,
      name: `Caja ${number}`,
      status: "active",
    });
    setNewNumber("");
    setCreating(false);
    await loadSlots();
  }

  const filtered = slots.filter((s) => s.number.includes(search.trim()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{es.slots.title}</h2>
        <Link href="/inventory/add">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {es.inventory.addDonation}
          </Button>
        </Link>
      </div>

      <Input
        placeholder={es.slots.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2">
        <Input
          placeholder={es.slots.number}
          value={newNumber}
          onChange={(e) => setNewNumber(e.target.value)}
        />
        <Button onClick={handleCreate} disabled={creating} variant="secondary">
          {es.slots.create}
        </Button>
      </div>

      {loading ? (
        <p>{es.app.loading}</p>
      ) : filtered.length === 0 ? (
        <p className="text-neutral-500">{es.slots.empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((slot) => (
            <Link key={slot.id} href={`/slots/${slot.id}`}>
              <Card className="transition hover:border-neutral-400">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <span className="text-2xl font-bold">{slot.number}</span>
                  <Badge variant="secondary">
                    {es.slots.statuses[slot.status]}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { filterSlots, hasExactSlotMatch } from "@/lib/slot-search";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canCreateSlots } from "@/lib/permissions";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { Slot } from "@/types/database";
import { Boxes } from "lucide-react";

export default function SlotsPage() {
  const { profile } = useUserProfile();
  const { showToast } = useToast();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
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

  async function handleCreate(number?: string) {
    const n = (number ?? search).trim();
    if (!n) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("slots").insert({
      number: n,
      name: n,
      status: "active",
    });
    setCreating(false);
    showToast(es.slots.created_success);
    await loadSlots();
  }

  const filtered = filterSlots(slots, search);
  const showCreateBanner =
    search.trim() &&
    !hasExactSlotMatch(slots, search) &&
    profile &&
    canCreateSlots(profile.role);

  return (
    <div className="space-y-4">
      <PageHeader title={es.slots.title} description={es.slots.description} />

      <Input
        placeholder={es.slots.searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="text-xs text-muted">{es.slots.searchHint}</p>

      {showCreateBanner && (
        <Button variant="outline" className="w-full" onClick={() => handleCreate()} disabled={creating}>
          {es.slots.createFromSearch.replace("{number}", search.trim())}
        </Button>
      )}

      {loading ? (
        <ListSkeleton variant="grid" count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={es.slots.empty}
          description={es.slots.emptyDescription}
          action={
            profile && canCreateSlots(profile.role) ? (
              <Button size="sm" onClick={() => handleCreate("1")} disabled={creating}>
                {es.slots.create}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((slot) => (
            <Link key={slot.id} href={`/slots/${slot.id}`}>
              <Card className="border-border bg-surface-1 transition hover:border-foreground motion-safe:animate-in">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <span className="text-2xl font-bold">{slot.number}</span>
                  <Badge variant="secondary">{es.slots.statuses[slot.status]}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { filterSlots, hasExactSlotMatch } from "@/lib/slot-search";
import { createSlot } from "@/lib/slot-create";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canCreateSlots } from "@/lib/permissions";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SlotCardLink } from "@/components/slot-card";
import type { Slot } from "@/types/database";
import { Boxes } from "lucide-react";

export default function SlotsPage() {
  const router = useRouter();
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
    const { slot, error } = await createSlot(supabase, n);
    setCreating(false);

    if (error || !slot) {
      showToast(es.app.error, "error");
      return;
    }

    showToast(es.slots.created_success);
    router.push(`/slots/${slot.id}`);
  }

  const filtered = filterSlots(slots, search);
  const canCreate = profile ? canCreateSlots(profile.role) : false;
  const showCreateBanner =
    search.trim() && !hasExactSlotMatch(slots, search) && canCreate;

  const createButtonLabel = es.slots.createFromSearch.replace("{number}", search.trim());

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
        <Button className="w-full" onClick={() => handleCreate()} disabled={creating}>
          {createButtonLabel}
        </Button>
      )}

      {loading ? (
        <ListSkeleton variant="grid" count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={search.trim() ? es.app.noResults : es.slots.empty}
          description={search.trim() ? es.slots.searchHint : es.slots.emptyDescription}
          action={
            showCreateBanner ? (
              <Button size="sm" onClick={() => handleCreate()} disabled={creating}>
                {createButtonLabel}
              </Button>
            ) : canCreate && !search.trim() ? (
              <Button size="sm" onClick={() => handleCreate("1")} disabled={creating}>
                {es.slots.create}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {filtered.map((slot) => (
              <SlotCardLink
                key={slot.id}
                href={`/slots/${slot.id}`}
                number={slot.number}
                status={slot.status}
              />
            ))}
          </div>
          {showCreateBanner && (
            <Button className="w-full" variant="secondary" onClick={() => handleCreate()} disabled={creating}>
              {createButtonLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

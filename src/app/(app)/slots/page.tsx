"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createSlot } from "@/lib/slot-create";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canCreateSlots } from "@/lib/permissions";
import { useInfiniteRefreshableList } from "@/hooks/use-infinite-refreshable-list";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  clearSlotsListCache,
  fetchAllSlotNumbers,
  fetchSlotsPage,
} from "@/lib/slots-list";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { es } from "@/locales/es";
import { ListPageShell } from "@/components/list-page-shell";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SlotCardLink } from "@/components/slot-card";
import type { Slot } from "@/types/database";
import { Boxes } from "lucide-react";

export default function SlotsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useUserProfile();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const scrollKey = listScrollKey(queryKeys.slots(debouncedSearch));

  const fetchPage = useCallback(
    (page: number) => fetchSlotsPage(page, debouncedSearch),
    [debouncedSearch]
  );

  const { items: slots, initialLoading, refreshing, loadingMore, hasMore, hasCachedData, refresh, loadMore } =
    useInfiniteRefreshableList<Slot>({
      queryKey: queryKeys.slots(debouncedSearch),
      fetchPage,
      getItemId: (slot) => slot.id,
      pollIntervalMs: 60_000,
    });

  const { data: knownNumbers = [] } = useQuery({
    queryKey: queryKeys.slotsNumbers(),
    queryFn: fetchAllSlotNumbers,
    staleTime: 3 * 60 * 1000,
  });

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loadingMore && !initialLoading,
  });

  function handleRefresh() {
    clearSlotsListCache();
    void queryClient.invalidateQueries({ queryKey: queryKeys.slotsNumbers() });
    refresh();
  }

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
    clearSlotsListCache();
    void queryClient.invalidateQueries({ queryKey: queryKeys.slotsNumbers() });
    void queryClient.invalidateQueries({ queryKey: ["slots", "list"] });
    router.push(`/slots/${slot.id}`);
  }

  const canCreate = profile ? canCreateSlots(profile.role) : false;
  const trimmedSearch = search.trim();
  const numberExists = knownNumbers.some(
    (n) => n.toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCreateBanner = trimmedSearch && !numberExists && canCreate;
  const createButtonLabel = es.slots.createFromSearch.replace("{number}", trimmedSearch);

  return (
    <ListPageShell
      title={es.slots.title}
      description={es.slots.description}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
    >
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

      {initialLoading ? (
        <ListSkeleton variant="grid" count={6} />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={trimmedSearch ? es.app.noResults : es.slots.empty}
          description={trimmedSearch ? es.slots.searchHint : es.slots.emptyDescription}
          action={
            showCreateBanner ? (
              <Button size="sm" onClick={() => handleCreate()} disabled={creating}>
                {createButtonLabel}
              </Button>
            ) : canCreate && !trimmedSearch ? (
              <Button size="sm" onClick={() => handleCreate("1")} disabled={creating}>
                {es.slots.create}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {slots.map((slot) => (
              <SlotCardLink
                key={slot.id}
                href={`/slots/${slot.id}`}
                number={slot.number}
                status={slot.status}
              />
            ))}
          </div>
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            loadingMore={loadingMore}
            hasMore={hasMore}
          />
          {showCreateBanner && (
            <Button className="w-full" variant="secondary" onClick={() => handleCreate()} disabled={creating}>
              {createButtonLabel}
            </Button>
          )}
        </div>
      )}
    </ListPageShell>
  );
}

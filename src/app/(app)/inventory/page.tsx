"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useInfiniteRefreshableList } from "@/hooks/use-infinite-refreshable-list";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  fetchInventoryCategories,
  fetchInventoryPage,
  type InventoryListItem,
} from "@/lib/inventory-list";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { es } from "@/locales/es";
import { ListPageShell } from "@/components/list-page-shell";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DonationItemPreview } from "@/components/donation-item-preview";
import { Package, Plus } from "lucide-react";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = { search: debouncedSearch, category: categoryFilter };
  const scrollKey = listScrollKey(queryKeys.inventory(filters));

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.inventoryCategories(),
    queryFn: fetchInventoryCategories,
    staleTime: 10 * 60 * 1000,
  });

  const fetchPage = useCallback(
    (page: number) => fetchInventoryPage(page, filters),
    [debouncedSearch, categoryFilter]
  );

  const { items, initialLoading, refreshing, loadingMore, hasMore, hasCachedData, refresh, loadMore } =
    useInfiniteRefreshableList<InventoryListItem>({
      queryKey: queryKeys.inventory(filters),
      fetchPage,
      getItemId: (item) => item.donation_item_id,
      pollIntervalMs: 60_000,
    });

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loadingMore && !initialLoading,
  });

  return (
    <ListPageShell
      title={es.inventory.title}
      description={es.inventory.description}
      onRefresh={refresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
      action={
        <Link href="/inventory/add">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            {es.inventory.addDonation}
          </Button>
        </Link>
      }
    >
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

      {initialLoading ? (
        <ListSkeleton count={5} />
      ) : items.length === 0 ? (
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
          {items.map((item) => (
            <Link
              key={item.donation_item_id}
              href={`/inventory/${item.donation_item_id}`}
              className="block rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:bg-surface-2 motion-safe:animate-in"
            >
              <DonationItemPreview
                description={item.description}
                presentation={item.presentation}
                unit_of_measurement={item.unit_of_measurement}
                subcategory={item.subcategory}
                category={item.category}
                status={item.status}
                quantity={item.total_quantity}
              />
            </Link>
          ))}
          <InfiniteScrollSentinel
            sentinelRef={sentinelRef}
            loadingMore={loadingMore}
            hasMore={hasMore}
          />
        </div>
      )}
    </ListPageShell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useInfiniteRefreshableList } from "@/hooks/use-infinite-refreshable-list";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import {
  fetchTransactionsPage,
  transactionTypeBadgeClass,
  TRANSACTION_TYPE_OPTIONS,
  type TransactionFilters,
  type TransactionListItem,
} from "@/lib/transactions-list";
import { fetchSlotOptions } from "@/lib/slots-list";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { es } from "@/locales/es";
import { ListPageShell } from "@/components/list-page-shell";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";
import type { InventoryTransactionType } from "@/types/database";

export default function TransactionsPage() {
  const [productSearch, setProductSearch] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [slotId, setSlotId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProductSearch(productSearch), 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const filters: TransactionFilters = useMemo(
    () => ({
      type: typeFilter,
      productSearch: debouncedProductSearch,
      slotId,
      dateFrom,
      dateTo,
    }),
    [typeFilter, debouncedProductSearch, slotId, dateFrom, dateTo]
  );

  const hasActiveFilters =
    Boolean(typeFilter) ||
    Boolean(debouncedProductSearch) ||
    Boolean(slotId) ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const scrollKey = listScrollKey(queryKeys.transactions(filters));

  const { data: slotOptions = [] } = useQuery({
    queryKey: queryKeys.slotsNumbers(),
    queryFn: fetchSlotOptions,
    staleTime: 10 * 60 * 1000,
  });

  const fetchPage = useCallback(
    (page: number) => fetchTransactionsPage(page, filters),
    [filters]
  );

  const { items: transactions, initialLoading, refreshing, loadingMore, hasMore, hasCachedData, refresh, loadMore } =
    useInfiniteRefreshableList<TransactionListItem>({
      queryKey: queryKeys.transactions(filters),
      fetchPage,
      getItemId: (tx) => tx.id,
      pollIntervalMs: 60_000,
    });

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loadingMore && !initialLoading,
  });

  return (
    <ListPageShell
      title={es.transactions.title}
      description={es.transactions.description}
      onRefresh={refresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
    >
      <div className="space-y-3">
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={es.transactions.filterType}
        >
          <option value="">{es.transactions.allTypes}</option>
          {TRANSACTION_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {es.transactions.types[type as InventoryTransactionType]}
            </option>
          ))}
        </Select>

        <Input
          placeholder={es.transactions.filterProductPlaceholder}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          aria-label={es.transactions.filterProduct}
        />

        <Select
          value={slotId}
          onChange={(e) => setSlotId(e.target.value)}
          aria-label={es.transactions.filterSlot}
        >
          <option value="">{es.transactions.filterSlotAll}</option>
          {slotOptions.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {es.slots.title} {slot.number}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="tx-date-from">
              {es.transactions.filterDateFrom}
            </label>
            <Input
              id="tx-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted" htmlFor="tx-date-to">
              {es.transactions.filterDateTo}
            </label>
            <Input
              id="tx-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {initialLoading ? (
        <ListSkeleton count={5} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={hasActiveFilters ? es.app.noResults : es.transactions.empty}
          description={hasActiveFilters ? undefined : es.transactions.emptyDescription}
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="rounded-xl border border-border bg-surface-1 p-4 motion-safe:animate-in"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${transactionTypeBadgeClass(tx.type)}`}
                >
                  {es.transactions.types[tx.type]}
                </span>
                <span className="text-sm text-muted">{formatDate(tx.created_at)}</span>
              </div>
              <p className="mt-2 font-medium">{tx.donation_item?.description}</p>
              <p className="text-sm text-muted">
                {es.inventory.quantity}: {tx.quantity}
                {tx.from_slot && ` · ${es.slots.title} ${tx.from_slot.number}`}
                {tx.to_slot && ` → ${es.slots.title} ${tx.to_slot.number}`}
              </p>
              {tx.reason && (
                <p className="text-sm text-muted">
                  {es.transactions.reason}: {tx.reason}
                </p>
              )}
              {tx.order?.order_number && tx.order_id && (
                <p className="text-sm">
                  {es.transactions.relatedOrder}:{" "}
                  <Link href={`/orders/${tx.order_id}`} className="font-medium underline">
                    {tx.order.order_number}
                  </Link>
                </p>
              )}
              {tx.created_by?.name && (
                <p className="text-xs text-muted">
                  {es.transactions.createdBy}: {tx.created_by.name}
                </p>
              )}
            </div>
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

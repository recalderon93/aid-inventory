"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchCompletedOrdersPage,
  fetchInProgressOrdersPage,
  fetchPendingOrdersPage,
  type OrderWithHandler,
} from "@/lib/orders-list";
import { startOrder } from "@/lib/orders-api";
import { useInfiniteRefreshableList } from "@/hooks/use-infinite-refreshable-list";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canCreateOrders, canViewOrders, getOrderStatusVariant } from "@/lib/permissions";
import { ListPageShell } from "@/components/list-page-shell";
import { SectionHeader } from "@/components/section-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScrollSentinel } from "@/components/infinite-scroll-sentinel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { OrderStatus } from "@/types/database";
import { formatDate, cn, profileDisplayName } from "@/lib/utils";
import { ClipboardList, Plus } from "lucide-react";

function OrderListCard({
  order,
  onClick,
  highlight,
  badge,
}: {
  order: OrderWithHandler;
  onClick?: () => void;
  highlight?: boolean;
  badge?: React.ReactNode;
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="font-semibold">{order.order_number}</p>
        <p className="text-sm">{order.requester_name}</p>
        <p className="text-xs text-muted">{formatDate(order.created_at)}</p>
        {order.progressLabel && (
          <p className="mt-1 text-xs text-muted">
            {es.orders.progress}: {order.progressLabel}
          </p>
        )}
        {profileDisplayName(order.prepared_by) && (
          <p className="mt-1 text-xs text-muted">
            {es.orders.preparingBy}: {profileDisplayName(order.prepared_by)}
          </p>
        )}
        {profileDisplayName(order.completed_by) && (
          <p className="mt-1 text-xs text-muted">
            {es.orders.handledBy}: {profileDisplayName(order.completed_by)}
          </p>
        )}
      </div>
      {badge}
    </div>
  );

  const className = cn(
    "block w-full rounded-xl border p-4 text-left transition-colors hover:bg-surface-2 motion-safe:animate-in",
    highlight ? "border-foreground bg-surface-2" : "border-border bg-surface-1"
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export default function OrdersPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useUserProfile();
  const scrollKey = listScrollKey(["orders"]);

  const fetchPendingPage = useCallback((page: number) => fetchPendingOrdersPage(page), []);
  const fetchInProgressPage = useCallback((page: number) => fetchInProgressOrdersPage(page), []);
  const fetchCompletedPage = useCallback((page: number) => fetchCompletedOrdersPage(page), []);

  const pendingList = useInfiniteRefreshableList<OrderWithHandler>({
    queryKey: queryKeys.ordersPending(),
    fetchPage: fetchPendingPage,
    getItemId: (order) => order.id,
    pollIntervalMs: 45_000,
  });

  const inProgressList = useInfiniteRefreshableList<OrderWithHandler>({
    queryKey: queryKeys.ordersInProgress(),
    fetchPage: fetchInProgressPage,
    getItemId: (order) => order.id,
    pollIntervalMs: 45_000,
  });

  const completedList = useInfiniteRefreshableList<OrderWithHandler>({
    queryKey: queryKeys.ordersCompleted(),
    fetchPage: fetchCompletedPage,
    getItemId: (order) => order.id,
    pollIntervalMs: 45_000,
  });

  const pendingSentinelRef = useInfiniteScroll(pendingList.loadMore, {
    enabled: pendingList.hasMore && !pendingList.loadingMore && !pendingList.initialLoading,
  });

  const inProgressSentinelRef = useInfiniteScroll(inProgressList.loadMore, {
    enabled: inProgressList.hasMore && !inProgressList.loadingMore && !inProgressList.initialLoading,
  });

  const completedSentinelRef = useInfiniteScroll(completedList.loadMore, {
    enabled: completedList.hasMore && !completedList.loadingMore && !completedList.initialLoading,
  });

  const initialLoading =
    pendingList.initialLoading || inProgressList.initialLoading || completedList.initialLoading;
  const refreshing =
    pendingList.refreshing || inProgressList.refreshing || completedList.refreshing;
  const hasCachedData =
    pendingList.hasCachedData || inProgressList.hasCachedData || completedList.hasCachedData;

  function refresh() {
    pendingList.refresh();
    inProgressList.refresh();
    completedList.refresh();
  }

  async function handlePendingClick(order: OrderWithHandler) {
    const { error } = await startOrder(order.id);
    if (error) {
      showToast(error.message);
      return;
    }
    pendingList.refresh();
    inProgressList.refresh();
    router.push(`/orders/${order.id}`);
  }

  const canCreate = profile && canCreateOrders(profile.role);
  const canView = profile && canViewOrders(profile.role);

  if (profile && !canView) {
    return <p>{es.app.error}</p>;
  }

  return (
    <ListPageShell
      title={es.orders.title}
      description={es.orders.description}
      onRefresh={refresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
      action={
        canCreate ? (
          <Link href="/orders/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {es.orders.create}
            </Button>
          </Link>
        ) : undefined
      }
    >
      {initialLoading ? (
        <div className="space-y-6">
          <ListSkeleton count={3} />
          <ListSkeleton count={3} />
          <ListSkeleton count={3} />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <SectionHeader title={es.orders.pending} description={es.orders.pendingDescription} />
            {pendingList.items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={es.orders.emptyPending}
                description={es.orders.emptyPendingDescription}
              />
            ) : (
              <div className="space-y-2">
                {pendingList.items.map((order) => (
                  <OrderListCard
                    key={order.id}
                    order={order}
                    onClick={() => handlePendingClick(order)}
                    badge={
                      <Badge variant={getOrderStatusVariant(order.status)}>
                        {es.orders.statuses[order.status as OrderStatus]}
                      </Badge>
                    }
                  />
                ))}
                <InfiniteScrollSentinel
                  sentinelRef={pendingSentinelRef}
                  loadingMore={pendingList.loadingMore}
                  hasMore={pendingList.hasMore}
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader
              title={es.orders.inProgress}
              description={es.orders.inProgressDescription}
            />
            {inProgressList.items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={es.orders.emptyInProgress}
                description={es.orders.emptyInProgressDescription}
              />
            ) : (
              <div className="space-y-2">
                {inProgressList.items.map((order) => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="block">
                    <OrderListCard
                      order={order}
                      highlight={profile?.id === order.prepared_by_user_id}
                      badge={
                        <Badge variant={getOrderStatusVariant(order.status)}>
                          {es.orders.statuses[order.status as OrderStatus]}
                        </Badge>
                      }
                    />
                  </Link>
                ))}
                <InfiniteScrollSentinel
                  sentinelRef={inProgressSentinelRef}
                  loadingMore={inProgressList.loadingMore}
                  hasMore={inProgressList.hasMore}
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeader title={es.orders.handled} description={es.orders.handledDescription} />
            {completedList.items.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={es.orders.emptyHandled}
                description={es.orders.emptyHandledDescription}
              />
            ) : (
              <div className="space-y-2">
                {completedList.items.map((order) => {
                  const isMine = profile && order.completed_by_user_id === profile.id;
                  return (
                    <Link key={order.id} href={`/orders/${order.id}`} className="block">
                      <OrderListCard
                        order={order}
                        highlight={!!isMine}
                        badge={
                          <Badge variant="success">
                            {order.has_issues
                              ? es.orders.completeWithIssues
                              : es.orders.statuses.completed}
                          </Badge>
                        }
                      />
                    </Link>
                  );
                })}
                <InfiniteScrollSentinel
                  sentinelRef={completedSentinelRef}
                  loadingMore={completedList.loadingMore}
                  hasMore={completedList.hasMore}
                />
              </div>
            )}
          </section>
        </div>
      )}
    </ListPageShell>
  );
}

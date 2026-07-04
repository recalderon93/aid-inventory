"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

const DEFAULT_POLL_MS = 60_000;
const DEFAULT_STALE_MS = 3 * 60 * 1000;
const DEFAULT_GC_MS = 30 * 60 * 1000;

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
}

export interface UseInfiniteRefreshableListOptions<T> {
  queryKey: readonly unknown[];
  fetchPage: (page: number) => Promise<PageResult<T>>;
  getItemId: (item: T) => string;
  pollIntervalMs?: number;
  enabled?: boolean;
  staleTime?: number;
}

export function useInfiniteRefreshableList<T>({
  queryKey,
  fetchPage,
  getItemId,
  pollIntervalMs = DEFAULT_POLL_MS,
  enabled = true,
  staleTime = DEFAULT_STALE_MS,
}: UseInfiniteRefreshableListOptions<T>) {
  const queryClient = useQueryClient();
  const fetchPageRef = useRef(fetchPage);

  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPageRef.current(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? (lastPageParam as number) + 1 : undefined,
    enabled,
    staleTime,
    gcTime: DEFAULT_GC_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!enabled || pollIntervalMs <= 0 || !query.isSuccess) return;

    const pollFirstPage = async () => {
      if (document.visibilityState !== "visible") return;
      if (!query.isStale) return;

      try {
        const fresh = await fetchPageRef.current(0);
        queryClient.setQueryData<InfiniteData<PageResult<T>>>(queryKey, {
          pages: [fresh],
          pageParams: [0],
        });
      } catch {
        // silent poll failure
      }
    };

    const id = window.setInterval(() => void pollFirstPage(), pollIntervalMs);
    const onVisible = () => void pollFirstPage();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pollIntervalMs, query.isSuccess, query.isStale, queryClient, queryKey]);

  const items = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<string>();
    const merged: T[] = [];
    for (const page of pages) {
      for (const item of page.items) {
        const id = getItemId(item);
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(item);
        }
      }
    }
    return merged;
  }, [query.data, getItemId]);

  const hasCachedData = query.data !== undefined;

  const refresh = useCallback(() => {
    queryClient.resetQueries({ queryKey });
    return query.refetch();
  }, [queryClient, queryKey, query]);

  return {
    items,
    initialLoading: query.isPending && !query.data,
    refreshing: query.isFetching && !query.isFetchingNextPage && !(query.isPending && !query.data),
    loadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage ?? false,
    hasCachedData,
    refresh,
    loadMore: () => query.fetchNextPage(),
  };
}

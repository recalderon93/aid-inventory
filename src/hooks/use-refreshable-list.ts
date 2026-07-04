"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DEFAULT_POLL_MS = 60_000;
const DEFAULT_STALE_MS = 3 * 60 * 1000;
const DEFAULT_GC_MS = 30 * 60 * 1000;

export interface UseRefreshableListOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
  staleTime?: number;
}

export function useRefreshableList<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options: UseRefreshableListOptions = {}
) {
  const { pollIntervalMs = DEFAULT_POLL_MS, enabled = true, staleTime = DEFAULT_STALE_MS } =
    options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey,
    queryFn: fetchFn,
    enabled,
    staleTime,
    gcTime: DEFAULT_GC_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!enabled || pollIntervalMs <= 0 || !query.isSuccess) return;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      if (!query.isStale) return;
      void query.refetch();
    };

    const id = window.setInterval(poll, pollIntervalMs);
    const onVisible = () => poll();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pollIntervalMs, query.isSuccess, query.isStale, query]);

  const refresh = useCallback(() => {
    queryClient.resetQueries({ queryKey });
    return query.refetch();
  }, [queryClient, queryKey, query]);

  return {
    data: query.data,
    initialLoading: query.isPending && !query.data,
    refreshing: query.isFetching && !(query.isPending && !query.data),
    hasCachedData: query.data !== undefined,
    refresh,
  };
}

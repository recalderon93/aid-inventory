"use client";

import { es } from "@/locales/es";
import { RefreshCw } from "lucide-react";

interface InfiniteScrollSentinelProps {
  loadingMore: boolean;
  hasMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function InfiniteScrollSentinel({
  loadingMore,
  hasMore,
  sentinelRef,
}: InfiniteScrollSentinelProps) {
  if (!hasMore && !loadingMore) return null;

  return (
    <div
      ref={sentinelRef}
      className="flex h-12 items-center justify-center text-sm text-muted"
      aria-live="polite"
    >
      {loadingMore ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 motion-safe:animate-spin" />
          {es.app.loadingMore}
        </>
      ) : hasMore ? (
        <span className="sr-only">{es.app.loadMore}</span>
      ) : null}
    </div>
  );
}

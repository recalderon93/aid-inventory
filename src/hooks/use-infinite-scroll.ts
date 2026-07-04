"use client";

import { useEffect, useRef } from "react";

export function useInfiniteScroll(
  onLoadMore: () => void,
  options: { enabled?: boolean; rootMargin?: string } = {}
) {
  const { enabled = true, rootMargin = "200px" } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin]);

  return sentinelRef;
}

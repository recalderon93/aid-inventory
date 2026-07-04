"use client";

import { useLayoutEffect, useEffect, useRef } from "react";

export function clearListScroll(storageKey: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey);
}

export function useListScrollRestoration(
  storageKey: string | undefined,
  ready: boolean,
  hasCachedData: boolean
) {
  const restored = useRef(false);

  useEffect(() => {
    if (!storageKey) return;
    return () => {
      sessionStorage.setItem(storageKey, String(window.scrollY));
    };
  }, [storageKey]);

  useLayoutEffect(() => {
    if (!storageKey || !ready || restored.current) return;

    if (!hasCachedData) {
      clearListScroll(storageKey);
      restored.current = true;
      return;
    }

    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const y = Number.parseInt(saved, 10);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
      }
    }
    restored.current = true;
  }, [storageKey, ready, hasCachedData]);
}

"use client";

import { useRef, useState, type ReactNode } from "react";
import { es } from "@/locales/es";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 72;

interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  refreshing?: boolean;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  refreshing = false,
  children,
  className,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  function canPull() {
    return typeof window !== "undefined" && window.scrollY <= 0;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing || !canPull()) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    pulling.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!pulling.current || refreshing) return;
    if (!canPull()) {
      pulling.current = false;
      setPullDistance(0);
      return;
    }
    const y = e.touches[0]?.clientY ?? 0;
    const delta = y - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, 120));
      if (delta > 10) e.preventDefault();
    }
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    const shouldRefresh = pullDistance >= PULL_THRESHOLD;
    setPullDistance(0);
    if (shouldRefresh) await onRefresh();
  }

  const showIndicator = refreshing || pullDistance > 8;
  const progress = refreshing ? 1 : Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      className={cn("relative", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => void onTouchEnd()}
      onTouchCancel={() => {
        pulling.current = false;
        setPullDistance(0);
      }}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden text-muted transition-[height,opacity] duration-200",
          showIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{ height: showIndicator ? Math.max(32, pullDistance * 0.45) : 0 }}
        aria-live="polite"
      >
        <RefreshCw
          className={cn(
            "h-5 w-5",
            refreshing && "motion-safe:animate-spin",
            !refreshing && progress >= 1 && "text-foreground"
          )}
          style={!refreshing ? { transform: `rotate(${progress * 180}deg)` } : undefined}
        />
        <span className="sr-only">{refreshing ? es.app.refreshing : es.app.pullToRefresh}</span>
      </div>
      {children}
    </div>
  );
}

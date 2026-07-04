"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { RefreshButton } from "@/components/refresh-button";
import {
  clearListScroll,
  useListScrollRestoration,
} from "@/hooks/use-list-scroll-restoration";

interface ListPageShellProps {
  title: string;
  description?: string;
  action?: ReactNode;
  onRefresh: () => void;
  refreshing?: boolean;
  scrollKey?: string;
  scrollReady?: boolean;
  hasCachedData?: boolean;
  children: ReactNode;
}

export function ListPageShell({
  title,
  description,
  action,
  onRefresh,
  refreshing,
  scrollKey,
  scrollReady = true,
  hasCachedData = false,
  children,
}: ListPageShellProps) {
  useListScrollRestoration(scrollKey, scrollReady, hasCachedData);

  function handleRefresh() {
    if (scrollKey) {
      clearListScroll(scrollKey);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    onRefresh();
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} refreshing={refreshing}>
      <div className="space-y-4">
        <PageHeader
          title={title}
          description={description}
          action={
            <div className="flex items-center gap-2">
              <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
              {action}
            </div>
          }
        />
        {children}
      </div>
    </PullToRefresh>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canManageImportReview } from "@/lib/permissions";
import { useRefreshableList } from "@/hooks/use-refreshable-list";
import { listScrollKey, queryKeys } from "@/lib/query-keys";
import { ListPageShell } from "@/components/list-page-shell";
import { ListSkeleton } from "@/components/list-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ImportReviewItem, ImportReviewStatus } from "@/types/database";
import { ClipboardList, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function statusVariant(
  status: ImportReviewStatus
): "default" | "secondary" | "success" | "warning" | "destructive" {
  switch (status) {
    case "RESOLVED":
      return "success";
    case "IGNORED":
      return "secondary";
    case "IN_REVIEW":
      return "warning";
    default:
      return "destructive";
  }
}

function extractDescription(item: ImportReviewItem): string {
  const json = item.original_row_json;
  if (!json) return item.warning_code;
  const desc =
    (json.cleanedDescription as string) ||
    (json.description as string) ||
    (json.cleaned_description as string);
  return desc || item.warning_code;
}

export default function ImportReviewPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const { showToast } = useToast();
  const [canLoad, setCanLoad] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");
  const [warningFilter, setWarningFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ImportReviewItem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filterKey = {
    status: statusFilter,
    warning: warningFilter,
    action: actionFilter,
    entity: entityFilter,
    search: search.trim(),
  };
  const scrollKey = listScrollKey(queryKeys.importReview(filterKey));

  const loadItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (warningFilter !== "all") params.set("warning_code", warningFilter);
    if (actionFilter !== "all") params.set("action_taken", actionFilter);
    if (entityFilter !== "all") params.set("entity_type", entityFilter);
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/admin/import-review?${params.toString()}`);
    if (!res.ok) return [] as ImportReviewItem[];
    return (await res.json()) as ImportReviewItem[];
  }, [statusFilter, warningFilter, actionFilter, entityFilter, search]);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile || !canManageImportReview(profile.role)) {
      router.replace("/slots");
      return;
    }
    setCanLoad(true);
  }, [profile, profileLoading, router]);

  const { data: items = [], initialLoading, refreshing, hasCachedData, refresh } = useRefreshableList(
    queryKeys.importReview(filterKey),
    loadItems,
    {
      enabled: canLoad,
      pollIntervalMs: 120_000,
    }
  );

  const warningCodes = useMemo(
    () => [...new Set(items.map((i) => i.warning_code))].sort(),
    [items]
  );
  const actions = useMemo(
    () => [...new Set(items.map((i) => i.action_taken))].sort(),
    [items]
  );
  const entityTypes = useMemo(
    () => [...new Set(items.map((i) => i.entity_type))].sort(),
    [items]
  );

  async function handleAction(action: "resolve" | "ignore" | "start_review") {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/import-review/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, resolution_notes: resolutionNotes }),
    });
    if (res.ok) {
      showToast(
        action === "resolve"
          ? es.importReview.resolved_success
          : action === "ignore"
            ? es.importReview.ignored_success
            : es.app.success
      );
      setSelected(null);
      setResolutionNotes("");
      await refresh();
    } else {
      showToast(es.app.error);
    }
    setSubmitting(false);
  }

  function openItem(item: ImportReviewItem) {
    setSelected(item);
    setResolutionNotes(item.resolution_notes ?? "");
  }

  function entityLink(item: ImportReviewItem) {
    if (!item.entity_id) return null;
    if (item.entity_type === "donation_item") {
      return `/inventory/${item.entity_id}`;
    }
    if (item.entity_type === "order_item") {
      return `/orders/${item.entity_id}`;
    }
    return null;
  }

  if (profileLoading || !canLoad) {
    return (
      <ListPageShell title={es.importReview.title} description={es.importReview.description} onRefresh={() => {}}>
        <ListSkeleton />
      </ListPageShell>
    );
  }

  return (
    <ListPageShell
      title={es.importReview.title}
      description={es.importReview.description}
      onRefresh={refresh}
      refreshing={refreshing}
      scrollKey={scrollKey}
      scrollReady={!initialLoading}
      hasCachedData={hasCachedData}
    >

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label>{es.importReview.filterStatus}</Label>
          <select
            className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{es.importReview.all}</option>
            <option value="PENDING_REVIEW">{es.importReview.pending}</option>
            <option value="IN_REVIEW">{es.importReview.inReview}</option>
            <option value="RESOLVED">{es.importReview.resolved}</option>
            <option value="IGNORED">{es.importReview.ignored}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>{es.importReview.filterWarning}</Label>
          <select
            className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
            value={warningFilter}
            onChange={(e) => setWarningFilter(e.target.value)}
          >
            <option value="all">{es.importReview.all}</option>
            {warningCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{es.importReview.filterAction}</Label>
          <select
            className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">{es.importReview.all}</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{es.importReview.filterEntity}</Label>
          <select
            className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="all">{es.importReview.all}</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{es.app.search}</Label>
          <Input
            placeholder={es.importReview.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {initialLoading ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={es.importReview.empty}
          description={es.importReview.emptyDescription}
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => openItem(item)}
            >
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{extractDescription(item)}</p>
                  <p className="text-sm text-muted">
                    {item.source_sheet ?? item.source_file}
                    {item.source_row_number ? ` · ${es.importReview.rowNumber} ${item.source_row_number}` : ""}
                  </p>
                  <p className="text-xs text-muted">{item.warning_code}</p>
                </div>
                <Badge variant={statusVariant(item.review_status)}>
                  {es.importReview.statuses[item.review_status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{extractDescription(selected)}</DialogTitle>
                <DialogDescription>
                  {selected.action_taken} · {selected.warning_code}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">{es.importReview.sourceFile}</p>
                  <p className="text-muted">{selected.source_file}</p>
                </div>
                {selected.source_sheet && (
                  <div>
                    <p className="font-medium">{es.importReview.sourceSheet}</p>
                    <p className="text-muted">{selected.source_sheet}</p>
                  </div>
                )}
                {selected.source_row_number && (
                  <div>
                    <p className="font-medium">{es.importReview.rowNumber}</p>
                    <p className="text-muted">{selected.source_row_number}</p>
                  </div>
                )}
                {selected.suggested_fix && (
                  <div>
                    <p className="font-medium">{es.importReview.suggestedFix}</p>
                    <p className="text-muted">{selected.suggested_fix}</p>
                  </div>
                )}
                {selected.original_row_json && (
                  <div>
                    <p className="mb-1 font-medium">{es.importReview.originalData}</p>
                    <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs">
                      {JSON.stringify(selected.original_row_json, null, 2)}
                    </pre>
                  </div>
                )}
                {entityLink(selected) && (
                  <Link href={entityLink(selected)!} onClick={() => setSelected(null)}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {selected.entity_type === "order_item"
                        ? es.importReview.viewOrder
                        : es.importReview.viewEntity}
                    </Button>
                  </Link>
                )}
                <div className="space-y-1">
                  <Label htmlFor="resolution-notes">{es.importReview.resolutionNotes}</Label>
                  <textarea
                    id="resolution-notes"
                    className="flex min-h-24 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {selected.review_status === "PENDING_REVIEW" && (
                  <Button
                    variant="outline"
                    disabled={submitting}
                    onClick={() => handleAction("start_review")}
                  >
                    {es.importReview.startReview}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => handleAction("ignore")}
                >
                  {es.importReview.ignore}
                </Button>
                <Button disabled={submitting} onClick={() => handleAction("resolve")}>
                  {es.importReview.resolve}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </ListPageShell>
  );
}

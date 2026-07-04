"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DonationItemPreview } from "@/components/donation-item-preview";
import { es } from "@/locales/es";
import {
  aggregateStockBySlot,
  picksFromValues,
  remainingQuantity,
  sumPickInputs,
  validatePickBatch,
  type PickInput,
  type StockBySlot,
} from "@/lib/order-fulfillment";
import {
  canMarkOrderItemIssue,
  canPickOnOrder,
  canRecordMerma,
} from "@/lib/permissions";
import type { Order, OrderItem, OrderItemStatus, UserRole } from "@/types/database";
import { OrderSlotPickInputs } from "./order-slot-pick-inputs";
import { OrderMermaDialog } from "./order-merma-dialog";
import { OrderIssueDialog } from "./order-issue-dialog";
import { confirmOrderItemPicks, markOrderItemIssue, recordMerma } from "@/lib/orders-api";

function itemStatusVariant(
  status: OrderItemStatus
): "default" | "secondary" | "success" | "warning" | "destructive" {
  switch (status) {
    case "fulfilled":
      return "success";
    case "partially_fulfilled":
      return "warning";
    case "issue":
      return "destructive";
    default:
      return "secondary";
  }
}

export function OrderItemPickCard({
  item,
  order,
  role,
  currentUserId,
  stockRows,
  onUpdated,
  onError,
  onSuccess,
}: {
  item: OrderItem;
  order: Order;
  role: UserRole;
  currentUserId: string | null;
  stockRows: { slot_id: string; quantity: number; slot_number: string }[];
  onUpdated: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [pickValues, setPickValues] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [mermaOpen, setMermaOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const slots: StockBySlot[] = aggregateStockBySlot(stockRows);
  const remaining = remainingQuantity(item.requested_quantity, item.fulfilled_quantity);
  const selectedPicks = picksFromValues(pickValues);
  const selectedTotal = sumPickInputs(selectedPicks);
  const canConfirmPick = selectedTotal > 0 && selectedTotal <= remaining;
  const canPick =
    order.status === "in_progress" &&
    canPickOnOrder(role, order.prepared_by_user_id, currentUserId) &&
    item.status !== "fulfilled" &&
    item.status !== "issue" &&
    item.status !== "cancelled";

  async function handleConfirmPick() {
    const picks: PickInput[] = selectedPicks;

    const validation = validatePickBatch({
      requested: item.requested_quantity,
      fulfilled: item.fulfilled_quantity,
      picks,
      stockBySlot: slots,
    });

    if (!validation.ok) {
      if (validation.error === "OVER_SLOT_STOCK") {
        onError(es.orders.notEnoughStockInBox);
      } else if (validation.error === "OVER_REQUESTED") {
        onError(
          es.orders.pickExceedsRemaining
            .replace("{selected}", String(validation.totalPick))
            .replace("{remaining}", String(validation.remaining))
        );
      } else if (validation.error === "EMPTY_PICK") {
        onError(es.orders.emptyPick);
      } else {
        onError(es.app.error);
      }
      return;
    }

    setPicking(true);
    const { error } = await confirmOrderItemPicks(item.id, picks);
    setPicking(false);

    if (error) {
      onError(error.message);
      return;
    }

    setPickValues({});
    onSuccess(es.orders.pickConfirmed);
    onUpdated();
  }

  async function handleMerma(data: {
    slotId: string;
    quantity: number;
    reason: string;
    notes: string;
  }) {
    if (!item.donation_item_id) return;
    setActionLoading(true);
    const { error } = await recordMerma({
      slotId: data.slotId,
      donationItemId: item.donation_item_id,
      quantity: data.quantity,
      reason: data.reason,
      notes: data.notes,
      orderId: order.id,
      orderItemId: item.id,
    });
    setActionLoading(false);

    if (error) {
      onError(error.message);
      return;
    }

    setMermaOpen(false);
    onSuccess(es.orders.mermaRecorded);
    onUpdated();
  }

  async function handleIssue(data: { reason: string; notes: string }) {
    setActionLoading(true);
    const { error } = await markOrderItemIssue(item.id, data.reason, data.notes);
    setActionLoading(false);

    if (error) {
      onError(error.message);
      return;
    }

    setIssueOpen(false);
    onSuccess(es.orders.issueMarked);
    onUpdated();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <DonationItemPreview
          description={item.donation_item?.description ?? ""}
          presentation={item.donation_item?.presentation}
          unit_of_measurement={item.donation_item?.unit_of_measurement}
          subcategory={item.donation_item?.subcategory}
          category={item.donation_item?.category}
          status={item.donation_item?.status}
          showQuantity={false}
        />
        <Badge variant={itemStatusVariant(item.status)}>
          {es.orders.itemStatuses[item.status] ?? item.status}
        </Badge>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted">
        <p>
          {es.orders.requested}: {item.requested_quantity} · {es.orders.picked}:{" "}
          {item.fulfilled_quantity} · {es.orders.remaining}: {remaining}
        </p>
        {item.issue_reason && (
          <p>
            {es.orders.issueReason}:{" "}
            {(es.orders.issueReasons as Record<string, string>)[item.issue_reason] ??
              item.issue_reason}
          </p>
        )}
      </div>

      {canPick && remaining > 0 && (
        <div className="mt-3 space-y-3">
          <OrderSlotPickInputs
            slots={slots}
            values={pickValues}
            remaining={remaining}
            disabled={picking}
            onChange={(slotId, value) =>
              setPickValues((prev) => ({ ...prev, [slotId]: value }))
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleConfirmPick}
              disabled={picking || !canConfirmPick}
            >
              {picking ? es.app.loading : es.orders.confirmPick}
            </Button>
            {canRecordMerma(role) && (
              <Button size="sm" variant="outline" onClick={() => setMermaOpen(true)}>
                {es.orders.recordMerma}
              </Button>
            )}
            {canMarkOrderItemIssue(role) && (
              <Button size="sm" variant="outline" onClick={() => setIssueOpen(true)}>
                {es.orders.markIssue}
              </Button>
            )}
          </div>
        </div>
      )}

      {canPick && remaining > 0 && canRecordMerma(role) && (
        <OrderMermaDialog
          open={mermaOpen}
          onOpenChange={setMermaOpen}
          slots={slots}
          onSubmit={handleMerma}
          loading={actionLoading}
        />
      )}

      {canPick && canMarkOrderItemIssue(role) && (
        <OrderIssueDialog
          open={issueOpen}
          onOpenChange={setIssueOpen}
          onSubmit={handleIssue}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { es } from "@/locales/es";
import type { StockBySlot } from "@/lib/order-fulfillment";

const MERMA_REASONS = [
  "LOST_PRODUCT",
  "DAMAGED_PRODUCT",
  "EXPIRED_PRODUCT",
  "STOCK_DIFFERENCE",
  "OTHER",
] as const;

export function OrderMermaDialog({
  open,
  onOpenChange,
  slots,
  defaultSlotId,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: StockBySlot[];
  defaultSlotId?: string;
  onSubmit: (data: { slotId: string; quantity: number; reason: string; notes: string }) => void;
  loading?: boolean;
}) {
  const [slotId, setSlotId] = useState(defaultSlotId ?? slots[0]?.slot_id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<string>(MERMA_REASONS[0]);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{es.orders.mermaTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{es.slots.title}</Label>
            <Select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              {slots.map((slot) => (
                <option key={slot.slot_id} value={slot.slot_id}>
                  {es.slots.title} {slot.slot_number} ({slot.quantity})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{es.inventory.quantity}</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{es.orders.mermaReason}</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {MERMA_REASONS.map((r) => (
                <option key={r} value={r}>
                  {es.orders.mermaReasons[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{es.orders.notes}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {es.orders.cancel}
          </Button>
          <Button
            disabled={loading || !slotId || !quantity}
            onClick={() =>
              onSubmit({
                slotId,
                quantity: Math.max(1, parseInt(quantity) || 1),
                reason,
                notes,
              })
            }
          >
            {loading ? es.app.loading : es.orders.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

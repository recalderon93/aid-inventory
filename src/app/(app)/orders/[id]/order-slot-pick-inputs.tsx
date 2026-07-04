"use client";

import { Input } from "@/components/ui/input";
import { es } from "@/locales/es";
import {
  maxQuantityForSlot,
  parsePickQuantity,
  sumPickInputs,
  picksFromValues,
  type StockBySlot,
} from "@/lib/order-fulfillment";

export function OrderSlotPickInputs({
  slots,
  values,
  remaining,
  onChange,
  disabled,
}: {
  slots: StockBySlot[];
  values: Record<string, string>;
  remaining: number;
  onChange: (slotId: string, value: string) => void;
  disabled?: boolean;
}) {
  if (slots.length === 0) {
    return <p className="text-xs text-muted">{es.inventory.outOfStock}</p>;
  }

  const picks = picksFromValues(values);
  const selectedTotal = sumPickInputs(picks);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {es.orders.pickingNow}:{" "}
        {es.orders.pickingNowSummary
          .replace("{selected}", String(selectedTotal))
          .replace("{remaining}", String(remaining))}
      </p>
      {slots.map((slot) => {
        const currentQty = parsePickQuantity(values[slot.slot_id] ?? "");
        const maxQty = maxQuantityForSlot({
          slotAvailable: slot.quantity,
          remaining,
          selectedTotal,
          currentSlotQuantity: currentQty,
        });

        return (
          <div key={slot.slot_id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">
              {es.slots.title} {slot.slot_number}: {slot.quantity}{" "}
              {es.orders.availableInSlot.toLowerCase()}
            </span>
            <Input
              type="number"
              min={0}
              max={maxQty}
              className="w-20"
              placeholder="0"
              value={values[slot.slot_id] ?? ""}
              disabled={disabled || maxQty === 0}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange(slot.slot_id, "");
                  return;
                }
                const qty = parsePickQuantity(raw);
                const capped = Math.min(qty, maxQty);
                onChange(slot.slot_id, capped > 0 ? String(capped) : "");
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

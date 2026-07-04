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

const ISSUE_REASONS = [
  "NOT_ENOUGH_STOCK",
  "PRODUCT_NOT_FOUND",
  "DAMAGED_OR_EXPIRED",
  "STOCK_MISMATCH",
  "OTHER",
] as const;

export function OrderIssueDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { reason: string; notes: string }) => void;
  loading?: boolean;
}) {
  const [reason, setReason] = useState<string>(ISSUE_REASONS[0]);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{es.orders.issueTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{es.orders.issueReason}</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {ISSUE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {es.orders.issueReasons[r]}
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
          <Button disabled={loading} onClick={() => onSubmit({ reason, notes })}>
            {loading ? es.app.loading : es.orders.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

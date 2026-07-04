/**
 * Integration-style tests simulating full order fulfillment flows using pure functions.
 * For live RPC validation, run against Supabase after `supabase db reset`.
 */
import { describe, expect, it } from "vitest";
import {
  aggregateStockBySlot,
  applyMerma,
  applyPicks,
  canCompleteOrder,
  canStartOrder,
  canUserCompleteOrder,
  countOrderProgress,
  deriveOrderItemStatus,
  pickAlreadyHasTransaction,
  remainingQuantity,
  sumPickedQuantity,
  validatePickBatch,
  type OrderItemLike,
} from "./order-fulfillment";

type SimItem = OrderItemLike & { donation_item_id: string };
type SimPick = { slot_id: string; quantity: number; status: string; inventory_transaction_id: string | null };

function simulateFlow() {
  const stock = [
    { slot_id: "box-10", slot_number: "10", quantity: 12 },
    { slot_id: "box-15", slot_number: "15", quantity: 20 },
    { slot_id: "box-22", slot_number: "22", quantity: 5 },
  ];

  const item: SimItem = {
    id: "item-1",
    donation_item_id: "prod-1",
    requested_quantity: 30,
    fulfilled_quantity: 0,
    status: "pending",
  };

  const picks: SimPick[] = [];
  const transactions: { type: string; slot_id: string; quantity: number }[] = [];

  return {
    stock,
    item,
    picks,
    transactions,
    confirmPick(batch: { slot_id: string; quantity: number }[]) {
      const slots = aggregateStockBySlot(this.stock);
      const validation = validatePickBatch({
        requested: this.item.requested_quantity,
        fulfilled: this.item.fulfilled_quantity,
        picks: batch,
        stockBySlot: slots,
      });
      if (!validation.ok) return { ok: false as const, error: validation.error };

      for (const pick of batch) {
        const slot = this.stock.find((s) => s.slot_id === pick.slot_id);
        if (!slot) return { ok: false as const, error: "OVER_SLOT_STOCK" as const };
        slot.quantity -= pick.quantity;
        const txnId = `txn-${this.transactions.length + 1}`;
        this.transactions.push({
          type: "order_fulfillment",
          slot_id: pick.slot_id,
          quantity: pick.quantity,
        });
        this.picks.push({
          ...pick,
          status: "confirmed",
          inventory_transaction_id: txnId,
        });
      }

      const applied = applyPicks(this.item.requested_quantity, this.item.fulfilled_quantity, batch);
      this.item.fulfilled_quantity = applied.fulfilled_quantity;
      this.item.status = applied.status;
      return { ok: true as const };
    },
    recordMerma(slotId: string, quantity: number) {
      const slot = this.stock.find((s) => s.slot_id === slotId);
      if (!slot || slot.quantity < quantity) return { ok: false as const };
      slot.quantity = applyMerma(slot.quantity, quantity);
      this.transactions.push({ type: "merma", slot_id: slotId, quantity });
      return { ok: true as const };
    },
    markIssue(reason: string) {
      this.item.status = "issue";
      return { ok: true as const, reason };
    },
    complete(role: "admin" | "staff" | "collaborator") {
      const items = [this.item];
      const check = canUserCompleteOrder(items, role);
      if (!check.allowed) return { ok: false as const, reason: check.reason };
      return {
        ok: true as const,
        status: "completed" as const,
        has_issues: items.some((i) => i.status === "issue"),
        transactionCount: this.transactions.length,
      };
    },
  };
}

describe("order-fulfillment integration (simulated)", () => {
  it("create order flow leaves items pending with zero fulfilled", () => {
    const item: SimItem = {
      id: "1",
      donation_item_id: "p1",
      requested_quantity: 20,
      fulfilled_quantity: 0,
      status: "pending",
    };
    expect(item.status).toBe("pending");
    expect(item.fulfilled_quantity).toBe(0);
  });

  it("start order flow allows pending and blocks wrong handler on in_progress", () => {
    expect(
      canStartOrder({ id: "o1", status: "pending", prepared_by_user_id: null }, "u1", "staff")
        .allowed
    ).toBe(true);
    expect(
      canStartOrder(
        { id: "o1", status: "in_progress", prepared_by_user_id: "other" },
        "u1",
        "collaborator"
      ).allowed
    ).toBe(false);
  });

  it("full pick and complete flow", () => {
    const sim = simulateFlow();
    const first = sim.confirmPick([{ slot_id: "box-10", quantity: 12 }]);
    expect(first.ok).toBe(true);
    expect(sim.item.fulfilled_quantity).toBe(12);
    expect(sim.transactions).toHaveLength(1);

    const second = sim.confirmPick([
      { slot_id: "box-15", quantity: 18 },
    ]);
    expect(second.ok).toBe(true);
    expect(sim.item.status).toBe("fulfilled");
    expect(sim.transactions).toHaveLength(2);

    const done = sim.complete("staff");
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.status).toBe("completed");
  });

  it("multi-box pick flow updates stock per box", () => {
    const sim = simulateFlow();
    sim.confirmPick([
      { slot_id: "box-10", quantity: 10 },
      { slot_id: "box-15", quantity: 5 },
    ]);
    expect(sim.stock.find((s) => s.slot_id === "box-10")?.quantity).toBe(2);
    expect(sim.stock.find((s) => s.slot_id === "box-15")?.quantity).toBe(15);
    expect(sim.transactions).toHaveLength(2);
  });

  it("merma during picking reduces stock and allows continue", () => {
    const sim = simulateFlow();
    const merma = sim.recordMerma("box-15", 2);
    expect(merma.ok).toBe(true);
    expect(sim.stock.find((s) => s.slot_id === "box-15")?.quantity).toBe(18);
    const pick = sim.confirmPick([{ slot_id: "box-15", quantity: 10 }]);
    expect(pick.ok).toBe(true);
  });

  it("not enough stock flow: issue then complete with issues as admin", () => {
    const sim = simulateFlow();
    sim.item.requested_quantity = 100;
    sim.confirmPick([{ slot_id: "box-10", quantity: 12 }]);
    sim.markIssue("NOT_ENOUGH_STOCK");
    expect(sim.complete("collaborator").ok).toBe(false);
    const done = sim.complete("admin");
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.has_issues).toBe(true);
  });

  it("reload simulation preserves confirmed picks and progress", () => {
    const sim = simulateFlow();
    sim.confirmPick([{ slot_id: "box-10", quantity: 12 }]);
    const reloadedFulfilled = sumPickedQuantity(sim.picks);
    const reloadedStatus = deriveOrderItemStatus(
      sim.item.requested_quantity,
      reloadedFulfilled
    );
    expect(reloadedFulfilled).toBe(12);
    expect(reloadedStatus).toBe("partially_fulfilled");
    expect(sim.transactions).toHaveLength(1);
    const progress = countOrderProgress([
      { ...sim.item, fulfilled_quantity: reloadedFulfilled, status: reloadedStatus },
    ]);
    expect(progress.done).toBe(0);
  });

  it("complete order idempotency does not add transactions on second complete", () => {
    const sim = simulateFlow();
    sim.confirmPick([
      { slot_id: "box-10", quantity: 12 },
      { slot_id: "box-15", quantity: 8 },
    ]);
    sim.item.requested_quantity = 20;
    sim.item.status = "fulfilled";
    const txnCount = sim.transactions.length;
    expect(canCompleteOrder([sim.item])).toBe(true);
    const first = sim.complete("staff");
    const second = sim.complete("staff");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(sim.transactions).toHaveLength(txnCount);
  });

  it("confirm pick idempotency via transaction id on pick row", () => {
    const pick = { inventory_transaction_id: "txn-1" };
    expect(pickAlreadyHasTransaction(pick)).toBe(true);
    expect(remainingQuantity(30, 12)).toBe(18);
  });

  it("permission flow: collaborator cannot complete with issues", () => {
    const sim = simulateFlow();
    sim.item.requested_quantity = 100;
    sim.confirmPick([{ slot_id: "box-10", quantity: 12 }]);
    sim.markIssue("NOT_ENOUGH_STOCK");
    expect(sim.complete("collaborator").ok).toBe(false);
    expect(sim.complete("admin").ok).toBe(true);
  });

  it("permission flow: staff can complete fulfilled order", () => {
    const sim = simulateFlow();
    sim.confirmPick([
      { slot_id: "box-10", quantity: 12 },
      { slot_id: "box-15", quantity: 8 },
    ]);
    sim.item.requested_quantity = 20;
    sim.item.status = "fulfilled";
    expect(sim.complete("staff").ok).toBe(true);
  });
});

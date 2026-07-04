import { describe, expect, it } from "vitest";
import {
  aggregateStockBySlot,
  applyMerma,
  applyPicks,
  canCompleteOrder,
  canPickOrderItem,
  canUserCompleteOrder,
  countOrderProgress,
  deriveOrderItemStatus,
  maxQuantityForSlot,
  parsePickQuantity,
  pickAlreadyHasTransaction,
  picksFromValues,
  remainingQuantity,
  sumPickedQuantity,
  validateMermaInput,
  validatePickBatch,
  validatePickInput,
} from "./order-fulfillment";
import type { OrderItemLike } from "./order-fulfillment";

describe("order-fulfillment", () => {
  describe("parsePickQuantity and picksFromValues", () => {
    it("parses positive integers", () => {
      expect(parsePickQuantity("5")).toBe(5);
      expect(parsePickQuantity(" 10 ")).toBe(10);
    });

    it("returns 0 for invalid quantities", () => {
      expect(parsePickQuantity("")).toBe(0);
      expect(parsePickQuantity("0")).toBe(0);
      expect(parsePickQuantity("abc")).toBe(0);
    });

    it("builds picks from slot value map", () => {
      expect(
        picksFromValues({ "box-1": "5", "box-2": "", "box-3": "3" })
      ).toEqual([
        { slot_id: "box-1", quantity: 5 },
        { slot_id: "box-3", quantity: 3 },
      ]);
    });
  });

  describe("maxQuantityForSlot", () => {
    it("limits by slot stock and remaining requested", () => {
      expect(
        maxQuantityForSlot({
          slotAvailable: 20,
          remaining: 10,
          selectedTotal: 8,
          currentSlotQuantity: 3,
        })
      ).toBe(5);
    });

    it("cannot exceed slot available", () => {
      expect(
        maxQuantityForSlot({
          slotAvailable: 4,
          remaining: 10,
          selectedTotal: 0,
          currentSlotQuantity: 0,
        })
      ).toBe(4);
    });
  });

  describe("canPickOrderItem", () => {
    const inProgressOrder = {
      id: "o1",
      status: "in_progress" as const,
      prepared_by_user_id: "user-a",
    };

    it("allows admin on in_progress order", () => {
      expect(canPickOrderItem(inProgressOrder, "user-b", "admin")).toBe(true);
    });

    it("allows assigned user", () => {
      expect(canPickOrderItem(inProgressOrder, "user-a", "staff")).toBe(true);
    });

    it("blocks other staff on assigned order", () => {
      expect(canPickOrderItem(inProgressOrder, "user-b", "staff")).toBe(false);
    });

    it("blocks pick on pending order", () => {
      expect(
        canPickOrderItem(
          { id: "o1", status: "pending", prepared_by_user_id: null },
          "user-a",
          "staff"
        )
      ).toBe(false);
    });
  });

  describe("EMPTY_PICK validation", () => {
    it("rejects empty pick batch", () => {
      const result = validatePickBatch({
        requested: 10,
        fulfilled: 0,
        picks: [],
        stockBySlot: [{ slot_id: "box-1", slot_number: "1", quantity: 20 }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("EMPTY_PICK");
    });
  });

  describe("aggregateStockBySlot", () => {
    it("keeps same product in different boxes separate", () => {
      const result = aggregateStockBySlot([
        { slot_id: "box-1", slot_number: "10", quantity: 10 },
        { slot_id: "box-2", slot_number: "15", quantity: 5 },
      ]);
      expect(result).toHaveLength(2);
      expect(result.reduce((s, r) => s + r.quantity, 0)).toBe(15);
      expect(result.find((r) => r.slot_id === "box-1")?.quantity).toBe(10);
      expect(result.find((r) => r.slot_id === "box-2")?.quantity).toBe(5);
    });

    it("consolidates same product in same box", () => {
      const result = aggregateStockBySlot([
        { slot_id: "box-1", slot_number: "10", quantity: 4 },
        { slot_id: "box-1", slot_number: "10", quantity: 6 },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(10);
    });
  });

  describe("pick from one box", () => {
    it("fulfills item when picking full requested quantity", () => {
      const result = applyPicks(10, 0, [{ slot_id: "box-1", quantity: 10 }]);
      expect(result.fulfilled_quantity).toBe(10);
      expect(result.status).toBe("fulfilled");
    });

    it("validates single box pick", () => {
      const validation = validatePickInput({
        requested: 10,
        fulfilled: 0,
        pickQty: 10,
        slotAvailable: 20,
      });
      expect(validation.ok).toBe(true);
    });
  });

  describe("pick from multiple boxes", () => {
    it("fulfills from two boxes", () => {
      const validation = validatePickBatch({
        requested: 15,
        fulfilled: 0,
        picks: [
          { slot_id: "box-1", quantity: 10 },
          { slot_id: "box-2", quantity: 5 },
        ],
        stockBySlot: [
          { slot_id: "box-1", slot_number: "1", quantity: 10 },
          { slot_id: "box-2", slot_number: "2", quantity: 10 },
        ],
      });
      expect(validation.ok).toBe(true);
      if (validation.ok) expect(validation.totalPick).toBe(15);

      const result = applyPicks(15, 0, [
        { slot_id: "box-1", quantity: 10 },
        { slot_id: "box-2", quantity: 5 },
      ]);
      expect(result.fulfilled_quantity).toBe(15);
      expect(result.status).toBe("fulfilled");
    });
  });

  describe("partial pick", () => {
    it("marks partially fulfilled", () => {
      const result = applyPicks(20, 0, [{ slot_id: "box-1", quantity: 8 }]);
      expect(result.fulfilled_quantity).toBe(8);
      expect(remainingQuantity(20, 8)).toBe(12);
      expect(result.status).toBe("partially_fulfilled");
    });
  });

  describe("prevent over-picking requested quantity", () => {
    it("rejects pick exceeding remaining", () => {
      const result = validatePickBatch({
        requested: 10,
        fulfilled: 0,
        picks: [{ slot_id: "box-1", quantity: 12 }],
        stockBySlot: [{ slot_id: "box-1", slot_number: "1", quantity: 20 }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("OVER_REQUESTED");
        expect(result.totalPick).toBe(12);
        expect(result.remaining).toBe(10);
      }
    });

    it("rejects combined picks over remaining", () => {
      const result = validatePickBatch({
        requested: 90,
        fulfilled: 0,
        picks: [
          { slot_id: "box-1", quantity: 50 },
          { slot_id: "box-2", quantity: 50 },
        ],
        stockBySlot: [
          { slot_id: "box-1", slot_number: "1", quantity: 50 },
          { slot_id: "box-2", slot_number: "2", quantity: 50 },
        ],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.totalPick).toBe(100);
    });
  });

  describe("prevent picking more than available in box", () => {
    it("rejects when box has insufficient stock", () => {
      const result = validatePickInput({
        requested: 20,
        fulfilled: 0,
        pickQty: 8,
        slotAvailable: 5,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("OVER_SLOT_STOCK");
    });
  });

  describe("merma", () => {
    it("reduces available stock", () => {
      expect(applyMerma(10, 2)).toBe(8);
    });

    it("cannot exceed available stock", () => {
      const result = validateMermaInput({ slotAvailable: 3, quantity: 5 });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("OVER_SLOT_STOCK");
    });
  });

  describe("complete order", () => {
    const baseItems = (statuses: OrderItemLike["status"][]): OrderItemLike[] =>
      statuses.map((status, i) => ({
        id: String(i),
        requested_quantity: 10,
        fulfilled_quantity: status === "fulfilled" ? 10 : 0,
        status,
      }));

    it("fails when one item is pending", () => {
      expect(canCompleteOrder(baseItems(["fulfilled", "pending"]))).toBe(false);
    });

    it("succeeds when all items fulfilled", () => {
      expect(canCompleteOrder(baseItems(["fulfilled", "fulfilled"]))).toBe(true);
    });

    it("allows admin to complete with issues", () => {
      const items = baseItems(["fulfilled", "issue"]);
      expect(canUserCompleteOrder(items, "admin").allowed).toBe(true);
      expect(canUserCompleteOrder(items, "collaborator").allowed).toBe(false);
    });
  });

  describe("idempotency", () => {
    it("detects pick that already has transaction", () => {
      expect(pickAlreadyHasTransaction({ inventory_transaction_id: "tx-1" })).toBe(true);
      expect(pickAlreadyHasTransaction({ inventory_transaction_id: null })).toBe(false);
    });

    it("complete order on already completed state is allowed at item level", () => {
      const items = [
        { id: "1", requested_quantity: 5, fulfilled_quantity: 5, status: "fulfilled" as const },
      ];
      expect(canCompleteOrder(items)).toBe(true);
    });
  });

  describe("progress and status helpers", () => {
    it("counts confirmed items for progress label", () => {
      const progress = countOrderProgress([
        { id: "1", requested_quantity: 5, fulfilled_quantity: 5, status: "fulfilled" },
        { id: "2", requested_quantity: 5, fulfilled_quantity: 0, status: "pending" },
        { id: "3", requested_quantity: 5, fulfilled_quantity: 3, status: "issue" },
      ]);
      expect(progress.label).toBe("2/3");
    });

    it("sums confirmed picks excluding cancelled", () => {
      expect(
        sumPickedQuantity([
          { quantity: 5, status: "confirmed" },
          { quantity: 3, status: "cancelled" },
          { quantity: 2, status: "confirmed" },
        ])
      ).toBe(7);
    });

    it("derives issue status", () => {
      expect(deriveOrderItemStatus(10, 5, true)).toBe("issue");
    });
  });
});

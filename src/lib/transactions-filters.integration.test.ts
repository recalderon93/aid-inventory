import { describe, expect, it } from "vitest";
import { filterTransactions, type TransactionListItem } from "./transactions-list";

/**
 * Integration-style tests for movements filter flow using in-memory transaction sets.
 */
describe("movements filters integration", () => {
  const dataset: TransactionListItem[] = [
    {
      id: "1",
      type: "inbound",
      donation_item_id: "p1",
      from_slot_id: null,
      to_slot_id: "slot-1",
      order_id: null,
      order_item_id: null,
      quantity: 50,
      reason: null,
      created_by_user_id: "u1",
      notes: "Importación inicial",
      created_at: "2026-02-01T08:00:00.000Z",
      donation_item: { description: "ACETAMINOFEN 500 MG" },
    },
    {
      id: "2",
      type: "order_fulfillment",
      donation_item_id: "p1",
      from_slot_id: "slot-1",
      to_slot_id: null,
      order_id: "order-1",
      order_item_id: "oi-1",
      quantity: 10,
      reason: null,
      created_by_user_id: "u2",
      notes: null,
      created_at: "2026-02-02T10:00:00.000Z",
      donation_item: { description: "ACETAMINOFEN 500 MG" },
      order: { order_number: "ORD-20260202-1234" },
    },
    {
      id: "3",
      type: "merma",
      donation_item_id: "p2",
      from_slot_id: "slot-2",
      to_slot_id: null,
      order_id: "order-1",
      order_item_id: "oi-2",
      quantity: 2,
      reason: "DAMAGED_PRODUCT",
      created_by_user_id: "u2",
      notes: "Caja dañada",
      created_at: "2026-02-02T11:00:00.000Z",
      donation_item: { description: "AMOXICILINA 500 MG" },
    },
    {
      id: "4",
      type: "outbound",
      donation_item_id: "p3",
      from_slot_id: "slot-3",
      to_slot_id: null,
      order_id: null,
      order_item_id: null,
      quantity: 5,
      reason: null,
      created_by_user_id: "u1",
      notes: null,
      created_at: "2026-02-03T09:00:00.000Z",
      donation_item: { description: "IBUPROFENO 400 MG" },
    },
  ];

  it("IN filter returns only inbound transactions", () => {
    const result = filterTransactions(dataset, {
      type: "inbound",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("inbound");
  });

  it("order_fulfillment filter returns only pick transactions", () => {
    const result = filterTransactions(dataset, {
      type: "order_fulfillment",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.order_id).toBe("order-1");
  });

  it("MERMA filter returns only merma transactions", () => {
    const result = filterTransactions(dataset, {
      type: "merma",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toBe("DAMAGED_PRODUCT");
  });

  it("ALL returns all visible transactions", () => {
    const result = filterTransactions(dataset, {
      type: "",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(4);
  });

  it("combined product and date filters narrow results", () => {
    const result = filterTransactions(dataset, {
      type: "",
      productSearch: "acetaminofen",
      slotId: "",
      dateFrom: "2026-02-01",
      dateTo: "2026-02-02",
    });
    expect(result.map((tx) => tx.id)).toEqual(["1", "2"]);
  });

  it("slot filter excludes unrelated movements", () => {
    const result = filterTransactions(dataset, {
      type: "",
      productSearch: "",
      slotId: "slot-3",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("4");
  });
});

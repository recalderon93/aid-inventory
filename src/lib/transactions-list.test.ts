import { describe, expect, it, vi } from "vitest";
import {
  applyTransactionQueryFilters,
  filterTransactions,
  type TransactionFilters,
  type TransactionListItem,
} from "./transactions-list";

function makeTx(overrides: Partial<TransactionListItem>): TransactionListItem {
  return {
    id: "tx-1",
    type: "inbound",
    donation_item_id: "item-1",
    from_slot_id: "slot-1",
    to_slot_id: null,
    order_id: null,
    order_item_id: null,
    quantity: 5,
    reason: null,
    created_by_user_id: "user-1",
    notes: null,
    created_at: "2026-01-15T12:00:00.000Z",
    donation_item: { description: "ACETAMINOFEN 500 MG" },
    ...overrides,
  };
}

const sampleItems: TransactionListItem[] = [
  makeTx({ id: "tx-in", type: "inbound", created_at: "2026-01-10T10:00:00.000Z" }),
  makeTx({
    id: "tx-out",
    type: "order_fulfillment",
    from_slot_id: "slot-2",
    created_at: "2026-01-12T10:00:00.000Z",
    donation_item: { description: "AMOXICILINA 500 MG" },
  }),
  makeTx({
    id: "tx-merma",
    type: "merma",
    from_slot_id: "slot-1",
    reason: "DAMAGED_PRODUCT",
    created_at: "2026-01-14T10:00:00.000Z",
  }),
];

describe("filterTransactions", () => {
  it("returns all when no filters", () => {
    const filters: TransactionFilters = {
      type: "",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    };
    expect(filterTransactions(sampleItems, filters)).toHaveLength(3);
  });

  it("filters by inbound type only", () => {
    const result = filterTransactions(sampleItems, {
      type: "inbound",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tx-in");
  });

  it("filters by order_fulfillment type", () => {
    const result = filterTransactions(sampleItems, {
      type: "order_fulfillment",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tx-out");
  });

  it("filters by merma type", () => {
    const result = filterTransactions(sampleItems, {
      type: "merma",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tx-merma");
  });

  it("filters by product search", () => {
    const result = filterTransactions(sampleItems, {
      type: "",
      productSearch: "amoxicilina",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tx-out");
  });

  it("filters by slot id", () => {
    const result = filterTransactions(sampleItems, {
      type: "",
      productSearch: "",
      slotId: "slot-2",
      dateFrom: "",
      dateTo: "",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("tx-out");
  });

  it("filters by date range", () => {
    const result = filterTransactions(sampleItems, {
      type: "",
      productSearch: "",
      slotId: "",
      dateFrom: "2026-01-12",
      dateTo: "2026-01-14",
    });
    expect(result.map((tx) => tx.id)).toEqual(["tx-out", "tx-merma"]);
  });
});

describe("applyTransactionQueryFilters", () => {
  function createMockQuery() {
    const calls: { method: string; args: unknown[] }[] = [];
    const query = {
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ method: "eq", args });
        return query;
      }),
      gte: vi.fn((...args: unknown[]) => {
        calls.push({ method: "gte", args });
        return query;
      }),
      lte: vi.fn((...args: unknown[]) => {
        calls.push({ method: "lte", args });
        return query;
      }),
      or: vi.fn((...args: unknown[]) => {
        calls.push({ method: "or", args });
        return query;
      }),
      filter: vi.fn((...args: unknown[]) => {
        calls.push({ method: "filter", args });
        return query;
      }),
      calls,
    };
    return query;
  }

  it("does not apply type filter when empty", () => {
    const query = createMockQuery();
    applyTransactionQueryFilters(query, {
      type: "",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(query.eq).not.toHaveBeenCalled();
  });

  it("applies type filter", () => {
    const query = createMockQuery();
    applyTransactionQueryFilters(query, {
      type: "merma",
      productSearch: "",
      slotId: "",
      dateFrom: "",
      dateTo: "",
    });
    expect(query.eq).toHaveBeenCalledWith("type", "merma");
  });

  it("applies product, slot, and date filters", () => {
    const query = createMockQuery();
    applyTransactionQueryFilters(query, {
      type: "inbound",
      productSearch: "acetaminofen",
      slotId: "slot-abc",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(query.eq).toHaveBeenCalledWith("type", "inbound");
    expect(query.filter).toHaveBeenCalledWith(
      "donation_items.description",
      "ilike",
      "%acetaminofen%"
    );
    expect(query.or).toHaveBeenCalledWith(
      "from_slot_id.eq.slot-abc,to_slot_id.eq.slot-abc"
    );
    expect(query.gte).toHaveBeenCalledWith("created_at", "2026-01-01T00:00:00.000Z");
    expect(query.lte).toHaveBeenCalledWith("created_at", "2026-01-31T23:59:59.999Z");
  });
});

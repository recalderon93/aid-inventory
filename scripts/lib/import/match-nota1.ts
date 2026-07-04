import { normalizeForMatch } from "./normalize";
import type {
  ClassifiedRow,
  DonationItemRecord,
  FulfillmentTransactionRecord,
  InventoryRecord,
  OrderItemRecord,
  OrderRecord,
} from "./types";
import { ORDER_DELIVERY_DATE, ORDER_DISPATCH_DATE, WAREHOUSE_ID } from "./types";
import { orderId, orderItemId, slotId, transactionId } from "./uuid";

export interface ProductMatchCandidate {
  product: DonationItemRecord;
  slotId: string | null;
  slotNumber: string | null;
  inventoryQuantity: number;
}

export interface Nota1MatchResult {
  matched: boolean;
  reason?: string;
  candidate?: ProductMatchCandidate;
  orderItem?: OrderItemRecord;
  fulfillment?: FulfillmentTransactionRecord;
}

function fieldsMatch(a: string | null, b: string | null): boolean {
  return normalizeForMatch(a ?? "") === normalizeForMatch(b ?? "");
}

function buildInventoryIndex(inventory: InventoryRecord[]): Map<string, InventoryRecord> {
  const map = new Map<string, InventoryRecord>();
  for (const row of inventory) {
    map.set(`${row.donationItemId}|${row.slotId}`, row);
  }
  return map;
}

function findCandidates(
  row: ClassifiedRow,
  products: DonationItemRecord[],
  inventory: InventoryRecord[]
): ProductMatchCandidate[] {
  const inventoryIndex = buildInventoryIndex(inventory);
  const candidates: ProductMatchCandidate[] = [];

  for (const product of products) {
    if (!fieldsMatch(product.description, row.cleanedDescription)) continue;
    if (!fieldsMatch(product.presentation, row.cleanedPresentation)) continue;

    const unitMatches =
      !row.cleanedUnitOfMeasure ||
      !product.unitOfMeasure ||
      fieldsMatch(product.unitOfMeasure, row.cleanedUnitOfMeasure);

    if (!unitMatches) continue;

    if (row.sourceBox) {
      const sId = slotId(row.sourceBox);
      const inv = inventoryIndex.get(`${product.id}|${sId}`);
      candidates.push({
        product,
        slotId: sId,
        slotNumber: row.sourceBox,
        inventoryQuantity: inv?.quantity ?? 0,
      });
      continue;
    }

    const productInventory = inventory.filter((inv) => inv.donationItemId === product.id);
    if (productInventory.length === 1) {
      const inv = productInventory[0]!;
      candidates.push({
        product,
        slotId: inv.slotId,
        slotNumber: inv.slotNumber,
        inventoryQuantity: inv.quantity,
      });
    } else if (productInventory.length > 1) {
      for (const inv of productInventory) {
        candidates.push({
          product,
          slotId: inv.slotId,
          slotNumber: inv.slotNumber,
          inventoryQuantity: inv.quantity,
        });
      }
    } else {
      candidates.push({
        product,
        slotId: null,
        slotNumber: null,
        inventoryQuantity: 0,
      });
    }
  }

  return candidates;
}

function pickUniqueMatch(
  row: ClassifiedRow,
  candidates: ProductMatchCandidate[]
): ProductMatchCandidate | null {
  if (candidates.length === 0) return null;

  if (row.sourceBox) {
    const withSlot = candidates.filter(
      (c) => c.slotNumber && normalizeForMatch(c.slotNumber) === normalizeForMatch(row.sourceBox)
    );
    if (withSlot.length === 1) return withSlot[0]!;
    if (withSlot.length > 1) return null;
  }

  const withUnit = candidates.filter((c) => {
    if (!row.cleanedUnitOfMeasure || !c.product.unitOfMeasure) return true;
    return fieldsMatch(c.product.unitOfMeasure, row.cleanedUnitOfMeasure);
  });

  if (withUnit.length === 1) return withUnit[0]!;

  const exactPresentation = withUnit.filter((c) =>
    fieldsMatch(c.product.presentation, row.cleanedPresentation)
  );
  if (exactPresentation.length === 1) return exactPresentation[0]!;

  if (withUnit.length === 1) return withUnit[0]!;
  return null;
}

export function matchNota1Row(
  row: ClassifiedRow,
  products: DonationItemRecord[],
  inventory: InventoryRecord[],
  order: OrderRecord
): Nota1MatchResult {
  if (row.skipped) {
    return { matched: false, reason: row.skipReason ?? "ROW_SKIPPED_NO_VALID_PRODUCT_DESCRIPTION" };
  }

  const qty = row.quantity;
  if (!qty || qty <= 0) {
    return { matched: false, reason: "QUANTITY_INVALID_PRODUCT_IMPORTED_WITHOUT_STOCK" };
  }

  const candidates = findCandidates(row, products, inventory);
  const unique = pickUniqueMatch(row, candidates);

  if (!unique) {
    if (candidates.length === 0) {
      return { matched: false, reason: "NO_MATCH_IN_MEDICINAS_FOR_NOTA_1" };
    }
    return { matched: false, reason: "MULTIPLE_PRODUCT_MATCHES_FOR_NOTA_1" };
  }

  if (!unique.slotId || !unique.slotNumber) {
    return { matched: false, reason: "NO_MATCH_IN_MEDICINAS_FOR_NOTA_1" };
  }

  if (qty > unique.inventoryQuantity) {
    return {
      matched: false,
      reason: "NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK",
      candidate: unique,
    };
  }

  const oItemId = orderItemId(order.id, unique.product.id, unique.slotId);
  const orderItem: OrderItemRecord = {
    id: oItemId,
    orderId: order.id,
    donationItemId: unique.product.id,
    slotId: unique.slotId,
    slotNumber: unique.slotNumber,
    requestedQuantity: qty,
    fulfilledQuantity: qty,
    status: "fulfilled",
    notes: "IMPORTADO DESDE NOTA 1",
  };

  const fulfillment: FulfillmentTransactionRecord = {
    id: transactionId("fulfillment", oItemId),
    orderId: order.id,
    orderItemId: oItemId,
    donationItemId: unique.product.id,
    fromSlotId: unique.slotId,
    quantity: qty,
    notes: "NOTA DE ENTREGA # 001 - TRASLADO A LA GUAIRA",
    createdAt: ORDER_DISPATCH_DATE,
  };

  return { matched: true, candidate: unique, orderItem, fulfillment };
}

export function createNota1Order(): OrderRecord {
  const id = orderId("NOTA-001");
  return {
    id,
    orderNumber: "NOTA-001",
    warehouseId: WAREHOUSE_ID,
    requesterName: "LA GUAIRA",
    requesterCity: "LA GUAIRA",
    requesterState: "ESTADO VARGAS",
    requesterAddress: "LA GUAIRA, ESTADO VARGAS",
    requesterNotes:
      "NOTA DE ENTREGA # 001 MEDICAMENTOS - DESPACHO ALMACEN 01/07/2026 - TRASLADO A LA GUAIRA 02/07/2026",
    status: "completed",
    createdAt: ORDER_DISPATCH_DATE,
    completedAt: ORDER_DELIVERY_DATE,
  };
}

export interface Nota1ProcessingResult {
  classifiedRows: ClassifiedRow[];
  orderItems: OrderItemRecord[];
  fulfillmentTransactions: FulfillmentTransactionRecord[];
  adjustedInventory: InventoryRecord[];
  nota1RowsSkipped: number;
  matchReasons: Map<number, string>;
}

export function processNota1Rows(
  rows: ClassifiedRow[],
  products: DonationItemRecord[],
  inventory: InventoryRecord[]
): Nota1ProcessingResult {
  const order = createNota1Order();
  const adjustedInventory = inventory.map((row) => ({ ...row }));
  const inventoryByKey = new Map(adjustedInventory.map((row) => [row.inventoryKey, row]));

  const orderItems: OrderItemRecord[] = [];
  const fulfillmentTransactions: FulfillmentTransactionRecord[] = [];
  const matchReasons = new Map<number, string>();
  let nota1RowsSkipped = 0;

  const classifiedRows = rows.map((row) => {
    if (row.skipped) {
      nota1RowsSkipped++;
      if (row.skipReason) matchReasons.set(row.rowNumber, row.skipReason);
      return row;
    }

    const result = matchNota1Row(row, products, adjustedInventory, order);
    if (!result.matched || !result.orderItem || !result.fulfillment) {
      nota1RowsSkipped++;
      matchReasons.set(row.rowNumber, result.reason ?? "ORDER_ITEM_SKIPPED");
      return row;
    }

    orderItems.push(result.orderItem);
    fulfillmentTransactions.push(result.fulfillment);

    const invKey = `${result.fulfillment.fromSlotId}|${result.fulfillment.donationItemId}`;
    const inv =
      inventoryByKey.get(invKey) ??
      adjustedInventory.find(
        (item) =>
          item.slotId === result.fulfillment!.fromSlotId &&
          item.donationItemId === result.fulfillment!.donationItemId
      );

    if (inv) {
      inv.quantity -= result.fulfillment.quantity;
      inventoryByKey.set(inv.inventoryKey, inv);
    }

    return row;
  });

  return {
    classifiedRows,
    orderItems,
    fulfillmentTransactions,
    adjustedInventory,
    nota1RowsSkipped,
    matchReasons,
  };
}

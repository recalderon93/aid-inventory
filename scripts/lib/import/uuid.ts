import { createHash } from "node:crypto";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function namespaceBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function formatUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Deterministic UUID v5 — matches Python uuid.uuid5(NAMESPACE_DNS, `aid-inventory.${name}`). */
export function deterministicId(name: string): string {
  const hash = createHash("sha1");
  hash.update(namespaceBytes(DNS_NAMESPACE));
  hash.update(`aid-inventory.${name}`);
  const digest = Buffer.from(hash.digest());
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  return formatUuid(digest.subarray(0, 16));
}

export function slotId(number: string): string {
  return deterministicId(`slot-${number}`);
}

export function itemId(productKey: string): string {
  return deterministicId(`item-${productKey}`);
}

export function inventoryId(slotIdValue: string, itemIdValue: string): string {
  return deterministicId(`inventory-${slotIdValue}-${itemIdValue}`);
}

export function transactionId(kind: string, key: string): string {
  return deterministicId(`${kind}-${key}`);
}

export function orderId(orderNumber: string): string {
  return deterministicId(`order-${orderNumber}`);
}

export function orderItemId(orderIdValue: string, itemIdValue: string, slotIdValue: string): string {
  return deterministicId(`order-item-${orderIdValue}-${itemIdValue}-${slotIdValue}`);
}

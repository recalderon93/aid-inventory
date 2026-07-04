/** Numeric box order (1, 2, 10…) — `number` is stored as text in the DB. */
export function compareSlotNumbers(a: string, b: string): number {
  const ai = Number(a.trim());
  const bi = Number(b.trim());
  if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}

export function sortSlotsByNumber<T extends { number: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => compareSlotNumbers(a.number, b.number));
}

export function filterSlots<T extends { number: string }>(slots: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return slots;
  return slots.filter((s) => s.number.toLowerCase().includes(q));
}

export function hasExactSlotMatch<T extends { number: string }>(slots: T[], query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return slots.some((s) => s.number.toLowerCase() === q.toLowerCase());
}

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

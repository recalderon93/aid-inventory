import { describe, expect, it } from "vitest";
import { filterSlots, hasExactSlotMatch } from "./slot-search";

const slots = [
  { number: "170" },
  { number: "171" },
  { number: "200" },
];

describe("slot-search", () => {
  describe("filterSlots", () => {
    it("returns all slots when query is empty", () => {
      expect(filterSlots(slots, "")).toHaveLength(3);
      expect(filterSlots(slots, "   ")).toHaveLength(3);
    });

    it("filters by partial number match", () => {
      expect(filterSlots(slots, "17")).toEqual([{ number: "170" }, { number: "171" }]);
    });
  });

  describe("hasExactSlotMatch", () => {
    it("detects exact matches case-insensitively", () => {
      expect(hasExactSlotMatch(slots, "170")).toBe(true);
      expect(hasExactSlotMatch(slots, " 170 ")).toBe(true);
      expect(hasExactSlotMatch(slots, "17")).toBe(false);
      expect(hasExactSlotMatch(slots, "")).toBe(false);
    });
  });
});

import { describe, expect, it } from "vitest";
import { compareSlotNumbers, filterSlots, hasExactSlotMatch, sortSlotsByNumber } from "./slot-search";

const slots = [
  { number: "170" },
  { number: "171" },
  { number: "200" },
];

describe("slot-search", () => {
  describe("sortSlotsByNumber", () => {
    it("orders numeric box numbers ascending", () => {
      const unsorted = [{ number: "10" }, { number: "2" }, { number: "1" }, { number: "11" }];
      expect(sortSlotsByNumber(unsorted).map((s) => s.number)).toEqual(["1", "2", "10", "11"]);
    });
  });

  describe("compareSlotNumbers", () => {
    it("sorts numerically when both values are numbers", () => {
      expect(compareSlotNumbers("9", "10")).toBeLessThan(0);
      expect(compareSlotNumbers("170", "171")).toBeLessThan(0);
    });
  });

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

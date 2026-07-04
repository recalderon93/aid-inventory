import { describe, expect, it } from "vitest";
import {
  canCreateOrders,
  canCreateSlots,
  canHandleOrders,
  canManageUsers,
  canManageImportReview,
  canRegisterDonations,
  getOrderStatusVariant,
  inferCategory,
  suggestSlotsForItem,
} from "./permissions";

describe("permissions", () => {
  describe("role gates", () => {
    it("only admin can manage users", () => {
      expect(canManageUsers("admin")).toBe(true);
      expect(canManageUsers("staff")).toBe(false);
      expect(canManageUsers("collaborator")).toBe(false);
    });

    it("only admin can manage import review", () => {
      expect(canManageImportReview("admin")).toBe(true);
      expect(canManageImportReview("staff")).toBe(false);
      expect(canManageImportReview("collaborator")).toBe(false);
    });

    it("all roles can create slots and register donations", () => {
      for (const role of ["admin", "staff", "collaborator"] as const) {
        expect(canCreateSlots(role)).toBe(true);
        expect(canRegisterDonations(role)).toBe(true);
      }
    });

    it("only admin and staff can create orders", () => {
      expect(canCreateOrders("admin")).toBe(true);
      expect(canCreateOrders("staff")).toBe(true);
      expect(canCreateOrders("collaborator")).toBe(false);
    });

    it("collaborators can handle orders but not create them", () => {
      expect(canHandleOrders("collaborator")).toBe(true);
      expect(canCreateOrders("collaborator")).toBe(false);
    });
  });

  describe("inferCategory", () => {
    it("maps medical supply subcategory", () => {
      expect(inferCategory("INSUMO MEDICO")).toBe("Medical Supply");
      expect(inferCategory("  insumo medico  ")).toBe("Medical Supply");
    });

    it("detects medicine keywords", () => {
      expect(inferCategory("ANALGESICO")).toBe("Medicine");
      expect(inferCategory("ANTIBIOTICO AMOXICILINA")).toBe("Medicine");
    });

    it("defaults to Other", () => {
      expect(inferCategory("ROPA")).toBe("Other");
      expect(inferCategory("")).toBe("Other");
    });
  });

  describe("suggestSlotsForItem", () => {
  const inventory = [
    { slot_id: "a", quantity: 5, slot: { number: "100" } },
    { slot_id: "b", quantity: 10, slot: { number: "200" } },
    { slot_id: "c", quantity: 3, slot: { number: "300" } },
  ];

    it("fulfills from highest quantity slots first", () => {
      const { suggestions, fulfilled, remaining } = suggestSlotsForItem(inventory, 12);
      expect(fulfilled).toBe(12);
      expect(remaining).toBe(0);
      expect(suggestions).toEqual([
        { slot_id: "b", slot_number: "200", quantity: 10 },
        { slot_id: "a", slot_number: "100", quantity: 2 },
      ]);
    });

    it("reports remaining when stock is insufficient", () => {
      const { fulfilled, remaining } = suggestSlotsForItem(inventory, 25);
      expect(fulfilled).toBe(18);
      expect(remaining).toBe(7);
    });
  });

  describe("getOrderStatusVariant", () => {
    it("maps known statuses", () => {
      expect(getOrderStatusVariant("completed")).toBe("success");
      expect(getOrderStatusVariant("in_progress")).toBe("warning");
      expect(getOrderStatusVariant("cancelled")).toBe("destructive");
      expect(getOrderStatusVariant("pending")).toBe("secondary");
    });
  });
});

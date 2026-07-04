import { describe, expect, it } from "vitest";
import { capitalizeWords, formatDate, normalizeText } from "./utils";

describe("utils", () => {
  describe("capitalizeWords", () => {
    it("capitalizes each word", () => {
      expect(capitalizeWords("amoxicilina 500mg")).toBe("Amoxicilina 500mg");
      expect(capitalizeWords("INSUMO MEDICO")).toBe("Insumo Medico");
    });

    it("returns empty-ish input unchanged", () => {
      expect(capitalizeWords("")).toBe("");
      expect(capitalizeWords("   ")).toBe("   ");
    });
  });

  describe("normalizeText", () => {
    it("trims and lowercases", () => {
      expect(normalizeText("  AMLODIPINO  ")).toBe("amlodipino");
    });
  });

  describe("formatDate", () => {
    it("formats dates in es-VE locale", () => {
      const formatted = formatDate("2026-01-15T14:30:00.000Z");
      expect(formatted).toMatch(/2026/);
      expect(formatted.length).toBeGreaterThan(5);
    });
  });
});

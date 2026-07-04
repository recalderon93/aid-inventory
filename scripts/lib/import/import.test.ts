import { describe, expect, it } from "vitest";
import { classifyRow } from "./classify";
import { buildMedicinasCatalog } from "./dedupe";
import { normalizeForMatch, parseQuantity, productKey } from "./normalize";
import { matchNota1Row, createNota1Order } from "./match-nota1";
import type { ClassifiedRow, DonationItemRecord, InventoryRecord } from "./types";
import { itemId, slotId } from "./uuid";

describe("normalizeForMatch", () => {
  it("treats accented and unaccented text as equivalent", () => {
    expect(normalizeForMatch("ANTIBIÓTICOS")).toBe(normalizeForMatch("ANTIBIOTICOS"));
    expect(normalizeForMatch("PEDIÁTRICO")).toBe(normalizeForMatch("PEDIATRICO"));
  });

  it("collapses whitespace and uppercases", () => {
    expect(normalizeForMatch("  analgesico  ")).toBe("ANALGESICO");
  });
});

describe("classifyRow", () => {
  it("maps antibiotic classifications to accented subcategories", () => {
    const result = classifyRow({
      classification: "ANTIBIOTICO",
      description: "AMOXICILINA",
      unitOfMeasure: "UNDS",
    });
    expect(result.category).toBe("MEDICINAS");
    expect(result.subcategory).toBe("ANTIBIÓTICOS");
  });

  it("detects pediatric antibiotics", () => {
    const result = classifyRow({
      classification: "ANTIBIOTICOS PEDIAT",
      description: "AMOXICILINA",
      unitOfMeasure: "UNDS",
    });
    expect(result.subcategory).toBe("ANTIBIÓTICOS PEDIÁTRICOS");
  });

  it("classifies medical supplies as INSUMOS", () => {
    const result = classifyRow({
      classification: "INSUMO MEDICO",
      description: "JERINGA 10ML",
      unitOfMeasure: "UNDS",
    });
    expect(result.category).toBe("INSUMOS");
    expect(result.subcategory).toBe("INSUMOS MÉDICOS");
  });

  it("falls back to SIN CLASIFICAR when unclear", () => {
    const result = classifyRow({
      classification: "XYZ DESCONOCIDO",
      description: "PRODUCTO DESCONOCIDO",
      unitOfMeasure: null,
    });
    expect(result.subcategory).toBe("SIN CLASIFICAR");
    expect(result.unclear).toBe(true);
  });
});

describe("buildMedicinasCatalog", () => {
  function row(overrides: Partial<ClassifiedRow>): ClassifiedRow {
    return {
      sheetName: "MEDICINAS",
      rowNumber: 1,
      sourceBox: "1",
      originalClassification: "ANALGESICO",
      normalizedClassification: "ANALGESICO",
      description: "ACETAMINOFEN",
      cleanedDescription: "ACETAMINOFEN",
      presentation: "500 MG",
      cleanedPresentation: "500 MG",
      quantity: 10,
      unitOfMeasure: "UNDS",
      cleanedUnitOfMeasure: "UNDS",
      salida: null,
      categoryColumn: null,
      warnings: [],
      skipped: false,
      category: "MEDICINAS",
      subcategory: "ANALGÉSICOS",
      classificationUnclear: false,
      ...overrides,
    };
  }

  it("merges duplicate rows in the same box", () => {
    const catalog = buildMedicinasCatalog([
      row({ rowNumber: 4, quantity: 5 }),
      row({ rowNumber: 5, quantity: 3 }),
    ]);
    expect(catalog.duplicateRowsSkipped).toBe(1);
    expect(catalog.inventory).toHaveLength(1);
    expect(catalog.inventory[0]?.quantity).toBe(5);
  });

  it("keeps separate inventory rows for different boxes", () => {
    const catalog = buildMedicinasCatalog([
      row({ rowNumber: 4, sourceBox: "1", quantity: 5 }),
      row({ rowNumber: 5, sourceBox: "2", quantity: 3 }),
    ]);
    expect(catalog.products).toHaveLength(1);
    expect(catalog.inventory).toHaveLength(2);
  });
});

describe("matchNota1Row", () => {
  const product: DonationItemRecord = {
    id: itemId(
      productKey({
        description: "ACETAMINOFEN",
        presentation: "500 MG",
        unitOfMeasure: "UNDS",
        category: "MEDICINAS",
        subcategory: "ANALGÉSICOS",
      })
    ),
    category: "MEDICINAS",
    subcategory: "ANALGÉSICOS",
    description: "ACETAMINOFEN",
    presentation: "500 MG",
    unitOfMeasure: "UNDS",
    productKey: "key",
  };

  const inventory: InventoryRecord[] = [
    {
      id: "inv-1",
      slotId: slotId("3"),
      slotNumber: "3",
      donationItemId: product.id,
      quantity: 20,
      inventoryKey: `${slotId("3")}|${product.id}`,
    },
  ];

  const order = createNota1Order();

  it("matches by description, presentation, unit, and box", () => {
    const row: ClassifiedRow = {
      sheetName: "NOTA 1",
      rowNumber: 10,
      sourceBox: "3",
      originalClassification: "ANALGESICOS",
      normalizedClassification: "ANALGESICOS",
      description: "ACETAMINOFEN",
      cleanedDescription: "ACETAMINOFEN",
      presentation: "500 MG",
      cleanedPresentation: "500 MG",
      quantity: 5,
      unitOfMeasure: "UNDS",
      cleanedUnitOfMeasure: "UNDS",
      salida: null,
      categoryColumn: null,
      warnings: [],
      skipped: false,
      category: "MEDICINAS",
      subcategory: "ANALGÉSICOS",
      classificationUnclear: false,
    };

    const result = matchNota1Row(row, [product], inventory, order);
    expect(result.matched).toBe(true);
    expect(result.orderItem?.requestedQuantity).toBe(5);
  });

  it("rejects when stock is insufficient", () => {
    const row: ClassifiedRow = {
      sheetName: "NOTA 1",
      rowNumber: 11,
      sourceBox: "3",
      originalClassification: "ANALGESICOS",
      normalizedClassification: "ANALGESICOS",
      description: "ACETAMINOFEN",
      cleanedDescription: "ACETAMINOFEN",
      presentation: "500 MG",
      cleanedPresentation: "500 MG",
      quantity: 100,
      unitOfMeasure: "UNDS",
      cleanedUnitOfMeasure: "UNDS",
      salida: null,
      categoryColumn: null,
      warnings: [],
      skipped: false,
      category: "MEDICINAS",
      subcategory: "ANALGÉSICOS",
      classificationUnclear: false,
    };

    const result = matchNota1Row(row, [product], inventory, order);
    expect(result.matched).toBe(false);
    expect(result.reason).toBe("NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK");
  });

  it("rejects ambiguous matches", () => {
    const product2: DonationItemRecord = {
      ...product,
      id: itemId("other"),
      unitOfMeasure: "CAJA 10",
    };

    const row: ClassifiedRow = {
      sheetName: "NOTA 1",
      rowNumber: 12,
      sourceBox: "",
      originalClassification: "ANALGESICOS",
      normalizedClassification: "ANALGESICOS",
      description: "ACETAMINOFEN",
      cleanedDescription: "ACETAMINOFEN",
      presentation: "500 MG",
      cleanedPresentation: "500 MG",
      quantity: 5,
      unitOfMeasure: null,
      cleanedUnitOfMeasure: null,
      salida: null,
      categoryColumn: null,
      warnings: [],
      skipped: false,
      category: "MEDICINAS",
      subcategory: "ANALGÉSICOS",
      classificationUnclear: false,
    };

    const result = matchNota1Row(row, [product, product2], inventory, order);
    expect(result.matched).toBe(false);
    expect(result.reason).toBe("MULTIPLE_PRODUCT_MATCHES_FOR_NOTA_1");
  });
});

describe("parseQuantity", () => {
  it("accepts positive integers", () => {
    expect(parseQuantity("10")).toBe(10);
    expect(parseQuantity("10.0")).toBe(10);
  });

  it("rejects invalid quantities", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });
});

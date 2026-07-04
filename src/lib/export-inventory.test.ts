import { describe, expect, it } from "vitest";
import { mapInventoryToExportRows } from "./export-inventory";

describe("export-inventory", () => {
  it("maps inventory rows to legacy Excel columns", () => {
    const rows = mapInventoryToExportRows([
      {
        quantity: 12,
        slot: { number: "170" },
        donation_item: {
          subcategory: "ANALGESICO",
          description: "Acetaminofen",
          presentation: "Tableta",
          unit_of_measurement: "UND",
        },
      },
      {
        quantity: 3,
        slot: null,
        donation_item: null,
      },
    ]);

    expect(rows[0]).toEqual({
      "CAJA #": "170",
      CLASIFICACION: "ANALGESICO",
      DESCRIPCION: "Acetaminofen",
      PRESENTACION: "Tableta",
      CANT: 12,
      "UND MEDIDA": "UND",
    });
    expect(rows[1]).toEqual({
      "CAJA #": "",
      CLASIFICACION: "",
      DESCRIPCION: "",
      PRESENTACION: "",
      CANT: 3,
      "UND MEDIDA": "",
    });
  });
});

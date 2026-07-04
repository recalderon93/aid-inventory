import { describe, expect, it } from "vitest";
import { buildDonationTaxonomy, mergeTaxonomyEntry } from "./donation-taxonomy";

describe("donation-taxonomy", () => {
  const rows = [
    { category: "Medicine", subcategory: "Analgesic" },
    { category: "Medicine", subcategory: "Antibiotic" },
    { category: "Other", subcategory: null },
    { category: "  ", subcategory: "Ignored" },
  ];

  it("builds sorted categories and subcategories", () => {
    const taxonomy = buildDonationTaxonomy(rows);
    expect(taxonomy.categories).toEqual(["Medicine", "Other"]);
    expect(taxonomy.subcategoriesByCategory.Medicine).toEqual(["Analgesic", "Antibiotic"]);
    expect(taxonomy.subcategoriesByCategory.Other).toEqual([]);
  });

  it("merges new taxonomy entries without duplicates", () => {
    const base = buildDonationTaxonomy(rows);
    const merged = mergeTaxonomyEntry(base, "Medicine", "Analgesic");
    expect(merged.subcategoriesByCategory.Medicine).toEqual(["Analgesic", "Antibiotic"]);

    const withNew = mergeTaxonomyEntry(base, "Equipment", "Wheelchair");
    expect(withNew.categories).toContain("Equipment");
    expect(withNew.subcategoriesByCategory.Equipment).toEqual(["Wheelchair"]);
  });
});

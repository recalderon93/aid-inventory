export interface DonationTaxonomy {
  categories: string[];
  subcategoriesByCategory: Record<string, string[]>;
}

export function buildDonationTaxonomy(
  rows: { category: string; subcategory: string | null }[]
): DonationTaxonomy {
  const subcategoriesByCategory: Record<string, Set<string>> = {};

  for (const row of rows) {
    const category = row.category?.trim();
    const subcategory = row.subcategory?.trim();
    if (!category) continue;

    if (!subcategoriesByCategory[category]) {
      subcategoriesByCategory[category] = new Set();
    }
    if (subcategory) {
      subcategoriesByCategory[category].add(subcategory);
    }
  }

  const sort = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

  const categories = Object.keys(subcategoriesByCategory).sort(sort);
  const normalized: Record<string, string[]> = {};
  for (const category of categories) {
    normalized[category] = [...subcategoriesByCategory[category]].sort(sort);
  }

  return { categories, subcategoriesByCategory: normalized };
}

export function mergeTaxonomyEntry(
  taxonomy: DonationTaxonomy,
  category: string,
  subcategory?: string | null
): DonationTaxonomy {
  const trimmedCategory = category.trim();
  const trimmedSubcategory = subcategory?.trim();
  if (!trimmedCategory) return taxonomy;

  const subcategoriesByCategory = { ...taxonomy.subcategoriesByCategory };
  const existing = new Set(subcategoriesByCategory[trimmedCategory] ?? []);
  if (trimmedSubcategory) existing.add(trimmedSubcategory);

  subcategoriesByCategory[trimmedCategory] = [...existing].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  const categories = Object.keys(subcategoriesByCategory).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" })
  );

  return { categories, subcategoriesByCategory };
}

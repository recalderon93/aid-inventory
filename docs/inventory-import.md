# Inventory Import Guide

This project imports legacy Excel inventory workbooks into Supabase seed datasets and SQL.

## Source file

Default workbook: [`docs/samples/INVENTARIO MEDICINAS CARITAS V3.xlsx`](../docs/samples/INVENTARIO%20MEDICINAS%20CARITAS%20V3.xlsx)

Sheets used:
- `MEDICINAS` — product catalog and initial stock
- `NOTA 1` — completed delivery note (NOTA-001)

Sheets ignored for import (exported for later review):
- `INSUMOS`
- `Hoja1`

## Generate datasets (Phase 1)

```bash
npm run import:inventory
```

Options:

```bash
npm run import:inventory -- \
  --input docs/samples/INVENTARIO\ MEDICINAS\ CARITAS\ V3.xlsx \
  --out-dir supabase/seed \
  --strategy upsert

# Preview counts without writing files
npm run import:inventory -- --dry-run

# Generate SQL with TRUNCATE preamble for empty databases
npm run import:inventory -- --strategy fresh
```

## Output files

All generated files are written to `supabase/seed/` (local only — not committed to git):

See [`supabase/seed/README.md`](../supabase/seed/README.md).

| File | Purpose |
|------|---------|
| `001_import_excel_inventory.sql` | Production-ready seed SQL |
| `manual_review_rows.csv` | Rows needing human review |
| `medicinas_clean.csv` | Cleaned MEDICINAS rows |
| `medicinas_products.csv` | Deduped product catalog |
| `medicinas_inventory.csv` | Final slot stock after NOTA 1 |
| `medicinas_inbound_transactions.csv` | Initial inbound audit rows |
| `nota1_clean.csv` | Cleaned NOTA 1 rows |
| `nota1_order_items.csv` | Matched order items |
| `nota1_fulfillment_transactions.csv` | Order fulfillment transactions |
| `ignored_insumos.csv` | INSUMOS sheet preserved |
| `ignored_hoja1.csv` | Hoja1 sheet preserved |

## Review workflow

1. Run the import script.
2. Open `manual_review_rows.csv` and filter `review_status = PENDING_REVIEW`.
3. Resolve rows by category:
   - `CATEGORY_UNCLEAR_IMPORTED_AS_SIN_CLASIFICAR` — assign subcategory manually
   - `NO_MATCH_IN_MEDICINAS_FOR_NOTA_1` — fix product or NOTA 1 row
   - `MULTIPLE_PRODUCT_MATCHES_FOR_NOTA_1` — disambiguate with box/presentation/unit
   - `NOTA_1_QUANTITY_EXCEEDS_AVAILABLE_STOCK` — verify quantities before loading
4. Update the Excel file and re-run the import.

## Database mapping

| Excel | Database |
|-------|----------|
| `CAJA #` | `slots.number` |
| `CLASIFICACION` | Used to infer `donation_items.subcategory` |
| `DESCRIPCION` | `donation_items.description` |
| `PRESENTACION` | `donation_items.presentation` |
| `CANT` (MEDICINAS only) | Initial `inventory.quantity` |
| `UND MEDIDA` | `donation_items.unit_of_measurement` |
| NOTA 1 `CANT` | `order_items` + fulfillment transactions |

Categories are stored in Spanish:
- `MEDICINAS`
- `INSUMOS`

## Repeat imports from Google Sheets

1. Export the workbook as `.xlsx`.
2. Replace or update the file in `docs/samples/`.
3. Run `npm run import:inventory`.
4. Review `manual_review_rows.csv` before loading SQL.

When the spreadsheet adds a `CATEGORY` column, the importer will prefer it over inferred classification.

## Phase 2 — Load into Supabase (deferred)

The loader script exists but is **not run automatically**:

```bash
node scripts/load-inventory-seed.mjs --target dev --strategy upsert --confirm
```

Requirements:
- `.env.local` with Supabase credentials
- Supabase CLI or `psql` access
- Manual review completed

For production:

```bash
node scripts/load-inventory-seed.mjs --target prod --strategy upsert --confirm
```

Always review `manual_review_rows.csv` before loading production data.

## Legacy generator

The older Python generator (`scripts/_generate-seed.py`) remains for reference but is superseded by `scripts/import-excel-inventory.ts`.

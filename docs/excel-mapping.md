# Excel Mapping — Legacy Inventory to Database

Reference sample: [`samples/INVENTARIO CARITAS STEPHANY.xlsx`](samples/INVENTARIO%20CARITAS%20STEPHANY.xlsx)

## Actual Excel structure

### Banner row (row 1)

| Col | Value |
|-----|-------|
| E | `EXISTENCIA` |
| H | `SALIDA` |

### Column headers (row 2)

| Col | Header | Populated in sample |
|-----|--------|---------------------|
| A | `CAJA #` | 168 rows |
| B | `CLASIFICACION` | 168 rows |
| C | `DESCRIPCION` | 168 rows |
| D | `PRESENTACION` | 128 rows (40 empty) |
| E | `CANT` | 168 rows |
| F | `UND MEDIDA` | 95 rows (73 empty) |
| G–J | (SALIDA section) | 0 rows — reserved for exit data |

### Differences vs project spec (§2)

| Spec expected | Sample actual |
|---------------|---------------|
| Single header row | Two rows (banner + headers) |
| `Caja #` | `CAJA #` |
| `Clasificación` | `CLASIFICACION` |
| `Cant.` | `CANT` |
| `Und. Medida` | `UND MEDIDA` |
| `Datos de salida` | Empty `SALIDA` columns |

## Column mapping

| Excel column | Database target | Notes |
|--------------|-----------------|-------|
| `CAJA #` | `slots.number` | Visible box number used by staff |
| `CLASIFICACION` | `donation_items.subcategory` | Raw value preserved; category inferred |
| `DESCRIPCION` | `donation_items.description` | Trim whitespace on import |
| `PRESENTACION` | `donation_items.presentation` | Nullable; often dosage (`10 MG`) |
| `CANT` | `inventory.quantity` | Quantity in a specific slot |
| `UND MEDIDA` | `donation_items.unit_of_measurement` | Nullable; packaging or physical unit |
| `SALIDA` (future) | `inventory_transactions` / `orders.completed_at` | Outbound movement or delivery date |

## Category inference

`CLASIFICACION` maps to `donation_items.subcategory`. `donation_items.category` is inferred:

| Subcategory pattern | Inferred category |
|---------------------|-------------------|
| `INSUMO MEDICO` | `Medical Supply` |
| Medicine drug classes (e.g. `ANTIHIPERTENSIVO`, `ANALGESICO`, `ANTIBIOTICO`) | `Medicine` |
| Topical products (`* TOPICO`) | `Medicine` |
| Default | `Other` |

## Data normalization notes

1. **Trim whitespace** on all text fields (21 rows have trailing spaces).
2. **Deduplicate donation items** by `(description, presentation, subcategory, unit_of_measurement)` — not per box.
3. **Empty presentation** (40 rows): allow `NULL`; common for `INSUMO MEDICO`.
4. **Empty unit** (73 rows): allow `NULL`; store quantity without unit when missing.
5. **Unit variants**: normalize `UNID` / `UND` / `UNIDAD` to a canonical form on import.
6. **Presentation vs unit**: dosage often in `PRESENTACION`; packaging in `UND MEDIDA`; physical sizes (`500ML`, `950CM`) in `UND MEDIDA`.

## Sample data profile

- **168** inventory rows
- **63** unique boxes (numbers `170`–`302`, non-sequential)
- **~108** unique product definitions after deduplication
- **Dominant subcategory**: `INSUMO MEDICO` (103 rows, 61%)

### Common subcategories (medicine)

`ANTIHIPERTENSIVO`, `ANALGESICO`, `ANTIINFLAMATORIO NO ESTEROIDE (AINE)`, `ANTISEPTICO`, `ANTIBIOTICO`, `ANTIAGREGANTE PLAQUETARIO`, `CORTICOESTEROIDE`, `RELAJANTE MUSCULAR`, and others (33 total).

### Common units of measurement

`BLISTER 10 UNID`, `BLISTER 20 UNID`, `BLISTER 30 UNID`, `CREMA 30G`, `CAJA 30 UNID`, `500ML`, `1LT`, `INHALADOR`, `SOBRES DE 5 COMPRESAS C/U`, and others (64 unique).

## Known inconsistencies

| Issue | Example | Handling |
|-------|---------|----------|
| Trailing spaces | `AMLODIPINO `, `100 MG ` | Trim on write |
| Missing presentation | Medical supplies | `NULL` allowed |
| Missing unit | `INSUMO MEDICO` rows | `NULL` allowed |
| Long classification | `ANTIINFLAMATORIO NO ESTEROIDE (AINE) - INHIBIDOR COX-2` | Store full string in `subcategory` |
| Mixed presentation meaning | `10 MG` vs empty | Keep as-is; do not merge with unit |
| Non-sequential box numbers | Gaps between 179 and 200 | `slots.number` is text/numeric, not auto-increment |

## Normalized model

```
donation_items (product definition)
    ↓
inventory (donation_item_id + slot_id + quantity)
    ↓
inventory_transactions (audit trail)
```

**Rule:** One `donation_item` per unique product. Multiple boxes = multiple `inventory` rows, not duplicated item definitions.

## Future import considerations (post-MVP)

1. Skip banner row; read headers from row 2.
2. Batch insert: slots → donation_items → inventory → inbound transactions.
3. Preview step showing deduplication matches before commit.
4. Report skipped/merged rows and normalization changes.
5. Map `SALIDA` columns when populated to outbound transactions or order dates.
6. Validate `CANT` is positive integer.
7. Create default `warehouse` record for single-location MVP.

## Excel export (MVP)

Export mirrors legacy columns for staff familiarity:

| Export column | Source |
|---------------|--------|
| `CAJA #` | `slots.number` |
| `CLASIFICACION` | `donation_items.subcategory` |
| `DESCRIPCION` | `donation_items.description` |
| `PRESENTACION` | `donation_items.presentation` |
| `CANT` | `inventory.quantity` |
| `UND MEDIDA` | `donation_items.unit_of_measurement` |

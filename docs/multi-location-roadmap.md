# Multi-Location Roadmap

> Post-MVP planning for multiple warehouses / donation centers.

## Current state (MVP)

- Single warehouse: `Caritas Stephany` (ID `00000000-0000-0000-0000-000000000001`).
- `warehouse_id` column on `slots` and `orders` prepared for future use.
- All data scoped to one location.

## Phase 1 — Data model

### New entity: warehouses (already exists)

| Column | Purpose |
|--------|---------|
| name | Location name |
| address | Physical address |
| status | active / inactive |

### FK additions (future migration)

| Table | Column | Notes |
|-------|--------|-------|
| `inventory` | `warehouse_id` | Denormalized for queries, or derive via slot |
| `inventory_transactions` | `warehouse_id` | Audit per location |
| `orders` | `warehouse_id` | Already present |
| `profiles` | `default_warehouse_id` | User's primary location |

## Phase 2 — Access control

- RLS policies filter by `warehouse_id`.
- Admin: all warehouses.
- Staff/Collaborator: assigned warehouse(s) only.
- New table: `profile_warehouses` (many-to-many) if users span locations.

## Phase 3 — UI

1. Warehouse selector in app header (admin sees all).
2. Slot/inventory/order lists filtered by selected warehouse.
3. Reports: per-warehouse and consolidated.

## Phase 4 — Data migration

1. Create default warehouse (already done).
2. Assign all existing slots/orders to default warehouse.
3. No data loss for single-location users.

## Open questions for stakeholders

1. Can inventory transfer between warehouses?
2. Shared catalog (`donation_items`) vs per-warehouse items?
3. Can one order pull from multiple warehouses?
4. Separate Excel exports per location?
5. User access: one warehouse or multiple?

## Transfer between warehouses (future)

If needed:

- New transaction type: `warehouse_transfer`
- Source/destination warehouse on transaction
- Approval workflow (optional)

## Timeline suggestion

| Milestone | When |
|-----------|------|
| MVP single warehouse | Now |
| Schema + RLS prep | MVP (done) |
| Multi-warehouse UI | After MVP + 1 location confirmed |
| Inter-warehouse transfers | When business requires |

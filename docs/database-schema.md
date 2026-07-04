# Database Schema

PostgreSQL schema for aid-inventory. Migrations live in `supabase/migrations/`.

## Entity relationship

```
warehouses
    └── slots
            └── inventory ←── donation_items
                    └── inventory_transactions
orders
    └── order_items → donation_items
slot_status_history → slots
profiles → auth.users
```

## Tables

### warehouses

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | TEXT | |
| address | TEXT | Nullable |
| status | TEXT | Default `active` |

Default warehouse: `00000000-0000-0000-0000-000000000001` (Caritas Stephany).

### profiles

Extends Supabase `auth.users`.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, FK → auth.users |
| name | TEXT | |
| email | TEXT | Unique |
| role | user_role | `admin`, `staff`, `collaborator` |
| status | user_status | `active`, `inactive` |
| deleted_at | TIMESTAMPTZ | Soft delete |

### slots

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| warehouse_id | UUID | FK → warehouses |
| number | TEXT | Visible box number (Excel `CAJA #`) |
| name | TEXT | Nullable |
| status | slot_status | `active`, `inactive`, `archived`, `shipped`, `reserved` |
| deleted_at | TIMESTAMPTZ | Soft delete |

Unique: `(warehouse_id, number)`.

### donation_items

Normalized product definitions (not per-box).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| category | TEXT | Inferred (Medicine, Medical Supply, Other) |
| subcategory | TEXT | Excel `CLASIFICACION` |
| description | TEXT | Excel `DESCRIPCION` |
| presentation | TEXT | Excel `PRESENTACION`, nullable |
| unit_of_measurement | TEXT | Excel `UND MEDIDA`, nullable |
| status | donation_item_status | `active`, `out_of_stock`, `needed`, `archived` |

### inventory

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| slot_id | UUID | FK → slots |
| donation_item_id | UUID | FK → donation_items |
| quantity | INTEGER | ≥ 0 |

Unique: `(slot_id, donation_item_id)`.

### inventory_transactions

| Column | Type | Notes |
|--------|------|-------|
| type | inventory_transaction_type | `inbound`, `outbound`, `relocation`, etc. |
| donation_item_id | UUID | FK |
| from_slot_id | UUID | Nullable |
| to_slot_id | UUID | Nullable |
| order_id | UUID | Nullable, FK → orders |
| quantity | INTEGER | > 0 |
| created_by_user_id | UUID | FK → profiles |

### orders

| Column | Type | Notes |
|--------|------|-------|
| order_number | TEXT | Unique |
| requester_* | TEXT | Name, phone, email, address, city, state, notes |
| status | order_status | `pending` → `completed` |
| prepared_by_user_id | UUID | |
| completed_by_user_id | UUID | |

### order_items

| Column | Type | Notes |
|--------|------|-------|
| order_id | UUID | FK |
| donation_item_id | UUID | Nullable for needed items |
| requested_quantity | INTEGER | |
| fulfilled_quantity | INTEGER | Default 0 |
| status | order_item_status | |

### slot_status_history

Audit trail for slot status changes.

## RLS

Row Level Security enabled incrementally per migration `00009`–`00012`. All authenticated users can read operational data; writes restricted by `get_user_role()`.

## Excel compatibility

See [excel-mapping.md](excel-mapping.md) for column mapping and normalization rules.

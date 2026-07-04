# User Flows

Core MVP flows for aid-inventory. UI is in Spanish; routes use English paths.

## Authentication

1. User opens `/login`.
2. Enters email and password.
3. On success → redirect to `/slots`.
4. Middleware protects all routes except `/login`.

**Test users:** see README.md (seed via `scripts/seed-auth.mjs`).

## Slot list

**Route:** `/slots`

1. User sees grid of box numbers (cards).
2. User searches by box number.
3. Admin/staff can create a new box by entering a number.
4. Tap a box → `/slots/[id]`.

## Slot detail

**Route:** `/slots/[id]`

1. Shows box number, status, and items inside.
2. Each item links to `/inventory/[id]`.
3. CTA: "Agregar donación" → `/inventory/add?slotId=...`.

## Add donation

**Route:** `/inventory/add`

**Step 1 — Select slot** (skipped if `slotId` query param present):

1. Search/select box from grid.

**Step 2 — Register donation:**

1. Search for existing item by description.
2. If found → select item, set quantity.
3. If not found → enter subcategory, description, presentation, unit, quantity.
4. On save:
   - Create or reuse `donation_item`.
   - Upsert `inventory` quantity for selected slot.
   - Insert `inventory_transaction` type `inbound`.
5. Redirect to slot detail.

## Inventory list

**Route:** `/inventory`

1. Aggregated list of items with total quantity across all boxes.
2. Search by description, subcategory, presentation.
3. Filter by subcategory (classification).
4. Out-of-stock items sort to end.
5. Tap item → `/inventory/[id]`.

## Donation item detail

**Route:** `/inventory/[id]`

1. Shows item metadata and total available quantity.
2. Lists boxes containing this item with per-box quantities.

## Create order

**Route:** `/orders/new`

**Step 1 — Requester:**

- Name (required), phone, email, address, city, state (Venezuelan list), notes.

**Step 2 — Items:**

- Search and add donation items.
- Set requested quantity per item.
- Shows available quantity.

**Step 3 — Review and submit:**

- Creates `order` (status `pending`) and `order_items`.

## Order fulfillment

**Route:** `/orders/[id]`

1. View requester info and requested items.
2. System shows suggested slots per item (highest quantity first).
3. **Prepare** → status `in_progress`, records `prepared_by`.
4. **Complete** → deducts inventory, creates `order_fulfillment` transactions, updates order to `completed`.

## Transactions

**Route:** `/transactions`

- Read-only list of recent inventory movements (newest first).

## Excel export

**Route:** `/export`

1. User clicks download.
2. API `/api/export` generates `.xlsx` with legacy columns.

## Role permissions (MVP)

| Action | Admin | Staff | Collaborator |
|--------|-------|-------|--------------|
| View slots/inventory | ✓ | ✓ | ✓ |
| Create slot | ✓ | ✓ | — |
| Register donation | ✓ | ✓ | ✓ |
| Create order | ✓ | ✓ | ✓ |
| Fulfill order | ✓ | ✓ | ✓ |
| Export Excel | ✓ | ✓ | ✓ |

# Manual Testing Guide

Manual test scenarios for MVP validation. Use seed data from `supabase/seed.sql` and test users from `scripts/seed-auth.mjs`.

## Prerequisites

- [ ] Migrations applied (`supabase/migrations/*.sql`)
- [ ] Seed data loaded (`supabase/seed.sql`)
- [ ] Test users created (`node scripts/seed-auth.mjs`)
- [ ] App running (`npm run dev`)
- [ ] `.env.local` configured with Supabase credentials

## Test users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aid-inventory.local | password123 |
| Staff | staff@aid-inventory.local | password123 |
| Collaborator | collaborator@aid-inventory.local | password123 |

---

## 1. Authentication

### 1.1 Login success

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/login` | Login form in Spanish |
| 2 | Enter staff credentials | — |
| 3 | Submit | Redirect to `/slots` |

### 1.2 Login failure

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter wrong password | Error message in Spanish |
| 2 | — | Stay on login page |

### 1.3 Protected routes

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log out | Redirect to `/login` |
| 2 | Navigate to `/inventory` while logged out | Redirect to `/login` |

### 1.4 Logout

| Step | Action | Expected |
|------|--------|----------|
| 1 | Click "Cerrar sesión" | Session cleared, redirect to login |

---

## 2. Slots

### 2.1 Slot list with seed data

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as staff | — |
| 2 | Open `/slots` | Boxes 170, 171, … visible (63 from seed) |
| 3 | Search `170` | Only box 170 shown |

### 2.2 Create slot

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter new number `999` | — |
| 2 | Click "Nueva caja" | Box 999 appears in list |

### 2.3 Slot detail

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open box `170` | Items from seed (e.g. AMLODIPINO) listed |
| 2 | Tap an item | Navigate to item detail |

---

## 3. Add donation

### 3.1 Add to existing item

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/inventory/add` | Slot selection step |
| 2 | Select box `170` | Donation form |
| 3 | Search `IBUPROFENO` | Existing item suggested |
| 4 | Select item, quantity `1`, save | Redirect to slot 170; quantity increased |

### 3.2 Add new item

| Step | Action | Expected |
|------|--------|----------|
| 1 | Select any box | — |
| 2 | Enter new subcategory, description, qty | — |
| 3 | Save | Item appears in slot and inventory list |

### 3.3 Validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Try quantity `0` or negative | Minimum quantity enforced (1) |

### 3.4 From slot detail

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open slot detail, click "Agregar donación" | Form opens with box pre-selected |

---

## 4. Inventory list

### 4.1 Search and filter

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/inventory` | Items aggregated with totals |
| 2 | Search `INSUMO` or filter subcategory | Results filtered |
| 3 | Open item detail | Per-slot quantities shown |

### 4.2 Seed data spot-check

Verify against Excel sample:

| Box | Item | Expected qty |
|-----|------|--------------|
| 170 | AMLODIPINO | 1 |
| 170 | IBUPROFENO | 2 |

---

## 5. Orders

### 5.1 Create order

| Step | Action | Expected |
|------|--------|----------|
| 1 | `/orders/new` — fill requester name | — |
| 2 | Add item (e.g. IBUPROFENO), qty 1 | Available qty shown |
| 3 | Submit | Order created, status Pendiente |

### 5.2 Fulfill order

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open order detail | Suggested slots shown |
| 2 | Click Preparar | Status En preparación |
| 3 | Click Completar pedido | Status Completado |
| 4 | Check inventory | Quantity deducted |
| 5 | Check `/transactions` | order_fulfillment recorded |

### 5.3 Unavailable item

| Step | Action | Expected |
|------|--------|----------|
| 1 | Request qty > available | Order item marked unavailable or partial |

---

## 6. Transactions

| Step | Action | Expected |
|------|--------|----------|
| 1 | After donation + fulfillment | Both inbound and order_fulfillment visible |
| 2 | — | Shows type, item, quantity, slot, date |

---

## 7. Excel export

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/export`, download | `.xlsx` file downloads |
| 2 | Open in Excel/Sheets | Columns: CAJA #, CLASIFICACION, DESCRIPCION, PRESENTACION, CANT, UND MEDIDA |
| 3 | Compare row for box 170 | Matches seed/DB data |

---

## 8. Mobile regression

Test at 375px width (Chrome DevTools):

- [ ] Bottom navigation usable (touch targets)
- [ ] Forms readable without zoom
- [ ] Slot grid wraps correctly
- [ ] Login form fits screen

---

## 9. Slow network

| Step | Action | Expected |
|------|--------|----------|
| 1 | Throttle to Slow 3G | — |
| 2 | Save donation | Loading state; retry on failure |
| 3 | — | No silent data loss |

---

## 10. Role checks (spot)

| Role | Create slot | Add donation | Fulfill order |
|------|-------------|--------------|---------------|
| Admin | ✓ | ✓ | ✓ |
| Staff | ✓ | ✓ | ✓ |
| Collaborator | — | ✓ | ✓ |

---

## Bug report template

```
**Role:**
**Browser:**
**Steps:**
1.
2.
**Expected:**
**Actual:**
**Screenshot:**
```

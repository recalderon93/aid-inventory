-- Warehouses, profiles, roles, and auth helpers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'staff', 'collaborator');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'staff',
  status user_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'staff')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

INSERT INTO warehouses (id, name, address)
VALUES ('00000000-0000-0000-0000-000000000001', 'Caritas Stephany', 'Main donation center');
-- Slots (boxes / storage locations)

CREATE TYPE slot_status AS ENUM ('active', 'inactive', 'archived', 'shipped', 'reserved');

CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES warehouses(id) ON DELETE RESTRICT,
  number TEXT NOT NULL,
  name TEXT,
  status slot_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (warehouse_id, number)
);

CREATE INDEX idx_slots_number ON slots(number);
CREATE INDEX idx_slots_status ON slots(status);

CREATE TRIGGER slots_updated_at
  BEFORE UPDATE ON slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Donation items (normalized product definitions)

CREATE TYPE donation_item_status AS ENUM ('active', 'out_of_stock', 'needed', 'archived');

CREATE TABLE donation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'Other',
  subcategory TEXT,
  description TEXT NOT NULL,
  presentation TEXT,
  unit_of_measurement TEXT,
  status donation_item_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_donation_items_description ON donation_items(description);
CREATE INDEX idx_donation_items_category ON donation_items(category);
CREATE INDEX idx_donation_items_subcategory ON donation_items(subcategory);
CREATE INDEX idx_donation_items_status ON donation_items(status);

CREATE TRIGGER donation_items_updated_at
  BEFORE UPDATE ON donation_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Inventory (quantity per slot per item)

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  donation_item_id UUID NOT NULL REFERENCES donation_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, donation_item_id)
);

CREATE INDEX idx_inventory_slot_id ON inventory(slot_id);
CREATE INDEX idx_inventory_donation_item_id ON inventory(donation_item_id);

CREATE TRIGGER inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Inventory transactions (audit trail)

CREATE TYPE inventory_transaction_type AS ENUM (
  'inbound',
  'outbound',
  'relocation',
  'adjustment',
  'order_fulfillment',
  'slot_deactivation',
  'slot_shipment'
);

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type inventory_transaction_type NOT NULL,
  donation_item_id UUID NOT NULL REFERENCES donation_items(id) ON DELETE RESTRICT,
  from_slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
  to_slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
  order_id UUID,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(type);
CREATE INDEX idx_inventory_transactions_donation_item ON inventory_transactions(donation_item_id);
CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);
-- Orders (donation requests)

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'in_progress',
  'ready_for_pickup',
  'completed',
  'cancelled'
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  warehouse_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES warehouses(id) ON DELETE RESTRICT,
  requester_name TEXT NOT NULL,
  requester_phone TEXT,
  requester_email TEXT,
  requester_address TEXT,
  requester_city TEXT,
  requester_state TEXT,
  requester_notes TEXT,
  status order_status NOT NULL DEFAULT 'pending',
  created_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prepared_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  prepared_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add FK from transactions to orders after orders table exists
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
-- Order items

CREATE TYPE order_item_status AS ENUM (
  'pending',
  'partially_fulfilled',
  'fulfilled',
  'unavailable',
  'cancelled'
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  donation_item_id UUID REFERENCES donation_items(id) ON DELETE SET NULL,
  requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
  fulfilled_quantity INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled_quantity >= 0),
  status order_item_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TRIGGER order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Slot status history

CREATE TABLE slot_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  old_status slot_status,
  new_status slot_status NOT NULL,
  changed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slot_status_history_slot_id ON slot_status_history(slot_id);
-- RLS: profiles

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated users can read warehouses"
  ON warehouses FOR SELECT
  TO authenticated
  USING (true);
-- RLS: slots

ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read slots"
  ON slots FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Admin and staff can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff'));

CREATE POLICY "Admin and staff can update slots"
  ON slots FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff'));
-- RLS: donation items, inventory, transactions

ALTER TABLE donation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read donation items"
  ON donation_items FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Staff and admin can manage donation items"
  ON donation_items FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

CREATE POLICY "Authenticated users can read inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admin can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

CREATE POLICY "Authenticated users can read transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admin can insert transactions"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));
-- RLS: orders

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admin can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

CREATE POLICY "Authenticated users can read order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff and admin can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

CREATE POLICY "Authenticated users can read slot status history"
  ON slot_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and staff can insert slot status history"
  ON slot_status_history FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff'));

-- Allow authenticated users to create their own profile when the auth trigger was missed.
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role = 'staff'::user_role
    AND status = 'active'::user_status
  );

-- Expose tables to Data API (needed if "Automatically expose new tables" is disabled)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- 00014_foundation.sql
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'disabled';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE profiles
SET
  first_name = COALESCE(first_name, split_part(name, ' ', 1)),
  last_name = COALESCE(
    last_name,
    NULLIF(trim(substring(name from position(' ' in name) + 1)), ''),
    ''
  )
WHERE first_name IS NULL OR last_name IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE TABLE IF NOT EXISTS order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, created_at DESC);

ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order history"
  ON order_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order history"
  ON order_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Staff can create orders" ON orders;
DROP POLICY IF EXISTS "Collaborators can create orders" ON orders;

CREATE POLICY "Admin and staff can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff'));

CREATE POLICY "Admin and staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

-- 00015_collaborator_slot_insert.sql
DROP POLICY IF EXISTS "Admin and staff can insert slots" ON slots;

CREATE POLICY "Admin staff and collaborator can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));
-- Order fulfillment: picks, merma, RPCs

-- Extend enums
ALTER TYPE inventory_transaction_type ADD VALUE IF NOT EXISTS 'merma';
ALTER TYPE order_item_status ADD VALUE IF NOT EXISTS 'issue';

-- Orders: track completion with issues
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS has_issues BOOLEAN NOT NULL DEFAULT false;

-- Order items: issue tracking
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS issue_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Inventory transactions: link to order item + reason
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id
  ON inventory_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_item_id
  ON inventory_transactions(order_item_id);

-- Order item picks (per-slot fulfillment)
CREATE TABLE order_item_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  donation_item_id UUID NOT NULL REFERENCES donation_items(id) ON DELETE RESTRICT,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  inventory_transaction_id UUID UNIQUE REFERENCES inventory_transactions(id) ON DELETE SET NULL,
  picked_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  picked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_item_picks_order_item ON order_item_picks(order_item_id);
CREATE INDEX idx_order_item_picks_order ON order_item_picks(order_id);
CREATE INDEX idx_order_item_picks_slot_item ON order_item_picks(slot_id, donation_item_id);

CREATE TRIGGER order_item_picks_updated_at
  BEFORE UPDATE ON order_item_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE order_item_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order item picks"
  ON order_item_picks FOR SELECT
  TO authenticated
  USING (true);

-- Fix overlapping orders RLS policies
DROP POLICY IF EXISTS "Staff and admin can manage orders" ON orders;

CREATE POLICY "Admin staff collaborator can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'staff', 'collaborator'))
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

-- Helper: assert user can handle orders
CREATE OR REPLACE FUNCTION public.assert_can_handle_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.get_user_role() NOT IN ('admin', 'staff', 'collaborator') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- Helper: assert user is admin or staff
CREATE OR REPLACE FUNCTION public.assert_admin_or_staff()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.get_user_role() NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
END;
$$;

-- Helper: check order handler access
CREATE OR REPLACE FUNCTION public.can_access_order_handler(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_prepared_by UUID;
BEGIN
  v_role := public.get_user_role();
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;
  SELECT prepared_by_user_id INTO v_prepared_by FROM orders WHERE id = p_order_id;
  RETURN v_prepared_by IS NULL OR v_prepared_by = auth.uid();
END;
$$;

-- Start order: pending -> in_progress
CREATE OR REPLACE FUNCTION public.start_order(p_order_id UUID)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_role user_role;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_role := public.get_user_role();

  IF v_order.status = 'completed' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order cannot be started';
  END IF;

  IF v_order.status = 'in_progress' THEN
    IF v_role <> 'admin' AND v_order.prepared_by_user_id IS NOT NULL AND v_order.prepared_by_user_id <> v_uid THEN
      RAISE EXCEPTION 'Order is being handled by another user';
    END IF;
    RETURN v_order;
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Order is not pending';
  END IF;

  UPDATE orders
  SET
    status = 'in_progress',
    prepared_by_user_id = v_uid,
    prepared_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', 'pending', 'in_progress');

  RETURN v_order;
END;
$$;

-- Confirm picks for an order item (atomic, progressive)
CREATE OR REPLACE FUNCTION public.confirm_order_item_picks(
  p_order_item_id UUID,
  p_picks JSONB
)
RETURNS order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item order_items;
  v_order orders;
  v_pick JSONB;
  v_slot_id UUID;
  v_qty INTEGER;
  v_inv inventory;
  v_new_fulfilled INTEGER;
  v_remaining INTEGER;
  v_txn_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF v_item.donation_item_id IS NULL THEN
    RAISE EXCEPTION 'Order item has no product';
  END IF;

  IF v_item.status IN ('fulfilled', 'issue', 'cancelled') THEN
    RAISE EXCEPTION 'Order item cannot be picked';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id FOR UPDATE;
  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  IF NOT public.can_access_order_handler(v_order.id) THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  v_remaining := v_item.requested_quantity - v_item.fulfilled_quantity;

  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    v_slot_id := (v_pick->>'slot_id')::UUID;
    v_qty := (v_pick->>'quantity')::INTEGER;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_qty > v_remaining THEN
      RAISE EXCEPTION 'Cannot pick more than remaining quantity (%)', v_remaining;
    END IF;

    SELECT * INTO v_inv
    FROM inventory
    WHERE slot_id = v_slot_id AND donation_item_id = v_item.donation_item_id
    FOR UPDATE;

    IF NOT FOUND OR v_inv.quantity < v_qty THEN
      RAISE EXCEPTION 'Not enough stock in slot';
    END IF;

    INSERT INTO inventory_transactions (
      type,
      donation_item_id,
      from_slot_id,
      order_id,
      order_item_id,
      quantity,
      reason,
      created_by_user_id,
      notes
    ) VALUES (
      'order_fulfillment',
      v_item.donation_item_id,
      v_slot_id,
      v_order.id,
      v_item.id,
      v_qty,
      'ORDER_PICK',
      v_uid,
      'Order ' || v_order.order_number
    )
    RETURNING id INTO v_txn_id;

    UPDATE inventory SET quantity = quantity - v_qty WHERE id = v_inv.id;

    INSERT INTO order_item_picks (
      order_id,
      order_item_id,
      donation_item_id,
      slot_id,
      quantity,
      status,
      inventory_transaction_id,
      picked_by_user_id,
      picked_at
    ) VALUES (
      v_order.id,
      v_item.id,
      v_item.donation_item_id,
      v_slot_id,
      v_qty,
      'confirmed',
      v_txn_id,
      v_uid,
      now()
    );

    v_remaining := v_remaining - v_qty;
  END LOOP;

  SELECT COALESCE(SUM(quantity), 0)::INTEGER INTO v_new_fulfilled
  FROM order_item_picks
  WHERE order_item_id = v_item.id AND status = 'confirmed';

  UPDATE order_items
  SET
    fulfilled_quantity = v_new_fulfilled,
    status = CASE
      WHEN v_new_fulfilled >= requested_quantity THEN 'fulfilled'::order_item_status
      WHEN v_new_fulfilled > 0 THEN 'partially_fulfilled'::order_item_status
      ELSE 'pending'::order_item_status
    END
  WHERE id = v_item.id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- Record merma (shrinkage / loss)
CREATE OR REPLACE FUNCTION public.record_merma(
  p_slot_id UUID,
  p_donation_item_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_order_item_id UUID DEFAULT NULL
)
RETURNS inventory_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv inventory;
  v_txn inventory_transactions;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_can_handle_orders();

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  SELECT * INTO v_inv
  FROM inventory
  WHERE slot_id = p_slot_id AND donation_item_id = p_donation_item_id
  FOR UPDATE;

  IF NOT FOUND OR v_inv.quantity < p_quantity THEN
    RAISE EXCEPTION 'Not enough stock for merma';
  END IF;

  INSERT INTO inventory_transactions (
    type,
    donation_item_id,
    from_slot_id,
    order_id,
    order_item_id,
    quantity,
    reason,
    created_by_user_id,
    notes
  ) VALUES (
    'merma',
    p_donation_item_id,
    p_slot_id,
    p_order_id,
    p_order_item_id,
    p_quantity,
    p_reason,
    v_uid,
    p_notes
  )
  RETURNING * INTO v_txn;

  UPDATE inventory SET quantity = quantity - p_quantity WHERE id = v_inv.id;

  INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, metadata)
  VALUES (
    'record_merma',
    'inventory_transaction',
    v_txn.id,
    v_uid,
    jsonb_build_object(
      'slot_id', p_slot_id,
      'donation_item_id', p_donation_item_id,
      'quantity', p_quantity,
      'reason', p_reason
    )
  );

  RETURN v_txn;
END;
$$;

-- Mark order item as issue
CREATE OR REPLACE FUNCTION public.mark_order_item_issue(
  p_order_item_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item order_items;
  v_order orders;
  v_uid UUID := auth.uid();
  v_role user_role;
BEGIN
  v_role := public.get_user_role();
  IF v_uid IS NULL OR v_role NOT IN ('admin', 'staff', 'collaborator') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT * INTO v_item FROM order_items WHERE id = p_order_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id FOR UPDATE;
  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  IF v_role = 'collaborator' AND v_order.prepared_by_user_id IS NOT NULL AND v_order.prepared_by_user_id <> v_uid THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Issue reason is required';
  END IF;

  UPDATE order_items
  SET
    status = 'issue',
    issue_reason = p_reason,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_order_item_id
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

-- Complete order (idempotent)
CREATE OR REPLACE FUNCTION public.complete_order(p_order_id UUID)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_uid UUID := auth.uid();
  v_role user_role;
  v_open_count INTEGER;
  v_issue_count INTEGER;
BEGIN
  PERFORM public.assert_can_handle_orders();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN v_order;
  END IF;

  IF v_order.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Order is not in progress';
  END IF;

  v_role := public.get_user_role();
  IF NOT public.can_access_order_handler(p_order_id) AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Order is being handled by another user';
  END IF;

  SELECT COUNT(*) INTO v_open_count
  FROM order_items
  WHERE order_id = p_order_id
    AND status NOT IN ('fulfilled', 'issue', 'cancelled', 'unavailable');

  IF v_open_count > 0 THEN
    RAISE EXCEPTION 'Not all items are fulfilled or marked as issue';
  END IF;

  SELECT COUNT(*) INTO v_issue_count
  FROM order_items
  WHERE order_id = p_order_id AND status = 'issue';

  IF v_issue_count > 0 AND v_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Only admin or staff can complete orders with issues';
  END IF;

  UPDATE orders
  SET
    status = 'completed',
    has_issues = (v_issue_count > 0),
    completed_by_user_id = v_uid,
    completed_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', 'in_progress', 'completed');

  RETURN v_order;
END;
$$;

-- Cancel order (admin/staff, no confirmed picks)
CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_pick_count INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  PERFORM public.assert_admin_or_staff();

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Order cannot be cancelled';
  END IF;

  SELECT COUNT(*) INTO v_pick_count
  FROM order_item_picks
  WHERE order_id = p_order_id AND status = 'confirmed';

  IF v_pick_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel order with confirmed picks';
  END IF;

  INSERT INTO order_history (order_id, changed_by, field, old_value, new_value)
  VALUES (p_order_id, v_uid, 'status', v_order.status::TEXT, 'cancelled');

  UPDATE orders
  SET
    status = 'cancelled',
    cancelled_at = now(),
    requester_notes = COALESCE(p_notes, requester_notes)
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_item_picks(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_merma(UUID, UUID, INTEGER, TEXT, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_item_issue(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;
-- Restore orders INSERT policy removed when dropping the broad FOR ALL policy in 00017

DROP POLICY IF EXISTS "Admin and staff can create orders" ON orders;

CREATE POLICY "Admin and staff can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff'));
-- Allow collaborators to create orders (UI + RLS aligned)

DROP POLICY IF EXISTS "Admin and staff can create orders" ON orders;
DROP POLICY IF EXISTS "Admin staff and collaborator can create orders" ON orders;

CREATE POLICY "Admin staff and collaborator can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));
-- order_history audit table (from 00014, extracted for DBs that skipped foundation migration)

CREATE TABLE IF NOT EXISTS order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_history(order_id, created_at DESC);

ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read order history" ON order_history;
CREATE POLICY "Authenticated users can read order history"
  ON order_history FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert order history" ON order_history;
CREATE POLICY "Authenticated users can insert order history"
  ON order_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);
-- audit_logs table (from 00014, for DBs that skipped foundation migration)

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

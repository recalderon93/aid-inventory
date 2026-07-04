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

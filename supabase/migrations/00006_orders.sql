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

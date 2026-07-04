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

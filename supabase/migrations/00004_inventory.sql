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

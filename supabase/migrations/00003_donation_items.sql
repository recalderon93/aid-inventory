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

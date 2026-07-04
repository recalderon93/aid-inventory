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

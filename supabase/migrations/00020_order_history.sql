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

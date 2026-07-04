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

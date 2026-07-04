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

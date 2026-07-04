-- Restore orders INSERT policy removed when dropping the broad FOR ALL policy in 00017

DROP POLICY IF EXISTS "Admin and staff can create orders" ON orders;

CREATE POLICY "Admin staff and collaborator can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

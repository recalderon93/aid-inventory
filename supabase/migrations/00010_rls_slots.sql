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

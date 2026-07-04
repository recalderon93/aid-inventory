-- Allow collaborators to create slots (needed when registering donations)

DROP POLICY IF EXISTS "Admin and staff can insert slots" ON slots;

CREATE POLICY "Admin staff and collaborator can insert slots"
  ON slots FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'staff', 'collaborator'));

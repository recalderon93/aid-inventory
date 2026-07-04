-- Allow authenticated users to create their own profile when the auth trigger was missed.

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role = 'staff'::user_role
    AND status = 'active'::user_status
  );

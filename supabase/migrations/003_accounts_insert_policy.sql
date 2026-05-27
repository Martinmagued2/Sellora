-- Add INSERT policy to the accounts table so authenticated users can create their own account record during signup

CREATE POLICY "Users can insert own account"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles are readable by signed-in users" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
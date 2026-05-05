-- ============================================================
-- ERMN NUCLEAR FIX: CLEANUP & SYNC
-- ============================================================

-- Enforce 3-letter username restrictions
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_restriction;
ALTER TABLE public.users ADD CONSTRAINT check_username_restriction 
CHECK (
  length(username) >= 4 OR 
  lower(username) IN ('cnn', 'cbc', 'mtv', 'bbc')
);

-- 1. DROP ALL triggers on auth.users to be 100% sure nothing is hidden
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name 
              FROM information_schema.triggers 
              WHERE event_object_schema = 'auth' 
              AND event_object_table = 'users') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON auth.users';
    END LOOP;
END $$;

-- 2. DROP ALL triggers on public.users just in case
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name 
              FROM information_schema.triggers 
              WHERE event_object_table = 'users') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON public.users';
    END LOOP;
END $$;

-- 3. Create a BRAND NEW, uniquely named sync function
CREATE OR REPLACE FUNCTION public.emergency_sync_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- We ONLY insert into users. NO WALLETS.
  -- This is the absolute minimum to get sign-up working.
  INSERT INTO public.users (id, username, email)
  VALUES (
    new.id, 
    COALESCE(NULLIF(new.raw_user_meta_data->>'username', ''), 'user_' || substr(new.id::text, 1, 8)),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email;

  RETURN new;
END;
$$;

-- 4. Attach the new trigger
DROP TRIGGER IF EXISTS on_auth_user_created_emergency ON auth.users;
CREATE TRIGGER on_auth_user_created_emergency
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.emergency_sync_user();

-- 5. Helper Functions & Policies
CREATE OR REPLACE FUNCTION public.is_not_banned()
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.banned_users 
    WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
    OR username = 'id:' || auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id AND public.is_not_banned());

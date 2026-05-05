-- ============================================================
-- ERMN COMPLETE HARDENED SECURITY & SYNC
-- ============================================================

-- 0. CLEANUP & SCHEMA FIXES
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equipped_background text DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equipped_shell text DEFAULT NULL;

-- Enforce 3-letter username restrictions (only for NEW users)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_restriction;
ALTER TABLE public.users ADD CONSTRAINT check_username_restriction 
CHECK (length(username) >= 4 OR lower(username) IN ('cnn', 'cbc', 'mtv', 'bbc', 'd_j'))
NOT VALID;

-- 1. HELPER FUNCTIONS
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

-- 2. MASTER SYNC TRIGGER (auth.users -> public.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_emergency ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. USERS TABLE POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid() = id AND public.is_not_banned()
) WITH CHECK (
  auth.uid() = id
);

-- 4. POSTS TABLE POLICIES
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posts visibility" ON posts;
DROP POLICY IF EXISTS "Owners can insert posts" ON posts;
DROP POLICY IF EXISTS "Owners or admins can modify posts" ON posts;

CREATE POLICY "Posts visibility" ON posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.username = posts.username
    AND (u.is_banned = false OR public.is_admin())
    AND (
      u.is_private = false OR 
      u.id = auth.uid() OR
      EXISTS (SELECT 1 FROM follows f WHERE f.following = u.username AND f.follower = (SELECT username FROM users WHERE id = auth.uid())) OR
      public.is_admin()
    )
  )
);

CREATE POLICY "Owners can insert posts" ON posts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username)
);

CREATE POLICY "Owners or admins can modify posts" ON posts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = posts.username OR is_admin = true))
);

-- 5. FOLLOWS & REQUESTS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Follows visibility" ON follows;
DROP POLICY IF EXISTS "Users can manage own follows" ON follows;
CREATE POLICY "Follows visibility" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON follows FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = follower OR username = following))
);

DROP POLICY IF EXISTS "Follow requests visibility" ON follow_requests;
DROP POLICY IF EXISTS "Users can manage own follow requests" ON follow_requests;
CREATE POLICY "Follow requests visibility" ON follow_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = requester OR username = target))
);
CREATE POLICY "Users can manage own follow requests" ON follow_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = requester OR username = target))
);

-- 6. LIKES & COMMENTS
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes visibility" ON likes;
DROP POLICY IF EXISTS "Owners can like" ON likes;
CREATE POLICY "Likes visibility" ON likes FOR SELECT USING (true);
CREATE POLICY "Owners can like" ON likes FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = likes.username)
);

DROP POLICY IF EXISTS "Comments visibility" ON comments;
DROP POLICY IF EXISTS "Owners can comment" ON comments;
CREATE POLICY "Comments visibility" ON comments FOR SELECT USING (true);
CREATE POLICY "Owners can comment" ON comments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = comments.username OR public.is_admin()))
);

-- 7. BLOCKING
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Blocks visibility" ON blocked_users;
DROP POLICY IF EXISTS "Users can manage own blocks" ON blocked_users;
CREATE POLICY "Blocks visibility" ON blocked_users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = blocker OR username = blocked))
);
CREATE POLICY "Users can manage own blocks" ON blocked_users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = blocker)
);

-- 8. POLLS
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Polls visibility" ON polls;
CREATE POLICY "Polls visibility" ON polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Poll votes visibility" ON poll_votes;
DROP POLICY IF EXISTS "Users can vote" ON poll_votes;
CREATE POLICY "Poll votes visibility" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON poll_votes FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = poll_votes.username)
);

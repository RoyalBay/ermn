-- ============================================================
-- HARDENED ROW LEVEL SECURITY (RLS) FOR ERMN
-- ============================================================

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.is_not_banned()
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_banned = true
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

-- 2. USERS TABLE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);

-- Only allow updating specific non-sensitive fields
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid() = id AND public.is_not_banned()
) WITH CHECK (
  auth.uid() = id AND 
  -- Ensure sensitive flags are NOT changed by the user
  is_admin = (SELECT is_admin FROM users WHERE id = auth.uid()) AND
  is_developer = (SELECT is_developer FROM users WHERE id = auth.uid()) AND
  is_banned = (SELECT is_banned FROM users WHERE id = auth.uid()) AND
  username = (SELECT username FROM users WHERE id = auth.uid())
);

-- 3. POSTS TABLE
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Posts visibility" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Owners or admins can modify posts" ON posts;

CREATE POLICY "Posts visibility" ON posts FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.username = posts.username
    AND (
      u.is_private = false OR 
      u.id = auth.uid() OR
      EXISTS (SELECT 1 FROM follows f WHERE f.following = u.username AND f.follower = (SELECT username FROM users WHERE id = auth.uid())) OR
      public.is_admin()
    )
  )
);

CREATE POLICY "Owners can insert posts" ON posts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username)
);

CREATE POLICY "Owners can update posts" ON posts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username) AND
  public.is_not_banned()
);

-- Note: Deleting posts is handled via Secure RPC for Admins, 
-- but we allow owners to delete their own.
CREATE POLICY "Owners can delete posts" ON posts FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username) AND
  public.is_not_banned()
);

-- 4. LIKES TABLE
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can see likes" ON likes;
DROP POLICY IF EXISTS "Authenticated users can like" ON likes;
DROP POLICY IF EXISTS "Owners can unlike" ON likes;

CREATE POLICY "Anyone can see likes" ON likes FOR SELECT USING (true);

CREATE POLICY "Owners can like" ON likes FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = likes.username)
);

CREATE POLICY "Owners can unlike" ON likes FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = likes.username) AND
  public.is_not_banned()
);

-- 5. COMMENTS TABLE
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments visibility" ON comments;
DROP POLICY IF EXISTS "Authenticated users can comment" ON comments;
DROP POLICY IF EXISTS "Owners or admins can delete comments" ON comments;

CREATE POLICY "Comments visibility" ON comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM posts p WHERE p.id = comments.post_id)
);

CREATE POLICY "Owners can comment" ON comments FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = comments.username)
);

CREATE POLICY "Owners can delete own comments" ON comments FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = comments.username) AND
  public.is_not_banned()
);

-- 6. BANNED_USERS & REPORTS (ADMIN ONLY)
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage banned users" ON banned_users;
DROP POLICY IF EXISTS "Anyone can check ban status" ON banned_users;
CREATE POLICY "Anyone can check ban status" ON banned_users FOR SELECT USING (true);
-- No direct mutations allowed; must use Secure RPC.

DROP POLICY IF EXISTS "Admins can view reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can report" ON reports;
CREATE POLICY "Admins can view reports" ON reports FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can report" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND public.is_not_banned());

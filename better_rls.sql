-- ============================================================
-- ENHANCED ROW LEVEL SECURITY (RLS) FOR ERMN
-- ============================================================

-- 1. Helper Function: Check if user is banned
CREATE OR REPLACE FUNCTION public.is_not_banned()
RETURNS boolean AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_banned = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Helper Function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. POSTS: Better Visibility & Mutation Controls
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Owners or admins can update/delete posts" ON posts;

-- Select: Anyone can see public posts, but private posts only to followers/owner
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

-- Insert: Only non-banned authenticated users
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND 
  public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username)
);

-- Update/Delete: Owners or Admins
CREATE POLICY "Owners or admins can modify posts" ON posts FOR ALL USING (
  auth.role() = 'authenticated' AND (
    (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username) AND public.is_not_banned()) OR
    public.is_admin()
  )
);

-- 4. USERS: Protect sensitive fields
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid() = id AND public.is_not_banned()
) WITH CHECK (
  auth.uid() = id AND 
  (is_admin = (SELECT is_admin FROM users WHERE id = auth.uid())) -- Prevent self-promotion to admin
);

-- 5. LIKES: Prevent banned likes
DROP POLICY IF EXISTS "Authenticated users can like" ON likes;
CREATE POLICY "Authenticated users can like" ON likes FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = likes.username)
);

-- 6. COMMENTS: Privacy matching posts
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
CREATE POLICY "Comments visibility" ON comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = comments.post_id
  ) -- Selection is already restricted by "Posts visibility" via joining in app logic, 
    -- but we can explicitly check if the post is visible.
);

DROP POLICY IF EXISTS "Authenticated users can comment" ON comments;
CREATE POLICY "Authenticated users can comment" ON comments FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = comments.username)
);

-- 7. BANNED_USERS: Only admins can manage, everyone can see
DROP POLICY IF EXISTS "Admins can manage banned users" ON banned_users;
CREATE POLICY "Admins can manage banned users" ON banned_users FOR ALL USING (
  public.is_admin()
);

-- 8. FOLLOW_REQUESTS: Secure handling
DROP POLICY IF EXISTS "Users can manage their own follow requests" ON follow_requests;
CREATE POLICY "Users can manage their own follow requests" ON follow_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = requester OR username = target))
);

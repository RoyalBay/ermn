-- ============================================================
-- ERMN MASTER SECURITY & RLS RESTORATION
-- ============================================================

SET search_path = public;

-- 1. HARDENED HELPER FUNCTIONS
-- Using SECURITY DEFINER and SET search_path to bypass RLS safely and prevent search_path attacks.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_not_banned()
RETURNS boolean 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the current user ID or their username is in the banned_users table
  RETURN NOT EXISTS (
    SELECT 1 FROM public.banned_users 
    WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
    OR username = 'id:' || auth.uid()::text
  );
END;
$$;

-- Helper to check if a user can see another user's content (handles privacy and blocks)
CREATE OR REPLACE FUNCTION public.can_view_content(target_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id uuid := auth.uid();
  viewer_username text;
  target_is_private boolean;
  target_is_banned boolean;
BEGIN
  -- Admins see everything
  IF EXISTS (SELECT 1 FROM public.users WHERE id = viewer_id AND is_admin = true) THEN
    RETURN true;
  END IF;

  -- Get target status
  SELECT is_private, is_banned INTO target_is_private, target_is_banned FROM public.users WHERE username = target_username;
  
  -- If target is banned, nobody sees their content (except admins, handled above)
  IF target_is_banned THEN
    RETURN false;
  END IF;

  -- If not private, everyone can see (unless blocked, but we'll keep it simple for now)
  IF NOT target_is_private THEN
    RETURN true;
  END IF;

  -- If private, check if viewer is the owner
  IF EXISTS (SELECT 1 FROM public.users WHERE id = viewer_id AND username = target_username) THEN
    RETURN true;
  END IF;

  -- If private, check if viewer follows target
  SELECT username INTO viewer_username FROM public.users WHERE id = viewer_id;
  IF EXISTS (SELECT 1 FROM public.follows WHERE follower = viewer_username AND following = target_username) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. SCHEMA FIXES & CONSTRAINTS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equipped_background text DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equipped_shell text DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Restore the correct username restrictions (allowing 'erm' and '4')
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_restriction;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS username_length_check;
ALTER TABLE public.users ADD CONSTRAINT check_username_restriction 
CHECK (
  length(username) >= 4 OR 
  lower(username) IN ('erm', '4', 'cnn', 'cbc', 'mtv', 'bbc', 'd_j')
);

-- 3. ENABLE RLS ON ALL TABLES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ermnium_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ermnium_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ermnium_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ermnium_shop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ermnium_inventory ENABLE ROW LEVEL SECURITY;

-- 4. USERS POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (
  auth.uid() = id AND public.is_not_banned()
) WITH CHECK (auth.uid() = id);

-- 5. POSTS POLICIES
DROP POLICY IF EXISTS "Posts visibility" ON posts;
DROP POLICY IF EXISTS "Owners can insert posts" ON posts;
DROP POLICY IF EXISTS "Owners or admins can modify posts" ON posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
DROP POLICY IF EXISTS "Owners or admins can update/delete posts" ON posts;

CREATE POLICY "Posts visibility" ON posts FOR SELECT USING (
  public.can_view_content(posts.username)
);

CREATE POLICY "Owners can insert posts" ON posts FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = posts.username)
);

CREATE POLICY "Owners or admins can modify posts" ON posts FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = posts.username OR is_admin = true))
);

-- 6. FOLLOWS & REQUESTS
DROP POLICY IF EXISTS "Follows visibility" ON follows;
DROP POLICY IF EXISTS "Users can manage own follows" ON follows;
DROP POLICY IF EXISTS "Users can manage their own follows" ON follows;
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

-- 7. LIKES & COMMENTS
DROP POLICY IF EXISTS "Likes visibility" ON likes;
DROP POLICY IF EXISTS "Owners can like" ON likes;
DROP POLICY IF EXISTS "Anyone can see likes" ON likes;
DROP POLICY IF EXISTS "Authenticated users can like" ON likes;
DROP POLICY IF EXISTS "Owners can unlike" ON likes;
CREATE POLICY "Likes visibility" ON likes FOR SELECT USING (true);
CREATE POLICY "Owners can like" ON likes FOR ALL USING (
  public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = likes.username)
);

DROP POLICY IF EXISTS "Comments visibility" ON comments;
DROP POLICY IF EXISTS "Owners can comment" ON comments;
DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can comment" ON comments;
DROP POLICY IF EXISTS "Owners or admins can delete comments" ON comments;
CREATE POLICY "Comments visibility" ON comments FOR SELECT USING (true);
CREATE POLICY "Owners can comment" ON comments FOR ALL USING (
  public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = comments.username OR is_admin = true))
);

-- 8. BLOCKING
DROP POLICY IF EXISTS "Blocks visibility" ON blocked_users;
DROP POLICY IF EXISTS "Users can manage own blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can manage their own blocks" ON blocked_users;
CREATE POLICY "Blocks visibility" ON blocked_users FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (username = blocker OR username = blocked))
);
CREATE POLICY "Users can manage own blocks" ON blocked_users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = blocker)
);

-- 9. POLLS
DROP POLICY IF EXISTS "Polls visibility" ON polls;
DROP POLICY IF EXISTS "Anyone can view polls" ON polls;
DROP POLICY IF EXISTS "Authenticated users can create/update polls" ON polls;
CREATE POLICY "Polls visibility" ON polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Poll votes visibility" ON poll_votes;
DROP POLICY IF EXISTS "Users can vote" ON poll_votes;
CREATE POLICY "Poll votes visibility" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON poll_votes FOR ALL USING (
  public.is_not_banned() AND
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND username = poll_votes.username)
);

-- 10. ADMIN ONLY TABLES (REPORTS, BANNED_USERS)
DROP POLICY IF EXISTS "Admins can view reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can report" ON reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON reports;
CREATE POLICY "Admins can view reports" ON reports FOR SELECT USING (public.is_admin());
CREATE POLICY "Authenticated users can report" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete reports" ON reports FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage banned users" ON banned_users;
DROP POLICY IF EXISTS "Anyone can check ban status" ON banned_users;
CREATE POLICY "Admins can manage banned users" ON banned_users FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can check ban status" ON banned_users FOR SELECT USING (true);

-- 11. ERMNIUM TABLES
DROP POLICY IF EXISTS "Read Config" ON ermnium_config;
CREATE POLICY "Read Config" ON ermnium_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Read Wallets" ON ermnium_wallets;
CREATE POLICY "Read Wallets" ON ermnium_wallets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Read Own Transactions" ON ermnium_transactions;
CREATE POLICY "Read Own Transactions" ON ermnium_transactions FOR SELECT USING (
  username = (SELECT username FROM users WHERE id = auth.uid()) OR public.is_admin()
);

DROP POLICY IF EXISTS "Read Shop" ON ermnium_shop;
CREATE POLICY "Read Shop" ON ermnium_shop FOR SELECT USING (true);

DROP POLICY IF EXISTS "Read Inventory" ON ermnium_inventory;
CREATE POLICY "Read Inventory" ON ermnium_inventory FOR SELECT USING (true);

-- Ensure Ermnium items can be updated by admin if needed (though usually done via functions)
ALTER TABLE ermnium_shop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage shop" ON ermnium_shop;
CREATE POLICY "Admins can manage shop" ON ermnium_shop FOR ALL USING (public.is_admin());

-- ============================================================
-- END OF MASTER SECURITY SCRIPT
-- ============================================================

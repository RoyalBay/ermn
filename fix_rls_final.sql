-- ============================================================
-- ERMN MASTER SECURITY & RLS RESTORATION (ROBUST EDITION)
-- ============================================================

SET search_path = public;

-- 1. CLEANUP OLD POLICIES ON ALL 16 TABLES
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'users', 'posts', 'follows', 'follow_requests', 'likes', 'comments', 
        'reports', 'banned_users', 'polls', 'poll_votes', 'blocked_users', 
        'ermnium_config', 'ermnium_wallets', 'ermnium_transactions', 'ermnium_shop', 'ermnium_inventory'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END
$$;

-- 2. HARDENED HELPER FUNCTIONS (KEEPING FOR COMPATIBILITY)
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
  RETURN NOT EXISTS (
    SELECT 1 FROM public.banned_users 
    WHERE username = (SELECT username FROM public.users WHERE id = auth.uid())
    OR username = 'id:' || auth.uid()::text
  );
END;
$$;

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

  -- If not private, everyone can see
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

-- 3. SCHEMA FIXES & CONSTRAINTS
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

-- 4. ENABLE RLS ON ALL 16 TABLES
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

-- 5. USERS POLICIES
CREATE POLICY "Public profiles are viewable by everyone" ON public.users 
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.users 
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id AND is_banned = false) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.users 
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- 6. POSTS POLICIES
CREATE POLICY "Posts visibility" ON public.posts 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.username = posts.username
      AND (u.is_banned = false OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true))
      AND (
        u.is_private = false OR 
        u.id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.follows f WHERE f.following = u.username AND f.follower = (SELECT username FROM public.users WHERE id = auth.uid())) OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
      )
    )
  );

CREATE POLICY "Owners can insert posts" ON public.posts 
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = posts.username 
        AND is_banned = false
    )
  );

CREATE POLICY "Owners or admins can modify posts" ON public.posts 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND username = posts.username)
      OR
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
    )
  );

-- 7. FOLLOWS POLICIES
CREATE POLICY "Follows visibility" ON public.follows 
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own follows" ON public.follows 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND (username = follower OR username = following)
        AND is_banned = false
    )
  );

-- 8. FOLLOW REQUESTS POLICIES
CREATE POLICY "Follow requests visibility" ON public.follow_requests 
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND (username = requester OR username = target)
    )
  );

CREATE POLICY "Users can manage own follow requests" ON public.follow_requests 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND (username = requester OR username = target)
        AND is_banned = false
    )
  );

-- 9. LIKES POLICIES
CREATE POLICY "Likes visibility" ON public.likes 
  FOR SELECT USING (true);

CREATE POLICY "Owners can manage likes" ON public.likes 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = likes.username 
        AND is_banned = false
    )
  );

-- 10. COMMENTS POLICIES
CREATE POLICY "Comments visibility" ON public.comments 
  FOR SELECT USING (true);

CREATE POLICY "Owners can insert comments" ON public.comments 
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = comments.username 
        AND is_banned = false
    )
  );

CREATE POLICY "Owners or admins can manage comments" ON public.comments 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND username = comments.username)
      OR
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
      OR
      EXISTS (
        SELECT 1 FROM public.posts p 
        JOIN public.users u ON p.username = u.username 
        WHERE p.id = comments.post_id AND u.id = auth.uid()
      )
    )
  );

-- 11. REPORTS POLICIES
CREATE POLICY "Admins can view reports" ON public.reports 
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Authenticated users can report" ON public.reports 
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = reports.reporter 
        AND is_banned = false
    )
  );

CREATE POLICY "Admins can delete reports" ON public.reports 
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- 12. BANNED USERS POLICIES
CREATE POLICY "Anyone can check ban status" ON public.banned_users 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage banned users" ON public.banned_users 
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- 13. POLLS POLICIES
CREATE POLICY "Polls visibility" ON public.polls 
  FOR SELECT USING (true);

CREATE POLICY "Post owners or admins can manage polls" ON public.polls 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = polls.post_id AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND (u.username = p.username OR u.is_admin = true))
      )
    )
  );

-- 14. POLL VOTES POLICIES
CREATE POLICY "Poll votes visibility" ON public.poll_votes 
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own votes" ON public.poll_votes 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = poll_votes.username 
        AND is_banned = false
    )
  );

-- 15. BLOCKED USERS POLICIES
CREATE POLICY "Blocks visibility" ON public.blocked_users 
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND (username = blocker OR username = blocked)
    )
  );

CREATE POLICY "Users can manage own blocks" ON public.blocked_users 
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND username = blocker 
        AND is_banned = false
    )
  );

-- 16. ERMNIUM TABLES POLICIES
-- Config
CREATE POLICY "Read Config" ON public.ermnium_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage config" ON public.ermnium_config FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Wallets
CREATE POLICY "Read Wallets" ON public.ermnium_wallets FOR SELECT USING (true);
CREATE POLICY "Admins can manage wallets" ON public.ermnium_wallets FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Transactions
CREATE POLICY "Read Own Transactions" ON public.ermnium_transactions 
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND username = ermnium_transactions.username)
      OR
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
    )
  );
CREATE POLICY "Admins can manage transactions" ON public.ermnium_transactions FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Shop
CREATE POLICY "Read Shop" ON public.ermnium_shop FOR SELECT USING (true);
CREATE POLICY "Admins can manage shop" ON public.ermnium_shop FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Inventory
CREATE POLICY "Read Inventory" ON public.ermnium_inventory FOR SELECT USING (true);
CREATE POLICY "Admins can manage inventory" ON public.ermnium_inventory FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- END OF MASTER SECURITY SCRIPT
-- ============================================================

-- ============================================================
-- ermn full schema — Consolidated Clean Version
-- ============================================================

-- USERS
-- Note: password column removed as Supabase Auth handles it securely.
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text,
  pic text default '',
  bio text default '',
  banner text default '',
  verified boolean default false,
  is_developer boolean default false,
  is_admin boolean default false,
  is_private boolean default false,
  is_banned boolean default false,
  spotify_data jsonb,
  created_at timestamptz default now()
);

-- Ensure missing columns exist in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_background text DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_shell text DEFAULT NULL;

-- Trigger to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into public.users with conflict handling
  INSERT INTO public.users (id, username, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- POSTS
create table if not exists posts (
  id bigint primary key generated always as identity,
  username text not null references users(username) on delete cascade,
  text text not null,
  repost_of bigint references posts(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz default now()
);

-- FOLLOWS
create table if not exists follows (
  follower text not null references users(username) on delete cascade,
  following text not null references users(username) on delete cascade,
  primary key (follower, following)
);

-- LIKES
create table if not exists likes (
  post_id bigint not null references posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  primary key (post_id, username)
);

-- COMMENTS
create table if not exists comments (
  id bigint primary key generated always as identity,
  post_id bigint not null references posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- REPORTS
create table if not exists reports (
  id bigint primary key generated always as identity,
  post_id bigint references posts(id) on delete cascade,
  reporter text not null references users(username) on delete cascade,
  reported_user text not null,
  reason text default 'No reason given',
  created_at timestamptz default now()
);

-- BANNED USERS
create table if not exists banned_users (
  username text primary key,
  original_username text,
  original_pic text,
  original_bio text,
  original_banner text,
  original_spotify_data jsonb,
  banned_at timestamptz default now()
);

-- POLLS
create table if not exists polls (
  post_id bigint primary key references posts(id) on delete cascade,
  options jsonb not null
);

create table if not exists poll_votes (
  post_id bigint not null references posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  option_index int not null,
  primary key (post_id, username)
);

-- BLOCKED USERS
create table if not exists blocked_users (
  blocker text not null references users(username) on delete cascade,
  blocked text not null references users(username) on delete cascade,
  primary key (blocker, blocked)
);

-- FOLLOW REQUESTS
create table if not exists follow_requests (
  requester text not null references users(username) on delete cascade,
  target text not null references users(username) on delete cascade,
  created_at timestamptz default now(),
  primary key (requester, target)
);

-- INDEXES
create index if not exists users_username_lower on users (lower(username));

-- ENABLE RLS
alter table users enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;
alter table banned_users enable row level security;
alter table polls enable row level security;
alter table poll_votes enable row level security;
alter table blocked_users enable row level security;
alter table follow_requests enable row level security;

-- POLICIES
do $$
begin
  -- Drop existing policies
  drop policy if exists "Public profiles are viewable by everyone" on users;
  drop policy if exists "Users can update own profile" on users;
  drop policy if exists "Posts are viewable by everyone" on posts;
  drop policy if exists "Authenticated users can create posts" on posts;
  drop policy if exists "Owners or admins can update/delete posts" on posts;
  drop policy if exists "Owners or admins can delete posts" on posts;
  drop policy if exists "Authenticated users can like" on likes;
  drop policy if exists "Owners can unlike" on likes;
  drop policy if exists "Anyone can read comments" on comments;
  drop policy if exists "Authenticated users can comment" on comments;
  drop policy if exists "Owners or admins can delete comments" on comments;
  drop policy if exists "Admins can view reports" on reports;
  drop policy if exists "Admins can delete reports" on reports;
  drop policy if exists "Authenticated users can report" on reports;
  drop policy if exists "Admins can manage banned users" on banned_users;
  drop policy if exists "Anyone can check ban status" on banned_users;
  drop policy if exists "Anyone can see likes" on likes;
  drop policy if exists "Anyone can view polls" on polls;
  drop policy if exists "Authenticated users can create/update polls" on polls;
  drop policy if exists "Users can manage their own follows" on follows;
  drop policy if exists "Users can manage their own blocks" on blocked_users;

  -- USERS
  create policy "Public profiles are viewable by everyone" on users for select using (true);
  create policy "Users can update own profile" on users for update using (auth.uid() = id);

  -- POSTS
  create policy "Posts are viewable by everyone" on posts for select using (true);
  create policy "Authenticated users can create posts" on posts for insert with check (
    auth.role() = 'authenticated' and 
    exists (select 1 from users where id = auth.uid() and username = posts.username)
  );
  create policy "Owners or admins can update/delete posts" on posts for all using (
    auth.role() = 'authenticated' and (
      exists (select 1 from users where id = auth.uid() and username = posts.username) or
      exists (select 1 from users where id = auth.uid() and is_admin = true)
    )
  );

  -- LIKES
  create policy "Anyone can see likes" on likes for select using (true);
  create policy "Authenticated users can like" on likes for insert with check (
    auth.role() = 'authenticated' and 
    exists (select 1 from users where id = auth.uid() and username = likes.username)
  );
  create policy "Owners can unlike" on likes for delete using (
    auth.role() = 'authenticated' and 
    exists (select 1 from users where id = auth.uid() and username = likes.username)
  );

  -- COMMENTS
  create policy "Anyone can read comments" on comments for select using (true);
  create policy "Authenticated users can comment" on comments for insert with check (
    auth.role() = 'authenticated' and 
    exists (select 1 from users where id = auth.uid() and username = comments.username)
  );
  create policy "Owners or admins can delete comments" on comments for delete using (
    auth.role() = 'authenticated' and (
      exists (select 1 from users where id = auth.uid() and username = comments.username) or
      exists (select 1 from users where id = auth.uid() and is_admin = true)
    )
  );

  -- REPORTS
  create policy "Admins can view reports" on reports for select using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );
  create policy "Authenticated users can report" on reports for insert with check (
    auth.role() = 'authenticated'
  );
  create policy "Admins can delete reports" on reports for delete using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );

  -- BANNED USERS
  create policy "Admins can manage banned users" on banned_users for all using (
    exists (select 1 from users where id = auth.uid() and is_admin = true)
  );
  create policy "Anyone can check ban status" on banned_users for select using (true);

  -- POLLS
  create policy "Anyone can view polls" on polls for select using (true);
  create policy "Authenticated users can create/update polls" on polls for all using (
    exists (select 1 from posts where id = polls.post_id and 
      (username in (select username from users where id = auth.uid()) or
       exists (select 1 from users where id = auth.uid() and is_admin = true))
    )
  );

  -- FOLLOWS, BLOCKED_USERS, FOLLOW_REQUESTS (simplified for brevity, owner-based)
  create policy "Users can manage their own follows" on follows for all using (
    exists (select 1 from users where id = auth.uid() and (username = follower or username = following))
  );
  create policy "Users can manage their own blocks" on blocked_users for all using (
    exists (select 1 from users where id = auth.uid() and username = blocker)
  );
end
$$;


-- COMMUNITIES
create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  pic text default '',
  banner text default '',
  creator text not null references users(username) on delete cascade,
  is_private boolean default false,
  password text,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  joined_at timestamptz default now(),
  primary key (community_id, username)
);

create table if not exists community_posts (
  id bigint primary key generated always as identity,
  community_id uuid not null references communities(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists community_comments (
  id bigint primary key generated always as identity,
  post_id bigint not null references community_posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- ENABLE RLS
alter table communities enable row level security;
alter table community_members enable row level security;
alter table community_posts enable row level security;
alter table community_comments enable row level security;

-- POLICIES
create policy "Anyone can view communities" on communities for select using (true);
create policy "Authenticated users can create communities" on communities for insert with check (auth.role() = 'authenticated');
create policy "Creator can update community" on communities for update using (auth.role() = 'authenticated' and creator = (select username from users where id = auth.uid()));
create policy "Creator can delete community" on communities for delete using (auth.role() = 'authenticated' and creator = (select username from users where id = auth.uid()));

create policy "Anyone can view community members" on community_members for select using (true);
create policy "Users can join communities" on community_members for insert with check (auth.role() = 'authenticated' and username = (select username from users where id = auth.uid()));
create policy "Users can leave communities" on community_members for delete using (auth.role() = 'authenticated' and username = (select username from users where id = auth.uid()));

create policy "Anyone can view community posts" on community_posts for select using (true);
create policy "Members can create community posts" on community_posts for insert with check (
  auth.role() = 'authenticated' and 
  username = (select username from users where id = auth.uid()) and
  exists (select 1 from community_members where community_id = community_posts.community_id and username = community_posts.username)
);
create policy "Creator or Admin can delete community posts" on community_posts for delete using (
  auth.role() = 'authenticated' and (
    username = (select username from users where id = auth.uid()) or
    exists (select 1 from communities where id = community_posts.community_id and creator = (select username from users where id = auth.uid()))
  )
);

create policy "Anyone can view community comments" on community_comments for select using (true);
create policy "Members can comment" on community_comments for insert with check (
  auth.role() = 'authenticated' and 
  username = (select username from users where id = auth.uid())
);
create policy "Comment author or community creator can delete comment" on community_comments for delete using (
  auth.role() = 'authenticated' and (
    username = (select username from users where id = auth.uid()) or
    exists (
      select 1 from communities c
      join community_posts cp on cp.community_id = c.id
      where cp.id = community_comments.post_id and c.creator = (select username from users where id = auth.uid())
    )
  )
);

-- Function to clean up expired communities
create or replace function cleanup_expired_communities()
returns void as $$
begin
  delete from communities where expires_at < now();
end;
$$ language plpgsql;

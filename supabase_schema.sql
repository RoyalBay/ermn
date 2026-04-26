-- ============================================================
-- ermn full schema — Consolidated Clean Version
-- ============================================================

-- USERS
create table if not exists users (
  username text primary key,
  password text not null,
  pic text default '',
  bio text default '',
  banner text default '',
  verified boolean default false,
  is_developer boolean default false,
  is_private boolean default false,
  created_at timestamptz default now()
);

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

-- POLICIES — drop & recreate to avoid "already exists" errors
do $$
begin
  -- Drop existing policies
  drop policy if exists "allow all users" on users;
  drop policy if exists "allow all posts" on posts;
  drop policy if exists "allow all follows" on follows;
  drop policy if exists "allow all likes" on likes;
  drop policy if exists "allow all comments" on comments;
  drop policy if exists "allow all reports" on reports;
  drop policy if exists "allow all banned_users" on banned_users;
  drop policy if exists "allow all polls" on polls;
  drop policy if exists "allow all poll_votes" on poll_votes;
  drop policy if exists "allow all blocked_users" on blocked_users;
  drop policy if exists "allow all follow_requests" on follow_requests;

  -- Create new policies
  create policy "allow all users" on users for all using (true) with check (true);
  create policy "allow all posts" on posts for all using (true) with check (true);
  create policy "allow all follows" on follows for all using (true) with check (true);
  create policy "allow all likes" on likes for all using (true) with check (true);
  create policy "allow all comments" on comments for all using (true) with check (true);
  create policy "allow all reports" on reports for all using (true) with check (true);
  create policy "allow all banned_users" on banned_users for all using (true) with check (true);
  create policy "allow all polls" on polls for all using (true) with check (true);
  create policy "allow all poll_votes" on poll_votes for all using (true) with check (true);
  create policy "allow all blocked_users" on blocked_users for all using (true) with check (true);
  create policy "allow all follow_requests" on follow_requests for all using (true) with check (true);
end
$$;

-- ENSURE COLUMNS EXIST (in case tables already existed without them)
alter table users add column if not exists bio text default '';
alter table users add column if not exists banner text default '';
alter table users add column if not exists verified boolean default false;
alter table users add column if not exists is_developer boolean default false;
alter table users add column if not exists is_private boolean default false;
alter table posts add column if not exists repost_of bigint references posts(id) on delete set null;
alter table posts add column if not exists edited_at timestamptz;

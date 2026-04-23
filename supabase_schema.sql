-- ============================================================
-- ermn full schema — run in Supabase SQL editor
-- Includes: reports, banned_users tables + all original tables
-- ============================================================

-- USERS
create table if not exists users (
  username text primary key,
  password text not null,
  pic text default '',
  bio text default '',
  created_at timestamptz default now()
);
alter table users add column if not exists bio text default '';

-- POSTS
create table if not exists posts (
  id bigint primary key generated always as identity,
  username text not null references users(username) on delete cascade,
  text text not null,
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

-- REPORTS (new)
create table if not exists reports (
  id bigint primary key generated always as identity,
  post_id bigint references posts(id) on delete cascade,
  reporter text not null references users(username) on delete cascade,
  reported_user text not null,
  reason text default 'No reason given',
  created_at timestamptz default now()
);

-- BANNED USERS (new)
create table if not exists banned_users (
  username text primary key,
  banned_at timestamptz default now()
);

-- ENABLE RLS
alter table users enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table reports enable row level security;
alter table banned_users enable row level security;

-- POLICIES — drop & recreate
drop policy if exists "allow all users" on users;
drop policy if exists "allow all posts" on posts;
drop policy if exists "allow all follows" on follows;
drop policy if exists "allow all likes" on likes;
drop policy if exists "allow all comments" on comments;
drop policy if exists "allow all reports" on reports;
drop policy if exists "allow all banned_users" on banned_users;

create policy "allow all users" on users for all using (true) with check (true);
create policy "allow all posts" on posts for all using (true) with check (true);
create policy "allow all follows" on follows for all using (true) with check (true);
create policy "allow all likes" on likes for all using (true) with check (true);
create policy "allow all comments" on comments for all using (true) with check (true);
create policy "allow all reports" on reports for all using (true) with check (true);
create policy "allow all banned_users" on banned_users for all using (true) with check (true);

-- INDEX for faster case-insensitive username lookup
create index if not exists users_username_lower on users (lower(username));

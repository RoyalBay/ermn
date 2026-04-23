-- Run this in your Supabase SQL editor
-- Run the NEW parts if you already have the old schema

-- Existing tables (create if not exists)
create table if not exists users (
  username text primary key,
  password text not null,
  pic text default '',
  bio text default '',
  created_at timestamptz default now()
);

create table if not exists posts (
  id bigint primary key generated always as identity,
  username text not null references users(username) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists follows (
  follower text not null references users(username) on delete cascade,
  following text not null references users(username) on delete cascade,
  primary key (follower, following)
);

create table if not exists likes (
  post_id bigint not null references posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  primary key (post_id, username)
);

-- NEW: Comments table
create table if not exists comments (
  id bigint primary key generated always as identity,
  post_id bigint not null references posts(id) on delete cascade,
  username text not null references users(username) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- NEW: Add bio column to existing users table (safe to run even if already added)
alter table users add column if not exists bio text default '';

-- Enable RLS
alter table users enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Policies (drop & recreate in case they already exist)
drop policy if exists "allow all users" on users;
drop policy if exists "allow all posts" on posts;
drop policy if exists "allow all follows" on follows;
drop policy if exists "allow all likes" on likes;
drop policy if exists "allow all comments" on comments;

create policy "allow all users" on users for all using (true) with check (true);
create policy "allow all posts" on posts for all using (true) with check (true);
create policy "allow all follows" on follows for all using (true) with check (true);
create policy "allow all likes" on likes for all using (true) with check (true);
create policy "allow all comments" on comments for all using (true) with check (true);

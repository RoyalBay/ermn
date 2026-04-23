-- Run this in your Supabase SQL editor

create table if not exists users (
  username text primary key,
  password text not null,
  pic text default '',
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

-- Enable RLS but allow all for anon (since we're doing our own auth)
alter table users enable row level security;
alter table posts enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;

create policy "allow all users" on users for all using (true) with check (true);
create policy "allow all posts" on posts for all using (true) with check (true);
create policy "allow all follows" on follows for all using (true) with check (true);
create policy "allow all likes" on likes for all using (true) with check (true);

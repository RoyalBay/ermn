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
returns void as 
begin
  delete from communities where expires_at < now();
end;
 language plpgsql;


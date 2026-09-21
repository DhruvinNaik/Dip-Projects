-- Direct messages for the portal Chat popup (not a new nav section).

create table if not exists public.portal_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  sender_username text not null,
  sender_name text,
  recipient_username text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_chat_messages_room_created_idx
  on public.portal_chat_messages (room_id, created_at);
create index if not exists portal_chat_messages_recipient_unread_idx
  on public.portal_chat_messages (recipient_username, read_at);

comment on table public.portal_chat_messages is
  '1:1 portal chat used by the floating Chat popup.';

alter table public.portal_chat_messages enable row level security;

drop policy if exists "portal_chat_messages_select" on public.portal_chat_messages;
drop policy if exists "portal_chat_messages_insert" on public.portal_chat_messages;
drop policy if exists "portal_chat_messages_update" on public.portal_chat_messages;

create policy "portal_chat_messages_select"
  on public.portal_chat_messages for select using (true);
create policy "portal_chat_messages_insert"
  on public.portal_chat_messages for insert with check (true);
create policy "portal_chat_messages_update"
  on public.portal_chat_messages for update using (true) with check (true);

grant select, insert, update on public.portal_chat_messages to anon, authenticated;

alter table public.portal_chat_messages replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.portal_chat_messages;
exception
  when duplicate_object then null;
end $$;

-- Groups created from the Chat popup + button.

create table if not exists public.portal_chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by_username text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_chat_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.portal_chat_groups(id) on delete cascade,
  username text not null,
  member_name text,
  created_at timestamptz not null default now(),
  unique (group_id, username)
);

create index if not exists portal_chat_group_members_user_idx
  on public.portal_chat_group_members (username);

alter table public.portal_chat_groups enable row level security;
alter table public.portal_chat_group_members enable row level security;

drop policy if exists "portal_chat_groups_select" on public.portal_chat_groups;
drop policy if exists "portal_chat_groups_insert" on public.portal_chat_groups;
drop policy if exists "portal_chat_group_members_select" on public.portal_chat_group_members;
drop policy if exists "portal_chat_group_members_insert" on public.portal_chat_group_members;

create policy "portal_chat_groups_select"
  on public.portal_chat_groups for select using (true);
create policy "portal_chat_groups_insert"
  on public.portal_chat_groups for insert with check (true);
create policy "portal_chat_group_members_select"
  on public.portal_chat_group_members for select using (true);
create policy "portal_chat_group_members_insert"
  on public.portal_chat_group_members for insert with check (true);

grant select, insert, update on public.portal_chat_groups to anon, authenticated;
grant select, insert, delete on public.portal_chat_group_members to anon, authenticated;

drop policy if exists "portal_chat_groups_update" on public.portal_chat_groups;
create policy "portal_chat_groups_update"
  on public.portal_chat_groups for update using (true) with check (true);

drop policy if exists "portal_chat_group_members_delete" on public.portal_chat_group_members;
create policy "portal_chat_group_members_delete"
  on public.portal_chat_group_members for delete using (true);

-- Per-user last-read cursor (needed for group unread badges).

create table if not exists public.portal_chat_room_reads (
  room_id text not null,
  username text not null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, username)
);

create index if not exists portal_chat_room_reads_user_idx
  on public.portal_chat_room_reads (username);

alter table public.portal_chat_room_reads enable row level security;

drop policy if exists "portal_chat_room_reads_select" on public.portal_chat_room_reads;
drop policy if exists "portal_chat_room_reads_insert" on public.portal_chat_room_reads;
drop policy if exists "portal_chat_room_reads_update" on public.portal_chat_room_reads;

create policy "portal_chat_room_reads_select"
  on public.portal_chat_room_reads for select using (true);
create policy "portal_chat_room_reads_insert"
  on public.portal_chat_room_reads for insert with check (true);
create policy "portal_chat_room_reads_update"
  on public.portal_chat_room_reads for update using (true) with check (true);

grant select, insert, update on public.portal_chat_room_reads to anon, authenticated;

drop policy if exists "portal_chat_messages_delete" on public.portal_chat_messages;
create policy "portal_chat_messages_delete"
  on public.portal_chat_messages for delete using (true);
grant delete on public.portal_chat_messages to anon, authenticated;

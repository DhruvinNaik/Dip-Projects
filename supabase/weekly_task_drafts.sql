-- Weekly task drafts: admin adds a whole week's tasks once, then assigns each to an employee later.
-- Assigning creates a normal row in public.tasks and links it back via task_id.

create table if not exists public.weekly_task_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  site_name text,
  priority text not null default 'medium',
  due_date date,
  hours_to_complete numeric,
  reschedule_allowed boolean not null default false,
  has_checkpoints boolean not null default false,
  audio_url text,
  document_url text,
  created_by text,
  assigned_to text,
  assigned_at timestamptz,
  task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists weekly_task_drafts_due_idx on public.weekly_task_drafts (due_date);
create index if not exists weekly_task_drafts_assigned_idx on public.weekly_task_drafts (assigned_to);

alter table public.weekly_task_drafts enable row level security;

drop policy if exists "weekly_task_drafts_all" on public.weekly_task_drafts;
create policy "weekly_task_drafts_all"
  on public.weekly_task_drafts for all using (true) with check (true);

grant select, insert, update, delete on public.weekly_task_drafts to anon, authenticated;

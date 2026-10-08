-- Half-day leave + what happens to the applicant's tasks during leave.
alter table public.leaves
  add column if not exists is_half_day boolean not null default false,
  add column if not exists half_day_period text,        -- 'first' (until 2 PM) | 'second' (from 2 PM)
  add column if not exists leave_days numeric,          -- 0.5 for half day
  add column if not exists task_action text;            -- 'proxy' | 'reschedule' | 'hold'

-- Make PostgREST pick up the new columns immediately.
notify pgrst, 'reload schema';

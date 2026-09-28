-- HR expense records. Safe to re-run.
create table if not exists public.hr_expenses (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  employee_name text,
  expense_date date,
  category text,
  amount numeric,
  status text default 'Pending',
  description text,
  proof_url text,
  proof_name text,
  created_at timestamptz not null default now()
);

alter table public.hr_expenses enable row level security;

drop policy if exists hr_expenses_all on public.hr_expenses;
create policy hr_expenses_all
  on public.hr_expenses
  for all
  using (true)
  with check (true);

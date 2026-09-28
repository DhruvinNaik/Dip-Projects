-- HR insurance policies. Safe to re-run.
create table if not exists public.hr_insurance (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  employee_name text,
  insurance_type text,
  provider text,
  policy_no text,
  sum_insured numeric,
  premium numeric,
  start_date date,
  renewal_date date,
  ayushman_no text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.hr_insurance enable row level security;

drop policy if exists hr_insurance_all on public.hr_insurance;
create policy hr_insurance_all
  on public.hr_insurance
  for all
  using (true)
  with check (true);

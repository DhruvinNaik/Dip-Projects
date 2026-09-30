-- Extra HR fields for employees. Login fields stay on user_details.
-- Safe to re-run.
create table if not exists public.hr_employee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_name text not null unique,
  emp_id text,
  designation text,
  phone text,
  email text,
  dob date,
  joining_date date,
  company text,
  emp_type text,
  salary text,
  increment text,
  manager text,
  blood_group text,
  emergency text,
  pf_no text,
  esic_no text,
  bank text,
  ifsc text,
  acc_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_employee_profiles enable row level security;

drop policy if exists hr_employee_profiles_all on public.hr_employee_profiles;
create policy hr_employee_profiles_all
  on public.hr_employee_profiles
  for all
  using (true)
  with check (true);

-- HR asset records. Safe to re-run.
create table if not exists public.hr_assets (
  id uuid primary key default gen_random_uuid(),
  asset_name text,
  asset_type text,
  serial_no text,
  user_name text,
  employee_name text,
  assign_date date,
  condition text,
  purchase_value numeric,
  status text default 'Available',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.hr_assets enable row level security;

drop policy if exists hr_assets_all on public.hr_assets;
create policy hr_assets_all
  on public.hr_assets
  for all
  using (true)
  with check (true);

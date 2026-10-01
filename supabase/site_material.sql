-- Arrived material catalog and site receipts. Safe to re-run.
create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table if not exists public.material_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.material_categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (category_id, name)
);

create table if not exists public.material_types (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.material_subcategories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (subcategory_id, name)
);

create table if not exists public.material_units (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references public.material_subcategories(id) on delete cascade,
  unit text not null,
  sort_order int not null default 0,
  unique (subcategory_id, unit)
);

create table if not exists public.site_material_arrivals (
  id uuid primary key default gen_random_uuid(),
  site_name text,
  user_name text,
  recorded_by text,
  category_name text not null,
  subcategory_name text not null,
  type_name text not null,
  quantity numeric not null,
  unit text not null,
  created_at timestamptz not null default now()
);

alter table public.material_categories enable row level security;
alter table public.material_subcategories enable row level security;
alter table public.material_types enable row level security;
alter table public.material_units enable row level security;
alter table public.site_material_arrivals add column if not exists bill_url text;

alter table public.site_material_arrivals enable row level security;

drop policy if exists material_categories_all on public.material_categories;
create policy material_categories_all on public.material_categories for all using (true) with check (true);

drop policy if exists material_subcategories_all on public.material_subcategories;
create policy material_subcategories_all on public.material_subcategories for all using (true) with check (true);

drop policy if exists material_types_all on public.material_types;
create policy material_types_all on public.material_types for all using (true) with check (true);

drop policy if exists material_units_all on public.material_units;
create policy material_units_all on public.material_units for all using (true) with check (true);

drop policy if exists site_material_arrivals_all on public.site_material_arrivals;
create policy site_material_arrivals_all on public.site_material_arrivals for all using (true) with check (true);

insert into public.material_categories (name, sort_order)
values ('Civil', 1), ('Electric', 2), ('Plumbing', 3), ('Flooring', 4), ('Furniture', 5)
on conflict (name) do nothing;

insert into public.material_subcategories (category_id, name, sort_order)
select c.id, v.name, v.sort_order
from public.material_categories c
join (values
  ('Civil', 'Cement', 1),
  ('Civil', 'Sand', 2),
  ('Civil', 'Aggregate', 3),
  ('Civil', 'Steel', 4),
  ('Flooring', 'Tiles', 1),
  ('Flooring', 'Tiles adhesive', 2),
  ('Flooring', 'Stone', 3),
  ('Furniture', 'Ply', 1),
  ('Furniture', 'Fevicol', 2),
  ('Furniture', 'Screws', 3)
) as v(category_name, name, sort_order) on v.category_name = c.name
where not exists (
  select 1 from public.material_subcategories s
  where s.category_id = c.id and s.name = v.name
);

insert into public.material_types (subcategory_id, name, sort_order)
select s.id, v.type_name, v.sort_order
from public.material_subcategories s
join public.material_categories c on c.id = s.category_id
join (values
  ('Civil', 'Cement', 'OPC', 1),
  ('Civil', 'Cement', 'PPC', 2),
  ('Civil', 'Sand', 'White', 1),
  ('Civil', 'Sand', 'River', 2),
  ('Civil', 'Aggregate', '10', 1),
  ('Civil', 'Aggregate', '20', 2),
  ('Civil', 'Steel', '8mm', 1),
  ('Civil', 'Steel', '10mm', 2),
  ('Civil', 'Steel', '12mm', 3),
  ('Flooring', 'Tiles', '300 x 300 mm', 1),
  ('Flooring', 'Tiles', '600 x 600 mm', 2),
  ('Flooring', 'Tiles', '800 x 800 mm', 3),
  ('Flooring', 'Tiles', '600 x 1200 mm', 4),
  ('Flooring', 'Tiles', '1200 x 1200 mm', 5),
  ('Flooring', 'Tiles adhesive', 'Gray', 1),
  ('Flooring', 'Tiles adhesive', 'White', 2),
  ('Flooring', 'Stone', 'Kota', 1),
  ('Flooring', 'Stone', 'Granite', 2),
  ('Flooring', 'Stone', 'Marble', 3),
  ('Furniture', 'Ply', '12mm', 1),
  ('Furniture', 'Ply', '19mm', 2),
  ('Furniture', 'Fevicol', 'SH', 1),
  ('Furniture', 'Fevicol', 'MR', 2),
  ('Furniture', 'Fevicol', 'Hi-Per', 3),
  ('Furniture', 'Fevicol', 'Marine', 4),
  ('Furniture', 'Screws', '19mm', 1),
  ('Furniture', 'Screws', '25mm', 2),
  ('Furniture', 'Screws', '32mm', 3),
  ('Furniture', 'Screws', '38mm', 4),
  ('Furniture', 'Screws', '50mm', 5)
) as v(category_name, sub_name, type_name, sort_order)
  on v.category_name = c.name and v.sub_name = s.name
where not exists (
  select 1 from public.material_types t
  where t.subcategory_id = s.id and t.name = v.type_name
);

insert into public.material_units (subcategory_id, unit, sort_order)
select s.id, v.unit, v.sort_order
from public.material_subcategories s
join public.material_categories c on c.id = s.category_id
join (values
  ('Civil', 'Cement', 'bags', 1),
  ('Civil', 'Sand', 'kg', 1),
  ('Civil', 'Sand', 'ton', 2),
  ('Civil', 'Aggregate', 'kg', 1),
  ('Civil', 'Aggregate', 'ton', 2),
  ('Civil', 'Steel', 'ton', 1),
  ('Flooring', 'Tiles', 'box', 1),
  ('Flooring', 'Tiles', 'pieces', 2),
  ('Flooring', 'Tiles adhesive', 'bags', 1),
  ('Flooring', 'Stone', 'square feet', 1),
  ('Flooring', 'Stone', 'square meter', 2),
  ('Flooring', 'Stone', 'cube meter', 3),
  ('Flooring', 'Stone', 'cube feet', 4),
  ('Furniture', 'Ply', 'NOS', 1),
  ('Furniture', 'Fevicol', 'kg', 1),
  ('Furniture', 'Screws', 'NOS', 1),
  ('Furniture', 'Screws', 'box', 2)
) as v(category_name, sub_name, unit, sort_order)
  on v.category_name = c.name and v.sub_name = s.name
where not exists (
  select 1 from public.material_units u
  where u.subcategory_id = s.id and u.unit = v.unit
);

-- HR employee documents. Safe to re-run.
-- Renames the earlier public.documents table when that is the HR table.

do $$
begin
  if to_regclass('public.hr_documents') is null
     and to_regclass('public.documents') is not null then
    alter table public.documents rename to hr_documents;
  end if;
end $$;

create table if not exists public.hr_documents (
  id uuid primary key default gen_random_uuid(),
  user_name text,
  employee_name text,
  doc_type text,
  type text,
  name text,
  file_name text,
  file_url text,
  url text,
  document_url text,
  created_at timestamptz not null default now()
);

alter table public.hr_documents enable row level security;

drop policy if exists hr_documents_all on public.hr_documents;
create policy hr_documents_all
  on public.hr_documents
  for all
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

drop policy if exists hr_storage_select on storage.objects;
create policy hr_storage_select on storage.objects
  for select using (bucket_id = 'documents');

drop policy if exists hr_storage_insert on storage.objects;
create policy hr_storage_insert on storage.objects
  for insert with check (bucket_id = 'documents');

drop policy if exists hr_storage_update on storage.objects;
create policy hr_storage_update on storage.objects
  for update using (bucket_id = 'documents');

drop policy if exists hr_storage_delete on storage.objects;
create policy hr_storage_delete on storage.objects
  for delete using (bucket_id = 'documents');

notify pgrst, 'reload schema';

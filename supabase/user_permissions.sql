-- Permission flags on user_details (admin Permissions screen).
-- Safe to re-run.

alter table public.user_details
  add column if not exists can_add_task boolean not null default false;

alter table public.user_details
  add column if not exists can_add_site boolean not null default false;

alter table public.user_details
  add column if not exists can_add_employee boolean not null default false;

alter table public.user_details
  add column if not exists can_resolve_tickets boolean not null default false;

alter table public.user_details
  add column if not exists can_verify boolean not null default false;

alter table public.user_details
  add column if not exists is_mis_executive boolean not null default false;

alter table public.user_details
  add column if not exists can_switch_office_site boolean not null default false;

alter table public.user_details
  add column if not exists can_switch_office_mdo boolean not null default false;

comment on column public.user_details.can_add_task is 'Admin-granted: add/assign tasks';
comment on column public.user_details.can_add_site is 'Admin-granted: add sites';
comment on column public.user_details.can_add_employee is 'Admin-granted: add employees';
comment on column public.user_details.can_resolve_tickets is 'Admin-granted: resolve tickets';
comment on column public.user_details.can_verify is 'Admin-granted: verify tasks';
comment on column public.user_details.is_mis_executive is 'Admin-granted: MIS executive';
comment on column public.user_details.can_switch_office_site is 'Admin-granted: Office ↔ Site portal switch';
comment on column public.user_details.can_switch_office_mdo is 'Admin-granted: Office ↔ MDO portal switch';

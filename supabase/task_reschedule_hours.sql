alter table public.reschedule_requests
  add column if not exists requested_hours numeric(7, 2) not null default 0;

create or replace function public.apply_reschedule_request_approval()
returns trigger
language plpgsql
as $$
declare
  task_row public.tasks%rowtype;
  elapsed_seconds numeric := 0;
  remaining_hours numeric := 0;
begin
  if new.admin_note like 'Admin rescheduled directly:%' then
    return new;
  end if;

  select * into task_row
  from public.tasks
  where id = new.task_id
  for update;
  if not found then
    raise exception 'Task % was not found for reschedule request %', new.task_id, new.id;
  end if;

  elapsed_seconds := greatest(coalesce(task_row.accumulated_seconds, 0), 0);
  if task_row.accepted_at is not null
     and not coalesce(task_row.is_held, false)
     and coalesce(task_row.status, '') not in ('completed', 'not_applicable') then
    elapsed_seconds := elapsed_seconds + greatest(
      extract(epoch from (clock_timestamp() - coalesce(task_row.resumed_at, task_row.accepted_at))),
      0
    );
  end if;
  remaining_hours := greatest(
    coalesce(task_row.hours_to_complete, 0) - elapsed_seconds / 3600.0,
    0
  );

  update public.tasks
  set due_date = new.requested_date,
      hours_to_complete = remaining_hours + coalesce(new.requested_hours, 0),
      status = 'pending',
      accepted_at = null,
      resumed_at = null,
      is_held = false,
      hold_started_at = null,
      accumulated_seconds = 0
  where id = task_row.id;

  return new;
end;
$$;

drop trigger if exists apply_reschedule_request_approval on public.reschedule_requests;
create trigger apply_reschedule_request_approval
  after update of status on public.reschedule_requests
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.apply_reschedule_request_approval();
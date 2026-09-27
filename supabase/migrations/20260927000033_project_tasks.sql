-- P1-05 Crew Tasks & Milestones: light creative coordination, not a generic task manager.
-- - Tasks and milestones belong to a project. Everyone who can read the project sees them.
-- - Roles come from the project: its owner (and crew admins) manage; active crew members add tasks, take them on,
--   and move tasks they created or are assigned to. Only the owner and admins assign other people.
-- - A task can need approval: then only the owner or an admin can mark it done (others move it to Review).
-- - A task can relate to something in the project (a link), depend on another task, and have comments.

create or replace function app.project_role(p_project uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when app.owns_project(p_project) then 'owner'
    else (select m.access from public.crews c join public.crew_members m on m.crew_id = c.id
          where c.project_id = p_project and m.creator_id = app.current_creator_id() and m.status = 'active')
  end
$$;

-- People who can hold tasks in a project: its owner and active crew.
create or replace function app.is_project_person(p_project uuid, p_creator uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.projects p where p.id = p_project and p.creator_id = p_creator)
      or exists (select 1 from public.crews c join public.crew_members m on m.crew_id = c.id
                 where c.project_id = p_project and m.creator_id = p_creator and m.status = 'active')
$$;

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  due_on date,
  done_at timestamptz,
  created_by uuid references public.creators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones(project_id, due_on);
create index project_milestones_created_by_fk_idx on public.project_milestones(created_by);
create trigger project_milestones_touch before update on public.project_milestones
  for each row execute function app.touch_updated_at();

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.creators(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 4000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done', 'blocked')),
  due_on date,
  milestone_id uuid references public.project_milestones(id) on delete set null,
  item_id uuid references public.project_items(id) on delete set null,
  depends_on uuid references public.project_tasks(id) on delete set null,
  needs_approval boolean not null default false,
  approved_by uuid references public.creators(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (depends_on is null or depends_on <> id)
);
create index project_tasks_project_idx on public.project_tasks(project_id, status, due_on);
create index project_tasks_created_by_fk_idx on public.project_tasks(created_by);
create index project_tasks_milestone_id_fk_idx on public.project_tasks(milestone_id);
create index project_tasks_item_id_fk_idx on public.project_tasks(item_id);
create index project_tasks_depends_on_fk_idx on public.project_tasks(depends_on);
create index project_tasks_approved_by_fk_idx on public.project_tasks(approved_by);
create trigger project_tasks_touch before update on public.project_tasks
  for each row execute function app.touch_updated_at();

create table public.project_task_assignees (
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  assigned_by uuid references public.creators(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, creator_id)
);
create index project_task_assignees_creator_idx on public.project_task_assignees(creator_id);
create index project_task_assignees_assigned_by_fk_idx on public.project_task_assignees(assigned_by);

create table public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  creator_id uuid references public.creators(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index project_task_comments_task_idx on public.project_task_comments(task_id, created_at);
create index project_task_comments_creator_id_fk_idx on public.project_task_comments(creator_id);

create or replace function app.task_project(p_task uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select project_id from public.project_tasks where id = p_task $$;

create or replace function app.is_task_assignee(p_task uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.project_task_assignees a where a.task_id = p_task and a.creator_id = app.current_creator_id()) $$;

-- Integrity and the rules that RLS can't express on its own.
create or replace function app.check_project_task()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_role text := app.project_role(new.project_id);
begin
  if new.milestone_id is not null and not exists (select 1 from public.project_milestones m where m.id = new.milestone_id and m.project_id = new.project_id) then
    raise exception 'milestone is not in this project' using errcode = '22023';
  end if;
  if new.item_id is not null and not exists (select 1 from public.project_items i where i.id = new.item_id and i.project_id = new.project_id) then
    raise exception 'related item is not in this project' using errcode = '22023';
  end if;
  if new.depends_on is not null and not exists (select 1 from public.project_tasks t where t.id = new.depends_on and t.project_id = new.project_id) then
    raise exception 'dependency is not in this project' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.project_id <> old.project_id or new.created_by is distinct from old.created_by then
      raise exception 'a task stays in its project' using errcode = '42501';
    end if;
    -- Only managers change whether a task needs approval.
    if new.needs_approval is distinct from old.needs_approval and coalesce(v_role, '') not in ('owner', 'admin') then
      raise exception 'only the owner or an admin can change approval' using errcode = '42501';
    end if;
  elsif new.needs_approval and coalesce(v_role, '') not in ('owner', 'admin') then
    raise exception 'only the owner or an admin can change approval' using errcode = '42501';
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    if new.needs_approval then
      if coalesce(v_role, '') not in ('owner', 'admin') then
        raise exception 'needs approval' using errcode = '42501';
      end if;
      new.approved_by := app.current_creator_id();
    end if;
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.approved_by := null;
  end if;
  return new;
end $$;
create trigger project_tasks_check before insert or update on public.project_tasks
  for each row execute function app.check_project_task();
revoke execute on function app.check_project_task() from public, anon, authenticated;

-- RLS ------------------------------------------------------------------------------------------------------------
alter table public.project_milestones enable row level security;
create policy project_milestones_read on public.project_milestones for select to authenticated using (app.can_read_project(project_id));
create policy project_milestones_write on public.project_milestones for all to authenticated
  using (app.project_role(project_id) in ('owner', 'admin'))
  with check (app.project_role(project_id) in ('owner', 'admin'));

alter table public.project_tasks enable row level security;
create policy project_tasks_read on public.project_tasks for select to authenticated using (app.can_read_project(project_id));
create policy project_tasks_insert on public.project_tasks for insert to authenticated
  with check (created_by = app.current_creator_id() and app.project_role(project_id) is not null);
create policy project_tasks_update on public.project_tasks for update to authenticated
  using (app.project_role(project_id) in ('owner', 'admin') or (app.project_role(project_id) is not null and (created_by = app.current_creator_id() or app.is_task_assignee(id))))
  with check (app.project_role(project_id) is not null);
create policy project_tasks_delete on public.project_tasks for delete to authenticated
  using (app.project_role(project_id) in ('owner', 'admin') or (created_by = app.current_creator_id() and app.project_role(project_id) is not null));

alter table public.project_task_assignees enable row level security;
create policy task_assignees_read on public.project_task_assignees for select to authenticated using (app.can_read_project(app.task_project(task_id)));
-- Managers assign anyone in the project; everyone else can only take a task on themselves.
create policy task_assignees_insert on public.project_task_assignees for insert to authenticated
  with check (
    assigned_by = app.current_creator_id()
    and app.is_project_person(app.task_project(task_id), creator_id)
    and (app.project_role(app.task_project(task_id)) in ('owner', 'admin')
         or (creator_id = app.current_creator_id() and app.project_role(app.task_project(task_id)) is not null))
  );
create policy task_assignees_delete on public.project_task_assignees for delete to authenticated
  using (app.project_role(app.task_project(task_id)) in ('owner', 'admin') or creator_id = app.current_creator_id());

alter table public.project_task_comments enable row level security;
create policy task_comments_read on public.project_task_comments for select to authenticated using (app.can_read_project(app.task_project(task_id)));
create policy task_comments_insert on public.project_task_comments for insert to authenticated
  with check (creator_id = app.current_creator_id() and app.project_role(app.task_project(task_id)) is not null);
create policy task_comments_delete on public.project_task_comments for delete to authenticated
  using (creator_id = app.current_creator_id() or app.project_role(app.task_project(task_id)) in ('owner', 'admin'));
revoke update on public.project_task_comments from authenticated;

-- The caller's role in a project (owner, admin, member or null), for showing the right controls.
create or replace function public.project_role_of(p_project uuid)
returns text language sql stable security definer set search_path = ''
as $$ select app.project_role(p_project) $$;
revoke execute on function public.project_role_of(uuid) from public, anon;
grant execute on function public.project_role_of(uuid) to authenticated;

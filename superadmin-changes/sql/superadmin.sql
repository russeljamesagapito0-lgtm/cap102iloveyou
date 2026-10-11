-- RootCare superadmin setup. Run once in the Supabase SQL Editor (after admin_setup.sql + admin_v2.sql).
-- The superadmin's ONLY job: create admin accounts and suspend/reactivate them.

-- 1. Allow the 'superadmin' role
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%role%';
  if c is not null then execute format('alter table public.profiles drop constraint %I', c); end if;
end $$;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user','admin','superadmin'));

-- 2. Helpers. A suspended admin immediately loses all admin data access (even with a live token).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'superadmin' and status = 'active');
$$;

-- 3. Nobody can change roles from the client (only the service role / SQL editor, where uid is null).
--    Admins may change status/plan only on regular users, never on admins or the superadmin.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.role := old.role;
    if not public.is_admin() then
      new.plan := old.plan; new.status := old.status;
    elsif old.role <> 'user' and old.id <> auth.uid() then
      new.plan := old.plan; new.status := old.status;
    end if;
  end if;
  return new;
end $$;

drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update
  using (id = auth.uid() or (public.is_admin() and role = 'user'));

-- 4. Superadmin login/logout can be written to the audit log (it has no read access to it).
drop policy if exists a_ins on public.audit_log;
create policy a_ins on public.audit_log for insert
  with check (public.is_admin() or public.is_superadmin());

-- 5. Create the one superadmin: add the user in Authentication -> Users, then run (replace email):
-- update public.profiles set role = 'superadmin' where email = 'superadmin@example.com';

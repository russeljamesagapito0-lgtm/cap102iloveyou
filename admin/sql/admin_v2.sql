-- Run after admin_setup.sql. Safe to re-run.

-- Keep the AI's original prediction when an admin corrects a label (useful for retraining)
alter table public.scans add column if not exists predicted_code text;

-- Audit log
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid default auth.uid() references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists a_sel on public.audit_log; drop policy if exists a_ins on public.audit_log;
create policy a_sel on public.audit_log for select using (public.is_admin());
create policy a_ins on public.audit_log for insert with check (public.is_admin());

-- Disease translations (English stays in public.diseases)
do $$
begin
  execute format(
    'create table if not exists public.disease_translations (
       disease_id %s references public.diseases(id) on delete cascade,
       lang text not null, name text, symptoms text, treatment text, prevention text,
       updated_at timestamptz default now(),
       primary key (disease_id, lang))',
    (select format_type(atttypid, atttypmod) from pg_attribute
      where attrelid = 'public.diseases'::regclass and attname = 'id'));
end $$;
alter table public.disease_translations enable row level security;
drop policy if exists t_sel on public.disease_translations; drop policy if exists t_all on public.disease_translations;
create policy t_sel on public.disease_translations for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.diseases d where d.id = disease_id and d.published));
create policy t_all on public.disease_translations for all
  using (public.is_admin()) with check (public.is_admin());

-- RootCare admin setup. Run once in Supabase SQL Editor.
-- If you already have tables with these names, adjust columns instead of re-creating.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  region text,
  plan text not null default 'free' check (plan in ('free','premium')),
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  last_active_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.diseases (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  type text,
  severity text,
  symptoms text,
  treatment text,
  prevention text,
  published boolean not null default false,
  updated_at timestamptz default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  disease_code text,            -- matches diseases.code
  confidence numeric,           -- 0..1
  image_url text,
  region text,
  flagged boolean not null default false,
  corrected boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  reply text,
  created_at timestamptz default now(),
  replied_at timestamptz
);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing auth users
insert into public.profiles (id, email, full_name)
select id, email, split_part(email,'@',1) from auth.users on conflict (id) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Non-admins can't change role/plan/status (SQL editor, uid null, is allowed)
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.plan := old.plan; new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles
  for each row execute function public.protect_profile();

-- RLS
alter table public.profiles enable row level security;
alter table public.diseases enable row level security;
alter table public.scans    enable row level security;
alter table public.feedback enable row level security;

drop policy if exists p_sel on public.profiles; drop policy if exists p_upd on public.profiles;
create policy p_sel on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy p_upd on public.profiles for update using (id = auth.uid() or public.is_admin());

drop policy if exists d_sel on public.diseases; drop policy if exists d_all on public.diseases;
create policy d_sel on public.diseases for select to anon, authenticated using (published or public.is_admin());
create policy d_all on public.diseases for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists s_sel on public.scans; drop policy if exists s_ins on public.scans; drop policy if exists s_adm on public.scans;
create policy s_sel on public.scans for select using (user_id = auth.uid() or public.is_admin());
create policy s_ins on public.scans for insert with check (user_id = auth.uid());
create policy s_adm on public.scans for update using (public.is_admin());

drop policy if exists f_sel on public.feedback; drop policy if exists f_ins on public.feedback; drop policy if exists f_adm on public.feedback;
create policy f_sel on public.feedback for select using (user_id = auth.uid() or public.is_admin());
create policy f_ins on public.feedback for insert with check (user_id = auth.uid());
create policy f_adm on public.feedback for update using (public.is_admin());

-- Dashboard stats in one call
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'totalUsers',     (select count(*) from profiles),
    'activeUsers7d',  (select count(*) from profiles where last_active_at > now() - interval '7 days'),
    'totalScans',     (select count(*) from scans),
    'scansToday',     (select count(*) from scans where created_at >= date_trunc('day', now())),
    'pendingFeedback',(select count(*) from feedback where status = 'open'),
    'flaggedScans',   (select count(*) from scans where flagged),
    'scansPerDay',    (select jsonb_agg(jsonb_build_object('day', to_char(d,'Dy'),
                        'count', (select count(*) from scans where created_at::date = d)) order by d)
                       from generate_series(current_date - 6, current_date, '1 day') d),
    'diseaseBreakdown',(select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc), '[]')
                       from (select coalesce(d.name, s.disease_code, 'Unknown') as name, count(*) c
                             from scans s left join diseases d on d.code = s.disease_code group by 1) t),
    'recent',         (select coalesce(jsonb_agg(x), '[]') from (
                        select * from (
                          select 'Scan: ' || coalesce(s.disease_code,'unknown') || ' by ' || coalesce(p.full_name,'user') as text, s.created_at
                          from scans s left join profiles p on p.id = s.user_id
                          union all
                          select 'Feedback: ' || subject, created_at from feedback
                        ) u order by created_at desc limit 6) x)
  ) into r;
  return r;
end $$;

-- Seed diseases (safe to re-run)
insert into public.diseases (code,name,type,severity,symptoms,treatment,prevention,published) values
('cassava_mosaic','Cassava Mosaic Disease','Viral','High','Yellow-green mosaic patterns on leaves, leaf distortion, stunted growth.','Remove and destroy infected plants. Use resistant varieties. Control whitefly vectors.','Plant certified disease-free cuttings. Rogue out infected plants early.',true),
('bacterial_blight','Cassava Bacterial Blight','Bacterial','High','Angular water-soaked leaf spots, wilting, gum exudate on stems.','Apply copper-based bactericide. Prune infected parts. Improve drainage.','Crop rotation. Use disease-free planting material. Avoid overhead irrigation.',true),
('brown_spot','Cassava Brown Spot','Fungal','Medium','Brown circular spots with yellow halos on older leaves.','Fungicide application. Remove severely infected leaves.','Proper spacing for airflow. Balanced fertilization. Avoid wetting foliage.',true),
('green_mite','Cassava Green Mite','Pest','Medium','Yellow speckling on leaves, tiny webs, stunted new growth.','Miticide spray. Introduce predatory mites. Neem oil application.','Monitor during dry season. Maintain plant vigor. Avoid dusty conditions.',true),
('anthracnose','Cassava Anthracnose','Fungal','Medium','Dark sunken lesions on stems, dieback of shoots, leaf spots.','Prune affected stems. Apply fungicide during wet season.','Resistant varieties. Clean tools between plants. Proper drainage.',false),
('healthy','Healthy Cassava','N/A','None','Uniform green leaves, no spots or discoloration, vigorous growth.','Continue current care routine.','Regular monitoring and good agricultural practices.',true)
on conflict (code) do nothing;

-- Make yourself admin (replace email, run after signing up / creating the user):
-- update public.profiles set role = 'admin' where email = 'you@example.com';

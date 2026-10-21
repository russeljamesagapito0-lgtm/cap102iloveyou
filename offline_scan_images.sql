-- RootCare: offline-first scan images. Run in Supabase SQL Editor. Idempotent.
-- Assumes public.is_admin() exists (admin/sql/admin_setup.sql) -> profiles.role = 'admin'.

-- 0) Schema check: confirmed against your schema dump. scans.id is uuid (the app generates UUID v4)
--    and every column the app writes already exists (image_path, image_url, disease_code,
--    confidence, accuracy, ...). No column changes are needed.

-- See which policies already exist before running section 1 (it only adds, never removes others):
--   select tablename, policyname, cmd, qual from pg_policies
--   where schemaname in ('public','storage') and tablename in ('scans','objects');
-- is_admin() comes from admin/sql/admin_setup.sql:
--   select public.is_admin();

-- 1) scans RLS: the app UPSERTs (needs UPDATE on own rows) and deletes its own rows.
--    admin_setup.sql only had select/insert for owners and update for admins.
drop policy if exists s_own_upd on public.scans;
create policy s_own_upd on public.scans for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists s_own_del on public.scans;
create policy s_own_del on public.scans for delete
  using (user_id = auth.uid() or public.is_admin());

-- 2) Bucket. Private is recommended (admin panel uses signed URLs). Leave as-is if it exists.
insert into storage.buckets (id, name, public)
values ('plant-scans', 'plant-scans', false)
on conflict (id) do nothing;
-- If you deliberately want it public instead: update storage.buckets set public = true where id = 'plant-scans';
-- and set SCAN_BUCKET_IS_PUBLIC = true in src/utils/syncManager.js.

-- 3) Storage policies on storage.objects for bucket plant-scans
drop policy if exists "plant_scans_insert_own" on storage.objects;
create policy "plant_scans_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-scans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "plant_scans_select_own" on storage.objects;
create policy "plant_scans_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'plant-scans' and (storage.foldername(name))[1] = auth.uid()::text);

-- upsert:true re-uploads over an existing object, which needs UPDATE as well
drop policy if exists "plant_scans_update_own" on storage.objects;
create policy "plant_scans_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'plant-scans' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'plant-scans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "plant_scans_delete_own" on storage.objects;
create policy "plant_scans_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-scans' and (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can read (and clean up) everything in the bucket
drop policy if exists "plant_scans_select_admin" on storage.objects;
create policy "plant_scans_select_admin" on storage.objects for select to authenticated
  using (bucket_id = 'plant-scans' and public.is_admin());

drop policy if exists "plant_scans_delete_admin" on storage.objects;
create policy "plant_scans_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-scans' and public.is_admin());

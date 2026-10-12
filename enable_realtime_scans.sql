-- Optional: instant admin updates (otherwise the admin panel polls every 10 s).
-- Realtime respects RLS, so admins only receive changes the s_sel policy lets them read.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scans'
  ) then
    alter publication supabase_realtime add table public.scans;
  end if;
end $$;

-- Server-side enforcement for suspended accounts.
-- The app signs suspended users out, but a token that was already issued stays valid
-- until it expires, so block writes in the database too. Run once in the SQL editor.

create or replace function public.is_account_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), true);
$$;

-- scans: suspended users can't add or edit scans
drop policy if exists s_ins on public.scans;
create policy s_ins on public.scans for insert
  with check (user_id = auth.uid() and public.is_account_active());

drop policy if exists s_own_upd on public.scans;
create policy s_own_upd on public.scans for update
  using (user_id = auth.uid() and public.is_account_active())
  with check (user_id = auth.uid() and public.is_account_active());

-- feedback: suspended users can't submit
drop policy if exists f_ins on public.feedback;
create policy f_ins on public.feedback for insert
  with check (user_id = auth.uid() and public.is_account_active());

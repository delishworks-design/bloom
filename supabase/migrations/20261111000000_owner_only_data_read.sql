-- PHASE 2. Apply ONLY after most partners run a version that reads bloom_shared.
-- Old partner APKs read bloom_data and will show empty views after this.
drop policy if exists "own data read" on public.bloom_data;
create policy "own data read" on public.bloom_data
  for select to authenticated using (user_id = auth.uid());

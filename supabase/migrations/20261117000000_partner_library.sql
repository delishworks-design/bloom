-- Bloom · partner's own library (read/progress track of shared books)
-- One JSONB doc per authenticated user (the follower), never the owner being read.
create table if not exists public.bloom_library (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bloom_library enable row level security;

create policy "own library read" on public.bloom_library
  for select to authenticated using (user_id = auth.uid());

create policy "own library insert" on public.bloom_library
  for insert to authenticated with check (user_id = auth.uid());

create policy "own library update" on public.bloom_library
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own library delete" on public.bloom_library
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.bloom_library to authenticated;
-- no bespoke RPC needed; upserts go through the table policies directly.

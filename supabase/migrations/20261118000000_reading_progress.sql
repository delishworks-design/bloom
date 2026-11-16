-- Bloom · per-user reading progress (daily minutes, goals, finished books)
-- One JSONB doc per authenticated user. Never shared with a partner.
create table if not exists public.bloom_reading (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.bloom_reading enable row level security;

create policy "own reading read" on public.bloom_reading
  for select to authenticated using (user_id = auth.uid());

create policy "own reading insert" on public.bloom_reading
  for insert to authenticated with check (user_id = auth.uid());

create policy "own reading update" on public.bloom_reading
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own reading delete" on public.bloom_reading
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.bloom_reading to authenticated;
-- no bespoke RPC needed; upserts go through the table policies directly.

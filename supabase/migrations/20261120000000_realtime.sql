-- Bloom · enable Supabase Realtime for the sync tables so changes propagate
-- instantly across a user's devices (polling remains as a fallback).
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bloom_data') then
    alter publication supabase_realtime add table public.bloom_data;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bloom_shared') then
    alter publication supabase_realtime add table public.bloom_shared;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bloom_library') then
    alter publication supabase_realtime add table public.bloom_library;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bloom_reading') then
    alter publication supabase_realtime add table public.bloom_reading;
  end if;
end $$;

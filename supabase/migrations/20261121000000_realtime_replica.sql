-- Bloom · Realtime needs full old-row images for RLS-filtered UPDATE events.
-- Every Bloom doc change is an UPDATE to a single row, so without this the
-- cross-device channel never delivers the new doc and devices only refresh
-- after a full sign-in (which reads the row directly).
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'bloom_data' and c.relkind = 'r') then
    alter table public.bloom_data replica identity full;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'bloom_shared' and c.relkind = 'r') then
    alter table public.bloom_shared replica identity full;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'bloom_reading' and c.relkind = 'r') then
    alter table public.bloom_reading replica identity full;
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'bloom_library' and c.relkind = 'r') then
    alter table public.bloom_library replica identity full;
  end if;
end $$;

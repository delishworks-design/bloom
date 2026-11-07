-- Bloom · partners read a filtered copy, never the private doc
create table if not exists public.bloom_shared (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.bloom_shared enable row level security;

create or replace function public.bloom_make_shared(p_doc jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare v_p jsonb := '{}'::jsonb; v_logs jsonb := '{}'::jsonb; r record; e jsonb;
begin
  if jsonb_typeof(p_doc->'p') = 'object' then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_p
      from jsonb_each(p_doc->'p')
     where key in ('name','avatar','avatarCrop','bud','waterGoal');
  end if;
  if jsonb_typeof(p_doc->'logs') = 'object' then
    for r in select key, value from jsonb_each(p_doc->'logs') loop
      if jsonb_typeof(r.value) = 'object' then
        select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into e
          from jsonb_each(r.value)
         where key in ('mood','flow','water','tags','sleep','exMin','energy');
        v_logs := v_logs || jsonb_build_object(r.key, e);
      end if;
    end loop;
  end if;
  return jsonb_build_object(
    'savedAt', coalesce(p_doc->'savedAt', '0'::jsonb),
    'p', v_p,
    'logs', v_logs,
    'tasks', case when jsonb_typeof(p_doc->'tasks') = 'array'  then p_doc->'tasks' else '[]'::jsonb end,
    'done',  case when jsonb_typeof(p_doc->'done')  = 'object' then p_doc->'done'  else '{}'::jsonb end,
    'meals', case when jsonb_typeof(p_doc->'meals') = 'object' then p_doc->'meals' else '{}'::jsonb end,
    'plan',  case when jsonb_typeof(p_doc->'plan')  = 'object' then p_doc->'plan'  else '{}'::jsonb end
  );
end $$;

create or replace function public.bloom_sync_shared()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.bloom_shared (user_id, doc, updated_at)
  values (new.user_id, public.bloom_make_shared(new.doc), now())
  on conflict (user_id) do update set doc = excluded.doc, updated_at = now();
  return null;
end $$;

drop trigger if exists bloom_sync_shared on public.bloom_data;
create trigger bloom_sync_shared after insert or update of doc on public.bloom_data
for each row execute function public.bloom_sync_shared();

create or replace function public.bloom_unshare()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.bloom_shared where user_id = old.user_id;
  return null;
end $$;

drop trigger if exists bloom_unshare on public.bloom_data;
create trigger bloom_unshare after delete on public.bloom_data
for each row execute function public.bloom_unshare();

insert into public.bloom_shared (user_id, doc, updated_at)
select user_id, public.bloom_make_shared(doc), now() from public.bloom_data
on conflict (user_id) do update set doc = excluded.doc, updated_at = now();

drop policy if exists "shared read" on public.bloom_shared;
create policy "shared read" on public.bloom_shared
  for select to authenticated
  using (user_id = auth.uid() or public.bloom_is_partner(user_id));

revoke all on public.bloom_shared from public, anon, authenticated;
grant select on public.bloom_shared to authenticated;
revoke execute on function public.bloom_make_shared(jsonb) from public, anon, authenticated;
revoke execute on function public.bloom_sync_shared() from public, anon, authenticated;
revoke execute on function public.bloom_unshare() from public, anon, authenticated;

-- Bloom · compare-and-set revisions for the dedicated sync tables
-- Mirrors the bloom_data/bloom_push_doc pattern: one JSONB doc per authenticated user,
-- a rev counter, and an RPC that refuses blind last-write-wins writes.
alter table public.bloom_reading add column if not exists rev bigint not null default 1;
alter table public.bloom_library add column if not exists rev bigint not null default 1;

create or replace function public.bloom_rev_bump()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bloom_reading_bump on public.bloom_reading;
create trigger bloom_reading_bump before update on public.bloom_reading
for each row execute function public.bloom_rev_bump();

drop trigger if exists bloom_library_bump on public.bloom_library;
create trigger bloom_library_bump before update on public.bloom_library
for each row execute function public.bloom_rev_bump();

-- bloom_push_reading(p_doc, p_base_rev)
-- Returns {status:'ok',rev} | {status:'conflict',rev,doc} | {status:'forbidden',reason}
create or replace function public.bloom_push_reading(p_doc jsonb, p_base_rev bigint)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_rev bigint; v_cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  -- reject docs that clearly belong to another account; allow legacy docs without _uid
  if (p_doc ? '_uid') and (p_doc->>'_uid') is not null
     and p_doc->>'_uid' <> auth.uid()::text then
    return jsonb_build_object('status','forbidden','reason','uid_mismatch');
  end if;

  insert into public.bloom_reading (user_id, doc) values (auth.uid(), p_doc)
  on conflict (user_id) do nothing;
  if found then
    select rev into v_rev from public.bloom_reading where user_id = auth.uid();
    return jsonb_build_object('status','ok','rev',v_rev);
  end if;

  update public.bloom_reading set doc = p_doc
   where user_id = auth.uid() and rev = p_base_rev
   returning rev into v_rev;
  if found then return jsonb_build_object('status','ok','rev',v_rev); end if;

  select rev, doc into v_cur from public.bloom_reading where user_id = auth.uid();
  return jsonb_build_object('status','conflict','rev',v_cur.rev,'doc',v_cur.doc);
end $$;

-- bloom_push_library(p_doc, p_base_rev)
-- Returns {status:'ok',rev} | {status:'conflict',rev,doc} | {status:'forbidden',reason}
create or replace function public.bloom_push_library(p_doc jsonb, p_base_rev bigint)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_rev bigint; v_cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  if (p_doc ? '_uid') and (p_doc->>'_uid') is not null
     and p_doc->>'_uid' <> auth.uid()::text then
    return jsonb_build_object('status','forbidden','reason','uid_mismatch');
  end if;

  insert into public.bloom_library (user_id, doc) values (auth.uid(), p_doc)
  on conflict (user_id) do nothing;
  if found then
    select rev into v_rev from public.bloom_library where user_id = auth.uid();
    return jsonb_build_object('status','ok','rev',v_rev);
  end if;

  update public.bloom_library set doc = p_doc
   where user_id = auth.uid() and rev = p_base_rev
   returning rev into v_rev;
  if found then return jsonb_build_object('status','ok','rev',v_rev); end if;

  select rev, doc into v_cur from public.bloom_library where user_id = auth.uid();
  return jsonb_build_object('status','conflict','rev',v_cur.rev,'doc',v_cur.doc);
end $$;

revoke execute on function public.bloom_push_reading(jsonb, bigint) from public, anon;
revoke execute on function public.bloom_push_library(jsonb, bigint) from public, anon;
grant execute on function public.bloom_push_reading(jsonb, bigint) to authenticated;
grant execute on function public.bloom_push_library(jsonb, bigint) to authenticated;

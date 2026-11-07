-- Bloom · revision counter for safe multi-device sync
alter table public.bloom_data add column if not exists rev bigint not null default 1;

create or replace function public.bloom_data_bump()
returns trigger language plpgsql as $$
begin
  new.rev := coalesce(old.rev, 0) + 1;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bloom_data_bump on public.bloom_data;
create trigger bloom_data_bump before update on public.bloom_data
for each row execute function public.bloom_data_bump();

-- compare-and-set push. Returns {status:'ok',rev} or {status:'conflict',rev,doc}
create or replace function public.bloom_push_doc(p_doc jsonb, p_base_rev bigint)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_rev bigint; v_cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.bloom_data (user_id, doc) values (auth.uid(), p_doc)
  on conflict (user_id) do nothing;
  if found then
    select rev into v_rev from public.bloom_data where user_id = auth.uid();
    return jsonb_build_object('status','ok','rev',v_rev);
  end if;
  update public.bloom_data set doc = p_doc
   where user_id = auth.uid() and rev = p_base_rev
   returning rev into v_rev;
  if found then return jsonb_build_object('status','ok','rev',v_rev); end if;
  select rev, doc into v_cur from public.bloom_data where user_id = auth.uid();
  return jsonb_build_object('status','conflict','rev',v_cur.rev,'doc',v_cur.doc);
end $$;

revoke execute on function public.bloom_push_doc(jsonb, bigint) from public, anon;
grant execute on function public.bloom_push_doc(jsonb, bigint) to authenticated;

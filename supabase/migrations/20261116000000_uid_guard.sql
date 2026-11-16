-- Bloom · server-side guard against docs whose _uid does not match the caller.
-- Block only when _uid is present AND mismatches. Legacy rows with no _uid still push
-- fine; the client sets _uid on all new saves and rows get the value on next sync.
create or replace function public.bloom_push_doc(p_doc jsonb, p_base_rev bigint)
returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare v_rev bigint; v_cur record;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  -- reject mismatched _uid (the follower-leak case); allow missing _uid for legacy clients
  if (p_doc ? '_uid') and (p_doc->>'_uid') is not null
     and p_doc->>'_uid' <> auth.uid()::text then
    return jsonb_build_object('status','forbidden','reason','uid_mismatch');
  end if;

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

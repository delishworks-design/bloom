-- Bloom · in-app account deletion
create or replace function public.bloom_delete_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  delete from public.bloom_redeem_attempts where user_id = v_uid;
  delete from auth.users where id = v_uid;  -- cascades to bloom_profiles, bloom_data, bloom_shared, bloom_partners (owner); partner_id is set null
end $$;
revoke execute on function public.bloom_delete_account() from public, anon;
grant execute on function public.bloom_delete_account() to authenticated;

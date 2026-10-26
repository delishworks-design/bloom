-- Bloom · persistent pairing
-- 1. the owner may read the profile of the person following them
-- 2. a follower can leave on their own (used by "Exit")
-- 3. creating a code must never unlink a live follower

create or replace function public.bloom_owns_partner(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bloom_partners p
    where p.owner_id = auth.uid()
      and p.partner_id = p_uid
      and p.revoked = false
  );
$$;

grant execute on function public.bloom_owns_partner(uuid) to authenticated;

drop policy if exists "own profile read" on public.bloom_profiles;
create policy "own profile read" on public.bloom_profiles
  for select to authenticated
  using (id = auth.uid() or public.bloom_is_partner(id) or public.bloom_owns_partner(id));

create or replace function public.bloom_create_partner_code(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_code text; v_live text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- someone is already following: keep that link, hand back its code
  select code into v_live
    from public.bloom_partners
   where owner_id = auth.uid() and partner_id is not null and revoked = false
   limit 1;
  if v_live is not null then return v_live; end if;
  v_code := upper(trim(p_code));
  -- only unclaimed codes get replaced
  delete from public.bloom_partners where owner_id = auth.uid() and partner_id is null;
  insert into public.bloom_partners (code, owner_id) values (v_code, auth.uid())
  on conflict (code) do update set owner_id = auth.uid(), partner_id = null, revoked = false;
  return v_code;
end;
$$;

create or replace function public.bloom_leave_pairing()
returns void
language sql security definer set search_path = public
as $$
  delete from public.bloom_partners where partner_id = auth.uid();
$$;

grant execute on function public.bloom_leave_pairing() to authenticated;

-- Bloom · harden partner pairing
-- 1. codes are generated on the server (client value is ignored)
-- 2. unclaimed codes expire after 24h
-- 3. redeem is atomic and rate limited

create extension if not exists pgcrypto with schema extensions;

alter table public.bloom_partners add column if not exists expires_at timestamptz;

update public.bloom_partners
   set expires_at = now() + interval '24 hours'
 where partner_id is null and expires_at is null;

create table if not exists public.bloom_redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists bloom_redeem_attempts_user_idx
  on public.bloom_redeem_attempts (user_id, at);
alter table public.bloom_redeem_attempts enable row level security;
-- intentionally no policies: only security definer functions touch this table

create or replace function public.bloom_gen_code()
returns text
language plpgsql volatile set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(8);
  s text := '';
  i int;
begin
  for i in 0..7 loop
    s := s || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return s;
end;
$$;

create or replace function public.bloom_create_partner_code(p_code text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare v_live text; v_code text; v_n int; i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- someone already follows: keep that link and return its code
  select code into v_live from public.bloom_partners
   where owner_id = auth.uid() and partner_id is not null and revoked = false
   limit 1;
  if v_live is not null then return v_live; end if;
  -- replace only unclaimed codes
  delete from public.bloom_partners
   where owner_id = auth.uid() and partner_id is null;
  for i in 1..10 loop
    v_code := public.bloom_gen_code();  -- p_code is deliberately ignored
    insert into public.bloom_partners (code, owner_id, expires_at)
    values (v_code, auth.uid(), now() + interval '24 hours')
    on conflict (code) do nothing;
    get diagnostics v_n = row_count;
    if v_n = 1 then return v_code; end if;
  end loop;
  raise exception 'could not allocate a code';
end;
$$;

create or replace function public.bloom_redeem_partner_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_code text := upper(trim(p_code)); v_fails int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.bloom_redeem_attempts where at < now() - interval '1 hour';
  select count(*) into v_fails from public.bloom_redeem_attempts
   where user_id = auth.uid() and at > now() - interval '10 minutes';
  if v_fails >= 5 then raise exception 'too many attempts'; end if;

  update public.bloom_partners
     set partner_id = auth.uid(), expires_at = null
   where code = v_code and revoked = false
     and (partner_id = auth.uid()
          or (partner_id is null and (expires_at is null or expires_at > now())))
  returning owner_id into v_owner;

  if v_owner is null then
    insert into public.bloom_redeem_attempts (user_id) values (auth.uid());
  end if;
  return v_owner;
end;
$$;

revoke all on function public.bloom_gen_code() from public, anon, authenticated;
revoke execute on function
  public.bloom_create_partner_code(text),
  public.bloom_redeem_partner_code(text),
  public.bloom_revoke_partner_codes(),
  public.bloom_leave_pairing(),
  public.bloom_owns_partner(uuid),
  public.bloom_is_partner(uuid)
from public, anon;
grant execute on function
  public.bloom_create_partner_code(text),
  public.bloom_redeem_partner_code(text),
  public.bloom_revoke_partner_codes(),
  public.bloom_leave_pairing(),
  public.bloom_owns_partner(uuid),
  public.bloom_is_partner(uuid)
to authenticated;

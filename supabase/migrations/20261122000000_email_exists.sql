-- Bloom · let the sign-up screen tell someone their email is already in use.
-- Security definer so anon callers can check without reading auth.users directly.
-- Returns only a boolean; the address itself is never exposed.
create or replace function public.bloom_email_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return false;
  end if;
  return exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
  );
end $$;

revoke all on function public.bloom_email_exists(text) from public, anon;
grant execute on function public.bloom_email_exists(text) to anon, authenticated;

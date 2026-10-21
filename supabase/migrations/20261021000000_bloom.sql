-- Bloom · PMOS Planner
-- Accounts, data sync and read-only partner sharing.
-- Run with: supabase db push --linked   (or the Management API query endpoint)

create table if not exists public.bloom_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar text,
  goals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bloom_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bloom_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid references auth.users(id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bloom_partners_code_idx on public.bloom_partners (code);
create index if not exists bloom_partners_partner_idx on public.bloom_partners (partner_id);
create index if not exists bloom_partners_owner_idx on public.bloom_partners (owner_id);

alter table public.bloom_profiles enable row level security;
alter table public.bloom_data     enable row level security;
alter table public.bloom_partners enable row level security;

-- ---------- helper: is this signed-in user a live partner of the given owner?
create or replace function public.bloom_is_partner(p_owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.bloom_partners p
    where p.owner_id = p_owner
      and p.partner_id = auth.uid()
      and p.revoked = false
  );
$$;

-- ---------- owner creates a share code
create or replace function public.bloom_create_partner_code(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  v_code := upper(trim(p_code));
  delete from public.bloom_partners where owner_id = auth.uid();
  insert into public.bloom_partners (code, owner_id) values (v_code, auth.uid())
  on conflict (code) do update set owner_id = auth.uid(), partner_id = null, revoked = false;
  return v_code;
end;
$$;

-- ---------- a partner redeems a code and claims the read-only link
create or replace function public.bloom_redeem_partner_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select owner_id into v_owner
    from public.bloom_partners
   where code = upper(trim(p_code))
     and revoked = false
     and (partner_id is null or partner_id = auth.uid())
   limit 1;
  if v_owner is null then return null; end if;
  update public.bloom_partners
     set partner_id = auth.uid()
   where code = upper(trim(p_code)) and revoked = false;
  return v_owner;
end;
$$;

-- ---------- owner revokes
create or replace function public.bloom_revoke_partner_codes()
returns void
language sql security definer set search_path = public
as $$
  delete from public.bloom_partners where owner_id = auth.uid();
$$;

grant execute on function public.bloom_is_partner(uuid) to authenticated;
grant execute on function public.bloom_create_partner_code(text) to authenticated;
grant execute on function public.bloom_redeem_partner_code(text) to authenticated;
grant execute on function public.bloom_revoke_partner_codes() to authenticated;

-- ---------- profiles
drop policy if exists "own profile read" on public.bloom_profiles;
create policy "own profile read" on public.bloom_profiles
  for select to authenticated
  using (id = auth.uid() or public.bloom_is_partner(id));

drop policy if exists "own profile write" on public.bloom_profiles;
create policy "own profile write" on public.bloom_profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists "own profile update" on public.bloom_profiles;
create policy "own profile update" on public.bloom_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- data doc
drop policy if exists "own data read" on public.bloom_data;
create policy "own data read" on public.bloom_data
  for select to authenticated
  using (user_id = auth.uid() or public.bloom_is_partner(user_id));

drop policy if exists "own data write" on public.bloom_data;
create policy "own data write" on public.bloom_data
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own data update" on public.bloom_data;
create policy "own data update" on public.bloom_data
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- partner links
drop policy if exists "own links read" on public.bloom_partners;
create policy "own links read" on public.bloom_partners
  for select to authenticated
  using (owner_id = auth.uid() or partner_id = auth.uid());

drop policy if exists "own links write" on public.bloom_partners;
create policy "own links write" on public.bloom_partners
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "own links delete" on public.bloom_partners;
create policy "own links delete" on public.bloom_partners
  for delete to authenticated using (owner_id = auth.uid());

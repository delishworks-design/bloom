create table if not exists public.bloom_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
create table if not exists public.bloom_ai_global (
  day date primary key,
  n int not null default 0
);
alter table public.bloom_ai_usage enable row level security;
alter table public.bloom_ai_global enable row level security;
revoke all on public.bloom_ai_usage from public, anon, authenticated;
revoke all on public.bloom_ai_global from public, anon, authenticated;

create or replace function public.bloom_ai_hit(p_user uuid, p_user_limit int, p_global_limit int)
returns text
language plpgsql security definer set search_path = public
as $$
declare d date := (now() at time zone 'utc')::date; g int; u int;
begin
  select n into g from public.bloom_ai_global where day = d;
  if coalesce(g, 0) >= p_global_limit then return 'global'; end if;
  insert into public.bloom_ai_usage (user_id, day, n) values (p_user, d, 1)
  on conflict (user_id, day) do update set n = public.bloom_ai_usage.n + 1
  returning n into u;
  if u > p_user_limit then return 'user'; end if;
  insert into public.bloom_ai_global (day, n) values (d, 1)
  on conflict (day) do update set n = public.bloom_ai_global.n + 1;
  return 'ok';
end $$;
revoke all on function public.bloom_ai_hit(uuid, int, int) from public, anon, authenticated;
grant execute on function public.bloom_ai_hit(uuid, int, int) to service_role;

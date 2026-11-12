-- Bloom · Private/Shared toggle for tasks, meals and journal
--
-- p.share on the private doc controls what the filtered copy contains:
--   absent   -> legacy default: tasks/meals/plan shared, journal private
--   'shared' -> tasks/meals/plan and journal shared
--   'private'-> cycle logs only
-- The share flag itself is included so the other side can show the state.

create or replace function public.bloom_make_shared(p_doc jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare v_p jsonb := '{}'::jsonb; v_logs jsonb := '{}'::jsonb; r record; e jsonb;
 v_share text := coalesce(p_doc->'p'->>'share', '');
 v_tasks boolean := v_share <> 'private';
 v_meals boolean := v_share <> 'private';
 v_journal boolean := v_share = 'shared';
begin
  if jsonb_typeof(p_doc->'p') = 'object' then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_p
      from jsonb_each(p_doc->'p')
     where key in ('name','avatar','avatarCrop','bud','waterGoal','share');
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
    'tasks', case when v_tasks and jsonb_typeof(p_doc->'tasks') = 'array' then p_doc->'tasks' else '[]'::jsonb end,
    'done',  case when v_tasks and jsonb_typeof(p_doc->'done')  = 'object' then p_doc->'done'  else '{}'::jsonb end,
    'meals', case when v_meals and jsonb_typeof(p_doc->'meals') = 'object' then p_doc->'meals' else '{}'::jsonb end,
    'plan',  case when v_meals and jsonb_typeof(p_doc->'plan')  = 'object' then p_doc->'plan'  else '{}'::jsonb end,
    'journal', case when v_journal and jsonb_typeof(p_doc->'journal') = 'array' then p_doc->'journal' else '[]'::jsonb end
  );
end $$;

-- the owner may also read the filtered copy of the person following them
drop policy if exists "shared read" on public.bloom_shared;
create policy "shared read" on public.bloom_shared
  for select to authenticated
  using (user_id = auth.uid() or public.bloom_is_partner(user_id) or public.bloom_owns_partner(user_id));

-- rebuild existing filtered copies so the new flag and journal rules apply
update public.bloom_shared s
   set doc = public.bloom_make_shared(d.doc)
  from public.bloom_data d
 where d.user_id = s.user_id;

revoke execute on function public.bloom_make_shared(jsonb) from public, anon, authenticated;

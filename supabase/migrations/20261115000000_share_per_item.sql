-- Bloom · per-item sharing: tasks, meals and journal each have their own switch
--
-- p.share on the private doc may be:
--   object   -> {"tasks":bool,"meals":bool,"journal":bool}; missing keys fall back
--   'shared' -> legacy: tasks/meals/plan and journal shared
--   'private'-> legacy: cycle logs only
--   absent   -> legacy default: tasks/meals/plan shared, journal private
-- The flag itself is included in the filtered copy so both sides can render it.

create or replace function public.bloom_make_shared(p_doc jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare v_p jsonb := '{}'::jsonb; v_logs jsonb := '{}'::jsonb; r record; e jsonb;
 v_share jsonb := p_doc->'p'->'share';
 v_str text := '';
 v_tasks boolean;
 v_meals boolean;
 v_journal boolean;
begin
  if jsonb_typeof(v_share) = 'object' then
    v_tasks := case
      when jsonb_typeof(v_share->'tasks') = 'boolean' then (v_share->>'tasks')::boolean
      when v_share->>'tasks' in ('true','false') then (v_share->>'tasks')::boolean
      else true end;
    v_meals := case
      when jsonb_typeof(v_share->'meals') = 'boolean' then (v_share->>'meals')::boolean
      when v_share->>'meals' in ('true','false') then (v_share->>'meals')::boolean
      else true end;
    v_journal := case
      when jsonb_typeof(v_share->'journal') = 'boolean' then (v_share->>'journal')::boolean
      when v_share->>'journal' in ('true','false') then (v_share->>'journal')::boolean
      else false end;
  else
    v_str := coalesce(p_doc->'p'->>'share', '');
    v_tasks := v_str <> 'private';
    v_meals := v_str <> 'private';
    v_journal := v_str = 'shared';
  end if;

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

-- rebuild existing filtered copies so per-item flags apply immediately
update public.bloom_shared s
   set doc = public.bloom_make_shared(d.doc), updated_at = now()
  from public.bloom_data d
 where d.user_id = s.user_id;

revoke execute on function public.bloom_make_shared(jsonb) from public, anon, authenticated;

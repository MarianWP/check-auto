-- Лёгкая синхронізація: клієнт відправляє лише змінені огляди, а з хмари завантажує рядки,
-- змінені після свого курсора (synced_at). Індекс робить таке читання дешевим.
-- Успішний запис повертає лише службові поля (без знімка чек-листа, моделі й відповідей):
-- клієнту потрібна тільки нова ревізія. При конфлікті, як і раніше, повертається весь рядок.
-- Клієнт працює і до цієї міграції, і після неї.
create index if not exists inspections_user_synced_idx on public.inspections(user_id, synced_at);

create or replace function public.sync_inspection(p_id text, p_base_revision bigint, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  existing public.inspections%rowtype;
  result public.inspections%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or length(p_id) not between 1 and 40 or p_base_revision is null or p_base_revision < 0 then raise exception 'Invalid record'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id, 0));
  select * into existing from public.inspections where id = p_id;
  if found and existing.user_id <> owner_id then raise exception 'Record belongs to another account' using errcode = '42501'; end if;
  if existing.id is not null and (existing.revision <> p_base_revision or existing.deleted_at is not null) then
    return jsonb_build_object('conflict', true, 'row', to_jsonb(existing));
  end if;
  if existing.id is null and p_base_revision <> 0 then raise exception 'Missing base revision'; end if;
  if p_record is not null and (jsonb_typeof(p_record) <> 'object' or jsonb_typeof(p_record->'cfg') is distinct from 'object'
      or jsonb_typeof(p_record->'answers') is distinct from 'object' or octet_length(p_record::text) > 2000000) then
    raise exception 'Invalid payload';
  end if;
  if p_record is null then
    if existing.id is null then
      insert into public.inspections(id, user_id, cfg, deleted_at) values(p_id, owner_id, '{}'::jsonb, now()) returning * into result;
    else
      update public.inspections set deleted_at = now(), revision = revision + 1, synced_at = now()
        where id = p_id returning * into result;
    end if;
  else
    insert into public.inspections(id, user_id, model, name, price, cfg, answers, stage, done, created_at, updated_at,
      checklist_snapshot, price_snapshot, model_snapshot, report_version, revision)
    values(p_id, owner_id, coalesce(p_record->>'model', 'golf5'), left(coalesce(p_record->>'name', ''), 60),
      greatest(0, (p_record->>'price')::integer), p_record->'cfg', p_record->'answers', greatest(0, (p_record->>'stage')::integer),
      coalesce((p_record->>'done')::boolean, false), (p_record->>'created_at')::timestamptz, (p_record->>'updated_at')::timestamptz,
      p_record->'checklist_snapshot', p_record->'price_snapshot', p_record->'model_snapshot', 1, coalesce(existing.revision, 0) + 1)
    on conflict(id) do update set model = excluded.model, name = excluded.name, price = excluded.price,
      cfg = excluded.cfg, answers = excluded.answers, stage = excluded.stage, done = excluded.done,
      updated_at = excluded.updated_at, checklist_snapshot = excluded.checklist_snapshot,
      price_snapshot = excluded.price_snapshot, model_snapshot = excluded.model_snapshot, report_version = excluded.report_version,
      revision = excluded.revision, synced_at = now()
    returning * into result;
  end if;
  return jsonb_build_object('conflict', false, 'row', jsonb_build_object('id', result.id, 'revision', result.revision,
    'deleted_at', result.deleted_at, 'synced_at', result.synced_at));
end $$;
revoke all on function public.sync_inspection(text, bigint, jsonb) from public, anon;
grant execute on function public.sync_inspection(text, bigint, jsonb) to authenticated;

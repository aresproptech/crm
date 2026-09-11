CREATE OR REPLACE FUNCTION public.crm_prepare_opportunity_contact()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  current_actor_id bigint := public.crm_current_profile_id();
  current_actor_name text := public.crm_current_name();
begin
  if tg_op = 'UPDATE' then
    if new.opportunity_id is distinct from old.opportunity_id then
      raise exception 'No se puede mover una actividad a otro lead' using errcode = '22023';
    end if;

    if old.event_type not in ('legacy', 'valuation', 'rg') then
      raise exception 'Los eventos de auditoría son inmutables' using errcode = '22023';
    end if;

    if old.event_type <> 'legacy' and new.event_type is distinct from old.event_type then
      raise exception 'No se puede cambiar el tipo de una actividad' using errcode = '22023';
    end if;
  end if;

  if new.event_type is null or new.event_type = 'legacy' then
    new.event_type := case
      when btrim(coalesce(new.memo, '')) ilike '[VALORACION]%' then 'valuation'
      when btrim(coalesce(new.memo, '')) ilike '[R.G.]%' then 'rg'
      when btrim(coalesce(new.memo, '')) ilike '[NOTA]%' then 'note'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una valoración%' then 'valuation_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una r.g.%' then 'rg_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%agregó una visita%' then 'visit_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó una visita%' then 'visit_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%agregó un encargo%' then 'order_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%editó un encargo%' then 'order_updated'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%cambió fase%' then 'phase_changed'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%llamó al lead%' then 'call'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%importó el lead%' then 'lead_imported'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%creó el lead%' then 'lead_created'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%'
        and lower(new.memo) like '%eliminó el lead%' then 'lead_deleted'
      when btrim(coalesce(new.memo, '')) ilike '[HISTORIAL]%' then 'activity'
      else 'legacy'
    end;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb);

  if current_actor_id is not null then
    new.actor_profile_id := current_actor_id;
  end if;

  if current_actor_name is not null then
    new.metadata := new.metadata || jsonb_build_object('actor_name', current_actor_name);
  end if;

  if
    tg_op = 'UPDATE'
    and new.fecha is distinct from old.fecha
    and new.effective_at is not distinct from old.effective_at
  then
    new.effective_at := case
      when new.fecha is not null then new.fecha::timestamp at time zone 'Europe/Madrid'
      else now()
    end;
  elsif new.effective_at is null then
    new.effective_at := case
      when new.fecha is not null then new.fecha::timestamp at time zone 'Europe/Madrid'
      else now()
    end;
  end if;

  new.updated_at := now();
  return new;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_prepare_opportunity_contact"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_prepare_opportunity_contact"() FROM PUBLIC;

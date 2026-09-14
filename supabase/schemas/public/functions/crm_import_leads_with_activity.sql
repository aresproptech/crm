CREATE OR REPLACE FUNCTION public.crm_import_leads_with_activity (
  p_rows jsonb
)
  RETURNS bigint[]
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO ''
  AS $function$
declare
  row_data jsonb;
  saved_opportunity_id bigint;
  saved_ids bigint[] := '{}'::bigint[];
  row_count integer;
begin
  if auth.uid() is null or public.crm_current_role() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'La importación debe contener una lista de leads' using errcode = '22023';
  end if;

  row_count := jsonb_array_length(p_rows);

  if row_count = 0 then
    raise exception 'No hay leads para importar' using errcode = '22023';
  end if;

  if row_count > 5000 then
    raise exception 'La importación no puede superar 5000 leads por archivo' using errcode = '22023';
  end if;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    saved_opportunity_id := public.crm_create_lead_with_activity(
      row_data,
      'lead_imported'
    );
    saved_ids := array_append(saved_ids, saved_opportunity_id);
  end loop;

  return saved_ids;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_import_leads_with_activity"(jsonb) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_import_leads_with_activity"(jsonb) FROM PUBLIC;

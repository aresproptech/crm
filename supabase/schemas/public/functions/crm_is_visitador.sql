CREATE OR REPLACE FUNCTION public.crm_is_visitador()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select public.crm_current_role() = 'comercial'
    and lower(btrim(coalesce(public.crm_current_name(), ''))) in ('gonza', 'gonzalo')
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_is_visitador"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_is_visitador"() FROM PUBLIC;

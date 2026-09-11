CREATE OR REPLACE FUNCTION public.crm_current_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select lower(btrim(p.rol))
  from public.profiles p
  where p.auth_id = auth.uid()
    and coalesce(p.enabled, true)
  limit 1
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_current_role"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_current_role"() FROM PUBLIC;

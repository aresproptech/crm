CREATE OR REPLACE FUNCTION public.crm_can_manage_visits()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.auth_id = auth.uid()
      and coalesce(p.enabled, true)
      and lower(btrim(coalesce(p.rol, ''))) = 'comercial'
      and p.can_manage_visits
  )
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_can_manage_visits"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_can_manage_visits"() FROM PUBLIC;

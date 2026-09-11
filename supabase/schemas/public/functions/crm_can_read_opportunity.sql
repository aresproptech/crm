CREATE OR REPLACE FUNCTION public.crm_can_read_opportunity (
  target_id bigint
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_id
      and o.deleted_at is null
      and (
        public.crm_current_role() in ('admin', 'coordinador')
        or public.crm_is_visitador()
        or (
          public.crm_current_role() = 'comercial'
          and (
            (o.comercial_user_id is not null
              and o.comercial_user_id = public.crm_current_profile_id())
            or
            (o.comercial_user_id is null
              and lower(btrim(coalesce(o.comercial_user_desc, ''))) =
                  lower(btrim(coalesce(public.crm_current_name(), ''))))
          )
        )
      )
  )
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_can_read_opportunity"(bigint) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_can_read_opportunity"(bigint) FROM PUBLIC;

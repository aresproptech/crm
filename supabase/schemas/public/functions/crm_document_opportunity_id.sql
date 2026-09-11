CREATE OR REPLACE FUNCTION public.crm_document_opportunity_id (
  object_name text
)
  RETURNS bigint
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
begin
  return nullif(split_part(object_name, '/', 1), '')::bigint;
exception when invalid_text_representation or numeric_value_out_of_range then
  return null;
end
$function$;

GRANT EXECUTE ON FUNCTION "public"."crm_document_opportunity_id"(text) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."crm_document_opportunity_id"(text) FROM PUBLIC;

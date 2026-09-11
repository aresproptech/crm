CREATE OR REPLACE FUNCTION public.get_current_user_name()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
DECLARE
  user_name text;
BEGIN
  SELECT name INTO user_name
  FROM users
  WHERE auth_id = auth.uid();
  RETURN user_name;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_current_user_name"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_current_user_name"() FROM PUBLIC;

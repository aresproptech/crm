CREATE OR REPLACE FUNCTION public.get_current_user_role()
  RETURNS text
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
DECLARE
  user_role text;
BEGIN
  SELECT rol INTO user_role
  FROM users
  WHERE auth_id = auth.uid();
  RETURN user_role;
END;
$function$;

GRANT EXECUTE ON FUNCTION "public"."get_current_user_role"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."get_current_user_role"() FROM PUBLIC;

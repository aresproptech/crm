CREATE SEQUENCE "public"."visitas_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."visitas_id_seq" TO "postgres", "service_role";

REVOKE ALL ON SEQUENCE "public"."visitas_id_seq" FROM "authenticated";

GRANT SELECT, USAGE ON SEQUENCE "public"."visitas_id_seq" TO "authenticated";

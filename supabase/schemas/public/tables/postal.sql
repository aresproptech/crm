CREATE TABLE "public"."postal" (
  "id"           bigint                      NOT NULL,
  "provincia_id" bigint,
  "provincia"    text,
  "distrito"     text,
  "created_at"   timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "postal_id_key" UNIQUE (id),
  CONSTRAINT "postal_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."postal"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_manage" ON "public"."postal"
  FOR ALL
  TO "authenticated"
  USING ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text])))
  WITH CHECK ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text])));

CREATE POLICY "catalog_read" ON "public"."postal"
  FOR SELECT
  TO "authenticated"
  USING ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text, 'comercial'::text])));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."postal" TO "appsheet_user";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."postal" TO "postgres", "service_role";

COMMENT ON TABLE "public"."postal" IS 'Tipos de Códigos Postales';

REVOKE ALL ON TABLE "public"."postal" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."postal" TO "authenticated";

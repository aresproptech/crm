CREATE TABLE "public"."lookups" (
  "id"          bigint                      GENERATED ALWAYS AS IDENTITY NOT NULL,
  "category"    character varying(100)      NOT NULL,
  "code"        character varying(100)      NOT NULL,
  "name"        character varying(255)      NOT NULL,
  "description" character varying(500),
  "sort_order"  integer                     DEFAULT 0,
  "is_active"   boolean                     DEFAULT true,
  "created_at"  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lookups_pkey" PRIMARY KEY (id),
  CONSTRAINT "uq_lookups_category_code" UNIQUE (category, code)
);

ALTER TABLE "public"."lookups"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_manage" ON "public"."lookups"
  FOR ALL
  TO "authenticated"
  USING ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text])))
  WITH CHECK ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text])));

CREATE POLICY "catalog_read" ON "public"."lookups"
  FOR SELECT
  TO "authenticated"
  USING ((public.crm_current_role() = ANY (ARRAY['admin'::text, 'coordinador'::text, 'comercial'::text])));

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."lookups" TO "appsheet_user";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."lookups" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."lookups" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."lookups" TO "authenticated";
